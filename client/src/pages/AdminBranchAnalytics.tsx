import { Layout } from "@/components/Layout";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TrendingUp, MapPin, ShoppingBag, Clock, AlertTriangle,
  Loader2, Package, Users, Award, BarChart3,
} from "lucide-react";
import { Link } from "wouter";
import { RiyalSign } from "@/components/RiyalSign";

export default function AdminBranchAnalytics() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/branches/analytics"],
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  const totals = data?.totals || {};
  const branches = data?.branches || [];
  const topRevenue = branches[0];

  return (
    <Layout>
      <div className="container max-w-6xl mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-black">📊 تحليلات الفروع</h1>
            <p className="text-sm text-gray-700 font-bold mt-1">أداء جميع الفروع — هذا الشهر</p>
          </div>
          <Link href="/admin/branches">
            <Button variant="outline" data-testid="link-manage-branches">إدارة الفروع</Button>
          </Link>
        </div>

        {/* Top KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Card className="p-4 bg-gradient-to-br from-primary to-primary/80 text-white border-0">
            <div className="flex items-center gap-2 text-xs font-bold opacity-90 mb-1">
              <TrendingUp className="h-4 w-4" />
              إيرادات الشهر
            </div>
            <p className="text-2xl font-black" data-testid="stat-revenue">
              {Number(totals.revenueMonth || 0).toLocaleString()}
              <span className="text-sm font-bold opacity-75 mr-1"><RiyalSign /></span>
            </p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-700 mb-1">
              <ShoppingBag className="h-4 w-4 text-blue-600" />
              طلبات الشهر
            </div>
            <p className="text-2xl font-black" data-testid="stat-orders">{totals.ordersMonth || 0}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-700 mb-1">
              <Package className="h-4 w-4 text-green-600" />
              تسليمات اليوم
            </div>
            <p className="text-2xl font-black" data-testid="stat-today-pickups">{totals.todayPickups || 0}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-700 mb-1">
              <Clock className="h-4 w-4 text-amber-600" />
              بانتظار الاستلام
            </div>
            <p className="text-2xl font-black" data-testid="stat-pending">{totals.pendingPickups || 0}</p>
          </Card>
          <Card className={`p-4 ${totals.onWay ? "border-blue-300 bg-blue-50/30" : ""}`}>
            <div className="flex items-center gap-2 text-xs font-bold text-gray-700 mb-1">
              🚗 عملاء في الطريق
            </div>
            <p className="text-2xl font-black" data-testid="stat-on-way">{totals.onWay || 0}</p>
          </Card>
        </div>

        {/* Top branch */}
        {topRevenue && (
          <Card className="p-5 bg-gradient-to-l from-amber-100 to-yellow-50 border-2 border-amber-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center text-2xl shrink-0">
                <Award className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">🏆 الفرع الأعلى أداءً</p>
                <p className="font-black text-lg text-amber-900">{topRevenue.name}</p>
                <p className="text-xs text-amber-700 font-bold">
                  {Number(topRevenue.revenueMonth).toLocaleString()} <RiyalSign /> — {topRevenue.ordersMonth} طلب
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Per-branch table */}
        <Card className="overflow-hidden">
          <div className="p-4 border-b">
            <h2 className="font-black text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              ترتيب الفروع
            </h2>
          </div>
          {branches.length === 0 ? (
            <div className="p-12 text-center text-gray-700">
              <MapPin className="h-12 w-12 mx-auto mb-3" />
              <p className="font-black">لا توجد فروع مفعّلة بعد</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-3 text-right font-black">الفرع</th>
                    <th className="p-3 text-right font-black">الإيرادات</th>
                    <th className="p-3 text-right font-black">الطلبات</th>
                    <th className="p-3 text-right font-black">اليوم</th>
                    <th className="p-3 text-right font-black">بانتظار</th>
                    <th className="p-3 text-right font-black">في الطريق</th>
                    <th className="p-3 text-right font-black">متوسط التجهيز</th>
                    <th className="p-3 text-right font-black">المخزون</th>
                  </tr>
                </thead>
                <tbody>
                  {branches.map((b: any, i: number) => (
                    <tr key={b.branchId} className="border-t hover:bg-gray-50" data-testid={`row-branch-${b.branchId}`}>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {i === 0 && <span className="text-amber-500">🥇</span>}
                          {i === 1 && <span className="text-gray-700">🥈</span>}
                          {i === 2 && <span className="text-orange-600">🥉</span>}
                          <div>
                            <p className="font-black">{b.name}</p>
                            {b.city && <p className="text-xs text-gray-700 font-bold">{b.city}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="p-3 font-black text-primary">{Number(b.revenueMonth).toLocaleString()} <RiyalSign /></td>
                      <td className="p-3 font-bold">{b.ordersMonth}</td>
                      <td className="p-3">
                        <Badge className="bg-green-100 text-green-800 border-green-200">{b.todayPickups}</Badge>
                      </td>
                      <td className="p-3">
                        {b.pendingPickups > 0 ? (
                          <Badge className="bg-amber-100 text-amber-800 border-amber-200">{b.pendingPickups}</Badge>
                        ) : <span className="text-gray-700">—</span>}
                      </td>
                      <td className="p-3">
                        {b.onWay > 0 ? (
                          <Badge className="bg-blue-100 text-blue-800 border-blue-200">🚗 {b.onWay}</Badge>
                        ) : <span className="text-gray-700">—</span>}
                      </td>
                      <td className="p-3 font-bold text-xs">
                        {b.avgFulfillmentMin > 0 ? `${b.avgFulfillmentMin} د` : "—"}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col gap-0.5 text-xs">
                          <span className="font-bold">{b.totalProducts} منتج</span>
                          {b.outOfStock > 0 && (
                            <Badge className="bg-red-100 text-red-800 border-red-200 text-[10px]">
                              <AlertTriangle className="h-2.5 w-2.5 ml-1" />
                              {b.outOfStock} نفذ
                            </Badge>
                          )}
                          {b.lowStock > 0 && b.outOfStock === 0 && (
                            <span className="text-amber-700 font-bold">⚠ {b.lowStock} منخفض</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </Layout>
  );
}
