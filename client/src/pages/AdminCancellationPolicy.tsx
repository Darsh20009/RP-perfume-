import { Layout } from "@/components/Layout";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, Save, Loader2, Wallet, Package, Bell, RefreshCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const ALL_STATUSES = [
  { value: "new", label: "جديد" },
  { value: "pending_payment", label: "بانتظار الدفع" },
  { value: "processing", label: "قيد التجهيز" },
  { value: "out_for_delivery", label: "خرج للتوصيل" },
] as const;

export default function AdminCancellationPolicy() {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/cancellation-policy"],
  });

  const [form, setForm] = useState<any>({
    customerCancelStatuses: ["new", "pending_payment", "processing"],
    allowCancelUntilShipping: true,
    refundTarget: "wallet",
    autoRestoreStock: true,
    notifyCustomer: true,
    notifyAdmin: true,
    returnWindowDays: 7,
    allowReturns: true,
    cancellationFeePercent: 0,
  });

  useEffect(() => { if (data) setForm({ ...form, ...data }); }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => apiRequest("PUT", "/api/admin/cancellation-policy", form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cancellation-policy"] });
      toast({ title: "تم حفظ السياسة ✓" });
    },
    onError: () => toast({ title: "فشل الحفظ", variant: "destructive" }),
  });

  const toggleStatus = (status: string) => {
    setForm((f: any) => ({
      ...f,
      customerCancelStatuses: f.customerCancelStatuses.includes(status)
        ? f.customerCancelStatuses.filter((s: string) => s !== status)
        : [...f.customerCancelStatuses, status],
    }));
  };

  if (isLoading) return <Layout><div className="p-12 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto" /></div></Layout>;

  return (
    <Layout>
      <div className="container mx-auto p-6 max-w-4xl space-y-6" dir="rtl">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-400 to-red-500 flex items-center justify-center text-white shadow-lg">
            <Shield className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-3xl font-black">سياسة الإلغاء والاسترجاع</h1>
            <p className="text-sm text-muted-foreground mt-1">تحكّم في متى وكيف يُمكن للعملاء إلغاء طلباتهم</p>
          </div>
        </div>

        {/* Customer cancellation rules */}
        <Card>
          <CardContent className="p-6 space-y-5">
            <h2 className="font-black text-lg flex items-center gap-2">
              <RefreshCcw className="w-5 h-5 text-rose-500" />
              متى يُسمح بالإلغاء
            </h2>
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">حدّد حالات الطلب التي يمكن للعميل إلغاؤها بنفسه:</p>
              <div className="grid grid-cols-2 gap-3">
                {ALL_STATUSES.map(s => (
                  <label key={s.value} className="flex items-center gap-3 p-3 rounded-xl border bg-muted/30 cursor-pointer hover:bg-muted/50 transition">
                    <Checkbox
                      checked={form.customerCancelStatuses.includes(s.value)}
                      onCheckedChange={() => toggleStatus(s.value)}
                      data-testid={`checkbox-status-${s.value}`}
                    />
                    <span className="text-sm font-bold">{s.label}</span>
                  </label>
                ))}
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50 border border-amber-100">
                <div>
                  <p className="font-bold text-sm">السماح بالإلغاء حتى الشحن</p>
                  <p className="text-xs text-muted-foreground">يقبل الإلغاء حتى وهو "خرج للتوصيل"</p>
                </div>
                <Switch
                  checked={form.allowCancelUntilShipping}
                  onCheckedChange={(v) => setForm({ ...form, allowCancelUntilShipping: v })}
                  data-testid="switch-allow-until-shipping"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Refund + Stock */}
        <Card>
          <CardContent className="p-6 space-y-5">
            <h2 className="font-black text-lg flex items-center gap-2">
              <Wallet className="w-5 h-5 text-green-500" />
              الاسترداد التلقائي
            </h2>
            <div className="space-y-3">
              <div>
                <Label className="text-xs font-black uppercase tracking-widest mb-2 block">وجهة الاسترداد</Label>
                <Select value={form.refundTarget} onValueChange={(v) => setForm({ ...form, refundTarget: v })}>
                  <SelectTrigger data-testid="select-refund-target"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="wallet">محفظة العميل (فوري)</SelectItem>
                    <SelectItem value="original">وسيلة الدفع الأصلية</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-green-50 border border-green-100">
                <div>
                  <p className="font-bold text-sm flex items-center gap-2"><Package className="w-4 h-4" /> إعادة الكمية للمخزون تلقائياً</p>
                  <p className="text-xs text-muted-foreground">يُحدّث المخزون فور الإلغاء</p>
                </div>
                <Switch
                  checked={form.autoRestoreStock}
                  onCheckedChange={(v) => setForm({ ...form, autoRestoreStock: v })}
                  data-testid="switch-auto-restore-stock"
                />
              </div>
              <div>
                <Label className="text-xs font-black uppercase tracking-widest mb-2 block">رسوم إلغاء (٪) — 0 للإلغاء المجاني</Label>
                <Input
                  type="number" min={0} max={100}
                  value={form.cancellationFeePercent}
                  onChange={(e) => setForm({ ...form, cancellationFeePercent: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) })}
                  data-testid="input-fee-percent"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardContent className="p-6 space-y-3">
            <h2 className="font-black text-lg flex items-center gap-2">
              <Bell className="w-5 h-5 text-blue-500" />
              التنبيهات
            </h2>
            <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50 border border-blue-100">
              <p className="font-bold text-sm">إشعار العميل (إيميل + push)</p>
              <Switch checked={form.notifyCustomer} onCheckedChange={(v) => setForm({ ...form, notifyCustomer: v })} data-testid="switch-notify-customer" />
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50 border border-blue-100">
              <p className="font-bold text-sm">إشعار الإدارة</p>
              <Switch checked={form.notifyAdmin} onCheckedChange={(v) => setForm({ ...form, notifyAdmin: v })} data-testid="switch-notify-admin" />
            </div>
          </CardContent>
        </Card>

        {/* Returns */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <h2 className="font-black text-lg">سياسة الاسترجاع بعد التسليم</h2>
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border">
              <p className="font-bold text-sm">السماح بالاسترجاع</p>
              <Switch checked={form.allowReturns} onCheckedChange={(v) => setForm({ ...form, allowReturns: v })} data-testid="switch-allow-returns" />
            </div>
            <div>
              <Label className="text-xs font-black uppercase tracking-widest mb-2 block">مدة الاسترجاع (أيام)</Label>
              <Input
                type="number" min={0} max={90}
                value={form.returnWindowDays}
                onChange={(e) => setForm({ ...form, returnWindowDays: Math.max(0, parseInt(e.target.value) || 0) })}
                data-testid="input-return-window"
              />
            </div>
          </CardContent>
        </Card>

        <Button
          size="lg"
          className="w-full bg-gradient-to-br from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white gap-2"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          data-testid="button-save-policy"
        >
          {saveMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          حفظ السياسة
        </Button>
      </div>
    </Layout>
  );
}
