import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import {
  ScanLine, Package, Printer, AlertTriangle, CheckCircle,
  Loader2, Search, RefreshCw, ShoppingBag, MapPin, Save,
} from "lucide-react";

const LOW_STOCK_THRESHOLD = 5;

function PrintInvoiceButton({ orderId }: { orderId: string }) {
  return (
    <Button
      variant="outline" size="sm"
      data-testid={`button-print-${orderId}`}
      onClick={() => window.open(`/orders/${orderId}?print=1`, "_blank")}
    >
      <Printer className="h-4 w-4 ml-1" />
      طباعة
    </Button>
  );
}

function PickupScanner() {
  const [code, setCode] = useState("");
  const { toast } = useToast();
  const verifyMut = useMutation({
    mutationFn: async (c: string) => {
      const res = await apiRequest("POST", "/api/branch/orders/verify-pickup", { code: c });
      return res.json();
    },
    onSuccess: (order: any) => {
      toast({
        title: "✅ تم التسليم",
        description: `طلب #${(order.id || "").slice(-6).toUpperCase()} — ${order.total} ر.س`,
      });
      setCode("");
      queryClient.invalidateQueries({ queryKey: ["/api/branch/orders"] });
    },
    onError: (err: any) => {
      toast({
        title: "تعذّر التحقق",
        description: err?.message || "الكود غير صحيح",
        variant: "destructive",
      });
    },
  });

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <ScanLine className="h-6 w-6 text-primary" />
        <div>
          <h3 className="font-black text-lg">مسح كود الاستلام</h3>
          <p className="text-xs text-gray-700 font-bold">امسح الـ QR أو أدخل الكود يدوياً</p>
        </div>
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="●●●●●● أو امسح QR"
          value={code}
          onChange={(e) => {
            const raw = e.target.value;
            // Accept either pure 6-digit code, or QR payload "PICKUP:<orderId>:<code>"
            const m = raw.match(/PICKUP:[^:]+:(\d{6})/i);
            const next = m ? m[1] : raw.replace(/\D/g, "").slice(0, 6);
            setCode(next);
            if (m && next.length === 6) {
              setTimeout(() => verifyMut.mutate(next), 50);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && code.length === 6) verifyMut.mutate(code);
          }}
          className="text-center font-mono text-2xl tracking-[0.5em] h-14"
          data-testid="input-pickup-code"
          autoFocus
        />
        <Button
          onClick={() => verifyMut.mutate(code)}
          disabled={code.length !== 6 || verifyMut.isPending}
          className="h-14 px-6"
          data-testid="button-verify-pickup"
        >
          {verifyMut.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
        </Button>
      </div>
      <p className="text-[11px] text-gray-700 mt-3 text-center">
        💡 يمكنك استخدام ماسح QR أو إدخال الكود يدوياً
      </p>
    </Card>
  );
}

