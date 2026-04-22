import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Store, CheckCircle, Loader2, ArrowRight } from "lucide-react";
import { Layout } from "@/components/Layout";

const applySchema = z.object({
  storeName: z.string().min(2, "اسم المتجر بالعربي مطلوب (حرفين على الأقل)"),
  storeNameEn: z.string().default(""),
  description: z.string().default(""),
  phone: z.string().default(""),
  email: z.string().email("بريد إلكتروني غير صحيح").optional().or(z.literal("")),
});

type ApplyForm = z.infer<typeof applySchema>;

export default function VendorApply() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const { data: existingVendor, isLoading: checkingVendor } = useQuery<any>({
    queryKey: ["/api/vendor/me"],
    retry: false,
  });

  const form = useForm<ApplyForm>({
    resolver: zodResolver(applySchema),
    defaultValues: { storeName: "", storeNameEn: "", description: "", phone: "", email: "" },
  });

  const applyMutation = useMutation({
    mutationFn: (data: ApplyForm) => apiRequest("POST", "/api/vendor/apply", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/me"] });
      toast({ title: "تم إرسال طلبك بنجاح!", description: "سيتم مراجعة طلبك من قبل الإدارة." });
    },
    onError: (err: any) => {
      toast({ title: "حدث خطأ", description: err.message, variant: "destructive" });
    },
  });

  if (!user) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">يجب تسجيل الدخول أولاً</p>
            <Button onClick={() => navigate("/auth")}>تسجيل الدخول</Button>
          </div>
        </div>
      </Layout>
    );
  }

  if (checkingVendor) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </Layout>
    );
  }

  if (existingVendor) {
    const status = existingVendor.status;
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center p-6">
          <Card className="max-w-md w-full text-center rounded-none border-2">
            <CardContent className="pt-10 pb-10">
              {status === "pending" && (
                <>
                  <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Store className="h-8 w-8 text-yellow-600" />
                  </div>
                  <h2 className="text-xl font-black mb-2">طلبك قيد المراجعة</h2>
                  <p className="text-muted-foreground text-sm">سيتم إخطارك بمجرد قبول طلبك من الإدارة</p>
                </>
              )}
              {status === "active" && (
                <>
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  </div>
                  <h2 className="text-xl font-black mb-2">متجرك مفعّل!</h2>
                  <p className="text-muted-foreground text-sm mb-6">يمكنك الآن إدارة منتجاتك وطلباتك</p>
                  <Button onClick={() => navigate("/vendor/dashboard")} className="rounded-none gap-2">
                    لوحة التحكم <ArrowRight className="h-4 w-4" />
                  </Button>
                </>
              )}
              {status === "suspended" && (
                <>
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Store className="h-8 w-8 text-red-600" />
                  </div>
                  <h2 className="text-xl font-black mb-2">تم تعليق حسابك</h2>
                  <p className="text-muted-foreground text-sm">يرجى التواصل مع الإدارة لمزيد من المعلومات</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-muted/20 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="w-20 h-20 bg-foreground rounded-full flex items-center justify-center mx-auto mb-4">
              <Store className="h-10 w-10 text-background" />
            </div>
            <h1 className="text-3xl font-black mb-2">افتح متجرك على عطور آر اف</h1>
            <p className="text-muted-foreground">انضم إلى المنصة وبيع منتجاتك لآلاف العملاء في السعودية</p>
          </div>

          {/* Benefits */}
          <div className="grid grid-cols-3 gap-4 mb-10">
            {[
              { label: "بدون رسوم تسجيل", icon: "✅" },
              { label: "لوحة تحكم متكاملة", icon: "📊" },
              { label: "دعم فني مستمر", icon: "💬" },
            ].map((b, i) => (
              <div key={i} className="bg-background border rounded-none p-4 text-center">
                <div className="text-2xl mb-1">{b.icon}</div>
                <p className="text-xs font-bold">{b.label}</p>
              </div>
            ))}
          </div>

          {/* Form */}
          <Card className="rounded-none border-2">
            <CardHeader>
              <CardTitle className="font-black">بيانات متجرك</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit((d) => applyMutation.mutate(d))} className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="storeName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-bold text-xs uppercase tracking-widest">اسم المتجر (عربي) *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="مثال: متجر الأناقة" data-testid="input-store-name-ar" className="rounded-none" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="storeNameEn"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-bold text-xs uppercase tracking-widest">Store Name (English)</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g. Style Store" data-testid="input-store-name-en" className="rounded-none" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-bold text-xs uppercase tracking-widest">وصف المتجر</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder="اكتب نبذة عن متجرك ومنتجاتك..." rows={3} data-testid="input-store-description" className="rounded-none resize-none" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-bold text-xs uppercase tracking-widest">رقم الجوال</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="05xxxxxxxx" data-testid="input-vendor-phone" className="rounded-none" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-bold text-xs uppercase tracking-widest">البريد الإلكتروني</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="store@example.com" data-testid="input-vendor-email" className="rounded-none" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={applyMutation.isPending}
                    data-testid="button-vendor-apply"
                    className="w-full rounded-none h-12 font-black uppercase tracking-widest"
                  >
                    {applyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "إرسال الطلب"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
