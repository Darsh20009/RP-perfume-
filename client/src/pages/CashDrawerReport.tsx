import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, Download, TrendingUp, TrendingDown } from "lucide-react";
import type { CashShift } from "@shared/schema";

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

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `cash-report-${new Date().getTime()}.csv`;
    link.click();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalOpened = report?.totalOpened || 0;
  const totalActual = report?.totalActual || 0;
  const totalDifference = report?.totalDifference || 0;

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold mb-2">تقارير صندوق النقد</h1>
            <p className="text-muted-foreground">تقرير شامل عن الورديات المغلقة</p>
          </div>
          <Button onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" />
            تحميل CSV
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">عدد الورديات</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-black">{report?.totalShifts || 0}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">إجمالي الأرصدة الافتتاحية</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-black text-primary">{totalOpened.toFixed(2)} ر.س</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">إجمالي الأرصدة الفعلية</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-black text-blue-600">{totalActual.toFixed(2)} ر.س</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">إجمالي الفرق</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-3xl font-black flex items-center gap-1 ${
                totalDifference === 0 ? "text-green-600" : totalDifference > 0 ? "text-blue-600" : "text-red-600"
              }`}>
                {totalDifference > 0 ? <TrendingUp className="h-6 w-6" /> : totalDifference < 0 ? <TrendingDown className="h-6 w-6" /> : null}
                {totalDifference.toFixed(2)} ر.س
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Shifts Table */}
        <Card>
          <CardHeader>
            <CardTitle>تفاصيل الورديات</CardTitle>
          </CardHeader>
          <CardContent>
            {report?.shifts && report.shifts.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-right py-3 px-4 text-xs font-black uppercase">التاريخ والوقت</th>
                      <th className="text-right py-3 px-4 text-xs font-black uppercase">الرصيد الافتتاحي</th>
                      <th className="text-right py-3 px-4 text-xs font-black uppercase">الرصيد الفعلي</th>
                      <th className="text-right py-3 px-4 text-xs font-black uppercase">الفرق</th>
                      <th className="text-right py-3 px-4 text-xs font-black uppercase">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.shifts.map((shift: CashShift) => (
                      <tr key={shift.id} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4 text-sm">{new Date(shift.closedAt || new Date()).toLocaleString("ar-SA")}</td>
                        <td className="py-3 px-4 text-sm font-bold">{shift.openingBalance?.toFixed(2)} ر.س</td>
                        <td className="py-3 px-4 text-sm font-bold">{shift.actualCash?.toFixed(2)} ر.س</td>
                        <td className={`py-3 px-4 text-sm font-bold ${
                          (shift.difference || 0) === 0
                            ? "text-green-600"
                            : (shift.difference || 0) > 0
                            ? "text-blue-600"
                            : "text-red-600"
                        }`}>
                          {(shift.difference || 0).toFixed(2)} ر.س
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            variant="outline"
                            className={
                              (shift.difference || 0) === 0
                                ? "bg-green-50 text-green-700 border-green-200"
                                : (shift.difference || 0) > 0
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : "bg-red-50 text-red-700 border-red-200"
                            }
                          >
                            {(shift.difference || 0) === 0 ? "متطابق" : (shift.difference || 0) > 0 ? "زيادة" : "عجز"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center py-8 text-muted-foreground">لم تغلق أي وردية بعد</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
