import { useQuery } from "@tanstack/react-query";
import { Brain, TrendingUp, TrendingDown, AlertTriangle, Sparkles, Loader2, RefreshCw, Package, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";

type InventoryInsights = {
  topMovers: { name: string; insight: string }[];
  slowMovers: { name: string; insight: string }[];
  restockUrgent: { name: string; reason: string; suggestedQty: number }[];
  overallHealth: string;
  recommendations: string[];
  generatedAt: string;
  totalRevenue: number;
  productCount: number;
  fallback?: boolean;
};

export default function AdminAiInsights() {
  const { data, isLoading, isFetching, refetch, error, isError } = useQuery<InventoryInsights>({
    queryKey: ["/api/admin/ai/inventory-insights"],
    staleTime: 10 * 60_000,
    retry: 1,
  });

  return (
    <div className="space-y-6" data-testid="admin-ai-insights">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1a2744] via-[#243558] to-[#1a2744] p-8 text-white">
        <div className="absolute -top-12 -end-12 w-64 h-64 rounded-full bg-[#c9a96e]/15 blur-3xl pointer-events-none" />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#c9a96e] to-[#a88550] flex items-center justify-center shadow-2xl">
              <Brain className="w-7 h-7 text-white" />
            </div>
            <div>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.3em] text-[#c9a96e] mb-1">
                <Sparkles className="w-3 h-3" /> ذكاء اصطناعي
              </span>
              <h2 className="text-2xl font-black">مساعد المخزون والمبيعات</h2>
              <p className="text-sm text-white/70 mt-1">تحليل ذكي لمنتجاتك مع توصيات إعادة التخزين والمنتجات الأكثر/الأقل حركة.</p>
            </div>
          </div>
          <Button onClick={() => refetch()} disabled={isFetching} className="bg-[#c9a96e] hover:bg-[#b8944f] text-white shrink-0" data-testid="button-refresh-insights">
            <RefreshCw className={`w-4 h-4 me-2 ${isFetching ? "animate-spin" : ""}`} /> تحديث
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-[#c9a96e]" /></div>
      ) : isError ? (
          <div className="text-center py-16 bg-red-50 border border-red-200 rounded-2xl" data-testid="ai-insights-error">
            <AlertTriangle className="w-12 h-12 mx-auto text-red-400 mb-3" />
            <p className="font-bold text-red-700">تعذّر جلب التحليلات</p>
            <p className="text-xs text-red-500 mt-1">{(error as any)?.message || "خطأ غير متوقع. تأكّد من صلاحياتك أو حاول مجدداً."}</p>
            <Button onClick={() => refetch()} className="mt-4 bg-red-500 hover:bg-red-600 text-white" data-testid="button-retry-insights">إعادة المحاولة</Button>
          </div>
        ) : !data ? (
          <div className="text-center py-20 bg-[#faf8f5] rounded-2xl">
          <Brain className="w-12 h-12 mx-auto text-[#c9a96e]/40 mb-3" />
          <p className="font-bold text-slate-700">لا تتوفر بيانات كافية بعد</p>
          <p className="text-xs text-slate-500 mt-1">سجّل بعض المبيعات لتظهر التحليلات</p>
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-[#e8e2d9] p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">إيرادات ٣٠ يوم</p>
              <p className="text-3xl font-black text-[#1a2744] mt-2">{Number(data.totalRevenue).toLocaleString("ar-SA")} <span className="text-sm font-normal text-slate-500">ر.س</span></p>
            </div>
            <div className="bg-white rounded-2xl border border-[#e8e2d9] p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">عدد المنتجات</p>
              <p className="text-3xl font-black text-[#1a2744] mt-2">{data.productCount}</p>
            </div>
            <div className="bg-white rounded-2xl border border-red-200 p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-red-500">يحتاج إعادة تخزين</p>
              <p className="text-3xl font-black text-red-600 mt-2">{data.restockUrgent?.length || 0}</p>
            </div>
          </div>

          {/* Overall health */}
          <div className="bg-gradient-to-br from-[#faf8f5] to-white rounded-2xl border-2 border-[#c9a96e]/20 p-6">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-[#c9a96e]" />
              <h3 className="font-black text-[#1a2744]">التقييم العام</h3>
              {data.fallback && <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold">تحليل تلقائي</span>}
            </div>
            <p className="text-sm text-slate-700 leading-loose">{data.overallHealth}</p>
          </div>

          {/* Top + Slow movers */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-emerald-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
                <h3 className="font-black text-[#1a2744]">الأكثر مبيعاً</h3>
              </div>
              <div className="space-y-3">
                {data.topMovers?.map((m, i) => (
                  <div key={i} className="border-s-4 border-emerald-400 ps-3 py-1" data-testid={`top-mover-${i}`}>
                    <p className="font-bold text-sm text-[#1a2744]">{m.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{m.insight}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-amber-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingDown className="w-5 h-5 text-amber-600" />
                <h3 className="font-black text-[#1a2744]">بطيئة الحركة</h3>
              </div>
              <div className="space-y-3">
                {data.slowMovers?.map((m, i) => (
                  <div key={i} className="border-s-4 border-amber-400 ps-3 py-1" data-testid={`slow-mover-${i}`}>
                    <p className="font-bold text-sm text-[#1a2744]">{m.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{m.insight}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Restock urgent */}
          {data.restockUrgent?.length > 0 && (
            <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <h3 className="font-black text-red-900">يحتاج إعادة تخزين عاجلة</h3>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                {data.restockUrgent.map((r, i) => (
                  <div key={i} className="bg-white rounded-xl p-4 border border-red-100 flex items-start gap-3" data-testid={`restock-${i}`}>
                    <Package className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-bold text-sm text-[#1a2744]">{r.name}</p>
                      <p className="text-xs text-slate-500 mt-1">{r.reason}</p>
                      <p className="text-[11px] font-black text-red-600 mt-2">اطلب: {r.suggestedQty} وحدة</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Strategic recommendations */}
          <div className="bg-gradient-to-br from-[#1a2744] to-[#243558] text-white rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className="w-5 h-5 text-[#c9a96e]" />
              <h3 className="font-black">توصيات استراتيجية</h3>
            </div>
            <ul className="space-y-2">
              {data.recommendations?.map((r, i) => (
                <li key={i} className="flex items-start gap-3 text-sm" data-testid={`recommendation-${i}`}>
                  <span className="w-6 h-6 rounded-full bg-[#c9a96e]/20 text-[#c9a96e] font-black text-xs flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                  <span className="text-white/85 leading-relaxed">{r}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-[10px] text-center text-slate-400">
            آخر تحديث: {new Date(data.generatedAt).toLocaleString("ar-SA")}
          </p>
        </>
      )}
    </div>
  );
}
