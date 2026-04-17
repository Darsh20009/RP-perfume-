import { useQuery, useMutation } from "@tanstack/react-query";
import { Branch, Product, BranchInventory, StockTransfer } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Package, AlertTriangle, ArrowRightLeft, Building, Plus, Check, X } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function AdminBranchInventory() {
  const { toast } = useToast();
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [activeTab, setActiveTab] = useState("stock");

  const { data: branches } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const { data: products } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

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
    mutationFn: async ({ id, stock }: { id: string, stock: number }) => {
      await apiRequest("PATCH", `/api/admin/inventory/${id}`, { stock });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inventory", selectedBranchId] });
      toast({ title: "تم تحديث المخزون" });
    }
  });

  const createTransferMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/admin/transfers", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/transfers"] });
      toast({ title: "تم إنشاء طلب التحويل" });
    }
  });

  const updateTransferStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      await apiRequest("PATCH", `/api/admin/transfers/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/transfers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inventory"] });
      toast({ title: "تم تحديث حالة التحويل" });
    }
  });

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black uppercase tracking-tight">إدارة مخزون الفروع</h2>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
          <TabsList className="rounded-none bg-black/5">
            <TabsTrigger value="stock" className="rounded-none data-[state=active]:bg-white">المخزون</TabsTrigger>
            <TabsTrigger value="transfers" className="rounded-none data-[state=active]:bg-white">التحويلات</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {activeTab === "stock" && (
        <>
          <div className="w-full flex gap-4">
            <div className="flex-1">
              <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                <SelectTrigger className="rounded-none h-10 border-black/5">
                  <SelectValue placeholder="اختر الفرع للمعاينة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="central">المستودع الرئيسي</SelectItem>
                  {branches?.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedBranchId && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="rounded-none gap-2 font-bold">
                    <ArrowRightLeft className="h-4 w-4" /> طلب تحويل مخزني
                  </Button>
                </DialogTrigger>
                <DialogContent dir="rtl">
                  <DialogHeader>
                    <DialogTitle>إنشاء طلب تحويل مخزني</DialogTitle>
                  </DialogHeader>
                  <form className="space-y-4" onSubmit={(e) => {
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
                    <div className="grid gap-2">
                      <Label>من فرع</Label>
                      <Select name="fromBranchId" required>
                        <SelectTrigger className="rounded-none">
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
                    <div className="grid gap-2">
                      <Label>المنتج</Label>
                      <Select name="productId" required>
                        <SelectTrigger className="rounded-none">
                          <SelectValue placeholder="اختر المنتج" />
                        </SelectTrigger>
                        <SelectContent>
                          {products?.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>الكمية</Label>
                      <Input type="number" name="quantity" min="1" required className="rounded-none" />
                    </div>
                    <div className="grid gap-2">
                      <Label>ملاحظات</Label>
                      <Input name="notes" className="rounded-none" />
                    </div>
                    <Button type="submit" className="w-full rounded-none" disabled={createTransferMutation.isPending}>
                      {createTransferMutation.isPending ? <Loader2 className="animate-spin" /> : "إرسال الطلب"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {!selectedBranchId ? (
            <Card className="rounded-none border-dashed border-2">
              <CardContent className="p-12 text-center text-muted-foreground">
                <Building className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p className="font-bold uppercase tracking-widest text-xs">يرجى اختيار فرع لعرض المخزون الخاص به</p>
              </CardContent>
            </Card>
          ) : invLoading ? (
            <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {products?.map(product => {
                const productInventory = inventory?.filter(i => i.productId === product.id);
                if (!productInventory?.length && selectedBranchId !== "central") return null;

                return (
                  <Card key={product.id} className="rounded-none border-black/5 overflow-hidden">
                    <CardHeader className="bg-black/5 py-3">
                      <CardTitle className="text-sm font-black uppercase">{product.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="divide-y divide-black/5">
                        {(product as any).variants?.map((variant: any) => {
                          const invItem = inventory?.find(i => i.variantSku === variant.sku);
                          const currentStock = selectedBranchId === "central" ? variant.stock : (invItem?.stock || 0);
                          const isLow = currentStock <= (invItem?.minStockLevel || 5);
                          
                          return (
                            <div key={variant.sku} className="p-4 flex justify-between items-center hover:bg-secondary/5">
                              <div className="flex items-center gap-4">
                                <div className="text-right">
                                  <p className="font-bold text-xs">{variant.color} / {variant.size}</p>
                                  <p className="text-[10px] text-muted-foreground font-mono">{variant.sku}</p>
                                </div>
                                {isLow && (
                                  <Badge variant="destructive" className="rounded-none text-[8px] flex items-center gap-1">
                                    <AlertTriangle className="h-2 w-2" /> مخزون منخفض
                                  </Badge>
                                )}
                              </div>

                              <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                  <Label className="text-[10px] font-bold">الكمية:</Label>
                                  <Input 
                                    type="number" 
                                    defaultValue={currentStock}
                                    onChange={(e) => {
                                      const val = parseInt(e.target.value);
                                      if (selectedBranchId === "central") {
                                        // Central warehouse update would need a specific endpoint or logic
                                        toast({ title: "يرجى تحديث مخزون المستودع من صفحة المنتجات" });
                                      } else if (invItem) {
                                        updateStockMutation.mutate({ id: invItem.id, stock: val });
                                      }
                                    }}
                                    className="w-20 h-8 rounded-none text-center font-black"
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {activeTab === "transfers" && (
        <div className="space-y-4">
          {transfers?.map(transfer => (
            <Card key={transfer.id} className="rounded-none border-black/5">
              <CardContent className="p-4 flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="bg-black/5 p-3">
                    <ArrowRightLeft className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-black text-sm">تحويل {transfer.quantity} قطعة</p>
                    <p className="text-xs text-muted-foreground">
                      من {transfer.fromBranchId === "central" ? "المستودع" : branches?.find(b => b.id === transfer.fromBranchId)?.name} 
                      إلى {transfer.toBranchId === "central" ? "المستودع" : branches?.find(b => b.id === transfer.toBranchId)?.name}
                    </p>
                    {transfer.notes && <p className="text-[10px] italic mt-1">{transfer.notes}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={transfer.status === "completed" ? "default" : transfer.status === "cancelled" ? "destructive" : "outline"} className="rounded-none uppercase text-[10px]">
                    {transfer.status === "pending" ? "قيد الانتظار" : transfer.status === "completed" ? "مكتمل" : "ملغي"}
                  </Badge>
                  {transfer.status === "pending" && (
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => updateTransferStatusMutation.mutate({ id: transfer.id, status: "completed" })} className="h-8 w-8 text-green-600">
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => updateTransferStatusMutation.mutate({ id: transfer.id, status: "cancelled" })} className="h-8 w-8 text-red-600">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {(!transfers || transfers.length === 0) && (
            <div className="p-12 text-center text-muted-foreground border-2 border-dashed">
              لا توجد طلبات تحويل حالية
            </div>
          )}
        </div>
      )}
    </div>
  );
}
