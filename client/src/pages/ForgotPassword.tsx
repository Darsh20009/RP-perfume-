import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, CheckCircle2, ShieldCheck, Lock, Eye, EyeOff, Mail, KeyRound, Phone, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const logoImg = "/images/logos/logo-light.png";

type Step = "phone" | "otp" | "verify" | "reset" | "done";

export default function ForgotPassword() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [step, setStep] = useState<Step>("phone");
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);

  // Form data carried across steps
  const [phone, setPhone] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [allowVerify, setAllowVerify] = useState(false); // customer with email may also use identity
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");

  // Step 1 — phone → routing
  const submitPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.replace(/\D/g, "").length < 9) {
      toast({ title: "رقم غير صالح", variant: "destructive" }); return;
    }
    setLoading(true);
    try {
      const r = await fetch("/api/auth/forgot/init", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "خطأ");
      if (d.method === "otp") {
        setMaskedEmail(d.masked || "");
        setAllowVerify(!!d.allowVerify);
        setStep("otp");
        toast({ title: "تم إرسال الرمز", description: `إلى ${d.masked}` });
      } else {
        setStep("verify");
      }
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  // Step 2 — submit OTP / identity → resetToken
  const submitVerify = async (e: React.FormEvent, mode: "otp" | "identity") => {
    e.preventDefault();
    setLoading(true);
    try {
      const body: any = { phone };
      if (mode === "otp") {
        if (!code || code.length < 6) { toast({ title: "أدخل الرمز كاملاً", variant: "destructive" }); setLoading(false); return; }
        body.code = code;
      } else {
        if (!name && !orderNumber) { toast({ title: "أدخل الاسم أو رقم طلب سابق", variant: "destructive" }); setLoading(false); return; }
        if (name) body.name = name;
        if (orderNumber) body.orderNumber = orderNumber;
      }
      const r = await fetch("/api/auth/forgot/verify", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "البيانات غير صحيحة");
      setResetToken(d.resetToken);
      setStep("reset");
    } catch (err: any) {
      toast({ title: "تحقق فاشل", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  // Step 3 — set new password
  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd.length < 6) { toast({ title: "كلمة مرور قصيرة", description: "٦ أحرف على الأقل", variant: "destructive" }); return; }
    if (pwd !== pwd2) { toast({ title: "غير متطابقتين", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const r = await fetch("/api/auth/forgot/reset", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetToken, password: pwd }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "فشل");
      setStep("done");
      setTimeout(() => setLocation("/login"), 2000);
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const titleByStep: Record<Step, string> = {
    phone: "استعادة كلمة المرور",
    otp: "تحقق بريدك",
    verify: "تأكيد هويتك",
    reset: "كلمة مرور جديدة",
    done: "تم التحديث",
  };
  const subtitleByStep: Record<Step, string> = {
    phone: "أدخل رقم جوالك المسجل",
    otp: `أدخل الرمز المرسل إلى ${maskedEmail}`,
    verify: "أكد هويتك بالاسم الكامل أو رقم طلب سابق",
    reset: "اختر كلمة مرور قوية",
    done: "تم تغيير كلمة المرور بنجاح",
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link href="/"><img src={logoImg} alt="رفيف العود" className="h-24 w-auto mx-auto mb-6 object-contain cursor-pointer" /></Link>
          <h2 className="text-2xl font-black uppercase tracking-tighter">{titleByStep[step]}</h2>
          <p className="text-muted-foreground mt-2 text-xs font-bold uppercase tracking-widest">{subtitleByStep[step]}</p>
        </div>

        <div className="bg-white border border-black/5 p-10 rounded-none shadow-2xl">
          {/* STEP: PHONE */}
          {step === "phone" && (
            <form onSubmit={submitPhone} className="space-y-6">
              <div className="text-right space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/40">رقم الجوال</label>
                <div className="relative">
                  <Phone className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black/30" />
                  <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="05xxxxxxxx"
                    className="h-12 bg-white border-black/10 rounded-none pr-10" inputMode="tel" data-testid="input-phone" />
                </div>
              </div>
              <Button type="submit" disabled={loading} className="w-full h-16 font-bold uppercase tracking-[0.3em] text-xs rounded-none bg-black text-white border-none" data-testid="button-continue">
                {loading ? <Loader2 className="animate-spin" /> : <span className="flex items-center gap-2"><ArrowRight className="h-4 w-4" /> متابعة</span>}
              </Button>
            </form>
          )}

          {/* STEP: OTP (sent to email) */}
          {step === "otp" && (
            <form onSubmit={(e) => submitVerify(e, "otp")} className="space-y-6">
              <div className="p-4 bg-black/5 text-right space-y-1">
                <Mail className="h-5 w-5 inline-block ml-1 text-black/60" />
                <span className="text-xs font-bold">{maskedEmail}</span>
                <p className="text-[10px] text-black/50 mt-1">صلاحية الرمز ١٠ دقائق</p>
              </div>
              <div className="text-right space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/40">رمز التحقق (٦ أرقام)</label>
                <Input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="------" maxLength={6} inputMode="numeric"
                  className="h-14 text-center text-2xl tracking-[0.5em] font-mono bg-white border-black/10 rounded-none"
                  data-testid="input-otp" />
              </div>
              <Button type="submit" disabled={loading} className="w-full h-16 font-bold uppercase tracking-[0.3em] text-xs rounded-none bg-black text-white border-none" data-testid="button-verify-otp">
                {loading ? <Loader2 className="animate-spin" /> : <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> تأكيد الرمز</span>}
              </Button>
              {allowVerify && (
                <button type="button" onClick={() => setStep("verify")} className="w-full text-[10px] font-bold uppercase tracking-widest text-black/40 hover:text-black" data-testid="button-use-identity">
                  ما وصلني الرمز؟ تحقق بالاسم أو رقم طلب
                </button>
              )}
            </form>
          )}

          {/* STEP: IDENTITY VERIFY */}
          {step === "verify" && (
            <form onSubmit={(e) => submitVerify(e, "identity")} className="space-y-6">
              <p className="text-[11px] text-black/60 text-right leading-relaxed">
                أدخل أحد التاليين على الأقل لإثبات هويتك:
              </p>
              <div className="text-right space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/40">اسمك الكامل المسجل</label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="مثال: محمد عبدالله"
                  className="h-12 bg-white border-black/10 rounded-none" data-testid="input-name" />
              </div>
              <div className="text-right space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/40">أو رقم طلب سابق</label>
                <Input value={orderNumber} onChange={e => setOrderNumber(e.target.value)} placeholder="رقم طلبك السابق"
                  className="h-12 bg-white border-black/10 rounded-none" data-testid="input-order-number" />
              </div>
              <Button type="submit" disabled={loading} className="w-full h-16 font-bold uppercase tracking-[0.3em] text-xs rounded-none bg-black text-white border-none" data-testid="button-verify-identity">
                {loading ? <Loader2 className="animate-spin" /> : <span className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> تأكيد الهوية</span>}
              </Button>
            </form>
          )}

          {/* STEP: NEW PASSWORD */}
          {step === "reset" && (
            <form onSubmit={submitReset} className="space-y-6">
              <div className="text-right space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/40">كلمة المرور الجديدة</label>
                <div className="relative">
                  <Input type={show ? "text" : "password"} value={pwd} onChange={e => setPwd(e.target.value)} placeholder="••••••••"
                    className="h-12 bg-white border-black/10 rounded-none pr-12" data-testid="input-password" />
                  <Button type="button" variant="ghost" size="icon" onClick={() => setShow(!show)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 no-default-hover-elevate" data-testid="button-toggle-password">
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="text-right space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/40">تأكيد كلمة المرور</label>
                <Input type={show ? "text" : "password"} value={pwd2} onChange={e => setPwd2(e.target.value)} placeholder="••••••••"
                  className="h-12 bg-white border-black/10 rounded-none" data-testid="input-password-confirm" />
              </div>
              <Button type="submit" disabled={loading} className="w-full h-16 font-bold uppercase tracking-[0.3em] text-xs rounded-none bg-black text-white border-none" data-testid="button-reset">
                {loading ? <Loader2 className="animate-spin" /> : <span className="flex items-center gap-2"><Lock className="h-4 w-4" /> تحديث كلمة المرور</span>}
              </Button>
            </form>
          )}

          {/* STEP: DONE */}
          {step === "done" && (
            <div className="text-center space-y-6 py-4">
              <CheckCircle2 className="h-16 w-16 text-black mx-auto" />
              <div>
                <h3 className="font-bold text-xl">تم التحديث بنجاح</h3>
                <p className="text-xs text-black/50 mt-2">جاري التحويل لتسجيل الدخول...</p>
              </div>
            </div>
          )}

          <div className="mt-8 pt-8 border-t border-black/5 text-center">
            <Link href="/login" className="text-[10px] font-bold uppercase tracking-widest text-black/40 hover:text-black" data-testid="link-back-login">
              رجوع لتسجيل الدخول
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
