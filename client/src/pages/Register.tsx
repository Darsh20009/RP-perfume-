import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import { useAuth } from "@/hooks/use-auth";
import { useAuthProviders } from "@/hooks/use-auth-providers";
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
  const { googleEnabled, appleEnabled, anyEnabled } = useAuthProviders();
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
    <div className="min-h-screen flex items-center justify-center bg-[#FFFFFF] p-4 relative overflow-hidden" dir="rtl">
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle, rgba(201,169,110,0.4) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
      <div className="absolute top-0 right-1/3 w-96 h-96 bg-[#DFB369]/5 rounded-full blur-[120px]" />

      <div className="w-full max-w-md space-y-8 relative z-10">
        <div className="text-center">
          <Link href="/">
            <img src={logoDarkImg} alt="عطور آر اف" className="h-20 w-auto mx-auto mb-4 cursor-pointer object-contain" />
          </Link>
          <div className="w-16 h-[1px] bg-gradient-to-r from-transparent via-[#DFB369] to-transparent mx-auto mb-4" />
          <p className="text-slate-800 text-sm">
            {isPrePopulated ? "تأكيد بيانات الموظف" : "أنشئ حسابك الجديد"}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-8 md:p-10 shadow-xl">
          {anyEnabled && (
            <div className="space-y-3 mb-6">
              {googleEnabled && (
                <a
                  href="/api/auth/google/start"
                  className="w-full h-12 bg-white border-2 border-gray-200 rounded-xl font-bold text-sm text-[#2B2B60] flex items-center justify-center gap-3 hover:bg-gray-50 transition-colors"
                  data-testid="button-register-google"
                >
                  <svg viewBox="0 0 48 48" className="h-5 w-5">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                  </svg>
                  المتابعة مع Google
                </a>
              )}
              {appleEnabled && (
                <a
                  href="/api/auth/apple/start"
                  className="w-full h-12 bg-black text-white rounded-xl font-bold text-sm flex items-center justify-center gap-3 hover:bg-black/90 transition-colors"
                  data-testid="button-register-apple"
                >
                  <svg viewBox="0 0 20 24" className="h-5 w-auto fill-white">
                    <path d="M13.23 3.02C14.28 1.71 14.94 0 14.94 0s-1.71.28-2.76 1.59c-.96 1.21-1.57 2.86-1.47 3.64.97.07 2.53-.3 3.52-2.21zM16.44 8.74c-1.77-.07-3.28 1-4.13 1-.85 0-2.14-.94-3.55-.91-1.82.03-3.5 1.06-4.43 2.71-1.9 3.28-.49 8.15 1.35 10.82.9 1.31 1.97 2.77 3.38 2.72 1.35-.05 1.86-.87 3.49-.87 1.62 0 2.09.87 3.51.84 1.46-.03 2.39-1.32 3.29-2.63.97-1.47 1.37-2.9 1.4-2.97-.03-.01-2.71-1.04-2.74-4.13-.03-2.59 2.11-3.83 2.21-3.9-1.2-1.78-3.08-1.68-3.78-1.68z"/>
                  </svg>
                  المتابعة مع Apple
                </a>
              )}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-[10px] font-bold text-gray-700 uppercase tracking-widest">أو بالهاتف</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              {isPrePopulated && (
                <div className="bg-[#DFB369]/10 p-4 border border-[#DFB369]/20 mb-4 text-center">
                  <p className="text-[#DFB369] font-bold text-sm">تم العثور على حساب موظف مرتبط بهذا الرقم</p>
                  <p className="text-white/40 text-[10px] mt-1">يرجى تأكيد الاسم وتعيين كلمة المرور لتفعيل الحساب</p>
                </div>
              )}

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="text-right">
                    <FormLabel className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#2B2B60]">الاسم الكامل</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="فلان الفلاني" 
                        {...field} 
                        readOnly={isPrePopulated}
                        className={`h-12 bg-[#FFFFFF] border-slate-200 rounded-xl focus-visible:ring-[#DFB369]/40 text-[#2B2B60] ${isPrePopulated ? 'opacity-60' : ''}`} 
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
                    <FormLabel className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#2B2B60]">رقم الجوال</FormLabel>
                    <FormControl>
                      <div dir="ltr" className="flex items-center gap-2 h-12 bg-[#FFFFFF] border border-slate-200 rounded-xl px-4 focus-within:border-[#DFB369] transition-colors">
                        <span className="text-sm font-bold text-slate-700 border-r border-slate-200 pr-2">+966</span>
                        <input
                          type="text"
                          className="flex-1 h-full bg-transparent border-none focus:outline-none text-sm font-bold tracking-widest text-[#2B2B60] placeholder:text-slate-700"
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
                    <FormLabel className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#2B2B60]">البريد الإلكتروني</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="example@email.com" {...field} value={field.value || ""} className="h-12 bg-[#FFFFFF] border-slate-200 rounded-xl focus-visible:ring-[#DFB369]/40 text-[#2B2B60]" />
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
                    <FormLabel className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#2B2B60]">كلمة المرور الجديدة</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input type={showPassword ? "text" : "password"} placeholder="••••••••" {...field} className="h-12 bg-[#FFFFFF] border-slate-200 rounded-xl focus-visible:ring-[#DFB369]/40 text-[#2B2B60] pr-12" />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 text-slate-700 hover:text-[#2B2B60] no-default-hover-elevate"
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

              <Button type="submit" className="w-full h-14 font-bold uppercase tracking-[0.3em] text-xs rounded-xl bg-[#DFB369] text-white hover:bg-[#c89853] border-none transition-all duration-300 shadow-lg shadow-[#DFB369]/20 mt-2" disabled={isRegistering}>
                {isRegistering ? <Loader2 className="animate-spin" /> : (isPrePopulated ? "تفعيل الحساب" : "إنشاء الحساب")}
              </Button>
            </form>
          </Form>

          <div className="mt-8 text-center text-[10px] font-bold uppercase tracking-widest text-slate-700">
            لديك حساب بالفعل؟{" "}
            <Link href="/login" className="text-[#DFB369] hover:text-[#c89853] mr-1 transition-colors">
              سجل دخولك
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
