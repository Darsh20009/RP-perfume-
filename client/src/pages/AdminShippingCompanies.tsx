import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Truck, Trash2, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RiyalSign } from "@/components/RiyalSign";

const emptyForm = {
  name: "",
  nameEn: "",
  logo: "",
  price: 0,
  estimatedDays: 2,
  storageXCode: "",
  freeShippingThreshold: 0,
  trackingUrlTemplate: "",
  supportPhone: "",
  isActive: true,
};

export default function AdminShippingCompanies() {
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ ...emptyForm });
  const [logoUploading, setLogoUploading] = useState(false);

  const { data: companies = [] } = useQuery({
    queryKey: ["/api/shipping-companies"],
    queryFn: async () => {
      const res = await fetch("/api/shipping-companies");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => apiRequest("POST", "/api/shipping-companies", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shipping-companies"] });
      setShowDialog(false);
      setFormData({ ...emptyForm });
      toast({ title: "تم إنشاء شركة الشحن بنجاح" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: typeof formData) => apiRequest("PATCH", `/api/shipping-companies/${editingId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shipping-companies"] });
      setShowDialog(false);
      setEditingId(null);
      setFormData({ ...emptyForm });
      toast({ title: "تم تحديث شركة الشحن بنجاح" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/shipping-companies/${id}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shipping-companies"] });
      toast({ title: "تم حذف شركة الشحن بنجاح" });
    },
  });

  const handleSubmit = () => {
    if (!formData.name || formData.price <= 0 || formData.estimatedDays <= 0) {
      toast({ title: "الرجاء ملء الاسم والسعر وعدد الأيام", variant: "destructive" });
      return;
    }
    if (editingId) updateMutation.mutate(formData);
    else createMutation.mutate(formData);
  };

  const handleEdit = (company: any) => {
    setEditingId(company.id);
    setFormData({
      name: company.name || "",
      nameEn: company.nameEn || "",
      logo: company.logo || "",
      price: Number(company.price) || 0,
      estimatedDays: Number(company.estimatedDays) || 2,
      storageXCode: company.storageXCode || "",
      freeShippingThreshold: Number(company.freeShippingThreshold) || 0,
      trackingUrlTemplate: company.trackingUrlTemplate || "",
      supportPhone: company.supportPhone || "",
      isActive: company.isActive !== false,
    });
    setShowDialog(true);
  };

  const uploadLogo = async (file: File) => {
    setLogoUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/upload", { method: "POST", body: fd, credentials: "include" });
      const d = await r.json();
      if (d.url) {
        setFormData({ ...formData, logo: d.url });
        toast({ title: "تم رفع الشعار" });
      }
    } catch {
      toast({ title: "فشل الرفع", variant: "destructive" });
    } finally {
      setLogoUploading(false);
    }
  };

  return (
    <Layout>
      <div className="min-h-screen bg-[#f8fafc] p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-black uppercase tracking-tight flex items-center gap-3">
              <Truck className="h-8 w-8 text-primary" />
              إدارة شركات الشحن
            </h1>
            <Button
              data-testid="button-add-shipping-company"
              onClick={() => {
                setEditingId(null);
                setFormData({ ...emptyForm });
                setShowDialog(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              إضافة شركة شحن
            </Button>
          </div>

          <div className="grid gap-6">
            {companies.map((company: any) => (
              <Card key={company.id} className="p-6 border border-black/5">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1">
                    {company.logo && (
                      <img src={company.logo} alt={company.name} className="h-14 w-14 object-contain bg-white border border-black/5 rounded-lg p-1" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-black text-lg" data-testid={`text-shipping-name-${company.id}`}>{company.name}</h3>
                        {company.nameEn && <span className="text-xs text-muted-foreground" dir="ltr">({company.nameEn})</span>}
                        {company.isActive === false && (
                          <span className="text-[10px] font-black bg-red-100 text-red-700 px-2 py-0.5 rounded">معطّلة</span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-muted-foreground">
                        <p><span className="font-bold">السعر:</span> {company.price} <RiyalSign /></p>
                        <p><span className="font-bold">المدة:</span> {company.estimatedDays} أيام</p>
                        {Number(company.freeShippingThreshold) > 0 && (
                          <p><span className="font-bold">شحن مجاني فوق:</span> {company.freeShippingThreshold} <RiyalSign /></p>
                        )}
                        {company.supportPhone && (
                          <p><span className="font-bold">الدعم:</span> <span dir="ltr">{company.supportPhone}</span></p>
                        )}
                      </div>
                      {company.trackingUrlTemplate && (
                        <p className="text-[10px] text-muted-foreground mt-2 truncate" dir="ltr" title={company.trackingUrlTemplate}>
                          🔗 {company.trackingUrlTemplate}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(company)} data-testid={`button-edit-shipping-${company.id}`}>تعديل</Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteMutation.mutate(company.id)}
                      data-testid={`button-delete-shipping-${company.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogContent dir="rtl" className="rounded-3xl max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingId ? "تعديل شركة الشحن" : "إضافة شركة شحن جديدة"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-bold mb-2 block">اسم الشركة (عربي) *</label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="مثال: أرامكس"
                      data-testid="input-shipping-name"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-bold mb-2 block">Name (English)</label>
                    <Input
                      value={formData.nameEn}
                      onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                      placeholder="Aramex"
                      dir="ltr"
                      data-testid="input-shipping-name-en"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-bold mb-2 block">شعار الشركة</label>
                  <div className="flex items-center gap-3">
                    {formData.logo && (
                      <img src={formData.logo} alt="logo" className="h-14 w-14 object-contain border border-black/10 rounded p-1 bg-white" />
                    )}
                    <Input
                      type="file"
                      accept="image/*"
                      disabled={logoUploading}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); }}
                      className="flex-1"
                      data-testid="input-upload-shipping-logo"
                    />
                    {formData.logo && (
                      <button onClick={() => setFormData({ ...formData, logo: "" })} className="text-[10px] text-red-500 font-bold hover:underline">حذف</button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-bold mb-2 block">السعر (<RiyalSign />) *</label>
                    <Input
                      type="number"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                      placeholder="25"
                      data-testid="input-shipping-price"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-bold mb-2 block">عدد الأيام *</label>
                    <Input
                      type="number"
                      value={formData.estimatedDays}
                      onChange={(e) => setFormData({ ...formData, estimatedDays: Number(e.target.value) })}
                      placeholder="2"
                      data-testid="input-shipping-days"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-bold mb-2 block">شحن مجاني فوق (<RiyalSign />) — اتركه 0 للتعطيل</label>
                  <Input
                    type="number"
                    value={formData.freeShippingThreshold}
                    onChange={(e) => setFormData({ ...formData, freeShippingThreshold: Number(e.target.value) })}
                    placeholder="0"
                    data-testid="input-shipping-free-threshold"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">يطبَّق فقط على هذه الشركة. عتبة المتجر العامة تأتي من إعدادات المتجر.</p>
                </div>

                <div>
                  <label className="text-sm font-bold mb-2 block">قالب رابط التتبع</label>
                  <Input
                    value={formData.trackingUrlTemplate}
                    onChange={(e) => setFormData({ ...formData, trackingUrlTemplate: e.target.value })}
                    placeholder="https://aramex.com/track/{tracking}"
                    dir="ltr"
                    data-testid="input-shipping-tracking-template"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">استخدم <code className="bg-secondary px-1">{"{tracking}"}</code> كمكان لرقم الشحنة. يُستبدل تلقائياً في رسائل العميل.</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-bold mb-2 block">هاتف دعم الشركة</label>
                    <Input
                      value={formData.supportPhone}
                      onChange={(e) => setFormData({ ...formData, supportPhone: e.target.value })}
                      placeholder="+9669200..."
                      dir="ltr"
                      data-testid="input-shipping-support-phone"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-bold mb-2 block">كود Storage X (اختياري)</label>
                    <Input
                      value={formData.storageXCode}
                      onChange={(e) => setFormData({ ...formData, storageXCode: e.target.value })}
                      placeholder="B20"
                      data-testid="input-shipping-storagex"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between bg-secondary/10 rounded p-3">
                  <div>
                    <p className="text-sm font-black">الشركة نشطة</p>
                    <p className="text-[11px] text-muted-foreground">إذا عطّلتها لن تظهر للعميل في الدفع</p>
                  </div>
                  <Switch
                    checked={formData.isActive}
                    onCheckedChange={(v) => setFormData({ ...formData, isActive: v })}
                    data-testid="switch-shipping-active"
                  />
                </div>

                <Button
                  className="w-full h-12 font-black"
                  onClick={handleSubmit}
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-save-shipping"
                >
                  {editingId ? "تحديث الشركة" : "إضافة الشركة"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </Layout>
  );
}