function BranchOrdersTab() {
  const { data: orders = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/branch/orders"],
  });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "pickup" | "pending" | "completed">("all");

  const filtered = useMemo(() => {
    let list = orders;
    if (filter === "pickup") list = list.filter(o => o.shippingMethod === "pickup");
    if (filter === "pending") list = list.filter(o => !o.pickupVerified && o.status !== "completed" && o.status !== "cancelled");
    if (filter === "completed") list = list.filter(o => o.status === "completed" || o.pickupVerified);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(o =>
        (o.id || "").toLowerCase().includes(s) ||
        (o.pickupCode || "").includes(s) ||
        (o.deliveryAddress || "").toLowerCase().includes(s)
      );
    }
    return list;
  }, [orders, filter, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-3 h-4 w-4 text-gray-700" />
          <Input
            placeholder="بحث برقم الطلب أو الكود"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-10"
            data-testid="input-orders-search"
          />
        </div>
        <div className="flex gap-2">
          {[
            { v: "all", l: "الكل" },
            { v: "pickup", l: "استلام" },
            { v: "pending", l: "بانتظار" },
            { v: "completed", l: "مكتملة" },
          ].map(o => (
            <Button
              key={o.v}
              variant={filter === o.v ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(o.v as any)}
              data-testid={`filter-${o.v}`}
            >
              {o.l}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <ShoppingBag className="h-12 w-12 text-gray-700 mx-auto mb-3" />
          <p className="font-black text-gray-800">لا توجد طلبات</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((o: any) => (
            <Card key={o.id} className="p-4" data-testid={`row-order-${o.id}`}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-mono font-black text-sm">#{(o.id || "").slice(-6).toUpperCase()}</span>
                    <Badge variant={o.status === "completed" ? "default" : "secondary"}>
                      {o.status}
                    </Badge>
                    {o.shippingMethod === "pickup" && (
                      <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                        <MapPin className="h-3 w-3 ml-1" />
                        استلام
                      </Badge>
                    )}
                    {o.pickupVerified && (
                      <Badge className="bg-green-100 text-green-800 border-green-200">
                        ✓ تم الاستلام
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-800 font-bold">{o.deliveryAddress}</p>
                  <p className="text-xs text-gray-700 mt-1">
                    {o.items?.length || 0} منتج — <span className="font-black text-black">{o.total} ر.س</span>
                  </p>
                  {o.pickupCode && !o.pickupVerified && (
                    <p className="text-xs font-mono font-black text-primary mt-1">
                      الكود: {o.pickupCode}
                    </p>
                  )}
                </div>
                <PrintInvoiceButton orderId={o.id} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function BranchInventoryTab() {
  const { data: inventory = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/branch/inventory"],
  });
  const [edits, setEdits] = useState<Record<string, number>>({});
  const { toast } = useToast();

  const updateMut = useMutation({
    mutationFn: async ({ id, stock }: { id: string; stock: number }) => {
      const res = await apiRequest("PATCH", `/api/branch/inventory/${id}`, { stock });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم التحديث" });
      queryClient.invalidateQueries({ queryKey: ["/api/branch/inventory"] });
    },
  });

  const lowStock = inventory.filter((i: any) => Number(i.stock || 0) < LOW_STOCK_THRESHOLD);

  return (
    <div className="space-y-4">
      {lowStock.length > 0 && (
        <Card className="p-4 bg-red-50 border-2 border-red-200">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <h4 className="font-black text-red-800">⚠️ تنبيه: {lowStock.length} منتج بكمية منخفضة</h4>
          </div>
          <p className="text-xs text-red-700 font-bold">
            يرجى تحديث المخزون أو إعادة التزويد فوراً
          </p>
        </Card>
      )}

      {isLoading ? (
        <div className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></div>
      ) : inventory.length === 0 ? (
        <Card className="p-12 text-center">
          <Package className="h-12 w-12 text-gray-700 mx-auto mb-3" />
          <p className="font-black text-gray-800">لا توجد منتجات في مخزون الفرع</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {inventory.map((it: any) => {
            const id = it.id || it._id;
            const current = edits[id] ?? Number(it.stock || 0);
            const isLow = current < LOW_STOCK_THRESHOLD;
            const dirty = edits[id] !== undefined && edits[id] !== Number(it.stock || 0);
            return (
              <Card key={id} className={`p-4 ${isLow ? "border-red-300 bg-red-50/50" : ""}`}>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <p className="font-black text-sm">{it.productName || it.name}</p>
                    <p className="text-xs text-gray-700 font-bold">{it.sku || it.variantSku}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      value={current}
                      onChange={(e) => setEdits(p => ({ ...p, [id]: Math.max(0, Number(e.target.value) || 0) }))}
                      className={`w-24 text-center font-mono font-black ${isLow ? "border-red-300" : ""}`}
                      data-testid={`input-stock-${id}`}
                    />
                    <Button
                      size="sm"
                      disabled={!dirty || updateMut.isPending}
                      onClick={() => updateMut.mutate({ id, stock: current })}
                      data-testid={`button-save-stock-${id}`}
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                    {isLow && <Badge className="bg-red-100 text-red-800 border-red-200">منخفض</Badge>}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function BranchDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: branchInfo, isLoading } = useQuery<any>({
    queryKey: ["/api/branch/me"],
  });

  if (!user) {
    setLocation("/login");
    return null;
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!branchInfo?.branchId) {
    return (
      <Layout>
        <div className="container max-w-2xl mx-auto px-4 py-16 text-center">
          <AlertTriangle className="h-16 w-16 text-amber-500 mx-auto mb-4" />
          <h1 className="font-black text-2xl mb-2">لم يتم إسناد فرع لحسابك</h1>
          <p className="text-gray-700 font-bold mb-6">يرجى التواصل مع الإدارة لإسناد فرع لك</p>
          <Button onClick={() => setLocation("/")}>الرئيسية</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50" dir="rtl">
        <div className="container max-w-6xl mx-auto px-4 py-8 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="font-black text-3xl tracking-tight" data-testid="text-branch-name">
                لوحة الفرع — {branchInfo.branch?.name || branchInfo.branchId}
              </h1>
              <p className="text-sm text-gray-700 font-bold mt-1">
                {branchInfo.branch?.address || ""}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["/api/branch/orders"] });
                queryClient.invalidateQueries({ queryKey: ["/api/branch/inventory"] });
              }}
              data-testid="button-refresh"
            >
              <RefreshCw className="h-4 w-4 ml-1" />
              تحديث
            </Button>
          </div>

          {/* Scanner always on top */}
          <PickupScanner />

          {/* Tabs */}
          <Tabs defaultValue="orders" className="w-full">
            <TabsList className="grid grid-cols-2 max-w-md">
              <TabsTrigger value="orders" data-testid="tab-orders">
                <ShoppingBag className="h-4 w-4 ml-1" />
                طلبات الفرع
              </TabsTrigger>
              <TabsTrigger value="inventory" data-testid="tab-inventory">
                <Package className="h-4 w-4 ml-1" />
                مخزون الفرع
              </TabsTrigger>
            </TabsList>
            <TabsContent value="orders" className="mt-4"><BranchOrdersTab /></TabsContent>
            <TabsContent value="inventory" className="mt-4"><BranchInventoryTab /></TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
}
