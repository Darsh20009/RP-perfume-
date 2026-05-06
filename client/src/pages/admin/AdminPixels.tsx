import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getPixelLog, clearPixelLog, type PixelLogEntry } from "@/lib/pixels";
import {
  CheckCircle2, XCircle, Save, Trash2, RefreshCw, Activity,
  Eye, ShoppingCart, CreditCard, DollarSign, Globe
} from "lucide-react";
import { SiMeta, SiTiktok, SiSnapchat, SiX, SiGoogletagmanager } from "react-icons/si";

interface PixelSettings {
  facebookPixelId?: string;
  tiktokPixelId?: string;
  snapchatPixelId?: string;
  twitterPixelId?: string;
  gtmId?: string;
}

const PLATFORMS = [
  {
    key: "facebookPixelId" as keyof PixelSettings,
    name: "Meta (Facebook) Pixel",
    nameAr: "ميتا / فيسبوك",
    Icon: SiMeta,
    color: "#1877F2",
    bg: "#EFF6FF",
    placeholder: "مثال: 123456789012345",
    help: "من: Meta Events Manager → أضف بيانات → فيسبوك بيكسل",
    docsUrl: "https://www.facebook.com/events_manager2",
    events: ["PageView", "ViewContent", "AddToCart", "InitiateCheckout", "Purchase"],
  },
  {
    key: "tiktokPixelId" as keyof PixelSettings,
    name: "TikTok Pixel",
    nameAr: "تيك توك بيكسل",
    Icon: SiTiktok,
    color: "#000000",
    bg: "#F0FDF4",
    placeholder: "مثال: C4ABCDEF1234567890",
    help: "من: TikTok Ads Manager → Assets → Events → Web Events",
    docsUrl: "https://ads.tiktok.com/i18n/events_manager",
    events: ["Browse", "ViewContent", "AddToCart", "InitiateCheckout", "CompletePayment"],
  },
  {
    key: "snapchatPixelId" as keyof PixelSettings,
    name: "Snapchat Pixel",
    nameAr: "سناب شات بيكسل",
    Icon: SiSnapchat,
    color: "#FFFC00",
    bg: "#FEFCE8",
    placeholder: "مثال: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    help: "من: Snapchat Ads Manager → Assets → Snap Pixel",
    docsUrl: "https://ads.snapchat.com/",
    events: ["PAGE_VIEW", "VIEW_CONTENT", "ADD_CART", "START_CHECKOUT", "PURCHASE"],
  },
  {
    key: "twitterPixelId" as keyof PixelSettings,
    name: "X (Twitter) Pixel",
    nameAr: "إكس / تويتر بيكسل",
    Icon: SiX,
    color: "#000000",
    bg: "#F8F9FA",
    placeholder: "مثال: o1abc",
    help: "من: X Ads Manager → Tools → Conversion tracking",
    docsUrl: "https://ads.twitter.com/",
    events: ["PageView", "ViewContent", "AddToCart", "InitiateCheckout", "Purchase"],
  },
  {
    key: "gtmId" as keyof PixelSettings,
    name: "Google Tag Manager",
    nameAr: "جوجل تاج مانيجر",
    Icon: SiGoogletagmanager,
    color: "#4285F4",
    bg: "#EFF6FF",
    placeholder: "مثال: GTM-XXXXXXX",
    help: "من: tagmanager.google.com → حساب → حاوية",
    docsUrl: "https://tagmanager.google.com/",
    events: ["PageView", "ViewContent", "AddToCart", "InitiateCheckout", "Purchase"],
  },
];

const EVENT_ICONS: Record<string, React.ReactNode> = {
  PageView: <Globe className="w-3 h-3" />,
  Browse: <Globe className="w-3 h-3" />,
  PAGE_VIEW: <Globe className="w-3 h-3" />,
  ViewContent: <Eye className="w-3 h-3" />,
  VIEW_CONTENT: <Eye className="w-3 h-3" />,
  AddToCart: <ShoppingCart className="w-3 h-3" />,
  ADD_CART: <ShoppingCart className="w-3 h-3" />,
  InitiateCheckout: <CreditCard className="w-3 h-3" />,
  START_CHECKOUT: <CreditCard className="w-3 h-3" />,
  Purchase: <DollarSign className="w-3 h-3" />,
  CompletePayment: <DollarSign className="w-3 h-3" />,
  PURCHASE: <DollarSign className="w-3 h-3" />,
};

