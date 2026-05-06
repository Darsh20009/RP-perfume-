import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Package, Layers, Tag, Calendar, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { RiyalSign } from "@/components/RiyalSign";

type Tier = { quantity: number; price: number; label?: string; labelEn?: string };
type Bundle = {
  id: string;
  title: string;
  titleEn?: string;
  description?: string;
  descriptionEn?: string;
  tiers: Tier[];
  scope: "all" | "categories" | "products" | "price";
  categoryIds?: string[];
  productIds?: string[];
  triggerItemPrice?: number;
  badgeText?: string;
  badgeColor?: string;
  showOnHome?: boolean;
  startTime?: string;
  endTime?: string;
  maxUsesTotal?: number;
  maxUsesPerCustomer?: number;
  usageCount?: number;
  isActive: boolean;
  priority: number;
  createdByName?: string;
};

const empty: Bundle = {
  id: "",
  title: "",
  titleEn: "",
  description: "",
  descriptionEn: "",
  tiers: [{ quantity: 3, price: 149, label: "" }],
  scope: "price",
  categoryIds: [],
  productIds: [],
  triggerItemPrice: 99,
  badgeText: "وفّر أكثر",
  badgeColor: "#850935",
  showOnHome: true,
  startTime: "",
  endTime: "",
  maxUsesTotal: 0,
  maxUsesPerCustomer: 0,
  isActive: true,
  priority: 0,
};

