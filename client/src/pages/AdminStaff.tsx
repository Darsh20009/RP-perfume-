import { useQuery, useMutation } from "@tanstack/react-query";
import { User, InsertUser, Branch, employeePermissions, Role } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, UserPlus, Shield, Building, Trash2, Key } from "lucide-react";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
};

const roleLabels: Record<string, string> = {
  admin: "مدير",
  assistant_manager: "مساعد مدير",
  tech_support: "دعم فني",
  accountant: "محاسب",
  legal_consultant: "مستشار قانوني",
  employee: "موظف",
  cashier: "كاشير",
  support: "دعم",
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

const roleBadgeColors: Record<string, string> = {
  admin: "bg-red-100 text-red-700 border-red-200",
  assistant_manager: "bg-amber-100 text-amber-700 border-amber-200",
  tech_support: "bg-blue-100 text-blue-700 border-blue-200",
  accountant: "bg-green-100 text-green-700 border-green-200",
  legal_consultant: "bg-purple-100 text-purple-700 border-purple-200",
  employee: "bg-gray-100 text-gray-700 border-gray-200",
  cashier: "bg-orange-100 text-orange-700 border-orange-200",
  support: "bg-cyan-100 text-cyan-700 border-cyan-200",
};

export default function AdminStaff() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);

  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  const { data: branches } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const { data: roles } = useQuery<Role[]>({
    queryKey: ["/api/admin/roles"],
  });

  const staff = users?.filter(u => u.role !== 'customer') || [];

  const form = useForm<InsertUser>({
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      password: "",
      role: "employee",
      permissions: [],
      branchId: "",
      loginType: "dashboard",
      isActive: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertUser) => {
      const res = await apiRequest("POST", "/api/admin/users", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "تم النجاح", description: "تم إضافة الموظف بنجاح" });
      setIsOpen(false);
      form.reset();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "تم الحذف", description: "تم حذف حساب الموظف" });
    },
  });

  if (usersLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8" dir="rtl">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-black uppercase tracking-widest">إدارة الموظفين والصلاحيات</h1>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <UserPlus className="h-4 w-4" />
              إضافة موظف جديد
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-right">إضافة موظف جديد</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="text-right">
                        <FormLabel>الاسم الكامل</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem className="text-right">
                        <FormLabel>رقم الهاتف</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="5XXXXXXXX" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem className="text-right">
                        <FormLabel>كلمة المرور</FormLabel>
                        <FormControl>
                          <Input {...field} type="password" placeholder="كلمة مرور الدخول" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem className="text-right">
                        <FormLabel>البريد الإلكتروني (اختياري)</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" placeholder="email@example.com" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem className="text-right">
                        <FormLabel>الدور الوظيفي</FormLabel>
                        <Select onValueChange={(val) => { field.onChange(val); form.setValue("permissions", roleDefaultPermissions[val] || []); }} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="اختر الدور" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="admin">مدير (Admin)</SelectItem>
                            <SelectItem value="assistant_manager">مساعد مدير (Assistant Manager)</SelectItem>
                            <SelectItem value="tech_support">دعم فني (Tech Support)</SelectItem>
                            <SelectItem value="accountant">محاسب (Accountant)</SelectItem>
                            <SelectItem value="legal_consultant">مستشار قانوني (Legal Consultant)</SelectItem>
                            <SelectItem value="employee">موظف (Employee)</SelectItem>
                            <SelectItem value="cashier">كاشير (Cashier)</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="loginType"
                    render={({ field }) => (
                      <FormItem className="text-right">
                        <FormLabel>نوع الدخول</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="اختر نوع الدخول" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="dashboard">لوحة التحكم</SelectItem>
                            <SelectItem value="pos">POS فقط</SelectItem>
                            <SelectItem value="both">الاثنين</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <FormField
                    control={form.control}
                    name="branchId"
                    render={({ field }) => (
                      <FormItem className="text-right">
                        <FormLabel>الفرع المرتبط</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="اختر الفرع" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="main">المركز الرئيسي</SelectItem>
                            {branches?.map(b => (
                              <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>
                <div className="space-y-3">
                  <FormLabel className="text-right block">الصلاحيات الدقيقة</FormLabel>
                  <div className="grid grid-cols-2 gap-3 border p-4 rounded-md bg-black/5">
                    {employeePermissions.map((permission) => (
                      <FormField
                        key={permission}
                        control={form.control}
                        name="permissions"
                        render={({ field }) => {
                          return (
                            <FormItem key={permission} className="flex flex-row items-start space-x-3 space-y-0 space-x-reverse">
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(permission)}
                                  onCheckedChange={(checked) => {
                                    return checked
                                      ? field.onChange([...(field.value || []), permission])
                                      : field.onChange(field.value?.filter((value) => value !== permission));
                                  }}
                                />
                              </FormControl>
                              <FormLabel className="font-normal text-xs">{permissionLabels[permission] || permission}</FormLabel>
                            </FormItem>
                          );
                        }}
                      />
                    ))}
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "إضافة الموظف"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {staff.map((user) => (
          <Card key={user.id} className="rounded-none border-black/10">
            <CardContent className="p-6 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-black text-white flex items-center justify-center rounded-full font-black">
                  {(user.name || user.phone || "م").charAt(0)}
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg">{user.name || user.phone || "—"}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">{user.phone}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${roleBadgeColors[user.role] || "bg-gray-100 text-gray-600 border-gray-200"}`}>
                      {roleLabels[user.role] || user.role}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-8">
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase text-black/40">الفرع</p>
                  <p className="text-sm font-bold flex items-center gap-2">
                    <Building className="h-3 w-3" />
                    {branches?.find(b => b.id === user.branchId)?.name || "المركز الرئيسي"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase text-black/40">الصلاحيات</p>
                  <p className="text-sm font-bold flex items-center gap-2">
                    <Shield className="h-3 w-3" />
                    {user.permissions?.length || 0} صلاحية
                  </p>
                </div>
                <div className="flex gap-2 border-r pr-6">
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteMutation.mutate(user.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
