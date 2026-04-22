import { useState, useEffect } from "react";
import { Download, Bell, X, BellRing } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";

// ─── PWA Install + Notification prompt ───────────────────────────────────────

export function PWAPrompt() {
  const { language } = useLanguage();
  const ar = language === "ar";

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showNotifBanner, setShowNotifBanner] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  // ── Detect standalone mode ───────────────────────────────────────────────
  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(standalone);
  }, []);

  // ── Capture beforeinstallprompt ─────────────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // ── Show install banner after 4s if not already installed ───────────────
  useEffect(() => {
    if (isStandalone) return;
    const dismissed = sessionStorage.getItem("pwa_install_dismissed");
    if (dismissed) return;

    const timer = setTimeout(() => {
      setShowInstallBanner(true);
    }, 4000);
    return () => clearTimeout(timer);
  }, [isStandalone]);

  // ── Show notification banner after 7s if permission not decided ─────────
  useEffect(() => {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "default") return;
    const dismissed = sessionStorage.getItem("notif_banner_dismissed");
    if (dismissed) return;

    const timer = setTimeout(() => {
      setShowNotifBanner(true);
    }, 7000);
    return () => clearTimeout(timer);
  }, []);

  // ── Install handler ──────────────────────────────────────────────────────
  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setDeferredPrompt(null);
        setShowInstallBanner(false);
      }
    } else {
      // Fallback: show browser guide
      const msg = ar
        ? "لتثبيت التطبيق: اضغط على قائمة المتصفح ← \"إضافة إلى الشاشة الرئيسية\""
        : 'To install: tap the browser menu → "Add to Home Screen"';
      alert(msg);
      setShowInstallBanner(false);
    }
    sessionStorage.setItem("pwa_install_dismissed", "1");
  };

  const dismissInstall = () => {
    setShowInstallBanner(false);
    sessionStorage.setItem("pwa_install_dismissed", "1");
  };

  // ── Notification handler ─────────────────────────────────────────────────
  const handleEnableNotif = async () => {
    setShowNotifBanner(false);
    sessionStorage.setItem("notif_banner_dismissed", "1");
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        // Try to subscribe to push (will succeed only if logged in & VAPID is set)
        if ("serviceWorker" in navigator && "PushManager" in window) {
          try {
            const reg = await navigator.serviceWorker.ready;
            const existing = await reg.pushManager.getSubscription();
            if (!existing) {
              const res = await fetch("/api/notifications/vapid-public-key");
              if (res.ok) {
                const { publicKey } = await res.json();
                const padding = "=".repeat((4 - (publicKey.length % 4)) % 4);
                const base64 = (publicKey + padding).replace(/-/g, "+").replace(/_/g, "/");
                const rawData = window.atob(base64);
                const keyArray = new Uint8Array(rawData.length);
                for (let i = 0; i < rawData.length; ++i) keyArray[i] = rawData.charCodeAt(i);
                await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyArray });
              }
            }
          } catch {
            // push subscription optional
          }
        }
      }
    } catch {
      // user blocked
    }
  };

  const dismissNotif = () => {
    setShowNotifBanner(false);
    sessionStorage.setItem("notif_banner_dismissed", "1");
  };

  // Don't render anything in standalone mode or if already installed
  if (isStandalone) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[9999] flex flex-col gap-2 pointer-events-none"
      dir={ar ? "rtl" : "ltr"}
    >
      {/* ── Notification Permission Banner ──────────────────────────── */}
      {showNotifBanner && Notification.permission === "default" && (
        <div className="pointer-events-auto mx-3 mb-2 rounded-2xl bg-foreground text-background shadow-2xl border border-white/10 flex items-center gap-3 px-4 py-3 animate-in slide-in-from-bottom-4 duration-300">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
            <BellRing className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-black leading-tight">
              {ar ? "تفعيل الإشعارات" : "Enable Notifications"}
            </p>
            <p className="text-[11px] text-white/60 leading-tight mt-0.5">
              {ar ? "كن أول من يعلم بالعروض والطلبات" : "Be first to know about offers & orders"}
            </p>
          </div>
          <button
            onClick={handleEnableNotif}
            className="shrink-0 h-8 px-4 rounded-xl bg-white text-black text-[11px] font-black hover:bg-white/90 active:scale-95 transition-all whitespace-nowrap"
            data-testid="button-enable-notifications"
          >
            {ar ? "تفعيل" : "Enable"}
          </button>
          <button
            onClick={dismissNotif}
            className="shrink-0 w-7 h-7 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 active:scale-95 transition-all"
            data-testid="button-dismiss-notifications"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* ── PWA Install Banner ──────────────────────────────────────── */}
      {showInstallBanner && (
        <div className="pointer-events-auto mx-3 mb-3 rounded-2xl bg-background border border-border shadow-2xl flex items-center gap-3 px-4 py-3 animate-in slide-in-from-bottom-4 duration-300">
          <div className="w-10 h-10 rounded-xl bg-foreground flex items-center justify-center shrink-0">
            <img src="/icons/icon-192x192.png" alt="عطور آر اف" className="w-8 h-8 rounded-lg object-contain" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-black text-foreground leading-tight">
              {ar ? "حمّل تطبيق عطور آر اف" : "Install عطور آر اف App"}
            </p>
            <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
              {ar ? "تجربة أسرع وأفضل على جهازك" : "Faster & better on your device"}
            </p>
          </div>
          <button
            onClick={handleInstall}
            className="shrink-0 h-8 px-4 rounded-xl bg-foreground text-background text-[11px] font-black hover:bg-foreground/90 active:scale-95 transition-all whitespace-nowrap flex items-center gap-1.5"
            data-testid="button-pwa-install"
          >
            <Download className="h-3.5 w-3.5" />
            {ar ? "تثبيت" : "Install"}
          </button>
          <button
            onClick={dismissInstall}
            className="shrink-0 w-7 h-7 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 active:scale-95 transition-all"
            data-testid="button-dismiss-install"
          >
            <X className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>
      )}
    </div>
  );
}
