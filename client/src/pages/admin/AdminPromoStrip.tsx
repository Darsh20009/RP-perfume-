import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, Trash2, Truck, ShieldCheck, RotateCcw, Headphones, Gift, Sparkles, Star, Award, Crown, Zap, Heart, BadgeCheck, Phone, MapPin, GripVertical } from "lucide-react";
import * as LucideIcons from "lucide-react";

const ICON_OPTIONS = [
  { name: "Truck", Icon: Truck },
  { name: "ShieldCheck", Icon: ShieldCheck },
  { name: "RotateCcw", Icon: RotateCcw },
  { name: "Headphones", Icon: Headphones },
  { name: "Gift", Icon: Gift },
  { name: "Sparkles", Icon: Sparkles },
  { name: "Star", Icon: Star },
  { name: "Award", Icon: Award },
  { name: "Crown", Icon: Crown },
  { name: "Zap", Icon: Zap },
  { name: "Heart", Icon: Heart },
  { name: "BadgeCheck", Icon: BadgeCheck },
  { name: "Phone", Icon: Phone },
  { name: "MapPin", Icon: MapPin },
];

type PromoItem = {
  id: string;
  icon: string;
  titleAr: string; titleEn: string;
  subtitleAr: string; subtitleEn: string;
  color: string; link: string;
  sortOrder: number; isActive: boolean;
};

const empty: Omit<PromoItem, "id"> = {
  icon: "Truck",
  titleAr: "", titleEn: "",
  subtitleAr: "", subtitleEn: "",
  color: "#c9a96e", link: "",
  sortOrder: 0, isActive: true,
};

