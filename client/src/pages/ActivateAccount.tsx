import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, CheckCircle2, ShieldCheck, Lock, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const logoImg = "/images/logos/logo-light.png";

export default function ActivateAccount() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [token, setToken] = useState<string | null>(null);
  const [info, setInfo] = useState<{ name: string; email: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [show, setShow] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (!t) { setError("لا يوجد رمز تفعيل في الرابط"); setLoading(false); return; }
    setToken(t);
    fetch(`/api/auth/activate/${encodeURIComponent(t)}`)
      .then(r => r.json())
      .then(d => {
        if (!d.valid) { setError(d.message || "رابط غير صالح"); }
        else setInfo({ name: d.name, email: d.email, role: d.role });
      })
      .catch(() => setError("تعذر التحقق من الرابط"))
      .finally(() => setLoading(false));
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd.length < 6) { toast({ title: "كلمة المرور قصيرة", description: "٦ أحرف على الأقل", variant: "destructive" }); return; }
    if (pwd !== pwd2) { toast({ title: "غير متطابقتين", description: "تأكيد كلمة المرور لا يطابق", variant: "destructive" }); return; }
    setSubmitting(true);
    try {
      const r = await fetch("/api/auth/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: pwd }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "فشل التفعيل");
      setDone(true);
      setTimeout(() => setLocation("/login"), 2200);
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link href="/"><img src={logoImg} alt="رفيف العود" className="h-24 w-auto mx-auto mb-6 object-contain" /></Link>
          <h2 className="text-2xl font-black uppercase tracking-tighter">تفعيل الحساب</h2>
          <p className="text-muted-foreground mt-2 text-xs font-bold uppercase tracking-widest">عيّن كلمة المرور لحسابك الجديد</p>
        </div>

        <div className="bg-white border border-black/5 p-10 rounded-none shadow-2xl">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin h-8 w-8" /></div>
          ) : error ? (
            <div className="text-center space-y-4 py-4">
              <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
              <p className="text-sm font-bold">{error}</p>
              <p className="text-[11px] text-black/50">اطلب من المدير إعادة إرسال رابط تفعيل جديد.</p>
              <Link href="/login"><Button variant="outline" className="rounded-none mt-4" data-testid="link-login">رجوع لتسجيل الدخول</Button></Link>
            </div>
          ) : done ? (
            <div className="text-center space-y-6 py-4">
              <CheckCircle2 className="h-16 w-16 text-black mx-auto" />
              <div>
                <h3 className="font-bold text-xl">تم التفعيل بنجاح</h3>
                <p className="text-xs text-black/50 mt-2">جاري تحويلك لتسجيل الدخول...</p>
              </div>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-6">
              {info && (
                <div className="p-4 bg-black/5 border border-black/10 text-right space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-black/40">مرحباً</p>
                  <p className="text-sm font-bold" data-testid="text-employee-name">{info.name}</p>
                  <p className="text-[11px] text-black/60">{info.email}</p>
                </div>
              )}

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

              <Button type="submit" disabled={submitting}
                className="w-full h-16 font-bold uppercase tracking-[0.3em] text-xs rounded-none bg-black text-white border-none mt-4"
                data-testid="button-activate">
                {submitting ? <Loader2 className="animate-spin" /> : <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> تفعيل الحساب</span>}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
