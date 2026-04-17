import webpush from "web-push";
import { NotificationModel, PushSubscriptionModel, UserModel } from "./models";
import type { WebSocket } from "ws";

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "BMuRKYfA848bkr9LPDIi0BiXwbgcisqOp2NPzDDDsbc2aVpx1FtvUWxQj8YsP7stW5sdIRgh45NWvLNzu7gqRnE";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "IoOFkWsX7Ga7_EQjA_cA0cxE7ChrFHENkNKpE6eyR10";
const VAPID_MAILTO = process.env.VAPID_MAILTO || "rf-purfume@outlook.com";

webpush.setVapidDetails(`mailto:${VAPID_MAILTO}`, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

export { VAPID_PUBLIC_KEY };

// ─── WebSocket Client Registry ───────────────────────────────────────────────
// Map userId → Set of active WebSocket connections
const wsClients = new Map<string, Set<WebSocket>>();

export function registerWsClient(userId: string, ws: WebSocket) {
  if (!wsClients.has(userId)) wsClients.set(userId, new Set());
  wsClients.get(userId)!.add(ws);
  ws.on("close", () => {
    wsClients.get(userId)?.delete(ws);
    if (wsClients.get(userId)?.size === 0) wsClients.delete(userId);
  });
}

/** Send a real-time WebSocket message to a user if they are online */
export function pushToUser(userId: string, payload: object) {
  const clients = wsClients.get(userId);
  if (!clients || clients.size === 0) return;
  const msg = JSON.stringify(payload);
  for (const ws of Array.from(clients)) {
    try {
      if (ws.readyState === 1 /* OPEN */) ws.send(msg);
    } catch {
      // ignore send errors
    }
  }
}

// ─── Web Push (VAPID) ─────────────────────────────────────────────────────────
/** Send a Web Push notification to all subscriptions of a user */
export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; icon?: string; tag?: string; url?: string }
) {
  try {
    const subs = await PushSubscriptionModel.find({ userId }).lean();
    const pushPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || "/icons/icon-192x192.png",
      badge: "/icons/icon-192x192.png",
      tag: payload.tag || `notif-${Date.now()}`,
      data: { url: payload.url || "/" },
    });

    const results = await Promise.allSettled(
      subs.map((sub) =>
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.keys?.p256dh ?? "", auth: sub.keys?.auth ?? "" },
          },
          pushPayload
        )
      )
    );

    // Remove expired/invalid subscriptions (410 Gone, 404 Not Found)
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === "rejected") {
        const err = result.reason as any;
        const statusCode = err?.statusCode;
        if (statusCode === 410 || statusCode === 404) {
          await PushSubscriptionModel.deleteOne({ endpoint: subs[i].endpoint });
          console.log(`[Push] Removed expired subscription: ${subs[i].endpoint.slice(0, 40)}...`);
        }
      }
    }
  } catch (err: any) {
    console.error("[Push] sendPushToUser error:", err?.message);
  }
}

// ─── Core Entry Point ─────────────────────────────────────────────────────────
export interface NotifyOptions {
  type?: "info" | "success" | "warning" | "error";
  link?: string;
  icon?: string;
  webPush?: boolean;
}

/**
 * fireNotify — the single entry point for all notifications.
 * Saves to DB + sends WebSocket + sends Web Push simultaneously.
 */
export async function fireNotify(
  userId: string,
  title: string,
  body: string,
  opts: NotifyOptions = {}
) {
  const { type = "info", link = "", icon = "🔔", webPush = true } = opts;

  // Layer 1: Persist to DB
  let notifId: string | undefined;
  try {
    const notif = await NotificationModel.create({ userId, type, title, body, link, icon });
    notifId = notif._id?.toString();
  } catch (err: any) {
    console.error("[Notify] DB save failed:", err?.message);
  }

  // Layer 2: Real-time WebSocket (if user is online)
  pushToUser(userId, {
    type: "notification",
    id: notifId,
    notifType: type,
    title,
    body,
    link,
    icon,
    createdAt: new Date().toISOString(),
  });

  // Layer 3: Web Push (even if app is closed)
  if (webPush) {
    await sendPushToUser(userId, { title, body, icon, url: link, tag: `notif-${notifId}` });
  }
}

/**
 * fireNotifyAdmins — notify all admins and supervisors at once.
 */
export async function fireNotifyAdmins(
  title: string,
  body: string,
  opts: NotifyOptions = {}
) {
  try {
    const admins = await UserModel.find({
      role: { $in: ["admin", "employee", "accountant", "support"] },
      isActive: true,
    }).select("_id").lean();

    await Promise.allSettled(
      admins.map((a) => fireNotify(a._id.toString(), title, body, opts))
    );
  } catch (err: any) {
    console.error("[Notify] fireNotifyAdmins error:", err?.message);
  }
}
