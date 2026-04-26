import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, Trash2, BarChart3 } from "lucide-react";

type StatItem = {
  id: string;
  valueAr: string; valueEn: string;
  labelAr: string; labelEn: string;
  color: string;
  sortOrder: number; isActive: boolean;
};

const empty: Omit<StatItem, "id"> = {
  valueAr: "", valueEn: "",
  labelAr: "", labelEn: "",
  color: "#DFB369",
  sortOrder: 0, isActive: true,
};

export default function AdminStats() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: items = [], isLoading } = useQuery<StatItem[]>({ queryKey: ["/api/admin/stats"] });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StatItem | null>(null);
  const [form, setForm] = useState<Omit<StatItem, "id">>(empty);

  const upsert = useMutation({
    mutationFn: async () => {
      if (editing) await apiRequest("PATCH", `/api/admin/stats/${editing.id}`, form);
      else await apiRequest("POST", "/api/admin/stats", form);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      qc.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: editing ? "تم التحديث" : "تمت الإضافة" });
      setOpen(false); setEditing(null); setForm(empty);
    },
    onError: (e: any) => toast({ variant: "destructive", title: "خطأ", description: e.message }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/admin/stats/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      qc.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "تم الحذف" });
    },
  });

  const toggleActive = useMutation({
    mutationFn: async (i: StatItem) => apiRequest("PATCH", `/api/admin/stats/${i.id}`, { isActive: !i.isActive }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      qc.invalidateQueries({ queryKey: ["/api/stats"] });
    },
  });

  const startEdit = (i: StatItem) => { setEditing(i); setForm({ ...i }); setOpen(true); };
  const startCreate = () => { setEditing(null); setForm({ ...empty, sortOrder: items.length }); setOpen(true); };

  return (
    <div className="space-y-6" data-testid="admin-stats">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-black text-[#2B2B60]">إحصائيات الصفحة الرئيسية</h2>
          <p className="text-sm text-slate-500 mt-1">الأرقام التي تظهر في الصفحة الرئيسية (عملاء سعداء، عطور، رضا، أيام توصيل). يمكنك إضافة، تعديل، أو حذف أي بطاقة.</p>
        </div>
        <Button onClick={startCreate} className="bg-[#DFB369] hover:bg-[#c89853] text-white" data-testid="button-add-stat">
          <Plus className="w-4 h-4 me-2" /> إضافة إحصائية
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#DFB369]" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 bg-[#FFFFFF] rounded-2xl border border-dashed border-[#DFB369]/30">
          <BarChart3 className="w-12 h-12 mx-auto text-[#DFB369]/40 mb-3" />
          <p className="font-bold text-slate-700">لا توجد إحصائيات بعد</p>
          <p className="text-xs text-slate-500 mt-1">أضف أول إحصائية تظهر للعملاء (مثال: +٥٠٠ عميل سعيد)</p>
          <p className="text-[11px] text-slate-400 mt-2">إذا لم تُضف أي إحصائية فلن يظهر هذا الشريط في الصفحة الرئيسية</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {items.map((item) => (
            <div key={item.id} className={`relative group bg-white rounded-2xl border-2 p-5 transition-all hover:shadow-lg ${item.isActive ? "border-[#E8E5E0]" : "border-slate-200 opacity-60"}`} data-testid={`stat-card-${item.id}`}>
              <div className="text-center">
                <div className="text-4xl md:text-5xl font-bold tracking-tighter" style={{ color: item.color }}>
                  {item.valueAr || item.valueEn}
                </div>
                <div className="text-xs font-bold uppercase tracking-wider text-gray-700 mt-2">
                  {item.labelAr || item.labelEn}
                </div>
              </div>
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#E8E5E0]">
                <div className="flex items-center gap-2">
                  <Switch checked={item.isActive} onCheckedChange={() => toggleActive.mutate(item)} data-testid={`switch-active-stat-${item.id}`} />
                  <span className="text-[10px] font-bold text-slate-500">{item.isActive ? "نشط" : "متوقف"}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => startEdit(item)} className="p-2 text-slate-500 hover:text-[#DFB369] rounded-lg hover:bg-[#FFFFFF]" data-testid={`button-edit-stat-${item.id}`}><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => { if (confirm("حذف هذه الإحصائية؟")) del.mutate(item.id); }} className="p-2 text-slate-500 hover:text-red-500 rounded-lg hover:bg-red-50" data-testid={`button-delete-stat-${item.id}`}><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setForm(empty); } }}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editing ? "تعديل إحصائية" : "إحصائية جديدة"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>القيمة (عربي)</Label>
                <Input value={form.valueAr} onChange={(e) => setForm({ ...form, valueAr: e.target.value })} placeholder="+٥٠٠" data-testid="input-value-ar" />
              </div>
              <div>
                <Label>القيمة (English)</Label>
                <Input value={form.valueEn} onChange={(e) => setForm({ ...form, valueEn: e.target.value })} placeholder="500+" data-testid="input-value-en" />
              </div>
              <div>
                <Label>الوصف (عربي)</Label>
                <Input value={form.labelAr} onChange={(e) => setForm({ ...form, labelAr: e.target.value })} placeholder="عميل سعيد" data-testid="input-label-ar" />
              </div>
              <div>
                <Label>الوصف (English)</Label>
                <Input value={form.labelEn} onChange={(e) => setForm({ ...form, labelEn: e.target.value })} placeholder="Happy Customers" data-testid="input-label-en" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>لون الرقم</Label>
                <Input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="h-10 p-1" data-testid="input-color-stat" />
              </div>
              <div>
                <Label>ترتيب</Label>
                <Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })} data-testid="input-sort-stat" />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
                <Label>نشط</Label>
              </div>
            </div>
            <div className="bg-[#F5F2ED] rounded-xl p-4 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">معاينة</p>
              <div className="text-4xl font-bold tracking-tighter" style={{ color: form.color }}>{form.valueAr || form.valueEn || "—"}</div>
              <div className="text-xs font-bold uppercase tracking-wider text-gray-700 mt-2">{form.labelAr || form.labelEn || "—"}</div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button onClick={() => upsert.mutate()} disabled={upsert.isPending} className="bg-[#DFB369] hover:bg-[#c89853] text-white" data-testid="button-save-stat">
              {upsert.isPending && <Loader2 className="w-4 h-4 animate-spin me-2" />}
              {editing ? "حفظ التعديلات" : "إضافة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
