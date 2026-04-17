import { useQuery, useMutation } from "@tanstack/react-query";
import { Banner, InsertBanner } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Plus, Trash2, Edit2, Image as ImageIcon, Eye, EyeOff } from "lucide-react";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

export default function AdminBanners() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string>("");

  const { data: banners, isLoading } = useQuery<Banner[]>({
    queryKey: ["/api/banners"],
  });

  const form = useForm<InsertBanner>({
    defaultValues: {
      title: "",
      image: "",
      link: "",
      type: "banner",
      isActive: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertBanner) => {
      const endpoint = editingId ? `/api/banners/${editingId}` : "/api/banners";
      const method = editingId ? "PATCH" : "POST";
      const res = await apiRequest(method, endpoint, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/banners"] });
      toast({ title: "تم النجاح", description: editingId ? "تم تحديث الإعلان بنجاح" : "تم إضافة الإعلان بنجاح" });
      setIsOpen(false);
      setEditingId(null);
      setImagePreview("");
      form.reset();
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "خطأ", description: error.message });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/banners/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/banners"] });
      toast({ title: "تم الحذف", description: "تم حذف الإعلان بنجاح" });
    },
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("فشل رفع الصورة");
      
      const { url } = await res.json();
      form.setValue("image", url);
      setImagePreview(url);
      toast({ title: "نجح", description: "تم رفع الصورة بنجاح" });
    } catch (err) {
      toast({ variant: "destructive", title: "خطأ", description: "فشل رفع الصورة" });
    }
  };

  const handleEdit = (banner: Banner) => {
    setEditingId(banner.id);
    form.reset({
      title: banner.title,
      image: banner.image,
      link: banner.link,
      type: banner.type,
      isActive: banner.isActive,
    });
    setImagePreview(banner.image);
    setIsOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8" dir="rtl">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-black uppercase tracking-widest">إدارة الإعلانات والـ Banners</h1>
        <Dialog open={isOpen} onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) {
            setEditingId(null);
            setImagePreview("");
            form.reset();
          }
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              إضافة إعلان جديد
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-right">{editingId ? "تعديل الإعلان" : "إضافة إعلان جديد"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-6">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem className="text-right">
                      <FormLabel>العنوان</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="عنوان الإعلان" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-3">
                  <FormLabel className="text-right block">صورة الإعلان</FormLabel>
                  <div className="border-2 border-dashed border-black/10 rounded-lg p-4">
                    {imagePreview ? (
                      <div className="space-y-3">
                        <img src={imagePreview} alt="معاينة" className="w-full h-40 object-cover rounded-lg" />
                        <Button 
                          type="button" 
                          variant="outline" 
                          className="w-full"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <ImageIcon className="h-4 w-4 mr-2" />
                          غير الصورة
                        </Button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full h-40 flex items-center justify-center flex-col gap-2 text-muted-foreground hover:text-foreground"
                      >
                        <ImageIcon className="h-8 w-8" />
                        <span>اضغط لرفع الصورة</span>
                      </button>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </div>

                <FormField
                  control={form.control}
                  name="link"
                  render={({ field }) => (
                    <FormItem className="text-right">
                      <FormLabel>الرابط (اختياري)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="https://example.com" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem className="text-right">
                      <FormLabel>نوع الإعلان</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="banner">Banner (شريط إعلاني)</SelectItem>
                          <SelectItem value="popup">Popup (نافذة منبثقة)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 space-y-0 space-x-4 space-x-reverse">
                      <div className="space-y-0.5">
                        <FormLabel>تفعيل الإعلان</FormLabel>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" disabled={createMutation.isPending || !form.getValues("image")}>
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (editingId ? "تحديث الإعلان" : "إضافة الإعلان")}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {banners?.map((banner) => (
          <Card key={banner.id} className="overflow-hidden border-black/10">
            <div className="relative w-full h-40 bg-secondary overflow-hidden">
              <img src={banner.image} alt={banner.title} className="w-full h-full object-cover" />
              <div className="absolute top-2 right-2 flex gap-2">
                <Badge variant={banner.isActive ? "default" : "secondary"}>
                  {banner.isActive ? <Eye className="h-3 w-3 mr-1" /> : <EyeOff className="h-3 w-3 mr-1" />}
                  {banner.isActive ? "مفعل" : "معطل"}
                </Badge>
                <Badge variant="outline">{banner.type === "banner" ? "شريط" : "منبثقة"}</Badge>
              </div>
            </div>
            <CardContent className="p-4">
              <div className="space-y-3">
                <h3 className="font-bold text-lg">{banner.title}</h3>
                {banner.link && <p className="text-xs text-muted-foreground truncate">{banner.link}</p>}
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="flex-1 gap-2"
                    onClick={() => handleEdit(banner)}
                    data-testid={`button-edit-banner-${banner.id}`}
                  >
                    <Edit2 className="h-3 w-3" />
                    تعديل
                  </Button>
                  <Button 
                    size="sm" 
                    variant="destructive"
                    className="flex-1 gap-2"
                    onClick={() => deleteMutation.mutate(banner.id)}
                    disabled={deleteMutation.isPending}
                    data-testid={`button-delete-banner-${banner.id}`}
                  >
                    <Trash2 className="h-3 w-3" />
                    حذف
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!isLoading && banners?.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">لا توجد إعلانات حالياً</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
