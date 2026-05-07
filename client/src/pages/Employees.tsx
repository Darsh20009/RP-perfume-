import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, UserPlus, Shield, Edit2, Trash2, Search,
  Phone, Mail, Building, Users, CheckCircle2, XCircle,
  Wallet, Plus
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useState, useMemo } from "react";
import { RiyalSign } from "@/components/RiyalSign";

const roleLabels: Record<string, string> = {
  admin: "مدير عام",
  assistant_manager: "مساعد مدير",
  tech_support: "دعم فني",
  accountant: "محاسب",
  legal_consultant: "مستشار قانوني",
  employee: "موظف",
  cashier: "كاشير",
  support: "دعم عملاء",
};

const roleBadge: Record<string, string> = {
  admin: "bg-rose-100 text-rose-700 border-rose-200",
  assistant_manager: "bg-amber-100 text-amber-700 border-amber-200",
  tech_support: "bg-sky-100 text-sky-700 border-sky-200",
  accountant: "bg-emerald-100 text-emerald-700 border-emerald-200",
  legal_consultant: "bg-violet-100 text-violet-700 border-violet-200",
  employee: "bg-gray-100 text-gray-700 border-gray-200",
  cashier: "bg-orange-100 text-orange-700 border-orange-200",
  support: "bg-cyan-100 text-cyan-700 border-cyan-200",
};

const roleAvatarGradient: Record<string, string> = {
  admin: "from-rose-500 to-rose-700",
  assistant_manager: "from-amber-500 to-amber-700",
  tech_support: "from-sky-500 to-sky-700",
  accountant: "from-emerald-500 to-emerald-700",
  cashier: "from-orange-500 to-orange-700",
  legal_consultant: "from-violet-500 to-violet-700",
};

const permissionLabels: Record<string, string> = {
  "orders.view": "عرض الطلبات",
  "orders.edit": "تعديل الطلبات",
  "orders.refund": "استرجاع الطلبات",
  "products.view": "عرض المنتجات",
  "products.edit": "تعديل المنتجات",
  "customers.view": "عرض العملاء",
  "wallet.adjust": "تعديل المحفظة",
  "reports.view": "عرض التقارير",
  "staff.manage": "إدارة الموظفين",
  "pos.access": "نقطة البيع",
  "settings.manage": "إعدادات النظام",
  "branch.manage": "إدارة الفروع",
  "branch.inventory": "مخزون الفرع",
  "branch.orders": "طلبات الفرع",
  orders: "الطلبات",
};

