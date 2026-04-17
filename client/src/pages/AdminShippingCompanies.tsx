import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Truck, Trash2, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function AdminShippingCompanies() {
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: "", price: 0, estimatedDays: 2, storageXCode: "" });

  const { data: companies = [] } = useQuery({
    queryKey: ["/api/shipping-companies"],
    queryFn: async () => {
      const res = await fetch("/api/shipping-companies");
      return res.json();
    }
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => apiRequest("POST", "/api/shipping-companies", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shipping-companies"] });
      setShowDialog(false);
      setFormData({ name: "", price: 0, estimatedDays: 2, storageXCode: "" });
      toast({ title: "تم إنشاء شركة الشحن بنجاح" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: (data: typeof formData) => apiRequest("PATCH", `/api/shipping-companies/${editingId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shipping-companies"] });
      setShowDialog(false);
      setEditingId(null);
      setFormData({ name: "", price: 0, estimatedDays: 2, storageXCode: "" });
      toast({ title: "تم تحديث شركة الشحن بنجاح" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/shipping-companies/${id}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shipping-companies"] });
      toast({ title: "تم حذف شركة الشحن بنجاح" });
    }
  });

  const handleSubmit = () => {
    if (!formData.name || formData.price <= 0 || formData.estimatedDays <= 0) {
      toast({ title: "الرجاء ملء جميع الحقول المطلوبة", variant: "destructive" });
      return;
    }
    if (editingId) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (company: any) => {
    setEditingId(company.id);
    setFormData({ name: company.name, price: company.price, estimatedDays: company.estimatedDays, storageXCode: company.storageXCode || "" });
    setShowDialog(true);
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
            <Button onClick={() => { setEditingId(null); setFormData({ name: "", price: 0, estimatedDays: 2, storageXCode: "" }); setShowDialog(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              إضافة شركة شحن
            </Button>
          </div>

          <div className="grid gap-6">
            {companies.map((company: any) => (
              <Card key={company.id} className="p-6 border border-black/5">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-black text-lg mb-2">{company.name}</h3>
                    <div className="grid grid-cols-3 gap-4 text-sm text-muted-foreground">
                      <p><span className="font-bold">السعر:</span> {company.price} ر.س</p>
                      <p><span className="font-bold">عدد الأيام:</span> {company.estimatedDays} أيام</p>
                      {company.storageXCode && <p><span className="font-bold">كود Storage X:</span> {company.storageXCode}</p>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(company)}>تعديل</Button>
                    <Button variant="destructive" size="sm" onClick={() => deleteMutation.mutate(company.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogContent dir="rtl" className="rounded-3xl">
              <DialogHeader>
                <DialogTitle>{editingId ? "تعديل شركة الشحن" : "إضافة شركة شحن جديدة"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-bold mb-2 block">اسم الشركة</label>
                  <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="مثال: Storage X" />
                </div>
                <div>
                  <label className="text-sm font-bold mb-2 block">السعر (ر.س)</label>
                  <Input type="number" value={formData.price} onChange={(e) => setFormData({...formData, price: Number(e.target.value)})} placeholder="0" />
                </div>
                <div>
                  <label className="text-sm font-bold mb-2 block">عدد الأيام المتوقعة</label>
                  <Input type="number" value={formData.estimatedDays} onChange={(e) => setFormData({...formData, estimatedDays: Number(e.target.value)})} placeholder="2" />
                </div>
                <div>
                  <label className="text-sm font-bold mb-2 block">كود Storage X (اختياري)</label>
                  <Input value={formData.storageXCode} onChange={(e) => setFormData({...formData, storageXCode: e.target.value})} placeholder="كود الاتصال" />
                </div>
                <Button className="w-full" onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingId ? "تحديث" : "إضافة"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </Layout>
  );
}
