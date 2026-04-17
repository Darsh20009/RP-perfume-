import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Ruler, ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface SizeAdvisorProps {
  productName: string;
  productCategory: string;
  availableSizes: string[];
  onSizeSelect?: (size: string) => void;
}

export function SizeAdvisor({ productName, productCategory, availableSizes, onSizeSelect }: SizeAdvisorProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [gender, setGender] = useState<"male" | "female">("female");
  const [measurements, setMeasurements] = useState({
    height: "",
    weight: "",
    chest: "",
    waist: "",
    hip: "",
    shoulder: "",
  });

  const handleGet = async () => {
    const filled = Object.values(measurements).some(v => v.trim() !== "");
    if (!filled) return;
    setLoading(true);
    try {
      const res = await fetch("/api/ai/size-advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName,
          productCategory,
          availableSizes,
          gender,
          measurements: Object.fromEntries(
            Object.entries(measurements)
              .filter(([, v]) => v.trim() !== "")
              .map(([k, v]) => [k, parseFloat(v)])
          ),
        }),
      });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ error: "حدث خطأ، حاول مجدداً" });
    }
    setLoading(false);
  };

  const confidenceColor = {
    high: "bg-green-100 text-green-700 border-green-200",
    medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
    low: "bg-red-100 text-red-700 border-red-200",
  };

  const fitLabel: Record<string, string> = {
    slim: "ضيق نسبياً",
    regular: "مقاس طبيعي",
    loose: "واسع نسبياً",
  };

  return (
    <div className="border border-black/8 bg-gradient-to-br from-primary/3 to-transparent rounded-none mt-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-4 text-right"
      >
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <p className="font-black text-sm uppercase tracking-widest">AI مستشار المقاسات</p>
            <p className="text-[9px] text-black/40 font-bold mt-0.5">أدخل مقاساتك واحصل على توصية فورية</p>
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-black/30" /> : <ChevronDown className="h-4 w-4 text-black/30" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4" dir="rtl">
              {/* Gender */}
              <div className="flex gap-2">
                {(["female", "male"] as const).map(g => (
                  <button
                    key={g}
                    onClick={() => setGender(g)}
                    className={`flex-1 h-9 text-xs font-black uppercase tracking-widest border transition-all ${
                      gender === g ? "border-primary bg-primary text-white" : "border-black/10 hover:border-black/20"
                    }`}
                  >
                    {g === "female" ? "👩 امرأة" : "👨 رجل"}
                  </button>
                ))}
              </div>

              {/* Measurements Grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: "height", label: "الطول (سم)", placeholder: "170" },
                  { key: "weight", label: "الوزن (كغ)", placeholder: "65" },
                  { key: "chest", label: "محيط الصدر (سم)", placeholder: "90" },
                  { key: "waist", label: "محيط الخصر (سم)", placeholder: "72" },
                  { key: "hip", label: "محيط الورك (سم)", placeholder: "96" },
                  { key: "shoulder", label: "عرض الكتف (سم)", placeholder: "40" },
                ].map(({ key, label, placeholder }) => (
                  <div key={key} className="space-y-1">
                    <Label className="text-[9px] font-black uppercase text-black/50">{label}</Label>
                    <Input
                      type="number"
                      placeholder={placeholder}
                      value={measurements[key as keyof typeof measurements]}
                      onChange={e => setMeasurements(prev => ({ ...prev, [key]: e.target.value }))}
                      className="h-8 text-xs font-bold"
                    />
                  </div>
                ))}
              </div>

              <Button
                onClick={handleGet}
                disabled={loading || !Object.values(measurements).some(v => v)}
                className="w-full h-10 font-black uppercase tracking-widest text-[11px] gap-2"
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> AI يحلّل مقاساتك...</>
                ) : (
                  <><Sparkles className="h-4 w-4" /> احصل على توصية المقاس</>
                )}
              </Button>

              {/* Result */}
              <AnimatePresence>
                {result && !result.error && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white border border-primary/20 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center">
                          <span className="text-white font-black text-sm">{result.recommendedSize}</span>
                        </div>
                        <div>
                          <p className="font-black text-sm">المقاس الموصى به</p>
                          <Badge className={`text-[8px] border ${confidenceColor[result.confidence as keyof typeof confidenceColor] || ""}`} variant="outline">
                            دقة {result.confidence === "high" ? "عالية" : result.confidence === "medium" ? "متوسطة" : "منخفضة"}
                          </Badge>
                        </div>
                      </div>
                      {result.fit && (
                        <Badge variant="secondary" className="text-[9px]">
                          <Ruler className="h-2.5 w-2.5 ml-1" />
                          {fitLabel[result.fit] || result.fit}
                        </Badge>
                      )}
                    </div>

                    <p className="text-xs text-black/60 font-bold leading-relaxed">{result.reasoning}</p>

                    {result.tips?.length > 0 && (
                      <div className="space-y-1">
                        {result.tips.map((tip: string, i: number) => (
                          <div key={i} className="flex items-start gap-2 text-[10px] text-black/50 font-bold">
                            <CheckCircle2 className="h-3 w-3 text-primary mt-0.5 flex-shrink-0" />
                            {tip}
                          </div>
                        ))}
                      </div>
                    )}

                    {result.alternativeSize && (
                      <p className="text-[9px] text-black/40 font-bold border-t border-black/5 pt-2">
                        البديل: <span className="font-black text-black/60">{result.alternativeSize}</span> — إن كنت تفضل الراحة/الضيق
                      </p>
                    )}

                    {onSizeSelect && result.recommendedSize && availableSizes.includes(result.recommendedSize) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onSizeSelect(result.recommendedSize)}
                        className="w-full h-8 text-[10px] font-black uppercase tracking-widest border-primary text-primary hover:bg-primary hover:text-white"
                      >
                        اختر المقاس {result.recommendedSize}
                      </Button>
                    )}
                  </motion.div>
                )}
                {result?.error && (
                  <p className="text-xs text-red-500 font-bold text-center py-2">{result.error}</p>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