export default function Employees() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [depositOpen, setDepositOpen] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "", phone: "", email: "", password: "", role: "employee", isActive: true
  });
  const [depositData, setDepositData] = useState({ amount: "", description: "" });

  const { data: users, isLoading } = useQuery({ queryKey: ["/api/admin/users"] });
  const { data: branches } = useQuery({ queryKey: ["/api/branches"] });

  const employees = useMemo(() =>
    Array.isArray(users) ? (users as any[]).filter((u) => u.role !== "customer") : [],
    [users]
  );

  const filtered = useMemo(() => {
    let list = employees;
    if (roleFilter !== "all") list = list.filter((u: any) => u.role === roleFilter);
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter((u: any) =>
        (u.name || "").toLowerCase().includes(s) ||
        (u.phone || "").includes(s) ||
        (u.email || "").toLowerCase().includes(s)
      );
    }
    return list;
  }, [employees, search, roleFilter]);

  const stats = useMemo(() => ({
    total: employees.length,
    active: employees.filter((u: any) => u.isActive).length,
    inactive: employees.filter((u: any) => !u.isActive).length,
  }), [employees]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/admin/users", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "تم الإضافة", description: "تمت إضافة الموظف بنجاح" });
      setCreateOpen(false);
      setForm({ name: "", phone: "", email: "", password: "", role: "employee", isActive: true });
    },
    onError: (err: any) => toast({ title: "خطأ", description: err?.message || "حدث خطأ", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "تم التحديث" });
      setEditingEmployee(null);
    },
    onError: (err: any) => toast({ title: "خطأ", description: err?.message || "حدث خطأ", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/admin/users/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "تم الحذف" });
      setDeleteId(null);
    },
    onError: (err: any) => toast({ title: "خطأ", description: err?.message, variant: "destructive" }),
  });

  const depositMutation = useMutation({
    mutationFn: async ({ userId, amount, description }: any) => {
      const res = await apiRequest("POST", "/api/admin/wallet/deposit", { userId, amount: Number(amount), description });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "تم شحن المحفظة" });
      setDepositOpen(null);
      setDepositData({ amount: "", description: "" });
    },
    onError: (err: any) => toast({ title: "خطأ", description: err?.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-[#DFB369]" />
      </div>
    );
  }

  const EmployeeForm = ({ isEdit = false, emp = null }: { isEdit?: boolean; emp?: any }) => (
    <div className="space-y-4 pt-2">
      <div className="grid grid-cols-2 gap-4">
        <div className="text-right">
          <Label className="font-black text-sm mb-1.5 block">الاسم الكامل</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="مثال: أحمد محمد"
            data-testid="input-emp-name"
          />
        </div>
        <div className="text-right">
          <Label className="font-black text-sm mb-1.5 block">رقم الهاتف</Label>
          <Input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="5XXXXXXXX"
            dir="ltr"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="text-right">
          <Label className="font-black text-sm mb-1.5 block">البريد الإلكتروني</Label>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="email@example.com"
            dir="ltr"
          />
        </div>
        <div className="text-right">
          <Label className="font-black text-sm mb-1.5 block">
            {isEdit ? "كلمة مرور جديدة (اختياري)" : "كلمة المرور"}
          </Label>
          <Input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder={isEdit ? "اتركها فارغة للإبقاء" : "••••••••"}
          />
        </div>
      </div>
      <div className="text-right">
        <Label className="font-black text-sm mb-1.5 block">الدور الوظيفي</Label>
        <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
          <SelectTrigger className="h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(roleLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center justify-between bg-[#FAF8F4] rounded-xl p-4 border border-[#DFB369]/15">
        <div className="text-right">
          <p className="font-black text-sm">حساب نشط</p>
          <p className="text-xs text-gray-500 font-bold">يستطيع الموظف تسجيل الدخول</p>
        </div>
        <Switch
          checked={form.isActive}
          onCheckedChange={(v) => setForm({ ...form, isActive: v })}
        />
      </div>
      <Button
        className="w-full h-11 bg-[#DFB369] hover:bg-[#c89853] text-[#0F0F0F] font-black"
        onClick={() => {
          if (isEdit && emp) {
            const payload: any = { name: form.name, email: form.email, role: form.role, isActive: form.isActive };
            if (form.password) payload.password = form.password;
            updateMutation.mutate({ id: emp.id, data: payload });
          } else {
            createMutation.mutate(form);
          }
        }}
        disabled={createMutation.isPending || updateMutation.isPending}
      >
        {(createMutation.isPending || updateMutation.isPending)
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : isEdit ? "حفظ التعديلات" : "إضافة الموظف"
        }
      </Button>
    </div>
  );

  return (
    <div className="p-6 md:p-8 space-y-6 min-h-screen" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[#2B2B60]">إدارة الموظفين</h1>
          <p className="text-sm text-gray-600 font-bold mt-1">إضافة وتعديل بيانات وصلاحيات فريق العمل</p>
        </div>
        <Dialog open={createOpen} onOpenChange={(v) => { setCreateOpen(v); if (!v) setForm({ name: "", phone: "", email: "", password: "", role: "employee", isActive: true }); }}>
          <DialogTrigger asChild>
            <Button
              className="gap-2 bg-[#DFB369] hover:bg-[#c89853] text-[#0F0F0F] font-black h-12 px-6 shadow-lg shadow-[#DFB369]/30"
              data-testid="button-add-employee"
            >
              <UserPlus className="h-5 w-5" />
              إضافة موظف
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-right text-2xl font-black text-[#2B2B60]">إضافة موظف جديد</DialogTitle>
              <DialogDescription className="text-right text-gray-600">أدخل بيانات الموظف وحدّد دوره الوظيفي.</DialogDescription>
            </DialogHeader>
            <EmployeeForm />
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border border-[#DFB369]/20 bg-gradient-to-br from-white to-[#FAF8F4]">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">إجمالي الموظفين</span>
              <Users className="h-4 w-4 text-[#2B2B60]" />
            </div>
            <p className="text-3xl font-black text-[#2B2B60]">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="border border-emerald-200 bg-gradient-to-br from-white to-emerald-50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">حسابات نشطة</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-3xl font-black text-emerald-600">{stats.active}</p>
          </CardContent>
        </Card>
        <Card className="border border-red-100 bg-gradient-to-br from-white to-red-50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">حسابات موقوفة</span>
              <XCircle className="h-4 w-4 text-red-500" />
            </div>
            <p className="text-3xl font-black text-red-500">{stats.inactive}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border border-[#DFB369]/20">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="ابحث بالاسم أو الجوال أو البريد…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-10 h-11 font-bold"
                data-testid="input-search-employees"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="md:w-48 h-11 font-bold" data-testid="filter-employee-role">
                <SelectValue placeholder="كل الأدوار" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأدوار</SelectItem>
                {Object.entries(roleLabels).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Employee Grid */}
      {filtered.length === 0 ? (
        <Card className="border-dashed border-2 border-[#DFB369]/20">
          <CardContent className="py-16 text-center">
            <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="font-black text-lg text-gray-600 mb-1">
              {employees.length === 0 ? "لا يوجد موظفون بعد" : "لا توجد نتائج"}
            </p>
            <p className="text-sm text-gray-400 font-bold">
              {employees.length === 0 ? "أنشئ حساب موظفك الأول" : "جرّب فلتر أو كلمة بحث أخرى"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((emp: any) => (
            <Card
              key={emp.id}
              className={`border hover:border-[#DFB369] hover:shadow-lg transition-all ${
                emp.isActive ? "border-[#DFB369]/20" : "border-red-200 bg-red-50/30"
              }`}
              data-testid={`card-employee-${emp.id}`}
            >
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl text-white shadow-md bg-gradient-to-br ${
                      roleAvatarGradient[emp.role] || "from-[#2B2B60] to-[#0F0F0F]"
                    }`}>
                      {(emp.name || emp.phone || "م").charAt(0).toUpperCase()}
                    </div>
                    <div className={`absolute -bottom-1 -left-1 w-4 h-4 rounded-full border-2 border-white ${emp.isActive ? "bg-emerald-500" : "bg-red-500"}`} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <p className="font-black text-lg text-[#2B2B60]" data-testid={`text-emp-name-${emp.id}`}>
                          {emp.name || emp.phone || "—"}
                        </p>
                        <span className={`inline-block mt-1 text-[10px] font-black px-2.5 py-0.5 rounded-full border ${roleBadge[emp.role] || "bg-gray-100 text-gray-700 border-gray-200"}`}>
                          {roleLabels[emp.role] || emp.role}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 space-y-1.5">
                      {emp.phone && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-600">
                          <Phone className="h-3 w-3 text-[#DFB369]" />
                          <span className="font-bold" dir="ltr">{emp.phone}</span>
                        </div>
                      )}
                      {emp.email && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-600">
                          <Mail className="h-3 w-3 text-[#DFB369]" />
                          <span className="font-bold truncate" dir="ltr">{emp.email}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-xs text-gray-600">
                        <Building className="h-3 w-3 text-[#DFB369]" />
                        <span className="font-bold">
                          {(branches as any[])?.find((b: any) => b.id === emp.branchId)?.name || "المركز الرئيسي"}
                        </span>
                      </div>
                    </div>

                    {/* Permissions */}
                    {emp.permissions && emp.permissions.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {emp.permissions.slice(0, 4).map((p: string) => (
                          <Badge key={p} variant="secondary" className="text-[9px] font-black px-2 py-0.5 gap-1">
                            <Shield className="w-2.5 h-2.5" />
                            {permissionLabels[p] || p}
                          </Badge>
                        ))}
                        {emp.permissions.length > 4 && (
                          <Badge variant="secondary" className="text-[9px] font-black px-2 py-0.5">
                            +{emp.permissions.length - 4}
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="mt-4 pt-3 border-t border-[#DFB369]/10 flex items-center gap-2 flex-wrap">
                      {/* Wallet deposit */}
                      <Dialog open={depositOpen === emp.id} onOpenChange={(v) => { if (!v) { setDepositOpen(null); setDepositData({ amount: "", description: "" }); } else setDepositOpen(emp.id); }}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" className="h-8 text-[11px] font-black gap-1 border-[#DFB369]/30 text-[#2B2B60] hover:bg-[#DFB369]/10">
                            <Plus className="w-3 h-3" />
                            شحن المحفظة
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[380px]" dir="rtl">
                          <DialogHeader>
                            <DialogTitle className="text-right font-black text-[#2B2B60]">شحن محفظة {emp.name}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 pt-2">
                            <div>
                              <Label className="font-black text-sm mb-1.5 block">المبلغ (<RiyalSign />)</Label>
                              <Input
                                type="number"
                                value={depositData.amount}
                                onChange={(e) => setDepositData({ ...depositData, amount: e.target.value })}
                                placeholder="0.00"
                                className="h-11"
                              />
                            </div>
                            <div>
                              <Label className="font-black text-sm mb-1.5 block">ملاحظات</Label>
                              <Input
                                value={depositData.description}
                                onChange={(e) => setDepositData({ ...depositData, description: e.target.value })}
                                placeholder="مثال: مكافأة شهرية"
                                className="h-11"
                              />
                            </div>
                            <Button
                              className="w-full h-11 bg-[#DFB369] hover:bg-[#c89853] text-[#0F0F0F] font-black"
                              onClick={() => depositMutation.mutate({ userId: emp.id, ...depositData })}
                              disabled={!depositData.amount || depositMutation.isPending}
                            >
                              {depositMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "تأكيد الشحن"}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>

                      {/* Edit */}
                      <Dialog open={editingEmployee?.id === emp.id} onOpenChange={(v) => {
                        if (v) {
                          setForm({ name: emp.name || "", phone: emp.phone || "", email: emp.email || "", password: "", role: emp.role || "employee", isActive: emp.isActive ?? true });
                          setEditingEmployee(emp);
                        } else {
                          setEditingEmployee(null);
                        }
                      }}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" className="h-8 text-[11px] font-black gap-1 border-[#DFB369]/30 text-[#2B2B60] hover:bg-[#DFB369]/10">
                            <Edit2 className="w-3 h-3" />
                            تعديل
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto" dir="rtl">
                          <DialogHeader>
                            <DialogTitle className="text-right font-black text-[#2B2B60]">تعديل بيانات {emp.name}</DialogTitle>
                          </DialogHeader>
                          <EmployeeForm isEdit emp={emp} />
                        </DialogContent>
                      </Dialog>

                      {/* Delete */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-[11px] font-black gap-1 text-red-500 hover:bg-red-50 hover:text-red-600 mr-auto"
                        onClick={() => setDeleteId(emp.id)}
                        data-testid={`button-delete-employee-${emp.id}`}
                      >
                        <Trash2 className="w-3 h-3" />
                        حذف
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(v) => { if (!v) setDeleteId(null); }}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-right font-black text-[#2B2B60]">تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription className="text-right">
              سيتم حذف حساب الموظف نهائيًا. هذا الإجراء لا يمكن التراجع عنه.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 font-black"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "حذف"}
            </AlertDialogAction>
            <AlertDialogCancel className="font-black">إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
