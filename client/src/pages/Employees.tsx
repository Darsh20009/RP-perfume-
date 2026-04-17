import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, UserPlus, Shield, ArrowRight, Edit2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";

export default function Employees() {
  const { toast } = useToast();
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [employeeExists, setEmployeeExists] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    password: "",
    role: "employee",
    permissions: ["orders"]
  });
  const [checkingPhone, setCheckingPhone] = useState(false);

  const { data: users, isLoading } = useQuery({
    queryKey: ["/api/admin/users"],
  });

  const employees = Array.isArray(users) ? users.filter((u: any) => u.role !== "customer") : [];

  const checkPhoneMutation = useMutation({
    mutationFn: async (phone: string) => {
      const res = await apiRequest("POST", "/api/admin/check-phone", { phone });
      return res.json();
    },
    onSuccess: (data) => {
      setEmployeeExists(data.exists);
      if (data.exists) {
        toast({ title: "موظف موجود", description: "رقم الموظف مسجل بالفعل في النظام" });
      } else {
        setStep(2);
      }
    },
    onError: () => {
      toast({ title: "خطأ", description: "حدث خطأ في التحقق من رقم الموظف" });
    }
  });

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/auth/register", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "تم النجاح", description: "تم إضافة الموظف بنجاح" });
      setIsAdding(false);
    },
  });

  useEffect(() => {
    if (!isAdding) {
      setStep(1);
      setFormData({ name: "", phone: "", email: "", password: "", role: "employee", permissions: ["orders"] });
      setEmployeeExists(false);
    }
  }, [isAdding]);

  const [depositData, setDepositData] = useState({ userId: "", amount: "", description: "" });
  const [isDepositing, setIsDepositing] = useState(false);

  const depositMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/admin/wallet/deposit", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "تم إضافة الرصيد بنجاح" });
      setIsDepositing(false);
    },
  });

  useEffect(() => {
    if (!isDepositing) {
      setDepositData({ userId: "", amount: "", description: "" });
    }
  }, [isDepositing]);

  useEffect(() => {
    if (!isEditing) {
      setEditingEmployee(null);
      setFormData({ name: "", phone: "", email: "", password: "", role: "employee", permissions: ["orders"] });
    }
  }, [isEditing]);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${editingEmployee.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "تم التحديث بنجاح" });
      setIsEditing(false);
    },
    onError: () => {
      toast({ title: "خطأ", description: "حدث خطأ في تحديث الموظف" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/users/${id}`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "تم الحذف بنجاح" });
    },
    onError: () => {
      toast({ title: "خطأ", description: "حدث خطأ في حذف الموظف" });
    }
  });

  return (
    <div className="p-8 space-y-8" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black">إدارة الموظفين</h1>
          <p className="text-muted-foreground text-sm">إضافة وتعديل صلاحيات فريق العمل</p>
        </div>
        
        <Dialog open={isAdding} onOpenChange={(open) => {
          setIsAdding(open);
          if (!open) {
            setStep(1);
            setFormData({ name: "", phone: "", email: "", password: "", role: "employee", permissions: ["orders"] });
            setEmployeeExists(false);
          }
        }}>
          <DialogTrigger asChild>
            <Button className="rounded-xl gap-2">
              <UserPlus className="w-4 h-4" />
              إضافة موظف
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="text-right">
                {step === 1 ? "تحقق من رقم الموظف" : step === 2 ? "أدخل بيانات الموظف" : "أنشئ بيانات الدخول"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4" dir="rtl">
              {step === 1 && (
                <>
                  <p className="text-sm text-muted-foreground text-right">أدخل رقم هاتف الموظف ثم اضغط على "تحقق" للتحقق من وجوده في النظام</p>
                  <div className="space-y-2 text-right">
                    <Label>رقم الموظف (رقم الهاتف)</Label>
                    <Input 
                      value={formData.phone} 
                      onChange={e => setFormData({...formData, phone: e.target.value.replace(/\s/g, '')})} 
                      placeholder="05xxxxxxxx" 
                      disabled={checkPhoneMutation.isPending}
                      type="tel"
                    />
                    <p className="text-xs text-muted-foreground">مثال: 0551329821 أو 0512345678</p>
                  </div>
                  <Button 
                    className="w-full mt-4 gap-2" 
                    onClick={() => {
                      const cleanPhone = formData.phone.replace(/\s/g, '');
                      if (!cleanPhone) {
                        toast({ title: "خطأ", description: "الرجاء إدخال رقم الموظف" });
                        return;
                      }
                      checkPhoneMutation.mutate(cleanPhone);
                    }}
                    disabled={checkPhoneMutation.isPending || !formData.phone}
                  >
                    {checkPhoneMutation.isPending ? <Loader2 className="animate-spin" /> : <>
                      تحقق <ArrowRight className="w-4 h-4" />
                    </>}
                  </Button>
                </>
              )}

              {step === 2 && !employeeExists && (
                <>
                  <p className="text-sm text-muted-foreground text-right">موظف جديد - أدخل البيانات الأساسية</p>
                  <div className="space-y-2 text-right">
                    <Label>الاسم الكامل</Label>
                    <Input 
                      value={formData.name} 
                      onChange={e => setFormData({...formData, name: e.target.value})} 
                      placeholder="مثال: أحمد محمد" 
                    />
                  </div>
                  <div className="space-y-2 text-right">
                    <Label>رقم الموظف</Label>
                    <div dir="ltr" className="flex items-center gap-2 h-10 bg-white border border-black/10 px-3 rounded-md">
                      <span className="text-sm font-bold text-black/40 border-r border-black/10 pr-2">+966</span>
                      <input
                        type="text"
                        className="flex-1 h-full bg-transparent border-none focus:outline-none text-sm font-bold tracking-widest"
                        placeholder="5x xxx xxxx"
                        maxLength={9}
                        value={formData.phone.replace(/(\d{2})(\d{3})(\d{4})/, "$1 $2 $3").trim()}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, "");
                          if (val.length <= 9 && (val.length === 0 || val.startsWith("5"))) {
                            setFormData({...formData, phone: val});
                          }
                        }}
                      />
                    </div>
                  </div>
                  <Button 
                    className="w-full mt-4 gap-2" 
                    onClick={() => {
                      if (formData.name.trim()) {
                        setStep(3);
                      } else {
                        toast({ title: "خطأ", description: "الرجاء إدخال الاسم الكامل" });
                      }
                    }}
                  >
                    التالي <ArrowRight className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="outline"
                    className="w-full mt-2"
                    onClick={() => {
                      setStep(1);
                      setFormData({ name: "", phone: "", email: "", password: "", role: "employee", permissions: ["orders"] });
                    }}
                  >
                    رجوع
                  </Button>
                </>
              )}

              {step === 3 && (
                <>
                  <p className="text-sm text-muted-foreground text-right">أنشئ بيانات الدخول للموظف</p>
                  <div className="space-y-2 text-right">
                    <Label>البريد الإلكتروني</Label>
                    <Input 
                      type="email"
                      value={formData.email} 
                      onChange={e => setFormData({...formData, email: e.target.value})} 
                      placeholder="example@email.com" 
                    />
                  </div>
                  <div className="space-y-2 text-right">
                    <Label>كلمة المرور</Label>
                    <Input 
                      type="password" 
                      value={formData.password} 
                      onChange={e => setFormData({...formData, password: e.target.value})} 
                      placeholder="••••••••"
                    />
                  </div>
                  <Button 
                    className="w-full mt-4 gap-2" 
                    onClick={() => mutation.mutate(formData)} 
                    disabled={mutation.isPending || !formData.email || !formData.password}
                  >
                    {mutation.isPending ? <Loader2 className="animate-spin" /> : "حفظ الموظف"}
                  </Button>
                  <Button 
                    variant="outline"
                    className="w-full mt-2"
                    onClick={() => setStep(2)}
                  >
                    رجوع
                  </Button>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <Loader2 className="animate-spin mx-auto text-primary" />
        ) : employees.map((emp: any) => (
          <Card key={emp.id} className="border-none shadow-sm hover-elevate overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                  {emp.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold">{emp.name}</h3>
                  <p className="text-xs text-muted-foreground">{emp.phone}</p>
                </div>
                <Badge className="mr-auto">{emp.role}</Badge>
              </div>
              
              <div className="space-y-3">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">الصلاحيات الممنوحة</p>
                <div className="flex flex-wrap gap-2">
                  {(emp.permissions || ["orders"]).map((p: string) => (
                    <Badge key={p} variant="secondary" className="text-[9px] rounded-lg">
                      <Shield className="w-3 h-3 ml-1" />
                      {p === "orders" ? "الطلبات" : p}
                    </Badge>
                  ))}
                </div>
              </div>
              
              <div className="mt-6 pt-4 border-t flex gap-2 items-center flex-wrap">
                <Dialog open={isDepositing && depositData.userId === emp.id} onOpenChange={(open) => {
                  if (!open) {
                    setIsDepositing(false);
                    setDepositData({ userId: "", amount: "", description: "" });
                  } else {
                    setIsDepositing(true);
                    setDepositData({ userId: emp.id, amount: "", description: "" });
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 rounded-lg text-[10px] gap-1">
                      <Plus className="w-3 h-3" />
                      شحن المحفظة
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle className="text-right">شحن محفظة {emp.name}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4 text-right" dir="rtl">
                      <div className="space-y-2">
                        <Label>المبلغ (ر.س)</Label>
                        <Input type="number" value={depositData.amount} onChange={e => setDepositData({...depositData, amount: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <Label>الملاحظات</Label>
                        <Input value={depositData.description} onChange={e => setDepositData({...depositData, description: e.target.value})} placeholder="مثال: مكافأة شهرية" />
                      </div>
                      <Button className="w-full" onClick={() => depositMutation.mutate(depositData)} disabled={depositMutation.isPending}>
                        تأكيد الشحن
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog open={isEditing && editingEmployee?.id === emp.id} onOpenChange={(open) => {
                  if (open) {
                    setEditingEmployee(emp);
                    setFormData({ name: emp.name, phone: emp.phone.replace(/\D/g, '').slice(-9), email: emp.email, password: "", role: emp.role, permissions: emp.permissions || ["orders"] });
                    setIsEditing(true);
                  } else {
                    setIsEditing(false);
                    setEditingEmployee(null);
                    setFormData({ name: "", phone: "", email: "", password: "", role: "employee", permissions: ["orders"] });
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 rounded-lg text-[10px] gap-1">
                      <Edit2 className="w-3 h-3" />
                      تعديل
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle className="text-right">تعديل بيانات {emp.name}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4 text-right" dir="rtl">
                      <div className="space-y-2">
                        <Label>الاسم الكامل</Label>
                        <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <Label>البريد الإلكتروني</Label>
                        <Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                      </div>
                      <Button className="w-full" onClick={() => updateMutation.mutate({name: formData.name, email: formData.email})} disabled={updateMutation.isPending}>
                        {updateMutation.isPending ? <Loader2 className="animate-spin" /> : "حفظ التعديلات"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/5 rounded-lg h-8 px-3" onClick={() => {
                  if (confirm(`هل تأكد من حذف ${emp.name}؟`)) {
                    deleteMutation.mutate(emp.id);
                  }
                }} disabled={deleteMutation.isPending}>
                  <Trash2 className="w-4 h-4 ml-1" />
                  حذف
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
