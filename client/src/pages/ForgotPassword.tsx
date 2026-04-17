import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, CheckCircle2, ShieldCheck, Lock, Eye, EyeOff } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
const logoImg = "/images/logos/logo-light.png";
const logoDarkImg = "/images/logos/logo-dark.png";

const verifySchema = z.object({
  name: z.string().min(1, "الاسم مطلوب"),
  phone: z.string().min(10, "رقم الجوال يجب أن يكون 10 أرقام على الأقل"),
});

const resetSchema = z.object({
  password: z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل"),
  confirmPassword: z.string().min(6, "تأكيد كلمة المرور مطلوب"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "كلمات المرور غير متطابقة",
  path: ["confirmPassword"],
});

export default function ForgotPassword() {
  const [step, setStep] = useState<"verify" | "reset" | "success">("verify");
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const verifyForm = useForm<z.infer<typeof verifySchema>>({
    resolver: zodResolver(verifySchema),
    defaultValues: { name: "", phone: "" },
  });

  const resetForm = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onVerify = async (data: z.infer<typeof verifySchema>) => {
    setIsLoading(true);
    try {
      const res = await apiRequest("POST", "/api/verify-reset", data);
      const result = await res.json();
      setUserId(result.id);
      setStep("reset");
    } catch (error: any) {
      toast({
        title: "خطأ في التحقق",
        description: "المعلومات المدخلة غير متطابقة مع سجلاتنا.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onReset = async (data: z.infer<typeof resetSchema>) => {
    setIsLoading(true);
    try {
      await apiRequest("POST", "/api/reset-password", { id: userId, password: data.password });
      setStep("success");
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: "تعذر تحديث كلمة المرور. حاول مرة أخرى.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link href="/">
             <img src={logoImg} alt="رفيف العود" className="h-24 w-auto mx-auto mb-6 cursor-pointer object-contain" />
          </Link>
          <h2 className="text-2xl font-black uppercase tracking-tighter">
            {step === "verify" ? "استعادة الحساب" : step === "reset" ? "كلمة مرور جديدة" : "تم التحديث"}
          </h2>
          <p className="text-muted-foreground mt-2 text-xs font-bold uppercase tracking-widest">
            {step === "verify" ? "أدخل بياناتك للتحقق من هويتك" : step === "reset" ? "أدخل كلمة المرور الجديدة لحسابك" : "تم تغيير كلمة المرور بنجاح"}
          </p>
        </div>

        <div className="bg-white border border-black/5 p-10 rounded-none shadow-2xl">
          {step === "verify" && (
            <Form {...verifyForm}>
              <form onSubmit={verifyForm.handleSubmit(onVerify)} className="space-y-6">
                <FormField
                  control={verifyForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="text-right">
                      <FormLabel className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/40">الاسم المسجل</FormLabel>
                      <FormControl>
                        <Input placeholder="فلان الفلاني" {...field} className="h-12 bg-white border-black/10 rounded-none focus-visible:ring-black" />
                      </FormControl>
                      <FormMessage className="text-[10px]" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={verifyForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem className="text-right">
                      <FormLabel className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/40">رقم الجوال المسجل</FormLabel>
                      <FormControl>
                        <Input placeholder="05xxxxxxxx" {...field} className="h-12 bg-white border-black/10 rounded-none focus-visible:ring-black" />
                      </FormControl>
                      <FormMessage className="text-[10px]" />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full h-16 font-bold uppercase tracking-[0.3em] text-xs rounded-none bg-black text-white hover-elevate active-elevate-2 border-none mt-4" disabled={isLoading}>
                  {isLoading ? <Loader2 className="animate-spin" /> : (
                    <span className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4" /> التحقق من البيانات
                    </span>
                  )}
                </Button>
              </form>
            </Form>
          )}

          {step === "reset" && (
            <Form {...resetForm}>
              <form onSubmit={resetForm.handleSubmit(onReset)} className="space-y-6">
                <FormField
                  control={resetForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem className="text-right">
                      <FormLabel className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/40">كلمة المرور الجديدة</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input type={showPassword ? "text" : "password"} placeholder="••••••••" {...field} className="h-12 bg-white border-black/10 rounded-none focus-visible:ring-black pr-12" />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 text-black/40 hover:text-black no-default-hover-elevate"
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
                <FormField
                  control={resetForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem className="text-right">
                      <FormLabel className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/40">تأكيد كلمة المرور</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input type={showPassword ? "text" : "password"} placeholder="••••••••" {...field} className="h-12 bg-white border-black/10 rounded-none focus-visible:ring-black pr-12" />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 text-black/40 hover:text-black no-default-hover-elevate"
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
                <Button type="submit" className="w-full h-16 font-bold uppercase tracking-[0.3em] text-xs rounded-none bg-black text-white hover-elevate active-elevate-2 border-none mt-4" disabled={isLoading}>
                  {isLoading ? <Loader2 className="animate-spin" /> : (
                    <span className="flex items-center gap-2">
                      <Lock className="h-4 w-4" /> تحديث كلمة المرور
                    </span>
                  )}
                </Button>
              </form>
            </Form>
          )}

          {step === "success" && (
            <div className="text-center space-y-6 py-4">
              <CheckCircle2 className="h-16 w-16 text-black mx-auto" />
              <div className="space-y-2">
                <h3 className="font-bold text-xl uppercase tracking-tight">تم التحديث بنجاح</h3>
                <p className="text-xs font-bold uppercase tracking-widest text-black/40 leading-relaxed">
                  يمكنك الآن تسجيل الدخول باستخدام كلمة المرور الجديدة.
                </p>
              </div>
              <Link href="/login">
                <Button className="w-full h-16 font-bold uppercase tracking-[0.3em] text-xs rounded-none bg-black text-white hover-elevate active-elevate-2 border-none">
                  تسجيل الدخول
                </Button>
              </Link>
            </div>
          )}

          <div className="mt-10 text-center text-[10px] font-bold uppercase tracking-widest text-black/40">
            {step === "verify" ? (
              <>
                تذكرت كلمة المرور؟{" "}
                <Link href="/login" className="text-black hover:underline ml-1">سجل دخولك</Link>
              </>
            ) : null}
          </div>
          
          <div className="mt-8 pt-8 border-t border-black/5 text-center">
            <a href="https://api.whatsapp.com/send/?phone=966551329821" target="_blank" rel="noreferrer" className="text-[10px] font-bold uppercase tracking-widest text-black/40 hover:text-black transition-colors">
              دعم فني مباشر عبر الواتساب
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
