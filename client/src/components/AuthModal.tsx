import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
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
  const { t, tx, language } = useLanguage();
  const isAr = language === "ar";
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

  // ─── Forgot Password flow ──────────────────────────────────────────────────
  type ForgotStep = null | "init" | "otp" | "verify" | "reset" | "done";
  const [forgotStep, setForgotStep] = useState<ForgotStep>(null);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMaskedEmail, setForgotMaskedEmail] = useState("");
  const [forgotAllowVerifyToo, setForgotAllowVerifyToo] = useState(false);
  const [forgotCode, setForgotCode] = useState("");
  const [forgotName, setForgotName] = useState("");
  const [forgotOrder, setForgotOrder] = useState("");
  const [forgotResetToken, setForgotResetToken] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");

  const resetForgotState = () => {
    setForgotStep(null);
    setForgotLoading(false);
    setForgotMaskedEmail("");
    setForgotAllowVerifyToo(false);
    setForgotCode("");
    setForgotName("");
    setForgotOrder("");
    setForgotResetToken("");
    setForgotNewPassword("");
  };

  const startForgot = async () => {
    if (phone.length < 9) {
      toast({ title: "أدخل رقم الجوال أولاً", variant: "destructive" });
      return;
    }
    setForgotLoading(true);
    try {
      const r = await fetch("/api/auth/forgot/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const d = await r.json();
      if (!r.ok) {
        toast({ title: "تعذّر بدء الاستعادة", description: d.message || "حاول مجدداً", variant: "destructive" });
        return;
      }
      if (d.method === "otp") {
        setForgotMaskedEmail(d.masked || "");
        setForgotAllowVerifyToo(!!d.allowVerify);
        setForgotStep("otp");
        toast({ title: "أُرسل الكود", description: `راجع بريدك ${d.masked || ""}` });
      } else {
        setForgotStep("verify");
      }
    } catch (e: any) {
      toast({ title: "خطأ في الشبكة", variant: "destructive" });
    } finally {
      setForgotLoading(false);
    }
  };

  const submitForgotVerify = async (payload: any) => {
    setForgotLoading(true);
    try {
      const r = await fetch("/api/auth/forgot/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, ...payload }),
      });
      const d = await r.json();
      if (!r.ok) {
        toast({ title: "فشل التحقق", description: d.message || "بيانات غير صحيحة", variant: "destructive" });
        return;
      }
      setForgotResetToken(d.resetToken);
      setForgotStep("reset");
    } catch {
      toast({ title: "خطأ في الشبكة", variant: "destructive" });
    } finally {
      setForgotLoading(false);
    }
  };

  const submitForgotReset = async () => {
    if (forgotNewPassword.length < 6) {
      toast({ title: "كلمة المرور قصيرة", description: "٦ أحرف على الأقل", variant: "destructive" });
      return;
    }
    setForgotLoading(true);
    try {
      const r = await fetch("/api/auth/forgot/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetToken: forgotResetToken, password: forgotNewPassword }),
      });
      const d = await r.json();
      if (!r.ok) {
        toast({ title: "فشل التحديث", description: d.message || "حاول مجدداً", variant: "destructive" });
        return;
      }
      toast({ title: "تم تحديث كلمة المرور", description: "سجّل دخولك الآن" });
      resetForgotState();
      setPassword(forgotNewPassword);
    } catch {
      toast({ title: "خطأ في الشبكة", variant: "destructive" });
    } finally {
      setForgotLoading(false);
    }
  };

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
      resetForgotState();
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
      <DialogContent className="max-w-md p-0 rounded-2xl border-0 shadow-2xl overflow-hidden bg-white" dir={isAr ? "rtl" : "ltr"}>
        <DialogTitle className="sr-only">{t("signIn")}</DialogTitle>

        <div className="px-6 pt-6 pb-2 text-center">
          <img src={logoImg} alt="عطور آر اف" className="h-14 w-auto mx-auto mb-3 object-contain" />
          <div className="w-12 h-[1px] bg-gradient-to-r from-transparent via-[#DFB369] to-transparent mx-auto" />
        </div>

        {/* ─── Forgot Password panels ────────────────────────────────────── */}
        {forgotStep && (
          <div className="px-6 pb-6 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={resetForgotState}
                className="text-[11px] font-bold text-gray-500 hover:text-[#2B2B60]"
                data-testid="button-forgot-back"
              >
                {isAr ? "← " : "← "}{t("back")}
              </button>
              <h3 className="text-sm font-black text-[#2B2B60]">{t("passwordRecovery")}</h3>
            </div>

            {forgotStep === "otp" && (
              <div className="space-y-3">
                <p className="text-xs text-gray-700 leading-relaxed">
                  {isAr ? <>أرسلنا كوداً مكوّناً من ٦ أرقام إلى بريدك <span className="font-bold text-[#2B2B60]">{forgotMaskedEmail}</span>. أدخله أدناه:</>
                       : <>We sent a 6-digit code to your email <span className="font-bold text-[#2B2B60]">{forgotMaskedEmail}</span>. Enter it below:</>}
                </p>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={forgotCode}
                  onChange={e => setForgotCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="------"
                  className="w-full h-14 text-center bg-[#FFFFFF] border border-gray-200 rounded-xl text-xl tracking-[0.5em] font-black text-[#2B2B60] focus:border-[#DFB369] focus:ring-2 focus:ring-[#DFB369]/20 outline-none"
                  data-testid="input-forgot-otp"
                />
                <button
                  onClick={() => submitForgotVerify({ code: forgotCode })}
                  disabled={forgotLoading || forgotCode.length !== 6}
                  className="w-full h-12 bg-[#DFB369] text-white rounded-xl font-bold text-sm hover:bg-[#c89853] disabled:opacity-40 flex items-center justify-center"
                  data-testid="button-forgot-verify-otp"
                >
                  {forgotLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : t("verifyCode")}
                </button>
                <div className="flex items-center justify-between text-[11px]">
                  <button onClick={startForgot} disabled={forgotLoading} className="text-[#DFB369] font-bold hover:underline">
                    {t("resendCode")}
                  </button>
                  {forgotAllowVerifyToo && (
                    <button onClick={() => setForgotStep("verify")} className="text-gray-600 font-bold hover:underline">
                      {t("verifyAnotherWay")}
                    </button>
                  )}
                </div>
              </div>
            )}

            {forgotStep === "verify" && (
              <div className="space-y-3">
                <p className="text-xs text-gray-700 leading-relaxed">
                  {tx("لاستعادة حسابك، أكّد هويتك بإحدى الطريقتين:", "To recover your account, verify your identity using one of these methods:")}
                </p>
                <div>
                  <label className="text-[10px] font-bold text-[#DFB369] uppercase tracking-widest mb-1 block">{t("fullNameAsAccount")}</label>
                  <input
                    type="text"
                    value={forgotName}
                    onChange={e => setForgotName(e.target.value)}
                    placeholder={t("fullNamePlaceholder")}
                    className="w-full h-12 bg-[#FFFFFF] border border-gray-200 rounded-xl px-4 text-sm text-[#2B2B60] focus:border-[#DFB369] focus:ring-2 focus:ring-[#DFB369]/20 outline-none"
                    data-testid="input-forgot-name"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-[10px] font-bold text-gray-500">{t("or")}</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[#DFB369] uppercase tracking-widest mb-1 block">{t("previousOrderNumber")}</label>
                  <input
                    type="text"
                    value={forgotOrder}
                    onChange={e => setForgotOrder(e.target.value)}
                    placeholder={tx("مثال: 123456", "e.g. 123456")}
                    className="w-full h-12 bg-[#FFFFFF] border border-gray-200 rounded-xl px-4 text-sm text-[#2B2B60] focus:border-[#DFB369] focus:ring-2 focus:ring-[#DFB369]/20 outline-none"
                    data-testid="input-forgot-order"
                  />
                </div>
                <button
                  onClick={() => submitForgotVerify({
                    ...(forgotName.trim() ? { name: forgotName.trim() } : {}),
                    ...(forgotOrder.trim() ? { orderNumber: forgotOrder.trim() } : {}),
                  })}
                  disabled={forgotLoading || (!forgotName.trim() && !forgotOrder.trim())}
                  className="w-full h-12 bg-[#DFB369] text-white rounded-xl font-bold text-sm hover:bg-[#c89853] disabled:opacity-40 flex items-center justify-center"
                  data-testid="button-forgot-verify-identity"
                >
                  {forgotLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : t("verifyAndContinue")}
                </button>
              </div>
            )}

            {forgotStep === "reset" && (
              <div className="space-y-3">
                <p className="text-xs text-gray-700 leading-relaxed">
                  {tx("تم التحقق بنجاح. اختر كلمة مرور جديدة (٦ أحرف على الأقل):", "Verified successfully. Choose a new password (at least 6 characters):")}
                </p>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={forgotNewPassword}
                    onChange={e => setForgotNewPassword(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") submitForgotReset(); }}
                    placeholder="••••••••"
                    className="w-full h-12 bg-[#FFFFFF] border border-gray-200 rounded-xl px-4 pr-12 text-sm text-[#2B2B60] focus:border-[#DFB369] focus:ring-2 focus:ring-[#DFB369]/20 outline-none"
                    data-testid="input-forgot-new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-700 hover:text-[#2B2B60]"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <button
                  onClick={submitForgotReset}
                  disabled={forgotLoading || forgotNewPassword.length < 6}
                  className="w-full h-12 bg-[#DFB369] text-white rounded-xl font-bold text-sm hover:bg-[#c89853] disabled:opacity-40 flex items-center justify-center"
                  data-testid="button-forgot-save"
                >
                  {forgotLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : t("saveNewPassword")}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ─── Normal Login / Register UI (hidden during forgot flow) ──── */}
        {!forgotStep && (
        <>
        <div className="flex mx-6 bg-[#FFFFFF] rounded-xl p-1 mb-4">
          <button
            onClick={() => setTab("login")}
            className={`flex-1 py-2.5 text-xs font-black rounded-lg transition-all ${tab === "login" ? "bg-white text-[#2B2B60] shadow-sm" : "text-gray-700"}`}
          >
            {t("signIn")}
          </button>
          <button
            onClick={() => setTab("register")}
            className={`flex-1 py-2.5 text-xs font-black rounded-lg transition-all ${tab === "register" ? "bg-white text-[#2B2B60] shadow-sm" : "text-gray-700"}`}
          >
            {t("newAccount")}
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
                {t("continueWithApple")}
              </>
            )}
          </button>

          <button
            onClick={handleGoogleSignIn}
            disabled={!!socialLoading}
            className="w-full h-12 bg-white border-2 border-gray-200 rounded-xl font-bold text-sm text-[#2B2B60] flex items-center justify-center gap-3 hover:bg-gray-50 transition-colors disabled:opacity-50"
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
                {t("continueWithGoogle")}
              </>
            )}
          </button>

          <div className="flex items-center gap-3 my-1">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-[10px] font-bold text-gray-700 uppercase tracking-widest">{t("orWithPhone")}</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
        </div>

        <div className="px-6 pb-6 space-y-3">
          {tab === "register" && (
            <div>
              <label className="text-[10px] font-bold text-[#DFB369] uppercase tracking-widest mb-1 block">{t("fullName")}</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={t("fullNamePlaceholder")}
                className="w-full h-12 bg-[#FFFFFF] border border-gray-200 rounded-xl px-4 text-sm text-[#2B2B60] focus:border-[#DFB369] focus:ring-2 focus:ring-[#DFB369]/20 outline-none transition-all"
              />
            </div>
          )}

          <div>
            <label className="text-[10px] font-bold text-[#DFB369] uppercase tracking-widest mb-1 block">{t("phoneNumber")}</label>
            <div dir="ltr" className="flex items-center h-12 bg-[#FFFFFF] border border-gray-200 rounded-xl px-4 focus-within:border-[#DFB369] focus-within:ring-2 focus-within:ring-[#DFB369]/20 transition-all">
              <span className="text-sm font-bold text-gray-700 border-r border-gray-200 pr-2 ml-2">+966</span>
              <input
                type="tel"
                value={displayPhone(phone)}
                onChange={e => setPhone(formatPhone(e.target.value))}
                onKeyDown={e => { if (e.key === "Enter" && tab === "login") handlePhoneLogin(); }}
                placeholder="5x xxx xxxx"
                maxLength={11}
                className="flex-1 h-full bg-transparent border-none outline-none text-sm font-bold tracking-wider text-[#2B2B60] placeholder:text-gray-700"
              />
            </div>
          </div>

          {tab === "register" && (
            <div>
              <label className="text-[10px] font-bold text-[#DFB369] uppercase tracking-widest mb-1 block">{t("email")} <span className="text-gray-700">({t("optional")})</span></label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="example@email.com"
                dir="ltr"
                className="w-full h-12 bg-[#FFFFFF] border border-gray-200 rounded-xl px-4 text-sm text-[#2B2B60] focus:border-[#DFB369] focus:ring-2 focus:ring-[#DFB369]/20 outline-none transition-all"
              />
            </div>
          )}

          {(isStaff || tab === "register") && (
            <div>
              <label className="text-[10px] font-bold text-[#DFB369] uppercase tracking-widest mb-1 block">{t("password")}</label>
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
                  className="w-full h-12 bg-[#FFFFFF] border border-gray-200 rounded-xl px-4 pr-12 text-sm text-[#2B2B60] focus:border-[#DFB369] focus:ring-2 focus:ring-[#DFB369]/20 outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-700 hover:text-[#2B2B60] transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          <button
            onClick={tab === "login" ? handlePhoneLogin : handlePhoneRegister}
            disabled={isLoggingIn || isRegistering || phone.length < 9 || (tab === "register" && (!name.trim() || password.length < 6))}
            className="w-full h-12 bg-[#DFB369] text-white rounded-xl font-bold text-sm hover:bg-[#c89853] transition-colors disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg shadow-[#DFB369]/20"
          >
            {(isLoggingIn || isRegistering) ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : tab === "login" ? t("signIn") : t("createAccount")}
          </button>

          {tab === "login" && (
            <button
              onClick={startForgot}
              disabled={forgotLoading}
              className="w-full text-center text-[11px] font-bold text-[#DFB369] hover:underline pt-1 disabled:opacity-50"
              data-testid="button-forgot-password"
            >
              {t("forgotPassword")}
            </button>
          )}

          <p className="text-center text-[10px] text-gray-700 pt-1">
            {tab === "login" ? (
              <>{t("noAccountYet")} <button onClick={() => setTab("register")} className="text-[#DFB369] font-bold hover:underline">{t("createNewAccount")}</button></>
            ) : (
              <>{t("haveAccount")} <button onClick={() => setTab("login")} className="text-[#DFB369] font-bold hover:underline">{t("signInShort")}</button></>
            )}
          </p>
        </div>
        </>
        )}
      </DialogContent>
    </Dialog>
  );
}
