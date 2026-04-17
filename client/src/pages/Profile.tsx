import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import { MapPin, User as UserIcon, Plus, Trash2, X, ChevronRight, Navigation, AlertCircle, Loader2, Award, Star, Gift, Zap } from "lucide-react";
import { useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import { useLocation } from "wouter";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

const profileSchema = z.object({
  name: z.string().min(1, "الاسم مطلوب"),
  email: z.string().email("البريد الإلكتروني غير صحيح"),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "كلمة المرور الحالية مطلوبة"),
  newPassword: z.string().min(6, "كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل"),
  confirmPassword: z.string().min(1, "تأكيد كلمة المرور مطلوب"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "كلمات المرور غير متطابقة",
  path: ["confirmPassword"],
});

const tierColors: Record<string, { bg: string; text: string; border: string; gradient: string }> = {
  bronze:   { bg: "bg-amber-950",  text: "text-amber-300",  border: "border-amber-800",  gradient: "from-amber-900 to-amber-950" },
  silver:   { bg: "bg-slate-800",  text: "text-slate-200",  border: "border-slate-600",  gradient: "from-slate-700 to-slate-900" },
  gold:     { bg: "bg-yellow-950", text: "text-yellow-300", border: "border-yellow-700", gradient: "from-yellow-800 to-yellow-950" },
  platinum: { bg: "bg-purple-950", text: "text-purple-300", border: "border-purple-700", gradient: "from-purple-800 to-purple-950" },
};
const tierIcons: Record<string, string> = { bronze: "🥉", silver: "🥈", gold: "🥇", platinum: "💎" };

function LoyaltyCard() {
  const { data: loyalty, isLoading } = useQuery<any>({
    queryKey: ["/api/user/loyalty"],
    queryFn: async () => {
      const res = await fetch("/api/user/loyalty");
      if (!res.ok) return null;
      return res.json();
    },
    retry: false,
  });

  if (isLoading) {
    return <div className="h-32 rounded-2xl bg-slate-100 animate-pulse" />;
  }
  if (!loyalty) return null;

  const tier = loyalty.tier || "bronze";
  const colors = tierColors[tier] || tierColors.bronze;
  const tierName: Record<string, string> = { bronze: "برونزي", silver: "فضي", gold: "ذهبي", platinum: "بلاتيني" };

  return (
    <Card className={`rounded-2xl border-none bg-gradient-to-br ${colors.gradient} text-white overflow-hidden`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{tierIcons[tier]}</span>
              <div>
                <p className="font-black text-lg tracking-tight">نقاط الولاء</p>
                <p className={`text-xs font-bold ${colors.text}`}>{tierName[tier] || tier} • {loyalty.tierInfo?.discount || 0}% خصم دائم</p>
              </div>
            </div>
            <div className="mt-4">
              <span className="text-4xl font-black tabular-nums">{(loyalty.points || 0).toLocaleString()}</span>
              <span className={`text-sm font-bold mr-2 ${colors.text}`}>نقطة</span>
            </div>
            <p className={`text-xs ${colors.text}`}>
              القيمة: {loyalty.pointsValue || "0.00"} ر.س
              {loyalty.nextTier && ` • ${loyalty.nextTierThreshold?.toLocaleString()} ر.س للمستوى التالي`}
            </p>
          </div>
          <div className="text-right space-y-2">
            <Badge className={`${colors.text} bg-white/10 border border-white/20 text-xs font-black`}>
              {tierName[tier] || tier}
            </Badge>
            {loyalty.nextTier && (
              <div className="space-y-1 mt-3">
                <div className="flex justify-between text-[9px] font-bold text-white/60">
                  <span>{(loyalty.progressToNext || 0)}%</span>
                  <span>{loyalty.nextTier}</span>
                </div>
                <div className="w-24 h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white/80 transition-all rounded-full"
                    style={{ width: `${loyalty.progressToNext || 0}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LocationMarker({ position, setPosition }: { position: L.LatLng | null, setPosition: (pos: L.LatLng) => void }) {
  const map = useMap();
  useMapEvents({
    click(e) {
      setPosition(e.latlng);
      map.flyTo(e.latlng, map.getZoom());
    },
  });
  return position === null ? null : <Marker position={position} />;
}

function LocateMeButton({ setPosition }: { setPosition: (pos: L.LatLng) => void }) {
  const map = useMap();
  const handleLocate = () => {
    map.locate().on("locationfound", (e) => {
      setPosition(e.latlng);
      map.flyTo(e.latlng, map.getZoom());
    });
  };
  return (
    <div className="absolute top-20 right-2 z-[1000]">
      <Button
        variant="secondary"
        size="icon"
        className="bg-white hover:bg-gray-100 shadow-md border border-gray-200"
        onClick={handleLocate}
        title="تحديد موقعي الحالي"
      >
        <Navigation className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default function Profile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [showMap, setShowMap] = useState(false);
  const [markerPosition, setMarkerPosition] = useState<L.LatLng | null>(null);
  const [addressName, setAddressName] = useState("");
  const mustChange = new URLSearchParams(window.location.search).get("mustChangePassword") === "true";

  const form = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || "",
      email: user?.email || "",
    },
  });

  const passwordForm = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: z.infer<typeof profileSchema>) => {
      const res = await apiRequest("PATCH", "/api/user", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: "تم التحديث", description: "تم تحديث بيانات الملف الشخصي بنجاح" });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: z.infer<typeof passwordSchema>) => {
      const res = await fetch("/api/user/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم بنجاح", description: "تم تحديث كلمة المرور بنجاح" });
      passwordForm.reset();
      if (mustChange) {
        window.location.href = user?.role === "admin" ? "/admin" : "/";
      }
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "خطأ", description: error.message });
    },
  });

  const addAddressMutation = useMutation({
    mutationFn: async (address: any) => {
      const addresses = [...(user?.addresses || []), { ...address, id: Math.random().toString(36).substr(2, 9) }];
      const res = await apiRequest("PATCH", "/api/user", { addresses });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: "تمت الإضافة", description: "تم إضافة العنوان بنجاح" });
      setShowMap(false);
      setMarkerPosition(null);
      setAddressName("");
    },
  });

  const deleteAddressMutation = useMutation({
    mutationFn: async (addressId: string) => {
      const addresses = user?.addresses.filter((a: any) => a.id !== addressId);
      const res = await apiRequest("PATCH", "/api/user", { addresses });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: "تم الحذف", description: "تم حذف العنوان بنجاح" });
    },
  });

  const handleSaveAddress = async () => {
    if (!markerPosition || !addressName) {
      toast({ title: "خطأ", description: "يرجى تحديد الموقع على الخريطة وإدخال اسم للعنوان", variant: "destructive" });
      return;
    }
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${markerPosition.lat}&lon=${markerPosition.lng}&accept-language=ar`);
      const data = await response.json();
      const city = data.address?.city || data.address?.town || data.address?.state || "غير معروف";
      const street = data.display_name;
      addAddressMutation.mutate({ name: addressName, city, street, lat: markerPosition.lat, lng: markerPosition.lng });
    } catch (error) {
      toast({ title: "خطأ", description: "حدث خطأ أثناء تحديد العنوان، يرجى المحاولة مرة أخرى", variant: "destructive" });
    }
  };

  if (!user) return null;

  return (
    <div className="container mx-auto px-4 py-8" dir="rtl">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" className="rounded-full hover:bg-black/5" onClick={() => setLocation("/")}>
          <ChevronRight className="h-6 w-6" />
        </Button>
        <h1 className="text-3xl font-black uppercase tracking-widest">حسابي</h1>
      </div>

      {mustChange && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>تنبيه</AlertTitle>
          <AlertDescription>يجب عليك تغيير كلمة المرور الافتراضية قبل المتابعة.</AlertDescription>
        </Alert>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-8">
          <Card className="rounded-none border-black/10 shadow-none">
            <CardHeader className="border-b border-black/5">
              <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                <UserIcon className="h-4 w-4" />
                البيانات الشخصية
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit((data) => updateProfileMutation.mutate(data))} className="space-y-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem className="text-right">
                      <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-black/40">الاسم الكامل</FormLabel>
                      <FormControl><Input {...field} className="rounded-none border-black/10 focus-visible:ring-black h-12" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem className="text-right">
                      <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-black/40">البريد الإلكتروني</FormLabel>
                      <FormControl><Input {...field} className="rounded-none border-black/10 focus-visible:ring-black h-12" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="text-right">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-black/40 block mb-2">رقم الهاتف</span>
                    <div dir="ltr" className="h-12 flex items-center px-3 bg-black/5 text-sm font-bold border border-transparent">+966 {user?.phone}</div>
                  </div>
                  <Button type="submit" className="w-full h-12 rounded-none bg-black text-white hover-elevate active-elevate-2 font-bold uppercase tracking-widest text-xs" disabled={updateProfileMutation.isPending}>حفظ التغييرات</Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card className="rounded-none border-black/10 shadow-none">
            <CardHeader className="border-b border-black/5">
              <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">تغيير كلمة المرور</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <Form {...passwordForm}>
                <form onSubmit={passwordForm.handleSubmit((data) => changePasswordMutation.mutate(data))} className="space-y-4">
                  <FormField control={passwordForm.control} name="currentPassword" render={({ field }) => (
                    <FormItem className="text-right">
                      <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-black/40">كلمة المرور الحالية</FormLabel>
                      <FormControl><Input type="password" {...field} className="rounded-none h-12" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={passwordForm.control} name="newPassword" render={({ field }) => (
                    <FormItem className="text-right">
                      <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-black/40">كلمة المرور الجديدة</FormLabel>
                      <FormControl><Input type="password" {...field} className="rounded-none h-12" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={passwordForm.control} name="confirmPassword" render={({ field }) => (
                    <FormItem className="text-right">
                      <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-black/40">تأكيد كلمة المرور</FormLabel>
                      <FormControl><Input type="password" {...field} className="rounded-none h-12" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="submit" className="w-full h-12 rounded-none bg-black text-white" disabled={changePasswordMutation.isPending}>
                    {changePasswordMutation.isPending ? <Loader2 className="animate-spin" /> : "تحديث كلمة المرور"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        {/* ── Loyalty Points Card ── */}
        <LoyaltyCard />

        <Card className="rounded-none border-black/10 shadow-none">
          <CardHeader className="border-b border-black/5">
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              عناوين الشحن
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            {user?.addresses.map((address: any) => (
              <div key={address.id} className="p-4 border border-black/10 flex justify-between items-start group">
                <div className="text-right">
                  <p className="font-bold text-sm">{address.name}</p>
                  <p className="text-xs text-black/60 mt-1">{address.city}</p>
                  <p className="text-[10px] text-black/40 mt-1 line-clamp-1">{address.street}</p>
                </div>
                <Button variant="ghost" size="icon" className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity no-default-hover-elevate" onClick={() => deleteAddressMutation.mutate(address.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            {!showMap ? (
              <Button variant="outline" className="w-full h-12 rounded-none border-dashed border-black/20 hover:border-black transition-colors gap-2 text-[10px] font-bold uppercase tracking-widest" onClick={() => setShowMap(true)}><Plus className="h-4 w-4" />إضافة عنوان جديد عبر الخريطة</Button>
            ) : (
              <div className="space-y-4 border border-black/10 p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest">حدد موقعك على الخريطة</span>
                  <Button variant="ghost" size="icon" onClick={() => setShowMap(false)}><X className="h-4 w-4" /></Button>
                </div>
                <div className="h-[300px] w-full relative z-[1]">
                  <MapContainer center={[24.7136, 46.6753]} zoom={6} style={{ height: "100%", width: "100%" }}>
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <LocationMarker position={markerPosition} setPosition={setMarkerPosition} />
                    <LocateMeButton setPosition={setMarkerPosition} />
                  </MapContainer>
                </div>
                <div className="space-y-4">
                  <div className="text-right">
                    <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-black/40">اسم العنوان (مثلاً: المنزل)</FormLabel>
                    <Input value={addressName} onChange={(e) => setAddressName(e.target.value)} placeholder="ادخل اسم للعنوان" className="rounded-none border-black/10 focus-visible:ring-black h-12 mt-1" />
                  </div>
                  <Button className="w-full h-12 rounded-none bg-black text-white hover-elevate active-elevate-2 font-bold uppercase tracking-widest text-xs" onClick={handleSaveAddress} disabled={addAddressMutation.isPending}>حفظ العنوان المختار</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}