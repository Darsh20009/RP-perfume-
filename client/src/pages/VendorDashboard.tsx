import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Store, Package, ShoppingBag, TrendingUp, Plus, Edit2, Trash2, Loader2, Star, Settings, ChevronRight, Eye } from "lucide-react";
import { Layout } from "@/components/Layout";

const productSchema = z.object({
  name: z.string().min(1, "اسم المنتج مطلوب"),
  description: z.string().default(""),
  price: z.string().min(1, "السعر مطلوب"),
  cost: z.string().default("0"),
  images: z.array(z.string()).default([]),
  isFeatured: z.boolean().default(false),
});
type ProductForm = z.infer<typeof productSchema>;

const profileSchema = z.object({
  storeName: z.string().min(1),
  storeNameEn: z.string().default(""),
  description: z.string().default(""),
  phone: z.string().default(""),
  email: z.string().default(""),
});
type ProfileForm = z.infer<typeof profileSchema>;

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  return (
    <Card className="rounded-none border-2">
      <CardContent className="p-5">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${color}`}>
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
            <p className="text-2xl font-black">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function VendorDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<any>(null);

  const { data: vendor, isLoading: loadingVendor } = useQuery<any>({
    queryKey: ["/api/vendor/me"],
    retry: false,
  });

  const { data: products = [], isLoading: loadingProducts } = useQuery<any[]>({
    queryKey: ["/api/vendor/products"],
    enabled: !!vendor,
  });

  const { data: orders = [], isLoading: loadingOrders } = useQuery<any[]>({
    queryKey: ["/api/vendor/orders"],
    enabled: !!vendor,
  });

  const productForm = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: { name: "", description: "", price: "", cost: "0", images: [], isFeatured: false },
  });

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      storeName: vendor?.storeName || "",
      storeNameEn: vendor?.storeNameEn || "",
      description: vendor?.description || "",
      phone: vendor?.phone || "",
      email: vendor?.email || "",
    },
  });

  const addProductMutation = useMutation({
    mutationFn: (data: ProductForm) => apiRequest("POST", "/api/vendor/products", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/products"] });
      setAddProductOpen(false);
      productForm.reset();
      toast({ title: "تم إضافة المنتج بنجاح" });
    },
    onError: (err: any) => toast({ title: "خطأ", description: err.message, variant: "destructive" }),
  });

  const editProductMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ProductForm> }) =>
      apiRequest("PATCH", `/api/vendor/products/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/products"] });
      setEditProduct(null);
      toast({ title: "تم تحديث المنتج" });
    },
    onError: (err: any) => toast({ title: "خطأ", description: err.message, variant: "destructive" }),
  });

  const deleteProductMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/vendor/products/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/products"] });
      toast({ title: "تم حذف المنتج" });
    },
    onError: (err: any) => toast({ title: "خطأ", description: err.message, variant: "destructive" }),
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data: ProfileForm) => apiRequest("PATCH", "/api/vendor/me", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/me"] });
      toast({ title: "تم تحديث الملف الشخصي" });
    },
    onError: (err: any) => toast({ title: "خطأ", description: err.message, variant: "destructive" }),
  });

  if (!user) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <Button onClick={() => navigate("/auth")}>تسجيل الدخول</Button>
        </div>
      </Layout>
    );
  }

  if (loadingVendor) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </Layout>
    );
  }

  if (!vendor) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center text-center p-6">
          <div>
            <Store className="h-16 w-16 mx-auto mb-4 opacity-20" />
            <h2 className="text-xl font-black mb-2">ليس لديك حساب بائع</h2>
            <p className="text-muted-foreground mb-6 text-sm">سجّل الآن كبائع وابدأ في بيع منتجاتك</p>
            <Button onClick={() => navigate("/vendor/apply")} className="rounded-none">التقدم كبائع</Button>
          </div>
        </div>
      </Layout>
    );
  }

  if (vendor.status === "pending") {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center text-center p-6">
          <div>
            <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Store className="h-10 w-10 text-yellow-600" />
            </div>
            <h2 className="text-xl font-black mb-2">طلبك قيد المراجعة</h2>
            <p className="text-muted-foreground text-sm">سيتم إخطارك فور قبول طلبك من الإدارة</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (vendor.status === "suspended") {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center text-center p-6">
          <div>
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Store className="h-10 w-10 text-red-600" />
            </div>
            <h2 className="text-xl font-black mb-2">تم تعليق حسابك</h2>
            <p className="text-muted-foreground text-sm">يرجى التواصل مع الإدارة</p>
          </div>
        </div>
      </Layout>
    );
  }

  const totalRevenue = orders.reduce((sum: number, o: any) => {
    const vendorItems = (o.items || []).filter((item: any) =>
      products.some((p: any) => p.id === item.productId)
    );
    return sum + vendorItems.reduce((s: number, item: any) => s + (item.price * item.quantity), 0);
  }, 0);

  return (
    <Layout>
      <div className="min-h-screen bg-muted/20">
        {/* Header */}
        <div className="bg-foreground text-background py-8 px-6">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              {vendor.logo ? (
                <img src={vendor.logo} alt={vendor.storeName} className="w-16 h-16 rounded-full object-cover border-2 border-background/20" />
              ) : (
                <div className="w-16 h-16 bg-background/10 rounded-full flex items-center justify-center">
                  <Store className="h-8 w-8 text-background/60" />
                </div>
              )}
              <div>
                <h1 className="text-2xl font-black">{vendor.storeName}</h1>
                {vendor.storeNameEn && <p className="text-background/60 text-sm">{vendor.storeNameEn}</p>}
                <div className="flex items-center gap-2 mt-1">
                  <Badge className="bg-green-500 text-white text-[10px] font-black rounded-none px-2">مفعّل</Badge>
                  {vendor.rating > 0 && (
                    <span className="flex items-center gap-1 text-xs text-background/60">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      {vendor.rating.toFixed(1)}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/stores/${vendor.id}`)}
              data-testid="button-view-store"
              className="rounded-none border-background/30 text-background hover:bg-background/10 gap-2"
            >
              <Eye className="h-4 w-4" />
              عرض المتجر
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard icon={Package} label="المنتجات" value={products.length} color="bg-blue-100 text-blue-600" />
            <StatCard icon={ShoppingBag} label="الطلبات" value={orders.length} color="bg-purple-100 text-purple-600" />
            <StatCard
              icon={TrendingUp}
              label="الإيرادات"
              value={`${totalRevenue.toLocaleString()} ر.س`}
              color="bg-green-100 text-green-600"
            />
            <StatCard
              icon={Store}
              label="العمولة"
              value={`${vendor.commissionRate}%`}
              color="bg-orange-100 text-orange-600"
            />
          </div>

          {/* Tabs */}
          <Tabs defaultValue="products">
            <TabsList className="rounded-none mb-6 bg-muted">
              <TabsTrigger value="products" className="rounded-none font-bold gap-2">
                <Package className="h-4 w-4" /> المنتجات
              </TabsTrigger>
              <TabsTrigger value="orders" className="rounded-none font-bold gap-2">
                <ShoppingBag className="h-4 w-4" /> الطلبات
              </TabsTrigger>
              <TabsTrigger value="settings" className="rounded-none font-bold gap-2">
                <Settings className="h-4 w-4" /> الإعدادات
              </TabsTrigger>
            </TabsList>

            {/* Products Tab */}
            <TabsContent value="products">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-black text-lg">منتجاتي ({products.length})</h2>
                <Button
                  onClick={() => setAddProductOpen(true)}
                  data-testid="button-add-product"
                  className="rounded-none gap-2"
                >
                  <Plus className="h-4 w-4" /> إضافة منتج
                </Button>
              </div>

              {loadingProducts ? (
                <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin" /></div>
              ) : products.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p className="font-bold">لا يوجد منتجات بعد</p>
                  <p className="text-sm">أضف منتجك الأول الآن</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {products.map((product: any) => (
                    <Card key={product.id} className="rounded-none border hover:border-foreground transition-all" data-testid={`card-vendor-product-${product.id}`}>
                      <CardContent className="p-4">
                        {product.images?.[0] && (
                          <img src={product.images[0]} alt={product.name} className="w-full h-40 object-cover mb-3" />
                        )}
                        <h3 className="font-bold text-sm mb-1 line-clamp-1">{product.name}</h3>
                        <p className="text-primary font-black text-sm mb-3">{product.price} ر.س</p>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditProduct(product);
                              productForm.reset({
                                name: product.name,
                                description: product.description || "",
                                price: product.price,
                                cost: product.cost || "0",
                                images: product.images || [],
                                isFeatured: product.isFeatured || false,
                              });
                            }}
                            data-testid={`button-edit-product-${product.id}`}
                            className="rounded-none flex-1 gap-1 text-xs"
                          >
                            <Edit2 className="h-3 w-3" /> تعديل
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => deleteProductMutation.mutate(product.id)}
                            disabled={deleteProductMutation.isPending}
                            data-testid={`button-delete-product-${product.id}`}
                            className="rounded-none gap-1 text-xs"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Orders Tab */}
            <TabsContent value="orders">
              <h2 className="font-black text-lg mb-4">طلباتي ({orders.length})</h2>
              {loadingOrders ? (
                <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin" /></div>
              ) : orders.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground">
                  <ShoppingBag className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p className="font-bold">لا يوجد طلبات بعد</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {orders.map((order: any) => (
                    <Card key={order.id} className="rounded-none" data-testid={`card-vendor-order-${order.id}`}>
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <p className="font-black text-sm">طلب #{order.id?.slice(-6)}</p>
                          <p className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleDateString("ar-SA")}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge className="rounded-none text-[10px] font-black">
                            {order.status === "pending" ? "معلق" :
                             order.status === "processing" ? "قيد المعالجة" :
                             order.status === "shipped" ? "تم الشحن" :
                             order.status === "delivered" ? "مكتمل" : order.status}
                          </Badge>
                          <p className="font-black text-sm">{order.total?.toLocaleString()} ر.س</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings">
              <Card className="rounded-none border-2 max-w-xl">
                <CardHeader>
                  <CardTitle className="font-black">إعدادات المتجر</CardTitle>
                </CardHeader>
                <CardContent>
                  <Form {...profileForm}>
                    <form onSubmit={profileForm.handleSubmit((d) => updateProfileMutation.mutate(d))} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={profileForm.control}
                          name="storeName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-bold text-xs uppercase tracking-widest">اسم المتجر (عربي)</FormLabel>
                              <FormControl>
                                <Input {...field} className="rounded-none" defaultValue={vendor.storeName} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={profileForm.control}
                          name="storeNameEn"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-bold text-xs uppercase tracking-widest">Store Name (EN)</FormLabel>
                              <FormControl>
                                <Input {...field} className="rounded-none" defaultValue={vendor.storeNameEn} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={profileForm.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-bold text-xs uppercase tracking-widest">وصف المتجر</FormLabel>
                            <FormControl>
                              <Textarea {...field} rows={3} className="rounded-none resize-none" defaultValue={vendor.description} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={profileForm.control}
                          name="phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-bold text-xs uppercase tracking-widest">الجوال</FormLabel>
                              <FormControl>
                                <Input {...field} className="rounded-none" defaultValue={vendor.phone} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={profileForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-bold text-xs uppercase tracking-widest">البريد الإلكتروني</FormLabel>
                              <FormControl>
                                <Input {...field} className="rounded-none" defaultValue={vendor.email} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                      <Button
                        type="submit"
                        disabled={updateProfileMutation.isPending}
                        data-testid="button-save-vendor-settings"
                        className="rounded-none font-black gap-2"
                      >
                        {updateProfileMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ التغييرات"}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Add Product Dialog */}
      <Dialog open={addProductOpen} onOpenChange={setAddProductOpen}>
        <DialogContent className="rounded-none max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-black">إضافة منتج جديد</DialogTitle>
          </DialogHeader>
          <Form {...productForm}>
            <form onSubmit={productForm.handleSubmit((d) => addProductMutation.mutate(d))} className="space-y-4">
              <FormField
                control={productForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-bold text-xs uppercase tracking-widest">اسم المنتج *</FormLabel>
                    <FormControl><Input {...field} className="rounded-none" placeholder="مثال: قميص قطن" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={productForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-bold text-xs uppercase tracking-widest">الوصف</FormLabel>
                    <FormControl><Textarea {...field} rows={2} className="rounded-none resize-none" /></FormControl>
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={productForm.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold text-xs uppercase tracking-widest">السعر (ر.س) *</FormLabel>
                      <FormControl><Input {...field} type="number" min="0" className="rounded-none" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={productForm.control}
                  name="cost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold text-xs uppercase tracking-widest">التكلفة (ر.س)</FormLabel>
                      <FormControl><Input {...field} type="number" min="0" className="rounded-none" /></FormControl>
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={addProductMutation.isPending} className="rounded-none flex-1 font-black">
                  {addProductMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "إضافة المنتج"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setAddProductOpen(false)} className="rounded-none">إلغاء</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Product Dialog */}
      <Dialog open={!!editProduct} onOpenChange={(open) => !open && setEditProduct(null)}>
        <DialogContent className="rounded-none max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-black">تعديل المنتج</DialogTitle>
          </DialogHeader>
          <Form {...productForm}>
            <form onSubmit={productForm.handleSubmit((d) => editProduct && editProductMutation.mutate({ id: editProduct.id, data: d }))} className="space-y-4">
              <FormField
                control={productForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-bold text-xs uppercase tracking-widest">اسم المنتج</FormLabel>
                    <FormControl><Input {...field} className="rounded-none" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={productForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-bold text-xs uppercase tracking-widest">الوصف</FormLabel>
                    <FormControl><Textarea {...field} rows={2} className="rounded-none resize-none" /></FormControl>
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={productForm.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold text-xs uppercase tracking-widest">السعر (ر.س)</FormLabel>
                      <FormControl><Input {...field} type="number" min="0" className="rounded-none" /></FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={productForm.control}
                  name="cost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold text-xs uppercase tracking-widest">التكلفة (ر.س)</FormLabel>
                      <FormControl><Input {...field} type="number" min="0" className="rounded-none" /></FormControl>
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={editProductMutation.isPending} className="rounded-none flex-1 font-black">
                  {editProductMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ التعديلات"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditProduct(null)} className="rounded-none">إلغاء</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
