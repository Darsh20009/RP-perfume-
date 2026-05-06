import { useQuery } from "@tanstack/react-query";
import { Loader2, CheckCircle2, XCircle, Key, RefreshCw, ExternalLink, AlertTriangle } from "lucide-react";

type Status = { [key: string]: boolean };

interface Integration {
  id: string;
  name: string;
  nameEn: string;
  category: string;
  logo: string;
  url: string;
  keys: { label: string; key: string }[];
  description: string;
}

const INTEGRATIONS: Integration[] = [
  {
    id: "paymob",
    name: "Paymob",
    nameEn: "Paymob",
    category: "المدفوعات",
    logo: "💳",
    url: "https://accept.paymob.com",
    description: "بوابة الدفع بالبطاقة البنكية",
    keys: [
      { label: "Secret Key", key: "secretKey" },
      { label: "Public Key", key: "publicKey" },
      { label: "Integration ID", key: "integrationId" },
      { label: "HMAC Secret", key: "hmacSecret" },
    ],
  },
  {
    id: "tabby",
    name: "Tabby",
    nameEn: "Tabby",
    category: "المدفوعات",
    logo: "🟢",
    url: "https://dashboard.tabby.ai",
    description: "الدفع بالتقسيط — تابي",
    keys: [
      { label: "Secret Key", key: "secretKey" },
      { label: "Public Key", key: "publicKey" },
      { label: "Webhook Secret", key: "webhookSecret" },
      { label: "Merchant Code", key: "merchantCode" },
    ],
  },
  {
    id: "tamara",
    name: "Tamara",
    nameEn: "Tamara",
    category: "المدفوعات",
    logo: "🔵",
    url: "https://app.tamara.co",
    description: "الدفع بالتقسيط — تمارا",
    keys: [
      { label: "API Token", key: "apiToken" },
      { label: "Notification Token", key: "notificationToken" },
      { label: "Public Key", key: "publicKey" },
    ],
  },
  {
    id: "gemini",
    name: "Google Gemini AI",
    nameEn: "Gemini",
    category: "الذكاء الاصطناعي",
    logo: "✨",
    url: "https://aistudio.google.com",
    description: "محرك الذكاء الاصطناعي الأساسي",
    keys: [
      { label: "Key 1 (رئيسي)", key: "key1" },
      { label: "Key 2 (احتياطي)", key: "key2" },
      { label: "Key 3 (احتياطي)", key: "key3" },
    ],
  },
  {
    id: "kimi",
    name: "Kimi AI",
    nameEn: "Kimi",
    category: "الذكاء الاصطناعي",
    logo: "🌙",
    url: "https://platform.moonshot.cn",
    description: "محرك الذكاء الاصطناعي الداعم",
    keys: [
      { label: "API Key", key: "apiKey" },
    ],
  },
  {
    id: "smtp",
    name: "SMTP2GO",
    nameEn: "SMTP2GO",
    category: "البريد الإلكتروني",
    logo: "📧",
    url: "https://app.smtp2go.com",
    description: "خدمة إرسال البريد الإلكتروني",
    keys: [
      { label: "API Key", key: "apiKey" },
    ],
  },
  {
    id: "google",
    name: "Google OAuth",
    nameEn: "Google",
    category: "المصادقة",
    logo: "🔐",
    url: "https://console.cloud.google.com",
    description: "تسجيل الدخول بحساب Google",
    keys: [
      { label: "Client ID", key: "clientId" },
      { label: "Client Secret", key: "clientSecret" },
    ],
  },
  {
    id: "apple",
    name: "Apple Sign-In",
    nameEn: "Apple",
    category: "المصادقة",
    logo: "🍎",
    url: "https://developer.apple.com",
    description: "تسجيل الدخول بحساب Apple",
    keys: [
      { label: "Client ID", key: "clientId" },
      { label: "Redirect URI", key: "redirectUri" },
    ],
  },
  {
    id: "storageStation",
    name: "Storage Station",
    nameEn: "3PL Fulfillment",
    category: "الشحن والخدمات اللوجستية",
    logo: "📦",
    url: "https://storagestation.app",
    description: "منصة التخزين والتوصيل — WooCommerce",
    keys: [
      { label: "API Key", key: "apiKey" },
      { label: "API Secret", key: "apiSecret" },
    ],
  },
  {
    id: "shipox",
    name: "Shipox — 3rd Mile",
    nameEn: "Shipox Courier",
    category: "الشحن والخدمات اللوجستية",
    logo: "🚚",
    url: "https://3rdmile.my.shipox.com",
    description: "نظام الشحن المباشر — إنشاء بوالص الشحن وتتبعها",
    keys: [
      { label: "SHIPOX_USERNAME", key: "username" },
      { label: "SHIPOX_PASSWORD", key: "password" },
    ],
  },
  {
    id: "mongo",
    name: "MongoDB Atlas",
    nameEn: "MongoDB",
    category: "قاعدة البيانات",
    logo: "🍃",
    url: "https://cloud.mongodb.com",
    description: "قاعدة البيانات السحابية",
    keys: [
      { label: "Connection URI", key: "uri" },
    ],
  },
  {
    id: "vapid",
    name: "Web Push (VAPID)",
    nameEn: "VAPID",
    category: "الإشعارات",
    logo: "🔔",
    url: "https://web-push-codelab.glitch.me",
    description: "إشعارات المتصفح الفورية",
    keys: [
      { label: "Public Key", key: "publicKey" },
      { label: "Private Key", key: "privateKey" },
    ],
  },
  {
    id: "session",
    name: "Session Secret",
    nameEn: "Session",
    category: "الأمان",
    logo: "🔒",
    url: "",
    description: "مفتاح تشفير الجلسات",
    keys: [
      { label: "Secret", key: "secret" },
    ],
  },
];

