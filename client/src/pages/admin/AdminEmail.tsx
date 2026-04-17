import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Mail, Send, CheckCircle2, XCircle, Loader2, Sparkles, Package, Truck, CreditCard } from "lucide-react";

const TEMPLATES = [
  { id: "welcome", label: "بريد الترحيب", icon: Sparkles, desc: "مرحباً للعملاء الجدد" },
  { id: "order_confirmation", label: "تأكيد الطلب", icon: Package, desc: "فاتورة + تفاصيل الطلب" },
  { id: "order_shipped", label: "شحن الطلب", icon: Truck, desc: "رقم تتبع + شركة الشحن" },
  { id: "payment", label: "تأكيد الدفع", icon: CreditCard, desc: "إيصال الدفع" },
];

export default function AdminEmail() {
  const { toast } = useToast();
  const [to, setTo] = useState("");
  const [name, setName] = useState("");
  const [template, setTemplate] = useState("welcome");
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<{ ok: boolean; msg: string; when: Date } | null>(null);

  const { data: status } = useQuery<{ configured: boolean; sender: string; senderName: string; provider: string }>({
    queryKey: ["/api/admin/email/status"],
  });

  const handleSend = async () => {
    if (!to || !/^\S+@\S+\.\S+$/.test(to)) {
      toast({ title: "خطأ", description: "أدخل بريد إلكتروني صالح", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/admin/email/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ to, template, name }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setLastResult({ ok: false, msg: data.message || "فشل الإرسال", when: new Date() });
        toast({ title: "فشل الإرسال", description: data.message, variant: "destructive" });
      } else {
        setLastResult({ ok: true, msg: data.message, when: new Date() });
        toast({ title: "تم الإرسال", description: `البريد في طريقه إلى ${to}` });
      }
    } catch (err: any) {
      setLastResult({ ok: false, msg: err?.message || "خطأ في الشبكة", when: new Date() });
      toast({ title: "خطأ", description: err?.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Status Card */}
      <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${status?.configured ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
                <Mail className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-black text-[#1a2744]">خدمة البريد الإلكتروني</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {status?.configured ? (
                    <>المزوّد: <span className="font-bold text-emerald-600">{status.provider}</span> — المُرسِل: <span className="font-mono">{status.sender}</span></>
                  ) : (
                    <span className="text-red-600 font-bold">غير مفعّلة — يرجى ضبط SMTP2GO_API_KEY</span>
                  )}
                </p>
              </div>
            </div>
            <div className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${status?.configured ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
              {status?.configured ? "✓ نشط" : "✗ متوقف"}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Template Picker */}
      <div>
        <Label className="text-xs font-black text-[#c9a96e] uppercase tracking-widest mb-3 block">نوع البريد التجريبي</Label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {TEMPLATES.map((t) => {
            const Icon = t.icon;
            const active = template === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTemplate(t.id)}
                className={`relative p-4 rounded-2xl border-2 text-right transition-all ${
                  active
                    ? "border-[#c9a96e] bg-gradient-to-br from-[#c9a96e]/10 to-white shadow-md"
                    : "border-slate-200 bg-white hover:border-[#c9a96e]/40"
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 ${active ? "bg-[#c9a96e] text-white" : "bg-slate-100 text-slate-500"}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <p className="font-black text-sm text-[#1a2744]">{t.label}</p>
                <p className="text-[10px] text-slate-500 mt-1">{t.desc}</p>
                {active && <div className="absolute top-2 left-2 w-2 h-2 rounded-full bg-[#c9a96e]" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Form */}
      <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <CardContent className="p-6 space-y-4">
          <div>
            <Label htmlFor="to" className="text-xs font-black text-[#1a2744] mb-2 block">البريد الإلكتروني للمستلم *</Label>
            <Input
              id="to"
              type="email"
              placeholder="customer@example.com"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              dir="ltr"
              className="h-12 rounded-xl"
            />
          </div>

          <div>
            <Label htmlFor="name" className="text-xs font-black text-[#1a2744] mb-2 block">اسم المستلم (اختياري)</Label>
            <Input
              id="name"
              placeholder="عميل تجريبي"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-12 rounded-xl"
            />
          </div>

          <Button
            onClick={handleSend}
            disabled={sending || !to || !status?.configured}
            className="w-full h-12 bg-[#1a2744] hover:bg-[#1a2744]/90 text-white rounded-xl font-black gap-2"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {sending ? "جارٍ الإرسال..." : "إرسال البريد التجريبي"}
          </Button>

          {lastResult && (
            <div className={`p-4 rounded-xl border-2 flex items-start gap-3 ${lastResult.ok ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
              {lastResult.ok ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" /> : <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />}
              <div className="flex-1">
                <p className={`text-sm font-bold ${lastResult.ok ? "text-emerald-700" : "text-red-700"}`}>{lastResult.msg}</p>
                <p className="text-[10px] text-slate-500 mt-1">{lastResult.when.toLocaleString("ar-SA")}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Help */}
      <Card className="rounded-2xl border border-amber-200 bg-amber-50/50">
        <CardContent className="p-5">
          <p className="text-xs font-black text-amber-900 mb-2">💡 نصائح للإرسال</p>
          <ul className="text-xs text-amber-800 space-y-1 list-disc list-inside">
            <li>تحقق من مجلد الرسائل غير المرغوب بها (Spam) إذا لم يصل البريد</li>
            <li>البريد المُرسَل من <span className="font-mono font-bold">rf-purfume@outlook.com</span> — أضِفه لجهات الاتصال</li>
            <li>القوالب تحمل تصميم RF Perfume الفاخر (RTL + ألوان العلامة)</li>
            <li>لا تستخدم هذه الصفحة لإرسال رسائل جماعية — هي للاختبار فقط</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
