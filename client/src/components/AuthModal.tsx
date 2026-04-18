import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff, X } from "lucide-react";
import { useLocation } from "wouter";

const logoImg = "/images/logos/logo-light-nobg.png";

declare global {
  interface Window {
    google?: any;
    AppleID?: any;
  }
}

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: "login" | "register";
}

export function AuthModal({ open, onOpenChange, defaultTab = "login" }: AuthModalProps) {
  const [tab, setTab] = useState<"login" | "register">(defaultTab);
  const { login, register, isLoggingIn, isRegistering } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [socialLoading, setSocialLoading] = useState<"google" | "apple" | null>(null);

  const lastCheckedPhone = useRef<string | null>(null);
  const [googleEnabled, setGoogleEnabled] = useState(false);

  useEffect(() => {
    setTab(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    if (!open) {
      setPhone("");
      setName("");
      setEmail("");
      setPassword("");
      setShowPassword(false);
      setIsStaff(false);
      setSocialLoading(null);
      return;
    }
    fetch("/api/auth/google/init")
      .then(r => r.ok ? r.json() : null)
      .then(d => setGoogleEnabled(!!d?.enabled))
      .catch(() => setGoogleEnabled(false));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("auth_success")) {
      toast({ title: "مرحباً", description: "تم الدخول بنجاح" });
      window.history.replaceState({}, "", window.location.pathname);
      onOpenChange(false);
      window.location.reload();
    } else if (params.get("auth_error")) {
      const err = params.get("auth_error");
      toast({ title: "فشل تسجيل الدخول", description: `خطأ: ${err}`, variant: "destructive" });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [open, toast, onOpenChange]);

  const handleGoogleSignIn = () => {
    if (!googleEnabled) {
      toast({ title: "غير متاح", description: "تسجيل الدخول بجوجل غير مفعّل — تأكد من إعدادات OAuth", variant: "destructive" });
      return;
    }
    setSocialLoading("google");
    window.location.href = "/api/auth/google/start";
  };

  const handleAppleSignIn = async () => {
    setSocialLoading("apple");
    try {
      const res = await fetch("/api/auth/apple/init", { credentials: "include" });
      const config = await res.json();

      if (!config.clientId) {
        toast({ title: "غير متاح حالياً", description: "تسجيل الدخول بأبل غير مفعّل بعد", variant: "destructive" });
        setSocialLoading(null);
        return;
      }

      if (!window.AppleID) {
        const script = document.createElement("script");
        script.src = "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";
        script.async = true;
        await new Promise<void>((resolve, reject) => {
          script.onload = () => resolve();
          script.onerror = () => reject();
          document.head.appendChild(script);
        });
      }

      window.AppleID.auth.init({
        clientId: config.clientId,
        scope: "name email",
        redirectURI: config.redirectURI,
        usePopup: true,
      });

      const appleResponse = await window.AppleID.auth.signIn();
      const serverRes = await fetch("/api/auth/apple", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_token: appleResponse.authorization.id_token,
          user: appleResponse.user,
        }),
        credentials: "include",
      });
      const data = await serverRes.json();
      if (!serverRes.ok) {
        toast({ title: "خطأ", description: data.message || "فشل تسجيل الدخول بأبل", variant: "destructive" });
        return;
      }
      toast({ title: "مرحباً", description: "تم الدخول بنجاح" });
      onOpenChange(false);
      window.location.reload();
    } catch (err: any) {
      if (err?.error !== "popup_closed_by_user") {
        toast({ title: "خطأ", description: "فشل تسجيل الدخول بأبل", variant: "destructive" });
      }
    } finally {
      setSocialLoading(null);
    }
  };

  const formatPhone = (val: string) => {
    let clean = val.replace(/\D/g, "");
    if (clean.startsWith("966")) clean = clean.substring(3);
    if (clean.startsWith("0")) clean = clean.substring(1);
    if (clean.length > 0 && !clean.startsWith("5")) clean = "";
    return clean.slice(0, 9);
  };

  const displayPhone = (val: string) => {
    if (val.length > 5) return val.slice(0, 2) + " " + val.slice(2, 5) + " " + val.slice(5);
    if (val.length > 2) return val.slice(0, 2) + " " + val.slice(2);
    return val;
  };

  useEffect(() => {
    if (phone.length === 9 && phone !== lastCheckedPhone.current) {
      lastCheckedPhone.current = phone;
      fetch(`/api/auth/check-role/${phone}`).then(r => r.ok ? r.json() : null).then(d => {
        setIsStaff(!!d?.isStaff);
      }).catch(() => setIsStaff(false));
    } else if (phone.length < 9) {
      setIsStaff(false);
    }
  }, [phone]);

  const handlePhoneLogin = () => {
    if (phone.length < 9) return;
    const pw = isStaff ? password : phone;
    login({ username: phone, password: pw }, {
      onSuccess: (userData: any) => {
        onOpenChange(false);
        if (userData?.mustChangePassword) {
          setLocation("/profile?mustChangePassword=true");
        } else {
          const redirect = userData?.redirectTo || "/";
          if (window.location.pathname !== redirect) setLocation(redirect);
        }
      },
    });
  };

  const handlePhoneRegister = () => {
    if (phone.length < 9 || !name.trim() || password.length < 6) return;
    register({
      phone, name: name.trim(), password, email: email || undefined,
      username: phone, role: "customer"
    } as any, {
      onSuccess: () => {
        toast({ title: "تم إنشاء الحساب", description: "يمكنك الآن تسجيل الدخول" });
        setTab("login");
        setPassword("");
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 rounded-2xl border-0 shadow-2xl overflow-hidden bg-white" dir="rtl">
        <DialogTitle className="sr-only">تسجيل الدخول</DialogTitle>

        <div className="px-6 pt-6 pb-2 text-center">
          <img src={logoImg} alt="رفيف العود" className="h-14 w-auto mx-auto mb-3 object-contain" />
          <div className="w-12 h-[1px] bg-gradient-to-r from-transparent via-[#c9a96e] to-transparent mx-auto" />
        </div>

        <div className="flex mx-6 bg-[#faf8f5] rounded-xl p-1 mb-4">
          <button
            onClick={() => setTab("login")}
            className={`flex-1 py-2.5 text-xs font-black rounded-lg transition-all ${tab === "login" ? "bg-white text-[#1a2744] shadow-sm" : "text-gray-700"}`}
          >
            تسجيل الدخول
          </button>
          <button
            onClick={() => setTab("register")}
            className={`flex-1 py-2.5 text-xs font-black rounded-lg transition-all ${tab === "register" ? "bg-white text-[#1a2744] shadow-sm" : "text-gray-700"}`}
          >
            حساب جديد
          </button>
        </div>

        <div className="px-6 space-y-3">
          <button
            onClick={handleAppleSignIn}
            disabled={!!socialLoading}
            className="w-full h-12 bg-black text-white rounded-xl font-bold text-sm flex items-center justify-center gap-3 hover:bg-black/90 transition-colors disabled:opacity-50"
          >
            {socialLoading === "apple" ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <svg viewBox="0 0 20 24" className="h-5 w-auto fill-white">
                  <path d="M13.23 3.02C14.28 1.71 14.94 0 14.94 0s-1.71.28-2.76 1.59c-.96 1.21-1.57 2.86-1.47 3.64.97.07 2.53-.3 3.52-2.21zM16.44 8.74c-1.77-.07-3.28 1-4.13 1-.85 0-2.14-.94-3.55-.91-1.82.03-3.5 1.06-4.43 2.71-1.9 3.28-.49 8.15 1.35 10.82.9 1.31 1.97 2.77 3.38 2.72 1.35-.05 1.86-.87 3.49-.87 1.62 0 2.09.87 3.51.84 1.46-.03 2.39-1.32 3.29-2.63.97-1.47 1.37-2.9 1.4-2.97-.03-.01-2.71-1.04-2.74-4.13-.03-2.59 2.11-3.83 2.21-3.9-1.2-1.78-3.08-1.68-3.78-1.68z"/>
                </svg>
                المتابعة مع Apple
              </>
            )}
          </button>

          <button
            onClick={handleGoogleSignIn}
            disabled={!!socialLoading}
            className="w-full h-12 bg-white border-2 border-gray-200 rounded-xl font-bold text-sm text-[#1a2744] flex items-center justify-center gap-3 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {socialLoading === "google" ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <svg viewBox="0 0 48 48" className="h-5 w-5">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                المتابعة مع Google
              </>
            )}
          </button>

          <div className="flex items-center gap-3 my-1">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-[10px] font-bold text-gray-700 uppercase tracking-widest">أو بالهاتف</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
        </div>

        <div className="px-6 pb-6 space-y-3">
          {tab === "register" && (
            <div>
              <label className="text-[10px] font-bold text-[#c9a96e] uppercase tracking-widest mb-1 block">الاسم الكامل</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="فلان الفلاني"
                className="w-full h-12 bg-[#faf8f5] border border-gray-200 rounded-xl px-4 text-sm text-[#1a2744] focus:border-[#c9a96e] focus:ring-2 focus:ring-[#c9a96e]/20 outline-none transition-all"
              />
            </div>
          )}

          <div>
            <label className="text-[10px] font-bold text-[#c9a96e] uppercase tracking-widest mb-1 block">رقم الهاتف</label>
            <div dir="ltr" className="flex items-center h-12 bg-[#faf8f5] border border-gray-200 rounded-xl px-4 focus-within:border-[#c9a96e] focus-within:ring-2 focus-within:ring-[#c9a96e]/20 transition-all">
              <span className="text-sm font-bold text-gray-700 border-r border-gray-200 pr-2 ml-2">+966</span>
              <input
                type="tel"
                value={displayPhone(phone)}
                onChange={e => setPhone(formatPhone(e.target.value))}
                onKeyDown={e => { if (e.key === "Enter" && tab === "login") handlePhoneLogin(); }}
                placeholder="5x xxx xxxx"
                maxLength={11}
                className="flex-1 h-full bg-transparent border-none outline-none text-sm font-bold tracking-wider text-[#1a2744] placeholder:text-gray-700"
              />
            </div>
          </div>

          {tab === "register" && (
            <div>
              <label className="text-[10px] font-bold text-[#c9a96e] uppercase tracking-widest mb-1 block">البريد الإلكتروني <span className="text-gray-700">(اختياري)</span></label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="example@email.com"
                dir="ltr"
                className="w-full h-12 bg-[#faf8f5] border border-gray-200 rounded-xl px-4 text-sm text-[#1a2744] focus:border-[#c9a96e] focus:ring-2 focus:ring-[#c9a96e]/20 outline-none transition-all"
              />
            </div>
          )}

          {(isStaff || tab === "register") && (
            <div>
              <label className="text-[10px] font-bold text-[#c9a96e] uppercase tracking-widest mb-1 block">كلمة المرور</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      if (tab === "login") handlePhoneLogin();
                      else handlePhoneRegister();
                    }
                  }}
                  placeholder="••••••••"
                  className="w-full h-12 bg-[#faf8f5] border border-gray-200 rounded-xl px-4 pr-12 text-sm text-[#1a2744] focus:border-[#c9a96e] focus:ring-2 focus:ring-[#c9a96e]/20 outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-700 hover:text-[#1a2744] transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          <button
            onClick={tab === "login" ? handlePhoneLogin : handlePhoneRegister}
            disabled={isLoggingIn || isRegistering || phone.length < 9 || (tab === "register" && (!name.trim() || password.length < 6))}
            className="w-full h-12 bg-[#c9a96e] text-white rounded-xl font-bold text-sm hover:bg-[#b8944f] transition-colors disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg shadow-[#c9a96e]/20"
          >
            {(isLoggingIn || isRegistering) ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : tab === "login" ? "تسجيل الدخول" : "إنشاء الحساب"}
          </button>

          <p className="text-center text-[10px] text-gray-700 pt-1">
            {tab === "login" ? (
              <>ليس لديك حساب؟ <button onClick={() => setTab("register")} className="text-[#c9a96e] font-bold hover:underline">أنشئ حساب جديد</button></>
            ) : (
              <>لديك حساب؟ <button onClick={() => setTab("login")} className="text-[#c9a96e] font-bold hover:underline">سجّل دخولك</button></>
            )}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
