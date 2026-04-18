import { useQuery } from "@tanstack/react-query";
import { Brain, Sparkles, Clock, Wind, Calendar, ThumbsUp, ThumbsDown } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";

type Insights = {
  summaryAr: string; summaryEn: string;
  scentNotes: string[];
  longevity: string; sillage: string;
  occasions: string[];
  pros: string[]; cons: string[];
  sentiment: number;
  basedOnReviewCount: number;
  generatedAt: string;
};

export function ProductInsightsCard({ productId }: { productId: string }) {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { data, isLoading } = useQuery<Insights | null>({
    queryKey: ["/api/products", productId, "insights"],
    queryFn: async () => {
      const res = await fetch(`/api/products/${productId}/insights`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!productId,
    staleTime: 10 * 60_000,
  });

  if (isLoading || !data || !data.summaryAr && !data.summaryEn) return null;

  const summary = isAr ? (data.summaryAr || data.summaryEn) : (data.summaryEn || data.summaryAr);

  return (
    <div
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1a2744] via-[#243558] to-[#1a2744] text-white p-6 md:p-8 shadow-2xl"
      dir={isAr ? "rtl" : "ltr"}
      data-testid="product-insights-card"
    >
      <div className="absolute -top-12 -end-12 w-64 h-64 rounded-full bg-[#c9a96e]/15 blur-3xl pointer-events-none" />
      <div className="relative">
        <div className="flex items-start gap-3 mb-5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#c9a96e] to-[#a88550] flex items-center justify-center shadow-lg shrink-0">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <div>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.3em] text-[#c9a96e] mb-1">
              <Sparkles className="w-3 h-3" /> {isAr ? "تحليل ذكي" : "AI Insight"}
            </span>
            <h3 className="text-lg font-black">{isAr ? "ملف العطر" : "Scent Profile"}</h3>
          </div>
        </div>

        <p className="text-sm text-white/85 leading-loose mb-6">{summary}</p>

        {data.scentNotes?.length > 0 && (
          <div className="mb-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#c9a96e] mb-2">{isAr ? "النوتات العطرية" : "Scent Notes"}</p>
            <div className="flex flex-wrap gap-2">
              {data.scentNotes.map((n, i) => (
                <span key={i} className="px-3 py-1.5 rounded-full bg-[#c9a96e]/15 border border-[#c9a96e]/30 text-[11px] font-bold text-[#c9a96e]">{n}</span>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mb-5">
          {data.longevity && (
            <div className="bg-white/5 rounded-lg p-3 border border-white/10">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-3.5 h-3.5 text-[#c9a96e]" />
                <p className="text-[9px] font-bold uppercase tracking-widest text-white/60">{isAr ? "الثبات" : "Longevity"}</p>
              </div>
              <p className="text-xs font-bold">{data.longevity}</p>
            </div>
          )}
          {data.sillage && (
            <div className="bg-white/5 rounded-lg p-3 border border-white/10">
              <div className="flex items-center gap-2 mb-1">
                <Wind className="w-3.5 h-3.5 text-[#c9a96e]" />
                <p className="text-[9px] font-bold uppercase tracking-widest text-white/60">{isAr ? "البصمة" : "Sillage"}</p>
              </div>
              <p className="text-xs font-bold">{data.sillage}</p>
            </div>
          )}
        </div>

        {data.occasions?.length > 0 && (
          <div className="mb-5 flex items-start gap-2">
            <Calendar className="w-4 h-4 text-[#c9a96e] shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#c9a96e] mb-1">{isAr ? "مناسب لـ" : "Best For"}</p>
              <p className="text-xs text-white/80">{data.occasions.join(" · ")}</p>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-3 pt-4 border-t border-white/10">
          {data.pros?.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ThumbsUp className="w-3.5 h-3.5 text-emerald-400" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-300">{isAr ? "نقاط القوة" : "Pros"}</p>
              </div>
              <ul className="space-y-1">
                {data.pros.map((p, i) => <li key={i} className="text-[11px] text-white/75">• {p}</li>)}
              </ul>
            </div>
          )}
          {data.cons?.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ThumbsDown className="w-3.5 h-3.5 text-amber-400" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-300">{isAr ? "ملاحظات" : "Notes"}</p>
              </div>
              <ul className="space-y-1">
                {data.cons.map((p, i) => <li key={i} className="text-[11px] text-white/75">• {p}</li>)}
              </ul>
            </div>
          )}
        </div>

        <p className="text-[9px] text-white/40 mt-5 text-center">
          {isAr ? `مبني على ${data.basedOnReviewCount} تقييم` : `Based on ${data.basedOnReviewCount} reviews`}
        </p>
      </div>
    </div>
  );
}
