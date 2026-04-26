import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Mail, Send, CheckCircle2, XCircle, Loader2, Sparkles, Package, Truck, CreditCard, Monitor, Smartphone, Globe, Copy, Inbox, ChevronDown, ShieldCheck } from "lucide-react";

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
                <h3 className="font-black text-[#2B2B60]">خدمة البريد الإلكتروني</h3>
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
        <Label className="text-xs font-black text-[#DFB369] uppercase tracking-widest mb-3 block">نوع البريد التجريبي</Label>
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
                    ? "border-[#DFB369] bg-gradient-to-br from-[#DFB369]/10 to-white shadow-md"
                    : "border-slate-200 bg-white hover:border-[#DFB369]/40"
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 ${active ? "bg-[#DFB369] text-white" : "bg-slate-100 text-slate-500"}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <p className="font-black text-sm text-[#2B2B60]">{t.label}</p>
                <p className="text-[10px] text-slate-500 mt-1">{t.desc}</p>
                {active && <div className="absolute top-2 left-2 w-2 h-2 rounded-full bg-[#DFB369]" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Form */}
      <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <CardContent className="p-6 space-y-4">
          <div>
            <Label htmlFor="to" className="text-xs font-black text-[#2B2B60] mb-2 block">البريد الإلكتروني للمستلم *</Label>
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
            <Label htmlFor="name" className="text-xs font-black text-[#2B2B60] mb-2 block">اسم المستلم (اختياري)</Label>
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
            className="w-full h-12 bg-[#2B2B60] hover:bg-[#2B2B60]/90 text-white rounded-xl font-black gap-2"
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
            <li>البريد المُرسَل من <span className="font-mono font-bold">support@rfperfume.sa</span> — أضِفه لجهات الاتصال</li>
            <li>القوالب تحمل تصميم RF Perfume الفاخر (RTL + ألوان العلامة)</li>
            <li>لا تستخدم هذه الصفحة لإرسال رسائل جماعية — هي للاختبار فقط</li>
          </ul>
        </CardContent>
      </Card>

      {/* ── Outlook Setup Guide ─────────────────────────────────────── */}
      <OutlookSetupGuide />
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────────────
   Outlook Setup Guide — كيفية إضافة بريد المتجر إلى Outlook
   حتى تظهر الرسائل القادمة من العملاء في صندوق الوارد مباشرة
   ─────────────────────────────────────────────────────────────────────── */
