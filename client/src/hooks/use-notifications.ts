import { useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

export interface AppNotification {
  _id: string;
  userId: string;
  type: "info" | "success" | "warning" | "error";
  title: string;
  body: string;
  link: string;
  icon: string;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationsData {
  notifications: AppNotification[];
  unreadCount: number;
}

// ─── URL helpers ──────────────────────────────────────────────────────────────
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

// ─── Web Push subscription ────────────────────────────────────────────────────
async function subscribeToPush(userId: string) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    if (existing) return;

    const res = await fetch("/api/notifications/vapid-public-key");
    const { publicKey } = await res.json();

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    const subJson = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
    await fetch("/api/notifications/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: subJson.endpoint,
        keys: { p256dh: subJson.keys.p256dh, auth: subJson.keys.auth },
      }),
      credentials: "include",
    });
    console.log("[Push] Subscribed to web push notifications");
  } catch (err) {
    console.warn("[Push] Could not subscribe:", err);
  }
}

// ─── Main Hook ────────────────────────────────────────────────────────────────
export function useNotifications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastRef = useRef(toast);
  const qcRef = useRef(qc);
  const userId = (user as any)?.id || (user as any)?._id;
  const userIdRef = useRef(userId);

  // Keep refs in sync without re-running connection logic
  useEffect(() => { toastRef.current = toast; });
  useEffect(() => { qcRef.current = qc; });
  useEffect(() => { userIdRef.current = userId; });

  // ── REST: fetch notifications ──────────────────────────────────────────────
  const { data } = useQuery<NotificationsData>({
    queryKey: ["/api/notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications", { credentials: "include" });
      if (!res.ok) return { notifications: [], unreadCount: 0 };
      return res.json();
    },
    enabled: !!userId,
    refetchInterval: 30_000,
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/notifications/${id}/read`, { method: "PATCH", credentials: "include" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      await fetch("/api/notifications/read-all", { method: "PATCH", credentials: "include" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  const deleteNotif = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/notifications/${id}`, { method: "DELETE", credentials: "include" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  // ── WebSocket: real-time ───────────────────────────────────────────────────
  // Stable connect function — never changes reference, uses refs for all external values
  const connectWs = useCallback(() => {
    const uid = userIdRef.current;
    if (!uid) return;
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) return;

    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "auth", userId: uid }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "notification") {
          qcRef.current.invalidateQueries({ queryKey: ["/api/notifications"] });
          toastRef.current({
            title: `${msg.icon || "🔔"} ${msg.title}`,
            description: msg.body,
            duration: 5000,
          });
        }
      } catch {
        // ignore malformed
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
      // Only reconnect if user is still logged in
      if (userIdRef.current) {
        reconnectTimer.current = setTimeout(() => connectWs(), 5000);
      }
    };

    ws.onerror = () => ws.close();
  }, []); // ← no external deps; all state accessed via refs

  // ── Web Push subscription setup ────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    if (Notification.permission === "default") {
      Notification.requestPermission().then((perm) => {
        if (perm === "granted") subscribeToPush(userId);
      });
    } else if (Notification.permission === "granted") {
      subscribeToPush(userId);
    }
  }, [userId]);

  // ── Start WebSocket connection ─────────────────────────────────────────────
  useEffect(() => {
    if (!userId) {
      // User logged out — close socket and cancel reconnect
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      wsRef.current?.close();
      wsRef.current = null;
      return;
    }
    connectWs();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [userId, connectWs]);

  return {
    notifications: data?.notifications || [],
    unreadCount: data?.unreadCount || 0,
    markRead: (id: string) => markRead.mutate(id),
    markAllRead: () => markAllRead.mutate(),
    deleteNotif: (id: string) => deleteNotif.mutate(id),
  };
}
