import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2, Lightbulb, RefreshCw, ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";

export function AIInsights() {
  const [insights, setInsights] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const { data: orders } = useQuery({
    queryKey: ["/api/orders"],
    queryFn: async () => {
      const r = await fetch("/api/orders", { credentials: "include" });
      return r.json();
    },
  });

  const analyzeOrders = async () => {
    if (!orders) return;
    setLoading(true);
    try {
      const allOrders = Array.isArray(orders) ? orders : [];
      const statusCount: Record<string, number> = {};
      const productSales: Record<string, number> = {};
      let totalRevenue = 0;

      allOrders.forEach((o: any) => {
        statusCount[o.status] = (statusCount[o.status] || 0) + 1;
        totalRevenue += o.total || 0;
        o.items?.forEach((item: any) => {
          const name = item.title || item.name || "منتج";
          productSales[name] = (productSales[name] || 0) + (item.quantity || 1);
        });
      });

      const topProducts = Object.entries(productSales)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([name, sales]) => ({ name, sales }));

      const res = await fetch("/api/ai/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          totalOrders: allOrders.length,
          totalRevenue,
          ordersByStatus: statusCount,
          topProducts,
          recentOrders: allOrders.slice(0, 10),
          periodDays: 30,
        }),
      });
      const data = await res.json();
      setInsights(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const trendIcon = insights?.trend === "up"
    ? <TrendingUp className="h-5 w-5 text-green-600" />
    : insights?.trend === "down"
    ? <TrendingDown className="h-5 w-5 text-red-500" />
    : <Minus className="h-5 w-5 text-yellow-500" />;

  const impactColor: Record<string, string> = {
    high: "bg-red-50 border-red-200 text-red-700",
    medium: "bg-yellow-50 border-yellow-200 text-yellow-700",
    low: "bg-blue-50 border-blue-200 text-blue-700",
  };

  return (
    <div className="border border-black/5 bg-gradient-to-br from-primary/3 via-transparent to-transparent" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-black/5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-black text-base uppercase tracking-tight">تحليلات الذكاء الاصطناعي</h3>
            <p className="text-[10px] text-black/40 font-bold">تحليل شامل لأداء المتجر وتوصيات قابلة للتطبيق</p>
          </div>
        </div>
        <Button
          onClick={analyzeOrders}
          disabled={loading || !orders}
          size="sm"
          className="gap-2 font-black uppercase tracking-widest text-[10px] h-9"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {loading ? "يحلّل البيانات..." : "تحليل الآن"}
        </Button>
      </div>

      <div className="p-6">
        {!insights && !loading && (
          <div className="text-center py-10 space-y-3">
            <div className="h-16 w-16 rounded-full bg-primary/5 flex items-center justify-center mx-auto">
              <Sparkles className="h-8 w-8 text-primary/40" />
            </div>
            <p className="font-black text-sm text-black/40 uppercase tracking-widest">اضغط "تحليل الآن" للحصول على تقرير AI</p>
            <p className="text-[10px] text-black/25 font-bold">يحلّل نظام الذكاء الاصطناعي بيانات المبيعات ويقدم توصيات استراتيجية</p>
          </div>
        )}

        {loading && (
          <div className="text-center py-10 space-y-3">
            <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
            <p className="font-black text-sm text-black/40 uppercase tracking-widest">AI يحلّل بيانات متجرك...</p>
          </div>
        )}

        {insights && !loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-5"
          >
            {/* Overview + Score */}
            <div className="flex items-start justify-between gap-4 p-5 bg-white border border-black/5">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  {trendIcon}
                  <span className="text-[10px] font-black uppercase tracking-widest text-black/40">
                    {insights.trend === "up" ? "أداء متصاعد" : insights.trend === "down" ? "أداء متراجع" : "أداء مستقر"}
                  </span>
                </div>
                <p className="text-sm font-bold text-black/70 leading-relaxed">{insights.overview}</p>
              </div>
              <div className="text-center flex-shrink-0">
                <div className="h-16 w-16 rounded-full border-4 border-primary flex items-center justify-center">
                  <span className="font-black text-xl text-primary">{insights.score}</span>
                </div>
                <p className="text-[8px] font-black uppercase tracking-widest text-black/30 mt-1">أداء / 100</p>
              </div>
            </div>

            {/* Highlights */}
            {insights.highlights?.length > 0 && (
              <div className="space-y-2">
                <p className="text-[9px] font-black uppercase tracking-widest text-black/40">إنجازات إيجابية</p>
                {insights.highlights.map((h: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 p-3 bg-green-50 border border-green-200">
                    <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs font-bold text-green-800">{h}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Warnings */}
            {insights.warnings?.length > 0 && insights.warnings[0] && (
              <div className="space-y-2">
                <p className="text-[9px] font-black uppercase tracking-widest text-black/40">تنبيهات</p>
                {insights.warnings.map((w: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200">
                    <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs font-bold text-amber-800">{w}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Recommendations */}
            {insights.recommendations?.length > 0 && (
              <div className="space-y-2">
                <p className="text-[9px] font-black uppercase tracking-widest text-black/40">توصيات استراتيجية</p>
                {insights.recommendations.map((rec: any, i: number) => (
                  <div key={i} className="p-4 bg-white border border-black/5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Lightbulb className="h-4 w-4 text-primary" />
                        <p className="font-black text-sm">{rec.title}</p>
                      </div>
                      <Badge className={`text-[8px] border ${impactColor[rec.impact] || ""}`} variant="outline">
                        {rec.impact === "high" ? "أولوية عالية" : rec.impact === "medium" ? "متوسطة" : "منخفضة"}
                      </Badge>
                    </div>
                    <div className="flex items-start gap-2">
                      <ArrowUpRight className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-black/60 font-bold">{rec.action}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