function OutlookSetupGuide() {
  const { toast } = useToast();
  const [open, setOpen] = useState(true);

  const ACCOUNT_EMAIL = "support@rfperfume.sa";
  const SENDER_DOMAIN = "noreply@rfperfume.sa";

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "تم النسخ", description: label });
  };

  const InfoRow = ({ label, value }: { label: string; value: string }) => (
    <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
      <button
        onClick={() => copy(value, label)}
        className="p-1.5 rounded-md hover:bg-white text-slate-500 hover:text-[#2B2B60] transition-colors"
        title="نسخ"
      >
        <Copy className="w-3.5 h-3.5" />
      </button>
      <div className="flex-1 text-left" dir="ltr">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">{label}</span>
        <span className="text-xs font-mono font-bold text-[#2B2B60]">{value}</span>
      </div>
    </div>
  );

  const Step = ({ n, title, children }: { n: number; title: string; children?: React.ReactNode }) => (
    <li className="flex gap-3">
      <span className="shrink-0 w-7 h-7 rounded-full bg-[#2B2B60] text-white text-xs font-black flex items-center justify-center mt-0.5">
        {n}
      </span>
      <div className="flex-1">
        <p className="text-sm font-bold text-[#2B2B60]">{title}</p>
        {children && <div className="mt-1.5 text-xs text-slate-600 leading-relaxed">{children}</div>}
      </div>
    </li>
  );

  return (
    <Card className="rounded-2xl border-2 border-[#0078D4]/20 bg-gradient-to-br from-[#0078D4]/5 via-white to-white shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full p-5 flex items-center justify-between gap-4 hover:bg-[#0078D4]/5 transition-colors"
        data-testid="button-toggle-outlook-guide"
      >
        <ChevronDown className={`w-5 h-5 text-[#0078D4] transition-transform ${open ? "rotate-180" : ""}`} />
        <div className="flex items-center gap-3 flex-1 text-right">
          <div>
            <h3 className="font-black text-[#2B2B60] text-base">إضافة بريد المتجر إلى Outlook</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">حتى تظهر رسائل العملاء في صندوق الوارد مباشرة على جميع أجهزتك</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[#0078D4] text-white flex items-center justify-center shrink-0 shadow-md">
            <Inbox className="w-6 h-6" />
          </div>
        </div>
      </button>

      {open && (
        <CardContent className="px-5 pb-6 pt-0 space-y-5">
          {/* Account info — copy/paste ready */}
          <div className="p-4 rounded-xl bg-white border border-slate-200">
            <p className="text-[10px] font-black text-[#DFB369] uppercase tracking-widest mb-3">بيانات الحساب</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <InfoRow label="البريد الإلكتروني" value={ACCOUNT_EMAIL} />
              <InfoRow label="اسم العرض" value="عطور آر اف — RF Perfume" />
              <InfoRow label="IMAP Server" value="outlook.office365.com" />
              <InfoRow label="IMAP Port" value="993 (SSL/TLS)" />
              <InfoRow label="SMTP Server" value="smtp.office365.com" />
              <InfoRow label="SMTP Port" value="587 (STARTTLS)" />
            </div>
            <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-800">
                كلمة المرور: استخدم <strong>كلمة مرور التطبيق</strong> (App Password) من
                <a href="https://account.microsoft.com/security" target="_blank" rel="noreferrer" className="text-[#0078D4] font-bold underline mx-1" dir="ltr">account.microsoft.com/security</a>
                إذا كان التحقق بخطوتين مفعّلاً.
              </p>
            </div>
          </div>

          {/* Tabbed setup steps */}
          <Tabs defaultValue="desktop" dir="rtl">
            <TabsList className="grid w-full grid-cols-3 bg-slate-100 rounded-xl p-1 h-auto">
              <TabsTrigger value="desktop" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm gap-1.5 text-xs font-bold py-2.5" data-testid="tab-outlook-desktop">
                <Monitor className="w-4 h-4" /> سطح المكتب
              </TabsTrigger>
              <TabsTrigger value="mobile" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm gap-1.5 text-xs font-bold py-2.5" data-testid="tab-outlook-mobile">
                <Smartphone className="w-4 h-4" /> الجوال
              </TabsTrigger>
              <TabsTrigger value="web" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm gap-1.5 text-xs font-bold py-2.5" data-testid="tab-outlook-web">
                <Globe className="w-4 h-4" /> ويب
              </TabsTrigger>
            </TabsList>

            {/* Desktop (Windows / Mac) */}
            <TabsContent value="desktop" className="mt-4">
              <ol className="space-y-3">
                <Step n={1} title="افتح تطبيق Outlook على جهازك">
                  Windows: ابحث عن <em>Outlook</em> في قائمة ابدأ. ماك: من Launchpad أو Applications.
                </Step>
                <Step n={2} title="أضف حساباً جديداً">
                  من القائمة: <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">File → Add Account</span>
                  (أو <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">Outlook → Settings → Accounts → +</span> على ماك).
                </Step>
                <Step n={3} title={`أدخل البريد: ${ACCOUNT_EMAIL}`}>
                  Outlook سيتعرّف تلقائياً أنه حساب Microsoft. اضغط <strong>Connect</strong> ثم أدخل كلمة المرور.
                </Step>
                <Step n={4} title="إذا طُلب الإعداد اليدوي">
                  اختر <strong>IMAP</strong> وأدخل البيانات أعلاه (IMAP: outlook.office365.com:993 SSL، SMTP: smtp.office365.com:587 STARTTLS).
                </Step>
                <Step n={5} title="أكمل وانتظر المزامنة">
                  ستظهر كل الرسائل في صندوق الوارد خلال ثوانٍ. الرسائل المرسلة من المتجر إلى العملاء ستُحفظ في مجلد <strong>Sent Items</strong>.
                </Step>
              </ol>
            </TabsContent>

            {/* Mobile (iOS / Android) */}
            <TabsContent value="mobile" className="mt-4">
              <ol className="space-y-3">
                <Step n={1} title="حمّل تطبيق Outlook">
                  من <a href="https://apps.apple.com/app/microsoft-outlook/id951937596" target="_blank" rel="noreferrer" className="text-[#0078D4] font-bold underline">App Store</a> للآيفون أو
                  <a href="https://play.google.com/store/apps/details?id=com.microsoft.office.outlook" target="_blank" rel="noreferrer" className="text-[#0078D4] font-bold underline mx-1">Google Play</a> للأندرويد.
                </Step>
                <Step n={2} title="افتح التطبيق واضغط ابدأ">
                  لو عندك حساب من قبل: من <strong>Settings → Add Account → Add Email Account</strong>.
                </Step>
                <Step n={3} title={`أدخل: ${ACCOUNT_EMAIL}`}>
                  اضغط <strong>إضافة الحساب</strong>. سيتم اكتشاف الإعدادات تلقائياً.
                </Step>
                <Step n={4} title="أدخل كلمة المرور">
                  إذا فشل: اختر يدوياً <strong>Office 365</strong> ثم أكمل.
                </Step>
                <Step n={5} title="فعّل الإشعارات">
                  من إعدادات التطبيق: <strong>Notifications → All</strong> ليصلك تنبيه فوري عند وصول رسالة من عميل.
                </Step>
              </ol>
            </TabsContent>

            {/* Web */}
            <TabsContent value="web" className="mt-4">
              <ol className="space-y-3">
                <Step n={1} title="افتح المتصفح وادخل على Outlook ويب">
                  <a href="https://outlook.live.com" target="_blank" rel="noreferrer" className="text-[#0078D4] font-bold underline" dir="ltr">https://outlook.live.com</a>
                </Step>
                <Step n={2} title={`سجّل دخول بـ: ${ACCOUNT_EMAIL}`}>
                  أدخل البريد ثم كلمة المرور. سترى صندوق الوارد فوراً.
                </Step>
                <Step n={3} title="ثبّت Outlook كتطبيق ويب (PWA)">
                  من شريط العنوان في Chrome/Edge اضغط أيقونة <strong>التثبيت</strong> ⊕ ليصبح Outlook كتطبيق سطح مكتب مع إشعارات.
                </Step>
                <Step n={4} title="فعّل الإشعارات في المتصفح">
                  سيطلب المتصفح إذن الإشعارات — وافق ليصلك تنبيه فوراً عند وصول رسالة جديدة.
                </Step>
              </ol>
            </TabsContent>
          </Tabs>

          {/* Pro tips — make sure mails actually land in inbox */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-white border border-emerald-200">
            <p className="text-xs font-black text-emerald-800 mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              لضمان وصول الرسائل لصندوق الوارد (وليس Spam)
            </p>
            <ul className="text-xs text-emerald-900 space-y-2">
              <li className="flex gap-2">
                <span className="text-emerald-600 font-black mt-0.5">✓</span>
                <span>أضف <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-emerald-200">{SENDER_DOMAIN}</span> و <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-emerald-200">{ACCOUNT_EMAIL}</span> إلى <strong>جهات الاتصال الآمنة (Safe Senders)</strong> في Outlook.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-600 font-black mt-0.5">✓</span>
                <span>من Outlook: <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-emerald-200">Settings → Mail → Junk email → Safe senders → Add</span> ثم أدخل النطاق <span className="font-mono">@rfperfume.sa</span>.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-600 font-black mt-0.5">✓</span>
                <span>إذا وجدت أي رسالة في <strong>Junk/Spam</strong>: اضغط عليها بزر الفأرة الأيمن → <strong>Mark as not junk</strong>.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-600 font-black mt-0.5">✓</span>
                <span>أنشئ قاعدة (Rule): <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-emerald-200">Settings → Rules → Add new rule</span> — كل رسالة من <span className="font-mono">@rfperfume.sa</span> تُنقل تلقائياً إلى مجلد "طلبات RF" مميّز.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-600 font-black mt-0.5">✓</span>
                <span>تحقق دورياً من <strong>Junk Email</strong> في الأسبوع الأول بعد الإعداد.</span>
              </li>
            </ul>
          </div>

          {/* Quick link buttons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <a
              href="https://outlook.live.com"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 h-11 rounded-xl bg-[#0078D4] text-white text-xs font-bold hover:bg-[#106EBE] transition-colors"
              data-testid="link-outlook-web"
            >
              <Globe className="w-4 h-4" />
              فتح Outlook ويب
            </a>
            <a
              href="https://www.microsoft.com/microsoft-365/outlook/email-and-calendar-software-microsoft-outlook"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 h-11 rounded-xl bg-white border-2 border-[#0078D4] text-[#0078D4] text-xs font-bold hover:bg-[#0078D4]/5 transition-colors"
              data-testid="link-outlook-desktop"
            >
              <Monitor className="w-4 h-4" />
              تنزيل تطبيق سطح المكتب
            </a>
            <a
              href="https://www.microsoft.com/microsoft-365/outlook-mobile-for-android-and-ios"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 h-11 rounded-xl bg-white border-2 border-[#0078D4] text-[#0078D4] text-xs font-bold hover:bg-[#0078D4]/5 transition-colors"
              data-testid="link-outlook-mobile"
            >
              <Smartphone className="w-4 h-4" />
              تطبيق الجوال
            </a>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