export default function AdminBundles() {
  const { toast } = useToast();
  const [editing, setEditing] = useState<Bundle | null>(null);
  const [open, setOpen] = useState(false);

  const { data: bundles = [], isLoading } = useQuery<Bundle[]>({
    queryKey: ["/api/admin/bundle-offers"],
  });

  const { data: categories = [] } = useQuery<any[]>({ queryKey: ["/api/categories"] });
  const { data: products = [] } = useQuery<any[]>({ queryKey: ["/api/products"] });

  const saveMut = useMutation({
    mutationFn: async (b: Bundle) => {
      const payload = { ...b };
      delete (payload as any).id;
      delete (payload as any).usageCount;
      delete (payload as any).createdByName;
      if (b.id) {
        return await apiRequest("PATCH", `/api/admin/bundle-offers/${b.id}`, payload);
      }
      return await apiRequest("POST", "/api/admin/bundle-offers", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bundle-offers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bundle-offers"] });
      setOpen(false);
      setEditing(null);
      toast({ title: "تم الحفظ", description: "تم حفظ عرض الباقة بنجاح" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/admin/bundle-offers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bundle-offers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bundle-offers"] });
      toast({ title: "تم الحذف" });
    },
  });

  const toggleMut = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiRequest("PATCH", `/api/admin/bundle-offers/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bundle-offers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bundle-offers"] });
    },
  });

  const startNew = () => { setEditing({ ...empty, tiers: [{ quantity: 3, price: 149, label: "" }] }); setOpen(true); };
  const startEdit = (b: Bundle) => { setEditing({ ...b }); setOpen(true); };

  const updateTier = (idx: number, patch: Partial<Tier>) => {
    if (!editing) return;
    const tiers = [...editing.tiers];
    tiers[idx] = { ...tiers[idx], ...patch };
    setEditing({ ...editing, tiers });
  };
  const addTier = () => {
    if (!editing) return;
    setEditing({ ...editing, tiers: [...editing.tiers, { quantity: editing.tiers.length * 3 + 3, price: 0, label: "" }] });
  };
  const removeTier = (idx: number) => {
    if (!editing) return;
    setEditing({ ...editing, tiers: editing.tiers.filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-6 p-6" dir="rtl" data-testid="admin-bundles-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-[#0F0F0F]">عروض الباقات</h1>
          <p className="text-gray-600 mt-1">أنشئ عروض حزم مثل "3 عطور بـ 149" أو "6 بـ 299" — تُطبَّق تلقائياً على السلة.</p>
        </div>
        <Button onClick={startNew} className="bg-[#850935] hover:bg-[#6b0729] text-white" data-testid="button-new-bundle">
          <Plus className="ml-2 h-4 w-4" /> باقة جديدة
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">جاري التحميل...</div>
      ) : bundles.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <Package className="mx-auto h-12 w-12 text-gray-300 mb-3" />
            <p className="text-gray-500">لا توجد عروض باقات حتى الآن.</p>
            <Button onClick={startNew} variant="outline" className="mt-4" data-testid="button-empty-new-bundle">
              <Plus className="ml-2 h-4 w-4" /> أنشئ أول باقة
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {bundles.map((b) => (
            <Card key={b.id} className="border-[#E8E5E0]" data-testid={`card-bundle-${b.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <CardTitle className="text-lg font-display text-[#0F0F0F]" data-testid={`text-bundle-title-${b.id}`}>{b.title}</CardTitle>
                    {b.badgeText && (
                      <Badge style={{ backgroundColor: b.badgeColor || "#850935" }} className="text-white mt-2">
                        {b.badgeText}
                      </Badge>
                    )}
                  </div>
                  <Switch
                    checked={b.isActive}
                    onCheckedChange={(v) => toggleMut.mutate({ id: b.id, isActive: v })}
                    data-testid={`switch-active-${b.id}`}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {b.description && <p className="text-sm text-gray-600">{b.description}</p>}
                <div className="space-y-2">
                  {b.tiers.map((t, i) => (
                    <div key={i} className="flex items-center justify-between bg-[#F5F2ED] rounded px-3 py-2 text-sm">
                      <span className="font-semibold text-[#2B2B60]">{t.quantity} قطع</span>
                      <span className="text-[#850935] font-bold">{t.price} <RiyalSign /></span>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 pt-2 border-t">
                  <span className="flex items-center gap-1"><Layers className="h-3 w-3" />
                    {b.scope === "all" ? "كل المنتجات"
                      : b.scope === "categories" ? `${b.categoryIds?.length || 0} فئة`
                      : b.scope === "price" ? `سعر ${b.triggerItemPrice || 0} ر.س`
                      : `${b.productIds?.length || 0} منتج`}
                  </span>
                  <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" /> {b.usageCount || 0} استخدام</span>
                  {(b.startTime || b.endTime) && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> محدد بوقت</span>}
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={() => startEdit(b)} className="flex-1" data-testid={`button-edit-${b.id}`}>
                    <Pencil className="ml-1 h-3 w-3" /> تعديل
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    onClick={() => { if (confirm(`حذف باقة "${b.title}"؟`)) delMut.mutate(b.id); }}
                    className="text-red-600 hover:bg-red-50"
                    data-testid={`button-delete-${b.id}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={(v) => { if (!v) { setOpen(false); setEditing(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="font-display text-[#0F0F0F]">
              {editing?.id ? "تعديل عرض الباقة" : "عرض باقة جديد"}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>العنوان (عربي) *</Label>
                  <Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                         placeholder="مثال: عرض 3 عطور بـ 149" data-testid="input-bundle-title" />
                </div>
                <div>
                  <Label>العنوان (إنجليزي)</Label>
                  <Input value={editing.titleEn || ""} onChange={(e) => setEditing({ ...editing, titleEn: e.target.value })}
                         placeholder="3 perfumes for 149" />
                </div>
              </div>
              <div>
                <Label>الوصف</Label>
                <Textarea value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                          placeholder="اختر 3 عطور من تشكيلتنا الفاخرة بسعر مميز" rows={2} />
              </div>

              <div className="border rounded-lg p-3 bg-[#F5F2ED]">
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-base font-semibold">شرائح الباقة (الكمية والسعر)</Label>
                  <Button type="button" size="sm" variant="outline" onClick={addTier} data-testid="button-add-tier">
                    <Plus className="ml-1 h-3 w-3" /> أضف شريحة
                  </Button>
                </div>
                <div className="space-y-2">
                  {editing.tiers.map((t, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-3">
                        <Label className="text-xs">الكمية</Label>
                        <Input type="number" min={1} value={t.quantity}
                               onChange={(e) => updateTier(i, { quantity: parseInt(e.target.value) || 1 })}
                               data-testid={`input-tier-quantity-${i}`} />
                      </div>
                      <div className="col-span-4">
                        <Label className="text-xs">السعر (<RiyalSign />)</Label>
                        <Input type="number" min={0} step="0.01" value={t.price}
                               onChange={(e) => updateTier(i, { price: parseFloat(e.target.value) || 0 })}
                               data-testid={`input-tier-price-${i}`} />
                      </div>
                      <div className="col-span-4">
                        <Label className="text-xs">تسمية اختيارية</Label>
                        <Input value={t.label || ""}
                               onChange={(e) => updateTier(i, { label: e.target.value })}
                               placeholder="الأكثر توفيراً" />
                      </div>
                      <div className="col-span-1">
                        <Button type="button" size="sm" variant="ghost" onClick={() => removeTier(i)}
                                className="text-red-600" data-testid={`button-remove-tier-${i}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>نطاق التطبيق</Label>
                  <Select value={editing.scope} onValueChange={(v: any) => setEditing({ ...editing, scope: v })}>
                    <SelectTrigger data-testid="select-bundle-scope"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="price">منتجات بسعر محدد</SelectItem>
                      <SelectItem value="all">كل المنتجات</SelectItem>
                      <SelectItem value="categories">فئات محددة</SelectItem>
                      <SelectItem value="products">منتجات محددة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>الأولوية (الأعلى يُطبَّق أولاً)</Label>
                  <Input type="number" value={editing.priority}
                         onChange={(e) => setEditing({ ...editing, priority: parseInt(e.target.value) || 0 })} />
                </div>
              </div>

              {editing.scope === "price" && (
                <div>
                  <Label>سعر العنصر المؤهل (<RiyalSign />) *</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={editing.triggerItemPrice ?? 99}
                    onChange={(e) => setEditing({ ...editing, triggerItemPrice: parseFloat(e.target.value) || 0 })}
                    placeholder="مثال: 99"
                    data-testid="input-trigger-price"
                  />
                  <p className="text-xs text-gray-500 mt-1">العرض يُطبَّق فقط على المنتجات التي سعرها بالضبط هذا المبلغ</p>
                </div>
              )}
              {editing.scope === "categories" && (
                <div>
                  <Label>الفئات المؤهلة</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-40 overflow-y-auto border rounded p-2">
                    {categories.map((c: any) => {
                      const checked = editing.categoryIds?.includes(c.id);
                      return (
                        <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="checkbox" checked={!!checked} onChange={(e) => {
                            const ids = new Set(editing.categoryIds || []);
                            if (e.target.checked) ids.add(c.id); else ids.delete(c.id);
                            setEditing({ ...editing, categoryIds: Array.from(ids) });
                          }} />
                          <span>{c.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
              {editing.scope === "products" && (
                <div>
                  <Label>المنتجات المؤهلة</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded p-2">
                    {products.slice(0, 200).map((p: any) => {
                      const checked = editing.productIds?.includes(p.id);
                      return (
                        <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="checkbox" checked={!!checked} onChange={(e) => {
                            const ids = new Set(editing.productIds || []);
                            if (e.target.checked) ids.add(p.id); else ids.delete(p.id);
                            setEditing({ ...editing, productIds: Array.from(ids) });
                          }} />
                          <span className="truncate">{p.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>نص الشارة</Label>
                  <Input value={editing.badgeText || ""} onChange={(e) => setEditing({ ...editing, badgeText: e.target.value })}
                         placeholder="وفّر أكثر" />
                </div>
                <div>
                  <Label>لون الشارة</Label>
                  <div className="flex items-center gap-2">
                    <Input type="color" className="w-16 h-10 p-1" value={editing.badgeColor || "#850935"}
                           onChange={(e) => setEditing({ ...editing, badgeColor: e.target.value })} />
                    <Input value={editing.badgeColor || ""} onChange={(e) => setEditing({ ...editing, badgeColor: e.target.value })} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>تاريخ البدء (اختياري)</Label>
                  <Input type="datetime-local" value={editing.startTime ? editing.startTime.slice(0, 16) : ""}
                         onChange={(e) => setEditing({ ...editing, startTime: e.target.value ? new Date(e.target.value).toISOString() : "" })} />
                </div>
                <div>
                  <Label>تاريخ الانتهاء (اختياري)</Label>
                  <Input type="datetime-local" value={editing.endTime ? editing.endTime.slice(0, 16) : ""}
                         onChange={(e) => setEditing({ ...editing, endTime: e.target.value ? new Date(e.target.value).toISOString() : "" })} />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Switch checked={editing.isActive} onCheckedChange={(v) => setEditing({ ...editing, isActive: v })} />
                    <span className="text-sm">مفعّل</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={!!editing.showOnHome} onCheckedChange={(v) => setEditing({ ...editing, showOnHome: v })} />
                    <span className="text-sm">عرض في الصفحة الرئيسية</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); setEditing(null); }}>إلغاء</Button>
            <Button
              onClick={() => editing && saveMut.mutate(editing)}
              disabled={saveMut.isPending || !editing?.title || !editing?.tiers?.length}
              className="bg-[#850935] hover:bg-[#6b0729] text-white"
              data-testid="button-save-bundle"
            >
              {saveMut.isPending ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
