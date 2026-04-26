import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, Trash2, FileText, ExternalLink, Image as ImageIcon, Eye } from "lucide-react";

type Page = {
  id: string;
  slug: string;
  titleAr: string; titleEn: string;
  excerptAr: string; excerptEn: string;
  heroImage: string;
  contentAr: string; contentEn: string;
  showInNav: boolean; isActive: boolean;
  sortOrder: number;
  seoTitle: string; seoDescription: string;
};

const empty: Omit<Page, "id"> = {
  slug: "", titleAr: "", titleEn: "",
  excerptAr: "", excerptEn: "",
  heroImage: "", contentAr: "", contentEn: "",
  showInNav: true, isActive: true,
  sortOrder: 0, seoTitle: "", seoDescription: "",
};

export default function AdminPages() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: pages = [], isLoading } = useQuery<Page[]>({ queryKey: ["/api/admin/pages"] });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Page | null>(null);
  const [form, setForm] = useState<Omit<Page, "id">>(empty);
  const [uploading, setUploading] = useState(false);

  const upsert = useMutation({
    mutationFn: async () => {
      if (editing) await apiRequest("PATCH", `/api/admin/pages/${editing.id}`, form);
      else await apiRequest("POST", "/api/admin/pages", form);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/pages"] });
      qc.invalidateQueries({ queryKey: ["/api/pages"] });
      toast({ title: editing ? "تم التحديث" : "تمت الإضافة" });
      setOpen(false); setEditing(null); setForm(empty);
    },
    onError: (e: any) => toast({ variant: "destructive", title: "خطأ", description: e.message }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/admin/pages/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/pages"] });
      qc.invalidateQueries({ queryKey: ["/api/pages"] });
      toast({ title: "تم الحذف" });
    },
  });

  const startEdit = (p: Page) => { setEditing(p); setForm({ ...p }); setOpen(true); };
  const startCreate = () => { setEditing(null); setForm({ ...empty }); setOpen(true); };

  const handleHeroUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd, credentials: "include" });
      const data = await res.json();
      if (data.url) setForm((f) => ({ ...f, heroImage: data.url }));
    } finally { setUploading(false); }
  };

  return (
    <div className="space-y-6" data-testid="admin-pages">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-black text-[#2B2B60]">صفحات المتجر</h2>
          <p className="text-sm text-slate-500 mt-1">صفحات مخصّصة (مَن نحن، سياسة الإرجاع، حملات…) تظهر في القائمة وفي روابط مباشرة.</p>
        </div>
        <Button onClick={startCreate} className="bg-[#2B2B60] hover:bg-[#3A3A75] text-white" data-testid="button-add-page">
          <Plus className="w-4 h-4 me-2" /> صفحة جديدة
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#DFB369]" /></div>
      ) : pages.length === 0 ? (
        <div className="text-center py-20 bg-[#FFFFFF] rounded-2xl border border-dashed border-[#DFB369]/30">
          <FileText className="w-12 h-12 mx-auto text-[#DFB369]/40 mb-3" />
          <p className="font-bold text-slate-700">لا توجد صفحات بعد</p>
          <p className="text-xs text-slate-500 mt-1">أنشئ صفحات تسويقية أو معلوماتية بالكامل من هنا</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {pages.map((p) => (
            <div key={p.id} className={`bg-white rounded-2xl border-2 p-5 hover:shadow-lg transition-all ${p.isActive ? "border-[#E8E5E0]" : "border-slate-200 opacity-60"}`} data-testid={`page-card-${p.id}`}>
              <div className="flex items-start gap-4">
                {p.heroImage ? (
                  <img src={p.heroImage} alt="" className="w-24 h-24 rounded-xl object-cover" />
                ) : (
                  <div className="w-24 h-24 rounded-xl bg-[#FFFFFF] flex items-center justify-center">
                    <FileText className="w-8 h-8 text-[#DFB369]/40" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-black text-[#2B2B60]">{p.titleAr || p.titleEn}</h3>
                    {p.showInNav && <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">في القائمة</span>}
                    {!p.isActive && <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">متوقف</span>}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-1">{p.excerptAr || p.excerptEn || "—"}</p>
                  <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
                    <span className="font-mono">/pages/{p.slug}</span>
                    <a href={`/pages/${p.slug}`} target="_blank" rel="noopener noreferrer" className="text-[#DFB369] hover:underline flex items-center gap-1">
                      معاينة <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => startEdit(p)} className="p-2 text-slate-500 hover:text-[#DFB369] rounded-lg hover:bg-[#FFFFFF]" data-testid={`button-edit-page-${p.id}`}><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => { if (confirm("حذف هذه الصفحة؟")) del.mutate(p.id); }} className="p-2 text-slate-500 hover:text-red-500 rounded-lg hover:bg-red-50" data-testid={`button-delete-page-${p.id}`}><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setForm(empty); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editing ? `تعديل: ${editing.titleAr || editing.titleEn}` : "صفحة جديدة"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>الرابط (slug)</Label>
                <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="about-us" data-testid="input-page-slug" />
                <p className="text-[10px] text-slate-400 mt-1">سيظهر كـ /pages/{form.slug || "your-slug"}</p>
              </div>
              <div>
                <Label>ترتيب</Label>
                <Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>العنوان (عربي)</Label>
                <Input value={form.titleAr} onChange={(e) => setForm({ ...form, titleAr: e.target.value })} placeholder="من نحن" data-testid="input-page-title-ar" />
              </div>
              <div>
                <Label>العنوان (English)</Label>
                <Input value={form.titleEn} onChange={(e) => setForm({ ...form, titleEn: e.target.value })} placeholder="About Us" />
              </div>
              <div>
                <Label>وصف مختصر (عربي)</Label>
                <Input value={form.excerptAr} onChange={(e) => setForm({ ...form, excerptAr: e.target.value })} />
              </div>
              <div>
                <Label>وصف مختصر (English)</Label>
                <Input value={form.excerptEn} onChange={(e) => setForm({ ...form, excerptEn: e.target.value })} />
              </div>
            </div>

            <div>
              <Label>صورة الغلاف</Label>
              <div className="flex items-center gap-3 mt-2">
                {form.heroImage && <img src={form.heroImage} className="w-20 h-20 rounded-lg object-cover" alt="" />}
                <label className="flex-1 cursor-pointer border-2 border-dashed border-[#DFB369]/30 rounded-lg px-4 py-3 hover:border-[#DFB369] flex items-center gap-2 text-sm text-slate-500">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                  {form.heroImage ? "استبدال الصورة" : "رفع صورة الغلاف"}
                  <input type="file" accept="image/*" onChange={handleHeroUpload} className="hidden" />
                </label>
                {form.heroImage && (
                  <button type="button" onClick={() => setForm({ ...form, heroImage: "" })} className="text-xs text-red-500 hover:underline">إزالة</button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>المحتوى (عربي) — يدعم HTML</Label>
                <Textarea rows={10} value={form.contentAr} onChange={(e) => setForm({ ...form, contentAr: e.target.value })} className="font-mono text-xs" placeholder="<h2>من نحن</h2><p>...</p>" data-testid="textarea-content-ar" />
              </div>
              <div>
                <Label>المحتوى (English) — supports HTML</Label>
                <Textarea rows={10} value={form.contentEn} onChange={(e) => setForm({ ...form, contentEn: e.target.value })} className="font-mono text-xs" placeholder="<h2>About</h2><p>...</p>" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#E8E5E0]">
              <div className="flex items-center gap-2">
                <Switch checked={form.showInNav} onCheckedChange={(v) => setForm({ ...form, showInNav: v })} />
                <Label>عرض في القائمة الرئيسية</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
                <Label>نشط</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button onClick={() => upsert.mutate()} disabled={upsert.isPending || !form.titleAr.trim() || !form.slug.trim()} className="bg-[#2B2B60] hover:bg-[#3A3A75] text-white" data-testid="button-save-page">
              {upsert.isPending && <Loader2 className="w-4 h-4 animate-spin me-2" />}
              {editing ? "حفظ" : "إنشاء الصفحة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
