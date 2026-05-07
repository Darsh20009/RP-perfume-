import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import {
  Loader2, Download, TrendingUp, TrendingDown, BarChart3,
  Wallet, CheckCircle, AlertTriangle, Calendar, Minus as MinusIcon
} from "lucide-react";
import type { CashShift } from "@shared/schema";
import { RiyalSign } from "@/components/RiyalSign";

function StatCard({
  label, value, sub, accent = "text-[#2B2B60]", icon: Icon
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
  icon: any;
}) {
  return (
    <Card className="border border-[#DFB369]/20 bg-gradient-to-br from-white to-[#FAF8F4]">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">{label}</span>
          <Icon className={`h-4 w-4 ${accent}`} />
        </div>
        <p className={`text-3xl font-black ${accent}`}>{value}</p>
        {sub && <p className="text-xs text-gray-500 font-bold mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function CashDrawerReport() {
  const { user } = useAuth();
  const branchId = user?.branchId || "main";

  const { data: report, isLoading } = useQuery({
    queryKey: [`/api/cash-shifts/branch/${branchId}/report`],
    queryFn: async () => {
      const response = await fetch(`/api/cash-shifts/branch/${branchId}/report`);
      if (!response.ok) throw new Error("Failed to fetch report");
      return response.json();
    },
  });

  const handleExport = () => {
    if (!report?.shifts) return;
    const csv = [
      ["التاريخ والوقت", "الرصيد الافتتاحي", "الرصيد الفعلي", "الفرق", "الحالة"].join(","),
      ...report.shifts.map((shift: CashShift) => [
        new Date(shift.closedAt || new Date()).toLocaleString("ar-SA"),
        shift.openingBalance?.toFixed(2),
        shift.actualCash?.toFixed(2),
        shift.difference?.toFixed(2),
        (shift.difference || 0) === 0 ? "متطابق" : (shift.difference || 0) > 0 ? "زيادة" : "عجز"
      ].join(","))
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `cash-report-${new Date().getTime()}.csv`;
    link.click();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-[#DFB369]" />
      </div>
    );
  }

  const totalOpened = report?.totalOpened || 0;
  const totalActual = report?.totalActual || 0;
  const totalDifference = report?.totalDifference || 0;
  const totalShifts = report?.totalShifts || 0;
  const balanced = report?.shifts?.filter((s: CashShift) => (s.difference || 0) === 0).length || 0;

  return (
    <div className="min-h-screen p-6 md:p-8 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[#2B2B60]">تقارير صندوق النقد</h1>
          <p className="text-sm text-gray-600 font-bold mt-1">تقرير شامل عن جميع الورديات المغلقة</p>
        </div>
        <Button
          onClick={handleExport}
          disabled={!report?.shifts?.length}
          className="gap-2 bg-[#2B2B60] hover:bg-[#1c1c45] text-white font-black h-11 px-6"
          data-testid="button-export-csv"
        >
          <Download className="h-4 w-4" />
          تصدير CSV
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="عدد الورديات"
          value={totalShifts}
          icon={BarChart3}
        />
        <StatCard
          label="متطابقة / إجمالي"
          value={`${balanced} / ${totalShifts}`}
          sub={totalShifts ? `${Math.round((balanced / totalShifts) * 100)}% دقة` : undefined}
          accent="text-emerald-600"
          icon={CheckCircle}
        />
        <StatCard
          label="إجمالي الأرصدة الفعلية"
          value={`${totalActual.toFixed(2)}`}
          sub="ريال سعودي"
          accent="text-[#DFB369]"
          icon={Wallet}
        />
        <StatCard
          label="صافي الفروقات"
          value={`${totalDifference > 0 ? "+" : ""}${totalDifference.toFixed(2)}`}
          sub={totalDifference === 0 ? "لا فروقات" : totalDifference > 0 ? "فائض" : "عجز"}
          accent={totalDifference === 0 ? "text-emerald-600" : totalDifference > 0 ? "text-blue-600" : "text-red-600"}
          icon={totalDifference >= 0 ? TrendingUp : TrendingDown}
        />
      </div>

      {/* Shifts Table */}
      <Card className="border border-[#DFB369]/20">
        <div className="p-5 border-b border-[#DFB369]/15 flex items-center gap-3">
          <Calendar className="h-5 w-5 text-[#DFB369]" />
          <h2 className="text-lg font-black text-[#2B2B60]">تفاصيل الورديات</h2>
          <Badge variant="outline" className="border-[#DFB369]/40 text-[#2B2B60] font-black ml-auto">
            {totalShifts} سجل
          </Badge>
        </div>

        {report?.shifts && report.shifts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#FAF8F4] border-b border-[#DFB369]/15">
                  <th className="text-right py-3 px-5 text-[10px] font-black uppercase tracking-wider text-gray-500">التاريخ والوقت</th>
                  <th className="text-right py-3 px-5 text-[10px] font-black uppercase tracking-wider text-gray-500">الافتتاحي</th>
                  <th className="text-right py-3 px-5 text-[10px] font-black uppercase tracking-wider text-gray-500">الفعلي</th>
                  <th className="text-right py-3 px-5 text-[10px] font-black uppercase tracking-wider text-gray-500">الفرق</th>
                  <th className="text-right py-3 px-5 text-[10px] font-black uppercase tracking-wider text-gray-500">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DFB369]/10">
                {report.shifts.map((shift: CashShift) => {
                  const d = shift.difference || 0;
                  return (
                    <tr key={shift.id} className="hover:bg-[#FAF8F4]/60 transition-colors" data-testid={`row-shift-${shift.id}`}>
                      <td className="py-4 px-5">
                        <p className="text-sm font-bold text-[#2B2B60]">
                          {new Date(shift.closedAt || new Date()).toLocaleString("ar-SA", { dateStyle: "short", timeStyle: "short" })}
                        </p>
                      </td>
                      <td className="py-4 px-5">
                        <p className="text-sm font-black text-[#2B2B60]">{(shift.openingBalance || 0).toFixed(2)} <RiyalSign /></p>
                      </td>
                      <td className="py-4 px-5">
                        <p className="text-sm font-black text-[#2B2B60]">{(shift.actualCash || 0).toFixed(2)} <RiyalSign /></p>
                      </td>
                      <td className="py-4 px-5">
                        <p className={`text-sm font-black flex items-center gap-1 ${
                          d === 0 ? "text-emerald-600" : d > 0 ? "text-blue-600" : "text-red-600"
                        }`}>
                          {d > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : d < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : <MinusIcon className="h-3.5 w-3.5" />}
                          {d > 0 ? "+" : ""}{d.toFixed(2)} <RiyalSign />
                        </p>
                      </td>
                      <td className="py-4 px-5">
                        <Badge
                          className={`font-black text-xs ${
                            d === 0
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : d > 0
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : "bg-red-50 text-red-700 border border-red-200"
                          }`}
                          variant="outline"
                        >
                          {d === 0 ? "✓ متطابق" : d > 0 ? "فائض" : "عجز"}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-16 text-center">
            <BarChart3 className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="font-black text-gray-500">لم تغلق أي وردية بعد</p>
            <p className="text-xs text-gray-400 mt-1 font-bold">ستظهر البيانات هنا بعد إغلاق أول وردية</p>
          </div>
        )}
      </Card>
    </div>
  );
}