const CATEGORY_COLORS: Record<string, string> = {
  "المدفوعات": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "الذكاء الاصطناعي": "bg-violet-50 text-violet-700 border-violet-200",
  "البريد الإلكتروني": "bg-blue-50 text-blue-700 border-blue-200",
  "المصادقة": "bg-amber-50 text-amber-700 border-amber-200",
  "الشحن والخدمات اللوجستية": "bg-orange-50 text-orange-700 border-orange-200",
  "قاعدة البيانات": "bg-green-50 text-green-700 border-green-200",
  "الإشعارات": "bg-pink-50 text-pink-700 border-pink-200",
  "الأمان": "bg-slate-50 text-slate-700 border-slate-200",
};

function IntegrationCard({ integration, status }: { integration: Integration; status: Status }) {
  const configured = integration.keys.filter(k => status[k.key]).length;
  const total = integration.keys.length;
  const allOk = configured === total;
  const noneOk = configured === 0;
  const catColor = CATEGORY_COLORS[integration.category] || "bg-slate-50 text-slate-700 border-slate-200";

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all hover:shadow-md ${
      allOk ? "border-emerald-100" : noneOk ? "border-red-100" : "border-amber-100"
    }`}>
      <div className={`h-1.5 ${allOk ? "bg-emerald-400" : noneOk ? "bg-red-400" : "bg-amber-400"}`} />
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{integration.logo}</span>
            <div>
              <h3 className="font-black text-sm text-slate-900">{integration.name}</h3>
              <p className="text-[11px] text-slate-400 font-bold">{integration.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {integration.url && (
              <a href={integration.url} target="_blank" rel="noopener noreferrer"
                className="p-1.5 rounded-lg text-slate-300 hover:text-slate-600 hover:bg-slate-50 transition-colors">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${catColor}`}>
              {integration.category}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          {integration.keys.map(k => (
            <div key={k.key} className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-50">
              <div className="flex items-center gap-2">
                <Key className="h-3 w-3 text-slate-300 shrink-0" />
                <span className="text-[11px] font-bold text-slate-600">{k.label}</span>
              </div>
              {status[k.key]
                ? <span className="flex items-center gap-1 text-[10px] font-black text-emerald-600">
                    <CheckCircle2 className="h-3.5 w-3.5" /> مُعدَّن
                  </span>
                : <span className="flex items-center gap-1 text-[10px] font-black text-red-500">
                    <XCircle className="h-3.5 w-3.5" /> غير محدد
                  </span>
              }
            </div>
          ))}
        </div>

        <div className={`mt-3 pt-3 border-t ${allOk ? "border-emerald-50" : noneOk ? "border-red-50" : "border-amber-50"}`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-400">{configured}/{total} مفاتيح مُعدَّة</span>
            {allOk
              ? <span className="flex items-center gap-1 text-[10px] font-black text-emerald-600"><CheckCircle2 className="h-3 w-3" /> جاهز</span>
              : noneOk
              ? <span className="flex items-center gap-1 text-[10px] font-black text-red-500"><XCircle className="h-3 w-3" /> غير مُفعَّل</span>
              : <span className="flex items-center gap-1 text-[10px] font-black text-amber-600"><AlertTriangle className="h-3 w-3" /> جزئي</span>
            }
          </div>
          <div className="mt-1.5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${allOk ? "bg-emerald-400" : noneOk ? "bg-red-400" : "bg-amber-400"}`}
              style={{ width: `${(configured / total) * 100}%`, transition: "width 1s ease" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminIntegrations() {
  const { data, isLoading, refetch, isFetching } = useQuery<any>({
    queryKey: ["/api/admin/integrations-status"],
    queryFn: async () => {
      const r = await fetch("/api/admin/integrations-status");
      if (!r.ok) throw new Error("فشل جلب حالة التكاملات");
      return r.json();
    },
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-[#DFB369]" />
    </div>
  );

  const categories = [...new Set(INTEGRATIONS.map(i => i.category))];
  const totalConfigured = INTEGRATIONS.filter(intg => {
    const st = data?.[intg.id] || {};
    return intg.keys.every(k => st[k.key]);
  }).length;

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-xl">
              <Key className="h-6 w-6 text-blue-600" />
            </div>
            ربط الخدمات والمفاتيح
          </h2>
          <p className="text-sm text-slate-400 font-bold mt-1 pr-11">إدارة جميع مفاتيح API والخدمات المرتبطة بالنظام</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-black hover:bg-slate-200 transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          تحديث
        </button>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-center">
          <p className="text-3xl font-black text-emerald-600">{totalConfigured}</p>
          <p className="text-[11px] font-bold text-emerald-500 mt-1">خدمة مُفعَّلة</p>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-center">
          <p className="text-3xl font-black text-amber-600">
            {INTEGRATIONS.filter(intg => {
              const st = data?.[intg.id] || {};
              const c = intg.keys.filter(k => st[k.key]).length;
              return c > 0 && c < intg.keys.length;
            }).length}
          </p>
          <p className="text-[11px] font-bold text-amber-500 mt-1">إعداد جزئي</p>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-center">
          <p className="text-3xl font-black text-red-600">
            {INTEGRATIONS.filter(intg => {
              const st = data?.[intg.id] || {};
              return intg.keys.every(k => !st[k.key]);
            }).length}
          </p>
          <p className="text-[11px] font-bold text-red-500 mt-1">غير مُفعَّلة</p>
        </div>
      </div>

      {/* Notice */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-start gap-3">
        <AlertTriangle className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-black text-blue-800">لإضافة أو تعديل مفتاح</p>
          <p className="text-[11px] text-blue-600 font-bold mt-0.5">
            انتقل إلى <strong>إعدادات Replit ← Secrets</strong> وأضف المفتاح بالاسم الصحيح. تُطبَّق التغييرات بعد إعادة تشغيل الخادم.
          </p>
        </div>
      </div>

      {/* By category */}
      {categories.map(cat => {
        const catIntgs = INTEGRATIONS.filter(i => i.category === cat);
        return (
          <div key={cat}>
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">{cat}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {catIntgs.map(intg => (
                <IntegrationCard
                  key={intg.id}
                  integration={intg}
                  status={data?.[intg.id] || {}}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
