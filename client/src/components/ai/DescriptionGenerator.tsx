import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, Copy, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface DescriptionGeneratorProps {
  productName: string;
  productCategory: string;
  price: number;
  onApply?: (description: string) => void;
  onApplyEn?: (description: string) => void;
}

export function DescriptionGenerator({ productName, productCategory, price, onApply, onApplyEn }: DescriptionGeneratorProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const generate = async () => {
    if (!productName) return;
    setLoading(true);
    try {
      const res = await fetch("/api/ai/generate-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: productName, category: productCategory, price }),
      });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ error: "حدث خطأ" });
    }
    setLoading(false);
  };

  const copyToClipboard = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={generate}
        disabled={loading || !productName}
        className="h-8 text-[10px] font-black uppercase tracking-widest gap-1.5 border-primary/30 text-primary hover:bg-primary hover:text-white"
      >
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
        {loading ? "AI يكتب الوصف..." : "توليد وصف بالذكاء الاصطناعي"}
      </Button>

      <AnimatePresence>
        {result && !result.error && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="border border-primary/20 bg-primary/3 p-4 space-y-3"
          >
            <p className="text-[9px] font-black uppercase tracking-widest text-primary flex items-center gap-1">
              <Sparkles className="h-2.5 w-2.5" /> نتائج AI
            </p>

            {/* Arabic Description */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-black text-black/40 uppercase">الوصف بالعربية</p>
                <div className="flex gap-1">
                  <button onClick={() => copyToClipboard(result.description_ar, "ar")}
                    className="h-5 w-5 flex items-center justify-center text-black/30 hover:text-primary">
                    {copied === "ar" ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                  </button>
                  {onApply && (
                    <button onClick={() => onApply(result.description_ar)}
                      className="text-[8px] font-black text-primary px-1.5 py-0.5 border border-primary/30 hover:bg-primary hover:text-white transition-all">
                      تطبيق
                    </button>
                  )}
                </div>
              </div>
              <p className="text-xs font-bold text-black/70 leading-relaxed bg-white p-2 border border-black/5" dir="rtl">
                {result.description_ar}
              </p>
            </div>

            {/* English Description */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-black text-black/40 uppercase">Description (English)</p>
                <div className="flex gap-1">
                  <button onClick={() => copyToClipboard(result.description_en, "en")}
                    className="h-5 w-5 flex items-center justify-center text-black/30 hover:text-primary">
                    {copied === "en" ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                  </button>
                  {onApplyEn && (
                    <button onClick={() => onApplyEn(result.description_en)}
                      className="text-[8px] font-black text-primary px-1.5 py-0.5 border border-primary/30 hover:bg-primary hover:text-white transition-all">
                      Apply
                    </button>
                  )}
                </div>
              </div>
              <p className="text-xs font-bold text-black/70 leading-relaxed bg-white p-2 border border-black/5" dir="ltr">
                {result.description_en}
              </p>
            </div>

            {/* Highlights */}
            {result.highlights_ar?.length > 0 && (
              <div className="space-y-1">
                <p className="text-[9px] font-black text-black/40 uppercase">المميزات الرئيسية</p>
                <div className="flex flex-wrap gap-1" dir="rtl">
                  {result.highlights_ar.map((h: string, i: number) => (
                    <span key={i} className="text-[9px] font-black bg-white border border-black/10 px-2 py-0.5 text-black/60">
                      ✓ {h}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {result.care_instructions && (
              <p className="text-[9px] text-black/40 font-bold border-t border-black/5 pt-2">
                <span className="font-black">العناية:</span> {result.care_instructions}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