export default function AdminPromoStrip() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: items = [], isLoading } = useQuery<PromoItem[]>({ queryKey: ["/api/admin/promo-strip"] });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PromoItem | null>(null);
  const [form, setForm] = useState<Omit<PromoItem, "id">>(empty);

  const upsert = useMutation({
    mutationFn: async () => {
      if (editing) await apiRequest("PATCH", `/api/admin/promo-strip/${editing.id}`, form);
      else await apiRequest("POST", "/api/admin/promo-strip", form);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/promo-strip"] });
      qc.invalidateQueries({ queryKey: ["/api/promo-strip"] });
      toast({ title: editing ? "تم التحديث" : "تمت الإضافة" });
      setOpen(false); setEditing(null); setForm(empty);
    },
    onError: (e: any) => toast({ variant: "destructive", title: "خطأ", description: e.message }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/admin/promo-strip/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/promo-strip"] });
      qc.invalidateQueries({ queryKey: ["/api/promo-strip"] });
      toast({ title: "تم الحذف" });
    },
  });

  const toggleActive = useMutation({
    mutationFn: async (i: PromoItem) => apiRequest("PATCH", `/api/admin/promo-strip/${i.id}`, { isActive: !i.isActive }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/promo-strip"] });
      qc.invalidateQueries({ queryKey: ["/api/promo-strip"] });
    },
  });

  const startEdit = (i: PromoItem) => {
    setEditing(i); setForm({ ...i }); setOpen(true);
  };
  const startCreate = () => {
    setEditing(null); setForm({ ...empty, sortOrder: items.length }); setOpen(true);
  };

  const renderIcon = (name: string, color: string) => {
    const Found = (LucideIcons as any)[name] || Truck;
    return <Found className="w-6 h-6" style={{ color }} />;
  };

  return (
    <div className="space-y-6" data-testid="admin-promo-strip">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-black text-[#1a2744]">شريط المميّزات</h2>
          <p className="text-sm text-slate-500 mt-1">يظهر في الصفحة الرئيسية تحت العروض السريعة. تحكم كامل من هنا.</p>
        </div>
        <Button onClick={startCreate} className="bg-[#c9a96e] hover:bg-[#b8944f] text-white" data-testid="button-add-promo">
          <Plus className="w-4 h-4 me-2" /> إضافة بطاقة
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#c9a96e]" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 bg-[#faf8f5] rounded-2xl border border-dashed border-[#c9a96e]/30">
          <Sparkles className="w-12 h-12 mx-auto text-[#c9a96e]/40 mb-3" />
          <p className="font-bold text-slate-700">لا توجد بطاقات بعد</p>
          <p className="text-xs text-slate-500 mt-1">أضف أول بطاقة تظهر للعملاء (شحن مجاني، ضمان، إلخ)</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <div key={item.id} className={`relative group bg-white rounded-2xl border-2 p-5 transition-all hover:shadow-lg ${item.isActive ? "border-[#e8e2d9]" : "border-slate-200 opacity-60"}`} data-testid={`promo-card-${item.id}`}>
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${item.color}15` }}>
                  {renderIcon(item.icon, item.color)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-[#1a2744] text-sm truncate">{item.titleAr || item.titleEn}</p>
                  <p className="text-xs text-slate-500 mt-1 truncate">{item.subtitleAr || item.subtitleEn}</p>
                  {item.link && <p className="text-[10px] text-[#c9a96e] mt-1 truncate">→ {item.link}</p>}
                </div>
              </div>
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#e8e2d9]">
                <div className="flex items-center gap-2">
                  <Switch checked={item.isActive} onCheckedChange={() => toggleActive.mutate(item)} data-testid={`switch-active-${item.id}`} />
                  <span className="text-[10px] font-bold text-slate-500">{item.isActive ? "نشط" : "متوقف"}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => startEdit(item)} className="p-2 text-slate-500 hover:text-[#c9a96e] rounded-lg hover:bg-[#faf8f5]" data-testid={`button-edit-promo-${item.id}`}><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => { if (confirm("حذف هذه البطاقة؟")) del.mutate(item.id); }} className="p-2 text-slate-500 hover:text-red-500 rounded-lg hover:bg-red-50" data-testid={`button-delete-promo-${item.id}`}><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setForm(empty); } }}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editing ? "تعديل بطاقة" : "بطاقة جديدة"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>الأيقونة</Label>
              <div className="grid grid-cols-7 gap-2 mt-2">
                {ICON_OPTIONS.map(({ name, Icon }) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setForm({ ...form, icon: name })}
                    className={`aspect-square rounded-lg border-2 flex items-center justify-center transition-all ${form.icon === name ? "border-[#c9a96e] bg-[#c9a96e]/10" : "border-[#e8e2d9] hover:border-[#c9a96e]/50"}`}
                    data-testid={`icon-pick-${name}`}
                  >
                    <Icon className="w-5 h-5" style={{ color: form.color }} />
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>عنوان (عربي)</Label>
                <Input value={form.titleAr} onChange={(e) => setForm({ ...form, titleAr: e.target.value })} placeholder="شحن مجاني" data-testid="input-title-ar" />
              </div>
              <div>
                <Label>عنوان (English)</Label>
                <Input value={form.titleEn} onChange={(e) => setForm({ ...form, titleEn: e.target.value })} placeholder="Free Shipping" data-testid="input-title-en" />
              </div>
              <div>
                <Label>وصف (عربي)</Label>
                <Input value={form.subtitleAr} onChange={(e) => setForm({ ...form, subtitleAr: e.target.value })} placeholder="للطلبات فوق ١٠٠ ر.س" data-testid="input-sub-ar" />
              </div>
              <div>
                <Label>وصف (English)</Label>
                <Input value={form.subtitleEn} onChange={(e) => setForm({ ...form, subtitleEn: e.target.value })} placeholder="On orders over 100 SAR" data-testid="input-sub-en" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>اللون</Label>
                <Input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="h-10 p-1" data-testid="input-color" />
              </div>
              <div className="col-span-2">
                <Label>رابط (اختياري)</Label>
                <Input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="/products" data-testid="input-link" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>ترتيب</Label>
                <Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })} data-testid="input-sort" />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
                <Label>نشط</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button onClick={() => upsert.mutate()} disabled={upsert.isPending} className="bg-[#c9a96e] hover:bg-[#b8944f] text-white" data-testid="button-save-promo">
              {upsert.isPending && <Loader2 className="w-4 h-4 animate-spin me-2" />}
              {editing ? "حفظ التعديلات" : "إضافة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
