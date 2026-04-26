import { useQuery, useMutation } from "@tanstack/react-query";
import { User, InsertUser, Branch, employeePermissions } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Loader2, UserPlus, Shield, Building, Trash2, Edit2, Search,
  Users, CheckCircle2, XCircle, ShieldCheck, Phone, Mail,
} from "lucide-react";
import { useForm } from "react-hook-form";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { useState, useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

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
};

const roleLabels: Record<string, string> = {
  admin: "مدير عام",
  assistant_manager: "مساعد مدير",
  tech_support: "دعم فني",
  accountant: "محاسب",
  legal_consultant: "مستشار قانوني",
  employee: "موظف",
  cashier: "كاشير",
  support: "دعم العملاء",
  vendor: "بائع",
  customer: "عميل",
};

const roleDefaultPermissions: Record<string, string[]> = {
  admin: ["orders.view", "orders.edit", "orders.refund", "products.view", "products.edit", "customers.view", "wallet.adjust", "reports.view", "staff.manage", "pos.access", "settings.manage"],
  assistant_manager: ["orders.view", "orders.edit", "orders.refund", "products.view", "products.edit", "customers.view", "wallet.adjust", "reports.view", "staff.manage"],
  tech_support: ["orders.view", "products.view", "customers.view", "settings.manage"],
  accountant: ["orders.view", "reports.view", "customers.view", "wallet.adjust"],
  legal_consultant: ["orders.view", "reports.view", "customers.view"],
  employee: ["orders.view", "products.view", "customers.view"],
  cashier: ["orders.view", "orders.edit", "pos.access", "customers.view"],
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

const emptyStaff: InsertUser = {
  name: "",
  phone: "",
  email: "",
  password: "",
  role: "employee",
  permissions: [],
  branchId: "",
  loginType: "dashboard",
  isActive: true,
};

function StatTile({ icon: Icon, label, value, accent = "text-[#2B2B60]" }: { icon: any; label: string; value: number | string; accent?: string }) {
  return (
    <Card className="p-5 border border-[#DFB369]/20 bg-gradient-to-br from-white to-[#FAF8F4]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-gray-700">{label}</span>
        <Icon className={`h-4 w-4 ${accent}`} />
      </div>
      <div className={`text-3xl font-black ${accent}`}>{value}</div>
    </Card>
  );
}

export default function AdminStaff() {
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [branchFilter, setBranchFilter] = useState<string>("all");

  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  const { data: branches } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const staff = useMemo(() => (users || []).filter(u => u.role !== "customer"), [users]);

  const createForm = useForm<InsertUser>({ defaultValues: emptyStaff });
  const editForm = useForm<InsertUser>({ defaultValues: emptyStaff });

  const createMutation = useMutation({
    mutationFn: async (data: InsertUser) => {
      const res = await apiRequest("POST", "/api/admin/users", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "تم بنجاح", description: "تم إضافة الموظف" });
      setCreateOpen(false);
      createForm.reset(emptyStaff);
    },
    onError: (err: any) => toast({ title: "تعذّر الإضافة", description: err?.message || "حدث خطأ", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertUser> }) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "تم التحديث", description: "تم حفظ تعديلات الموظف" });
      setEditingUser(null);
    },
    onError: (err: any) => toast({ title: "تعذّر التحديث", description: err?.message || "حدث خطأ", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/admin/users/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "تم الحذف", description: "تم حذف حساب الموظف" });
      setDeleteId(null);
    },
    onError: (err: any) => toast({ title: "تعذّر الحذف", description: err?.message || "حدث خطأ", variant: "destructive" }),
  });

  const startEdit = (u: User) => {
    editForm.reset({
      name: u.name || "",
      phone: u.phone || "",
      email: u.email || "",
      password: "",
      role: u.role as any,
      permissions: u.permissions || [],
      branchId: u.branchId || "",
      loginType: (u as any).loginType || "dashboard",
      isActive: u.isActive ?? true,
    });
    setEditingUser(u);
  };

  const filtered = useMemo(() => {
    let list = staff;
    if (roleFilter !== "all") list = list.filter(u => u.role === roleFilter);
    if (branchFilter !== "all") list = list.filter(u => (u.branchId || "main") === branchFilter);
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      list = list.filter(u =>
        (u.name || "").toLowerCase().includes(s) ||
        (u.phone || "").includes(s) ||
        (u.email || "").toLowerCase().includes(s),
      );
    }
    return list;
  }, [staff, search, roleFilter, branchFilter]);

  const stats = useMemo(() => {
    return {
      total: staff.length,
      active: staff.filter(u => u.isActive).length,
      admins: staff.filter(u => ["admin", "assistant_manager"].includes(u.role)).length,
      cashiers: staff.filter(u => u.role === "cashier").length,
    };
  }, [staff]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-[#DFB369]" />
      </div>
    );
  }

  const renderForm = (form: typeof createForm, isEdit: boolean) => (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((data) => {
          if (isEdit && editingUser) {
            const payload: Partial<InsertUser> = { ...data };
            if (!payload.password) delete (payload as any).password;
            updateMutation.mutate({ id: editingUser.id, data: payload });
          } else {
            createMutation.mutate(data);
          }
        })}
        className="space-y-5"
      >
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem className="text-right">
              <FormLabel className="font-black">الاسم الكامل</FormLabel>
              <FormControl><Input {...field} value={field.value || ""} data-testid="input-staff-name" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="phone" render={({ field }) => (
            <FormItem className="text-right">
              <FormLabel className="font-black">رقم الهاتف</FormLabel>
              <FormControl><Input {...field} value={field.value || ""} placeholder="5XXXXXXXX" dir="ltr" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="password" render={({ field }) => (
            <FormItem className="text-right">
              <FormLabel className="font-black">{isEdit ? "كلمة مرور جديدة (اختياري)" : "كلمة المرور"}</FormLabel>
              <FormControl><Input {...field} value={field.value || ""} type="password" placeholder={isEdit ? "اتركها فارغة للإبقاء" : "كلمة مرور الدخول"} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="email" render={({ field }) => (
            <FormItem className="text-right">
              <FormLabel className="font-black">البريد الإلكتروني</FormLabel>
              <FormControl><Input {...field} value={field.value || ""} type="email" placeholder="email@example.com" dir="ltr" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="role" render={({ field }) => (
            <FormItem className="text-right">
              <FormLabel className="font-black">الدور الوظيفي</FormLabel>
              <Select
                onValueChange={(val) => {
                  field.onChange(val);
                  if (!isEdit) form.setValue("permissions", roleDefaultPermissions[val] || []);
                }}
                value={field.value}
              >
                <FormControl>
                  <SelectTrigger><SelectValue placeholder="اختر الدور" /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.entries(roleLabels).filter(([k]) => k !== "customer" && k !== "vendor" && k !== "support").map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormItem>
          )} />
          <FormField control={form.control} name="loginType" render={({ field }) => (
            <FormItem className="text-right">
              <FormLabel className="font-black">نوع الدخول</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || "dashboard"}>
                <FormControl>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="dashboard">لوحة التحكم</SelectItem>
                  <SelectItem value="pos">نقطة بيع فقط</SelectItem>
                  <SelectItem value="both">الاثنين معاً</SelectItem>
                </SelectContent>
              </Select>
            </FormItem>
          )} />
        </div>

        <FormField control={form.control} name="branchId" render={({ field }) => (
          <FormItem className="text-right">
            <FormLabel className="font-black">الفرع المرتبط</FormLabel>
            <Select onValueChange={field.onChange} value={field.value || "main"}>
              <FormControl>
                <SelectTrigger><SelectValue placeholder="اختر الفرع" /></SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="main">المركز الرئيسي</SelectItem>
                {branches?.map(b => (<SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </FormItem>
        )} />

        <FormField control={form.control} name="isActive" render={({ field }) => (
          <FormItem className="flex flex-row items-center justify-between bg-[#FAF8F4] rounded-xl p-4">
            <div className="text-right">
              <FormLabel className="font-black">حساب نشط</FormLabel>
              <p className="text-[11px] text-gray-700 font-bold">يستطيع الموظف تسجيل الدخول</p>
            </div>
            <FormControl><Switch checked={field.value ?? true} onCheckedChange={field.onChange} /></FormControl>
          </FormItem>
        )} />

        <div className="space-y-3">
          <FormLabel className="text-right block font-black">الصلاحيات الدقيقة</FormLabel>
          <div className="grid grid-cols-2 gap-3 border border-[#DFB369]/30 p-4 rounded-xl bg-[#FAF8F4]">
            {employeePermissions.map((permission) => (
              <FormField
                key={permission}
                control={form.control}
                name="permissions"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center gap-2 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value?.includes(permission)}
                        onCheckedChange={(checked) => {
                          return checked
                            ? field.onChange([...(field.value || []), permission])
                            : field.onChange((field.value || []).filter((v: string) => v !== permission));
                        }}
                      />
                    </FormControl>
                    <FormLabel className="font-bold text-xs cursor-pointer">{permissionLabels[permission] || permission}</FormLabel>
                  </FormItem>
                )}
              />
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="submit"
            className="bg-[#2B2B60] hover:bg-[#1c1c45] text-white font-black"
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            {(createMutation.isPending || updateMutation.isPending) ? <Loader2 className="h-4 w-4 animate-spin" /> : isEdit ? "حفظ التعديلات" : "إضافة الموظف"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );

  return (
    <div className="p-6 md:p-8 space-y-6 bg-[#FAF8F4]/30 min-h-screen" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[#2B2B60]">إدارة الموظفين والصلاحيات</h1>
          <p className="text-sm text-gray-700 font-bold mt-1">أنشئ حسابات الموظفين وحدّد دورهم وصلاحياتهم وفرعهم.</p>
        </div>
        <Dialog open={createOpen} onOpenChange={(v) => { setCreateOpen(v); if (!v) createForm.reset(emptyStaff); }}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-[#DFB369] hover:bg-[#c89853] text-[#0F0F0F] font-black h-12 px-6 shadow-lg shadow-[#DFB369]/30" data-testid="button-add-staff">
              <UserPlus className="h-5 w-5" />
              إضافة موظف
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-right text-2xl font-black text-[#2B2B60]">إضافة موظف جديد</DialogTitle>
              <DialogDescription className="text-right text-gray-700">أدخل بيانات الموظف وحدّد دوره وصلاحياته.</DialogDescription>
            </DialogHeader>
            {renderForm(createForm, false)}
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile icon={Users} label="إجمالي الموظفين" value={stats.total} />
        <StatTile icon={CheckCircle2} label="حسابات نشطة" value={stats.active} accent="text-emerald-600" />
        <StatTile icon={ShieldCheck} label="مديرون" value={stats.admins} accent="text-rose-600" />
        <StatTile icon={Shield} label="كاشير" value={stats.cashiers} accent="text-orange-600" />
      </div>

      {/* Filters */}
      <Card className="p-4 border border-[#DFB369]/20">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-700" />
            <Input
              placeholder="ابحث بالاسم أو الجوال أو البريد…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-10 h-11 font-bold"
              data-testid="input-search-staff"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="md:w-48 h-11 font-bold" data-testid="filter-staff-role">
              <SelectValue placeholder="كل الأدوار" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأدوار</SelectItem>
              {Object.entries(roleLabels).filter(([k]) => k !== "customer").map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="md:w-48 h-11 font-bold" data-testid="filter-staff-branch">
              <SelectValue placeholder="كل الفروع" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الفروع</SelectItem>
              <SelectItem value="main">المركز الرئيسي</SelectItem>
              {branches?.map(b => (<SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Staff list */}
      {filtered.length === 0 ? (
        <Card className="p-16 text-center border-dashed border-2">
          <Users className="h-12 w-12 text-gray-700 mx-auto mb-4" />
          <p className="font-black text-lg text-gray-800 mb-2">
            {staff.length === 0 ? "لا يوجد موظفون بعد" : "لا توجد نتائج للبحث"}
          </p>
          <p className="text-sm text-gray-700 font-bold">
            {staff.length === 0 ? "أنشئ حساب موظفك الأول" : "جرّب فلتر أو كلمة بحث أخرى"}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((u) => (
            <Card
              key={u.id}
              className={`p-5 border ${u.isActive ? "border-[#DFB369]/20" : "border-red-200 bg-red-50/30"} hover:border-[#DFB369] transition-all hover:shadow-lg`}
              data-testid={`card-staff-${u.id}`}
            >
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="relative shrink-0">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl text-white shadow-lg ${
                    u.role === "admin" ? "bg-gradient-to-br from-rose-500 to-rose-700" :
                    u.role === "assistant_manager" ? "bg-gradient-to-br from-amber-500 to-amber-700" :
                    u.role === "cashier" ? "bg-gradient-to-br from-orange-500 to-orange-700" :
                    u.role === "accountant" ? "bg-gradient-to-br from-emerald-500 to-emerald-700" :
                    "bg-gradient-to-br from-[#2B2B60] to-[#0F0F0F]"
                  }`}>
                    {(u.name || u.phone || "م").charAt(0).toUpperCase()}
                  </div>
                  {u.isActive ? (
                    <div className="absolute -bottom-1 -left-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-white" />
                  ) : (
                    <div className="absolute -bottom-1 -left-1 w-5 h-5 rounded-full bg-red-500 border-2 border-white" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <p className="font-black text-lg text-[#2B2B60]" data-testid={`text-staff-name-${u.id}`}>
                        {u.name || u.phone || "—"}
                      </p>
                      <span className={`inline-block mt-1 text-[10px] font-black px-2.5 py-0.5 rounded-full border ${roleBadge[u.role] || "bg-gray-100 text-gray-700 border-gray-200"}`}>
                        {roleLabels[u.role] || u.role}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1.5 text-xs">
                    {u.phone && (
                      <div className="flex items-center gap-1.5 text-gray-800">
                        <Phone className="h-3 w-3 text-[#DFB369]" />
                        <span className="font-bold" dir="ltr">{u.phone}</span>
                      </div>
                    )}
                    {u.email && (
                      <div className="flex items-center gap-1.5 text-gray-800">
                        <Mail className="h-3 w-3 text-[#DFB369]" />
                        <span className="font-bold truncate" dir="ltr">{u.email}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-gray-800">
                      <Building className="h-3 w-3 text-[#DFB369]" />
                      <span className="font-bold">{branches?.find(b => b.id === u.branchId)?.name || "المركز الرئيسي"}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-800">
                      <Shield className="h-3 w-3 text-[#DFB369]" />
                      <span className="font-bold">{u.permissions?.length || 0} صلاحية</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-3 border-t border-gray-100 mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateMutation.mutate({ id: u.id, data: { isActive: !u.isActive } })}
                      disabled={updateMutation.isPending}
                      className="flex-1 font-bold"
                      data-testid={`button-toggle-staff-${u.id}`}
                    >
                      {u.isActive ? <XCircle className="h-3.5 w-3.5 ml-1" /> : <CheckCircle2 className="h-3.5 w-3.5 ml-1" />}
                      {u.isActive ? "تعطيل" : "تفعيل"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => startEdit(u)}
                      className="font-bold border-[#DFB369]/40 text-[#2B2B60] hover:bg-[#DFB369]/10"
                      data-testid={`button-edit-staff-${u.id}`}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteId(u.id)}
                      className="font-bold border-red-200 text-red-600 hover:bg-red-50"
                      data-testid={`button-delete-staff-${u.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editingUser} onOpenChange={(v) => { if (!v) setEditingUser(null); }}>
        <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-right text-2xl font-black text-[#2B2B60]">تعديل بيانات الموظف</DialogTitle>
            <DialogDescription className="text-right text-gray-700">{editingUser?.name || editingUser?.phone}</DialogDescription>
          </DialogHeader>
          {editingUser && renderForm(editForm, true)}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(v) => { if (!v) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-right">تأكيد حذف الموظف</AlertDialogTitle>
            <AlertDialogDescription className="text-right">
              سيتم حذف حساب الموظف نهائياً ولن يستطيع الدخول بعد ذلك.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-bold">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-red-600 hover:bg-red-700 font-black"
              data-testid="button-confirm-delete-staff"
            >
              نعم، احذف الحساب
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