const LOG_EVENT_AR: Record<string, string> = {
  PageView: "مشاهدة صفحة",
  Browse: "تصفح",
  PAGE_VIEW: "مشاهدة صفحة",
  ViewContent: "مشاهدة محتوى",
  VIEW_CONTENT: "مشاهدة محتوى",
  AddToCart: "إضافة للسلة",
  ADD_CART: "إضافة للسلة",
  InitiateCheckout: "بدء الدفع",
  START_CHECKOUT: "بدء الدفع",
  Purchase: "إتمام شراء",
  CompletePayment: "إتمام دفع",
  PURCHASE: "إتمام شراء",
};

export default function AdminPixels() {
  const { toast } = useToast();
  const [form, setForm] = useState<PixelSettings>({});
  const [log, setLog] = useState<PixelLogEntry[]>([]);
  const [logOpen, setLogOpen] = useState(false);

  const { data: settings, isLoading } = useQuery<PixelSettings>({
    queryKey: ["/api/pixels"],
    staleTime: 30_000,
  });

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  useEffect(() => {
    setLog(getPixelLog());
  }, []);

  const saveMutation = useMutation({
    mutationFn: (data: PixelSettings) => apiRequest("PATCH", "/api/store/settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pixels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/store/settings"] });
      toast({ title: "✅ تم الحفظ", description: "تم تحديث إعدادات البيكسل بنجاح" });
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل حفظ الإعدادات", variant: "destructive" });
    },
  });

  const activeCount = PLATFORMS.filter(p => !!form[p.key]?.trim()).length;

  return (
    <div className="space-y-6 p-1" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-[#2B2B60] tracking-tight flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            إدارة البيكسل التسويقي
          </h2>
          <p className="text-xs text-black/50 mt-0.5">ربط بيكسل وسائل التواصل الاجتماعي لتتبع العملاء وتحسين الإعلانات</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${activeCount > 0 ? "bg-green-100 text-green-700" : "bg-black/5 text-black/40"}`}>
            <span className={`w-2 h-2 rounded-full ${activeCount > 0 ? "bg-green-500" : "bg-black/20"}`} />
            {activeCount} من {PLATFORMS.length} مفعّل
          </div>
        </div>
      </div>

      {/* Platform Cards */}
      {isLoading ? (
        <div className="grid gap-4">
          {PLATFORMS.map(p => (
            <div key={p.key} className="h-28 rounded-2xl bg-black/5 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4">
          {PLATFORMS.map(({ key, name, nameAr, Icon, color, bg, placeholder, help, docsUrl, events }) => {
            const value = form[key] || "";
            const active = !!value.trim();
            return (
              <div
                key={key}
                className={`rounded-2xl border-2 transition-all ${active ? "border-green-200 shadow-sm" : "border-black/5"}`}
                style={{ background: active ? bg : "#FAFAFA" }}
              >
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
                      style={{ background: color === "#FFFC00" ? color : color, opacity: active ? 1 : 0.35 }}
                    >
                      <Icon className="w-5 h-5" style={{ color: color === "#FFFC00" ? "#000" : "#fff" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-black text-sm text-[#2B2B60]">{nameAr}</p>
                          <p className="text-[10px] text-black/40 font-mono">{name}</p>
                        </div>
                        {active ? (
                          <span className="flex items-center gap-1 text-[10px] font-black text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" /> مفعّل
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] font-black text-black/30 bg-black/5 px-2 py-0.5 rounded-full">
                            <XCircle className="w-3 h-3" /> غير مفعّل
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex gap-2">
                        <input
                          type="text"
                          value={value}
                          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                          placeholder={placeholder}
                          className="flex-1 text-xs font-mono px-3 py-2 rounded-lg border border-black/10 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 placeholder:text-black/25"
                          data-testid={`input-pixel-${key}`}
                        />
                        {value && (
                          <button
                            onClick={() => setForm(f => ({ ...f, [key]: "" }))}
                            className="px-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="مسح"
                            data-testid={`button-clear-pixel-${key}`}
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div className="mt-1.5 flex items-center justify-between">
                        <p className="text-[10px] text-black/40">{help}</p>
                        <a href={docsUrl} target="_blank" rel="noreferrer" className="text-[10px] text-primary/60 hover:text-primary underline">فتح اللوحة ↗</a>
                      </div>
                    </div>
                  </div>

                  {active && (
                    <div className="mt-3 pt-3 border-t border-black/5">
                      <p className="text-[10px] font-bold text-black/40 mb-1.5">الأحداث المُتتبَّعة:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {events.map(ev => (
                          <span key={ev} className="flex items-center gap-1 text-[10px] font-bold bg-white border border-black/8 px-2 py-0.5 rounded-full text-black/60">
                            {EVENT_ICONS[ev]}
                            {ev}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Save Button */}
      <button
        onClick={() => saveMutation.mutate(form)}
        disabled={saveMutation.isPending}
        className="w-full flex items-center justify-center gap-2 bg-[#2B2B60] hover:bg-[#1a1a40] text-white font-black py-3 rounded-2xl transition-all shadow-lg shadow-[#2B2B60]/20 disabled:opacity-50"
        data-testid="button-save-pixels"
      >
        {saveMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        حفظ إعدادات البيكسل
      </button>

      {/* Event Log */}
      <div className="rounded-2xl border border-black/5 bg-white overflow-hidden">
        <button
          onClick={() => { setLog(getPixelLog()); setLogOpen(o => !o); }}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-black/2 transition-colors"
          data-testid="button-toggle-pixel-log"
        >
          <span className="flex items-center gap-2 font-black text-sm text-[#2B2B60]">
            <Activity className="w-4 h-4 text-primary" />
            سجل الأحداث المُرسَلة
          </span>
          <span className="text-xs text-black/40 font-mono">{log.length} حدث</span>
        </button>
        {logOpen && (
          <div className="border-t border-black/5">
            {log.length === 0 ? (
              <p className="text-xs text-black/30 text-center py-6">لا توجد أحداث مسجّلة بعد</p>
            ) : (
              <>
                <div className="max-h-64 overflow-y-auto">
                  {log.map((entry, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-2 border-b border-black/3 last:border-0">
                      <span className="text-black/30">{EVENT_ICONS[entry.event] || <Activity className="w-3 h-3" />}</span>
                      <span className="flex-1 text-xs font-bold text-black/70">{LOG_EVENT_AR[entry.event] || entry.event}</span>
                      {entry.value ? <span className="text-xs text-green-600 font-black">{entry.value.toLocaleString()} ر.س</span> : null}
                      {entry.contentName ? <span className="text-[10px] text-black/40 truncate max-w-24">{entry.contentName}</span> : null}
                      <span className="text-[10px] text-black/30 font-mono flex-shrink-0">{new Date(entry.at).toLocaleTimeString("ar-SA")}</span>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-2 border-t border-black/5">
                  <button
                    onClick={() => { clearPixelLog(); setLog([]); }}
                    className="text-[11px] text-red-400 hover:text-red-600 flex items-center gap-1 font-bold"
                    data-testid="button-clear-pixel-log"
                  >
                    <Trash2 className="w-3 h-3" /> مسح السجل
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Info box */}
      <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4 text-xs text-blue-700 leading-relaxed">
        <p className="font-black mb-1">كيف يعمل نظام التتبع؟</p>
        <ul className="space-y-1 text-blue-600">
          <li>• <span className="font-bold">مشاهدة الصفحة</span> — يُرسَل تلقائياً عند كل تنقل في المتجر</li>
          <li>• <span className="font-bold">مشاهدة المنتج</span> — عند فتح صفحة تفاصيل أي منتج</li>
          <li>• <span className="font-bold">إضافة للسلة</span> — عند إضافة أي منتج لسلة التسوق</li>
          <li>• <span className="font-bold">بدء الدفع</span> — عند الضغط على زر إتمام الطلب</li>
          <li>• <span className="font-bold">إتمام الشراء</span> — عند اكتمال الدفع وتأكيد الطلب</li>
        </ul>
      </div>
    </div>
  );
}
