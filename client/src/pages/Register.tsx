import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useLocation, Link } from "wouter";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { z } from "zod";
import { useState, useRef } from "react";

const logoDarkImg = "/images/logos/logo-light-nobg.png";

export default function Register() {
  const { register, isRegistering, user } = useAuth();
  const [, setLocation] = useLocation();
  const [showPassword, setShowPassword] = useState(false);

  if (user) {
    const destination = "/";
    if (window.location.pathname !== destination) {
      setLocation(destination);
    }
    return null;
  }

  const form = useForm<z.infer<typeof insertUserSchema>>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      password: "",
      name: "",
      phone: "",
      email: "",
      role: "customer"
    },
  });

  const [isPrePopulated, setIsPrePopulated] = useState(false);
  const [employeeData, setEmployeeData] = useState<any>(null);

  const onSubmit = (data: z.infer<typeof insertUserSchema>) => {
    register({
      ...data,
      username: data.phone,
      role: employeeData?.role || "customer"
    }, {
      onSuccess: () => setLocation("/login"),
    });
  };

  const lastCheckedPhoneRef = useRef<string | null>(null);

  const checkPhone = async (phone: string) => {
    if (phone === lastCheckedPhoneRef.current) return;
    lastCheckedPhoneRef.current = phone;
    
    let cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.startsWith("0")) cleanPhone = cleanPhone.substring(1);
    
    if (cleanPhone.length >= 9) {
      try {
        const response = await fetch(`/api/admin/users/by-phone/${cleanPhone}`);
        if (response.ok) {
          const userData = await response.json();
          if (userData.role !== "customer" && !userData.isActive) {
            setEmployeeData(userData);
            form.setValue("name", userData.name || "");
            setIsPrePopulated(true);
            if (userData.email) {
              form.setValue("email", userData.email);
            }
          } else {
            setEmployeeData(null);
            setIsPrePopulated(false);
          }
        } else {
          setEmployeeData(null);
          setIsPrePopulated(false);
        }
      } catch (error) {
        console.error("Error checking phone:", error);
      }
    } else {
      setEmployeeData(null);
      setIsPrePopulated(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf8f5] p-4 relative overflow-hidden" dir="rtl">
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle, rgba(201,169,110,0.4) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
      <div className="absolute top-0 right-1/3 w-96 h-96 bg-[#c9a96e]/5 rounded-full blur-[120px]" />

      <div className="w-full max-w-md space-y-8 relative z-10">
        <div className="text-center">
          <Link href="/">
            <img src={logoDarkImg} alt="رفيف العود" className="h-20 w-auto mx-auto mb-4 cursor-pointer object-contain" />
          </Link>
          <div className="w-16 h-[1px] bg-gradient-to-r from-transparent via-[#c9a96e] to-transparent mx-auto mb-4" />
          <p className="text-slate-800 text-sm">
            {isPrePopulated ? "تأكيد بيانات الموظف" : "أنشئ حسابك الجديد"}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-8 md:p-10 shadow-xl">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              {isPrePopulated && (
                <div className="bg-[#c9a96e]/10 p-4 border border-[#c9a96e]/20 mb-4 text-center">
                  <p className="text-[#c9a96e] font-bold text-sm">تم العثور على حساب موظف مرتبط بهذا الرقم</p>
                  <p className="text-white/40 text-[10px] mt-1">يرجى تأكيد الاسم وتعيين كلمة المرور لتفعيل الحساب</p>
                </div>
              )}

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="text-right">
                    <FormLabel className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1a2744]">الاسم الكامل</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="فلان الفلاني" 
                        {...field} 
                        readOnly={isPrePopulated}
                        className={`h-12 bg-[#faf8f5] border-slate-200 rounded-xl focus-visible:ring-[#c9a96e]/40 text-[#1a2744] ${isPrePopulated ? 'opacity-60' : ''}`} 
                      />
                    </FormControl>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem className="text-right">
                    <FormLabel className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1a2744]">رقم الجوال</FormLabel>
                    <FormControl>
                      <div dir="ltr" className="flex items-center gap-2 h-12 bg-[#faf8f5] border border-slate-200 rounded-xl px-4 focus-within:border-[#c9a96e] transition-colors">
                        <span className="text-sm font-bold text-slate-700 border-r border-slate-200 pr-2">+966</span>
                        <input
                          type="text"
                          className="flex-1 h-full bg-transparent border-none focus:outline-none text-sm font-bold tracking-widest text-[#1a2744] placeholder:text-slate-700"
                          placeholder="5x xxx xxxx"
                          maxLength={11}
                          value={field.value.replace(/(\d{2})(\d{3})(\d{4})/, "$1 $2 $3").trim()}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, "");
                            let cleanVal = val;
                            if (cleanVal.startsWith("0")) cleanVal = cleanVal.substring(1);
                            if (cleanVal.length > 0 && !cleanVal.startsWith("5")) cleanVal = "5" + cleanVal.substring(1);
                            if (cleanVal.length <= 9) {
                              field.onChange(cleanVal);
                              if (cleanVal.length >= 9) checkPhone(cleanVal);
                              else setIsPrePopulated(false);
                            }
                          }}
                        />
                      </div>
                    </FormControl>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="text-right">
                    <FormLabel className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1a2744]">البريد الإلكتروني</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="example@email.com" {...field} value={field.value || ""} className="h-12 bg-[#faf8f5] border-slate-200 rounded-xl focus-visible:ring-[#c9a96e]/40 text-[#1a2744]" />
                    </FormControl>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem className="text-right">
                    <FormLabel className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1a2744]">كلمة المرور الجديدة</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input type={showPassword ? "text" : "password"} placeholder="••••••••" {...field} className="h-12 bg-[#faf8f5] border-slate-200 rounded-xl focus-visible:ring-[#c9a96e]/40 text-[#1a2744] pr-12" />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 text-slate-700 hover:text-[#1a2744] no-default-hover-elevate"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full h-14 font-bold uppercase tracking-[0.3em] text-xs rounded-xl bg-[#c9a96e] text-white hover:bg-[#b8944f] border-none transition-all duration-300 shadow-lg shadow-[#c9a96e]/20 mt-2" disabled={isRegistering}>
                {isRegistering ? <Loader2 className="animate-spin" /> : (isPrePopulated ? "تفعيل الحساب" : "إنشاء الحساب")}
              </Button>
            </form>
          </Form>

          <div className="mt-8 text-center text-[10px] font-bold uppercase tracking-widest text-slate-700">
            لديك حساب بالفعل؟{" "}
            <Link href="/login" className="text-[#c9a96e] hover:text-[#b8944f] mr-1 transition-colors">
              سجل دخولك
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
