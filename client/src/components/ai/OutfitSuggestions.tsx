import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, Tag, Calendar, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface OutfitSuggestionsProps {
  productName: string;
  productCategory: string;
  gender?: string;
}

export function OutfitSuggestions({ productName, productCategory, gender }: OutfitSuggestionsProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [occasion, setOccasion] = useState("");

  const occasions = ["كاجوال", "عمل", "سهرة", "رياضة", "عرس"];

  const getSuggestions = async () => {
    setLoading(true);
    setOpen(true);
    try {
      const res = await fetch("/api/ai/outfit-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productName, productCategory, occasion: occasion || undefined, gender }),
      });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ error: "حدث خطأ، حاول مجدداً" });
    }
    setLoading(false);
  };

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap" dir="rtl">
        <span className="text-[9px] font-black uppercase text-black/30">المناسبة:</span>
        {occasions.map(o => (
          <button
            key={o}
            onClick={() => setOccasion(o === occasion ? "" : o)}
            className={`text-[9px] font-black px-2 py-1 border transition-all ${
              occasion === o ? "border-primary bg-primary text-white" : "border-black/10 hover:border-black/20"
            }`}
          >
            {o}
          </button>
        ))}
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={getSuggestions}
        disabled={loading}
        className="w-full h-9 font-black uppercase tracking-widest text-[10px] gap-2 border-dashed border-black/20 hover:border-primary hover:text-primary"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        اقتراحات تنسيق بالذكاء الاصطناعي
      </Button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="border border-primary/20 bg-primary/3 p-4 space-y-4" dir="rtl">
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-black uppercase tracking-widest text-primary flex items-center gap-1">
                  <Sparkles className="h-2.5 w-2.5" /> اقتراحات التنسيق AI
                </p>
                <button onClick={() => setOpen(false)}>
                  <X className="h-3.5 w-3.5 text-black/30" />
                </button>
              </div>

              {loading && (
                <div className="text-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto mb-2" />
                  <p className="text-[10px] font-black text-black/30">AI يُعدّ اقتراحات التنسيق...</p>
                </div>
              )}

              {result && !loading && !result.error && (
                <div className="space-y-4">
                  {/* Occasions */}
                  {result.occasions?.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Calendar className="h-3 w-3 text-primary" />
                        <p className="text-[9px] font-black uppercase text-black/40">مناسبات مقترحة</p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {result.occasions.map((o: string, i: number) => (
                          <span key={i} className="text-[9px] font-black bg-white border border-black/10 px-2 py-1 text-black/60">
                            {o}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Combinations */}
                  {result.combinations?.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Tag className="h-3 w-3 text-primary" />
                        <p className="text-[9px] font-black uppercase text-black/40">قطع تنسيق مقترحة</p>
                      </div>
                      <div className="space-y-2">
                        {result.combinations.map((c: any, i: number) => (
                          <div key={i} className="flex items-start gap-2 bg-white p-2.5 border border-black/5">
                            <span className="h-5 w-5 rounded-full bg-primary flex items-center justify-center text-[8px] font-black text-white flex-shrink-0">
                              {i + 1}
                            </span>
                            <div>
                              <p className="text-xs font-black text-black/80">{c.item}</p>
                              <p className="text-[9px] text-black/40 font-bold">{c.why}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Style Tip */}
                  {result.style_tip && (
                    <div className="bg-white border-r-4 border-primary p-3">
                      <p className="text-[9px] font-black uppercase text-primary mb-1">💡 نصيحة الأسلوب</p>
                      <p className="text-xs font-bold text-black/70">{result.style_tip}</p>
                    </div>
                  )}

                  {/* Avoid */}
                  {result.avoid && (
                    <div className="bg-red-50 border border-red-200 p-3">
                      <p className="text-[9px] font-black uppercase text-red-600 mb-1">⚠️ تجنبي</p>
                      <p className="text-xs font-bold text-red-700">{result.avoid}</p>
                    </div>
                  )}
                </div>
              )}

              {result?.error && !loading && (
                <p className="text-xs text-red-500 font-bold text-center">{result.error}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
