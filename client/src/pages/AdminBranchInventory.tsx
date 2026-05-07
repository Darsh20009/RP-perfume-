import { useQuery, useMutation } from "@tanstack/react-query";
import { Branch, Product, BranchInventory, StockTransfer } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Package, AlertTriangle, ArrowRightLeft,
  Building, Plus, Check, X, Boxes, Search
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function AdminBranchInventory() {
  const { toast } = useToast();
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [activeTab, setActiveTab] = useState("stock");
  const [search, setSearch] = useState("");

  const { data: branches } = useQuery<Branch[]>({ queryKey: ["/api/branches"] });
  const { data: products } = useQuery<Product[]>({ queryKey: ["/api/products"] });

  const { data: inventory, isLoading: invLoading } = useQuery<BranchInventory[]>({
    queryKey: ["/api/admin/inventory", selectedBranchId],
    enabled: !!selectedBranchId && activeTab === "stock",
    queryFn: async () => {
      const res = await fetch(`/api/admin/inventory?branchId=${selectedBranchId}`);
      if (!res.ok) throw new Error("Failed to fetch inventory");
      return res.json();
    }
  });

  const { data: transfers } = useQuery<StockTransfer[]>({
    queryKey: ["/api/admin/transfers"],
    enabled: activeTab === "transfers",
  });

  const updateStockMutation = useMutation({
    mutationFn: async ({ id, stock }: { id: string; stock: number }) => {
      await apiRequest("PATCH", `/api/admin/inventory/${id}`, { stock });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inventory", selectedBranchId] });
      toast({ title: "تم تحديث المخزون" });
    }
  });

  const createTransferMutation = useMutation({
    mutationFn: async (data: any) => { await apiRequest("POST", "/api/admin/transfers", data); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/transfers"] });
      toast({ title: "تم إنشاء طلب التحويل" });
    }
  });

  const updateTransferStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PATCH", `/api/admin/transfers/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/transfers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inventory"] });
      toast({ title: "تم تحديث حالة التحويل" });
    }
  });

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    return products.filter(p =>
      !search || p.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [products, search]);

  const lowStockCount = useMemo(() => {
    if (!inventory || !products) return 0;
    let count = 0;
    products.forEach(p => {
      (p as any).variants?.forEach((v: any) => {
        const inv = inventory.find(i => i.variantSku === v.sku);
        if (inv && inv.stock <= (inv.minStockLevel || 5)) count++;
      });
    });
    return count;
  }, [inventory, products]);

  return (
    <div className="p-6 md:p-8 space-y-6 min-h-screen" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[#2B2B60]">مخزون الفروع</h1>
          <p className="text-sm text-gray-600 font-bold mt-1">تتبع وإدارة المخزون لكل فرع مع دعم التحويلات</p>
        </div>
        {selectedBranchId && (
          <Dialog>
            <DialogTrigger asChild>
              <Button
                className="gap-2 bg-[#DFB369] hover:bg-[#c89853] text-[#0F0F0F] font-black h-12 px-6 shadow-lg shadow-[#DFB369]/30"
                data-testid="button-create-transfer"
              >
                <ArrowRightLeft className="h-5 w-5" />
                طلب تحويل مخزني
              </Button>
            </DialogTrigger>
            <DialogContent dir="rtl" className="sm:max-w-[480px]">
              <DialogHeader>
                <DialogTitle className="text-right text-xl font-black text-[#2B2B60]">إنشاء طلب تحويل مخزني</DialogTitle>
              </DialogHeader>
              <form className="space-y-4 pt-2" onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                createTransferMutation.mutate({
                  fromBranchId: formData.get("fromBranchId"),
                  toBranchId: selectedBranchId,
                  productId: formData.get("productId"),
                  variantSku: formData.get("variantSku"),
                  quantity: parseInt(formData.get("quantity") as string),
                  notes: formData.get("notes")
                });
              }}>
                <div>
                  <Label className="font-black text-sm mb-1.5 block">من فرع</Label>
                  <Select name="fromBranchId" required>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="اختر فرع المصدر" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="central">المستودع الرئيسي</SelectItem>
                      {branches?.filter(b => b.id !== selectedBranchId).map(b => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="font-black text-sm mb-1.5 block">المنتج</Label>
                  <Select name="productId" required>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="اختر المنتج" />
                    </SelectTrigger>
                    <SelectContent>
                      {products?.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="font-black text-sm mb-1.5 block">الكمية</Label>
                    <Input type="number" name="quantity" min="1" required className="h-11" />
                  </div>
                  <div>
                    <Label className="font-black text-sm mb-1.5 block">ملاحظات</Label>
                    <Input name="notes" className="h-11" placeholder="اختياري" />
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full h-11 bg-[#2B2B60] hover:bg-[#1c1c45] text-white font-black"
                  disabled={createTransferMutation.isPending}
                >
                  {createTransferMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "إرسال الطلب"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-[#FAF8F4] border border-[#DFB369]/20 h-11 p-1">
          <TabsTrigger value="stock" className="font-black data-[state=active]:bg-[#2B2B60] data-[state=active]:text-white rounded-lg px-5">
            المخزون
          </TabsTrigger>
          <TabsTrigger value="transfers" className="font-black data-[state=active]:bg-[#2B2B60] data-[state=active]:text-white rounded-lg px-5 relative">
            التحويلات
            {transfers?.filter(t => t.status === "pending").length ? (
              <span className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-[#DFB369] text-[8px] font-black flex items-center justify-center text-[#0F0F0F]">
                {transfers.filter(t => t.status === "pending").length}
              </span>
            ) : null}
          </TabsTrigger>
        </TabsList>

        {/* Stock Tab */}
        <TabsContent value="stock" className="space-y-4 mt-4">
          {/* Branch + Search Bar */}
          <div className="flex flex-col md:flex-row gap-3">
            <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
              <SelectTrigger className="md:w-64 h-11 font-bold border-[#DFB369]/20" data-testid="select-branch-inventory">
                <SelectValue placeholder="اختر الفرع للمعاينة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="central">المستودع الرئيسي</SelectItem>
                {branches?.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedBranchId && (
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="ابحث عن منتج…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pr-10 h-11 font-bold border-[#DFB369]/20"
                />
              </div>
            )}
            {selectedBranchId && lowStockCount > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-xl">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <span className="text-sm font-black text-amber-700">{lowStockCount} صنف منخفض المخزون</span>
              </div>
            )}
          </div>

          {!selectedBranchId ? (
            <Card className="border-dashed border-2 border-[#DFB369]/20">
              <CardContent className="py-16 text-center">
                <Building className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="font-black text-gray-500 text-lg">اختر فرعًا لعرض مخزونه</p>
                <p className="text-sm text-gray-400 font-bold mt-1">حدد الفرع من القائمة أعلاه</p>
              </CardContent>
            </Card>
          ) : invLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-[#DFB369]" />
            </div>
          ) : (
            <div className="space-y-4">
              {filteredProducts.map(product => {
                const productInventory = inventory?.filter(i => i.productId === product.id);
                if (!productInventory?.length && selectedBranchId !== "central") return null;
                const variants = (product as any).variants || [];
                if (!variants.length) return null;

                return (
                  <Card key={product.id} className="border border-[#DFB369]/20 overflow-hidden hover:border-[#DFB369]/50 transition-colors">
                    <div className="px-5 py-3 bg-gradient-to-l from-[#FAF8F4] to-white border-b border-[#DFB369]/15 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#DFB369]/10 flex items-center justify-center">
                        <Boxes className="h-4 w-4 text-[#DFB369]" />
                      </div>
                      <h3 className="font-black text-[#2B2B60]">{product.name}</h3>
                      <Badge variant="outline" className="mr-auto text-[10px] font-black border-[#DFB369]/30 text-[#2B2B60]">
                        {variants.length} تنويع
                      </Badge>
                    </div>
                    <CardContent className="p-0">
                      <div className="divide-y divide-[#DFB369]/10">
                        {variants.map((variant: any) => {
                          const invItem = inventory?.find(i => i.variantSku === variant.sku);
                          const currentStock = selectedBranchId === "central"
                            ? variant.stock
                            : (invItem?.stock ?? 0);
                          const isLow = currentStock <= (invItem?.minStockLevel || 5);

                          return (
                            <div key={variant.sku} className="px-5 py-4 flex items-center justify-between hover:bg-[#FAF8F4]/40 transition-colors" data-testid={`row-inventory-${variant.sku}`}>
                              <div className="flex items-center gap-4">
                                <div>
                                  <p className="font-bold text-sm text-[#2B2B60]">{variant.color} / {variant.size}</p>
                                  <p className="text-[10px] text-gray-400 font-mono mt-0.5">{variant.sku}</p>
                                </div>
                                {isLow && (
                                  <Badge className="bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-black gap-1" variant="outline">
                                    <AlertTriangle className="h-2.5 w-2.5" /> مخزون منخفض
                                  </Badge>
                                )}
                              </div>

                              <div className="flex items-center gap-3">
                                <span className={`text-sm font-black px-3 py-1 rounded-lg ${
                                  currentStock === 0
                                    ? "bg-red-50 text-red-600"
                                    : isLow
                                    ? "bg-amber-50 text-amber-600"
                                    : "bg-emerald-50 text-emerald-600"
                                }`}>
                                  {currentStock} وحدة
                                </span>
                                {selectedBranchId !== "central" && invItem && (
                                  <Input
                                    type="number"
                                    defaultValue={currentStock}
                                    onBlur={(e) => {
                                      const val = parseInt(e.target.value);
                                      if (!isNaN(val) && val !== currentStock) {
                                        updateStockMutation.mutate({ id: invItem.id, stock: val });
                                      }
                                    }}
                                    className="w-24 h-9 text-center font-black border-[#DFB369]/20 focus:border-[#DFB369]"
                                    data-testid={`input-stock-${variant.sku}`}
                                  />
                                )}
                                {selectedBranchId === "central" && (
                                  <p className="text-xs text-gray-400 font-bold italic">من صفحة المنتجات</p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {filteredProducts.filter(p => {
                const inv = inventory?.filter(i => i.productId === p.id);
                return (inv?.length && selectedBranchId !== "central") || selectedBranchId === "central";
              }).length === 0 && (
                <Card className="border-dashed border-2 border-[#DFB369]/20">
                  <CardContent className="py-16 text-center">
                    <Package className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                    <p className="font-black text-gray-500">لا يوجد مخزون لهذا الفرع بعد</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* Transfers Tab */}
        <TabsContent value="transfers" className="space-y-4 mt-4">
          {(!transfers || transfers.length === 0) ? (
            <Card className="border-dashed border-2 border-[#DFB369]/20">
              <CardContent className="py-16 text-center">
                <ArrowRightLeft className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="font-black text-gray-500">لا توجد طلبات تحويل</p>
              </CardContent>
            </Card>
          ) : (
            transfers.map(transfer => (
              <Card
                key={transfer.id}
                className={`border transition-all ${
                  transfer.status === "pending"
                    ? "border-amber-200 bg-amber-50/30"
                    : transfer.status === "completed"
                    ? "border-emerald-200"
                    : "border-red-100"
                }`}
                data-testid={`card-transfer-${transfer.id}`}
              >
                <CardContent className="p-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      transfer.status === "pending" ? "bg-amber-100" :
                      transfer.status === "completed" ? "bg-emerald-100" : "bg-red-50"
                    }`}>
                      <ArrowRightLeft className={`h-5 w-5 ${
                        transfer.status === "pending" ? "text-amber-600" :
                        transfer.status === "completed" ? "text-emerald-600" : "text-red-500"
                      }`} />
                    </div>
                    <div>
                      <p className="font-black text-[#2B2B60]">
                        تحويل <span className="text-[#DFB369]">{transfer.quantity}</span> قطعة
                      </p>
                      <p className="text-xs text-gray-500 font-bold mt-0.5">
                        من{" "}
                        <span className="text-[#2B2B60]">
                          {transfer.fromBranchId === "central" ? "المستودع الرئيسي" : branches?.find(b => b.id === transfer.fromBranchId)?.name}
                        </span>
                        {" "}إلى{" "}
                        <span className="text-[#2B2B60]">
                          {transfer.toBranchId === "central" ? "المستودع الرئيسي" : branches?.find(b => b.id === transfer.toBranchId)?.name}
                        </span>
                      </p>
                      {transfer.notes && (
                        <p className="text-[10px] text-gray-400 italic mt-1">{transfer.notes}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <Badge
                      className={`font-black text-xs px-3 ${
                        transfer.status === "pending" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                        transfer.status === "completed" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                        "bg-red-50 text-red-700 border border-red-200"
                      }`}
                      variant="outline"
                    >
                      {transfer.status === "pending" ? "قيد الانتظار" : transfer.status === "completed" ? "✓ مكتمل" : "✕ ملغي"}
                    </Badge>
                    {transfer.status === "pending" && (
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          className="h-9 w-9 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
                          onClick={() => updateTransferStatusMutation.mutate({ id: transfer.id, status: "completed" })}
                          data-testid={`button-approve-transfer-${transfer.id}`}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-9 w-9 border-red-200 text-red-600 hover:bg-red-50 rounded-xl"
                          onClick={() => updateTransferStatusMutation.mutate({ id: transfer.id, status: "cancelled" })}
                          data-testid={`button-cancel-transfer-${transfer.id}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
