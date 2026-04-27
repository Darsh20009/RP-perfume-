import { useQuery, useMutation } from "@tanstack/react-query";
import { Branch, InsertBranch, insertBranchSchema } from "@shared/schema";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Loader2, Plus, MapPin, Phone, Trash2, Edit2, Search, Building2,
  CheckCircle, XCircle, Clock, Mail, Image as ImageIcon, ExternalLink,
  Package, AlertCircle, KeyRound, Copy, User as UserIcon, Eye, EyeOff, Link2,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { useState, useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LocationMap } from "@/components/LocationMap";

// Extended form schema: branch fields + optional manager credentials
const branchFormSchema = insertBranchSchema.extend({
  managerName: z.string().optional().default(""),
  managerPhone: z.string().optional().default(""),
  managerPassword: z.string().optional().default(""),
});
type BranchFormValues = z.infer<typeof branchFormSchema>;

const emptyBranch: BranchFormValues = {
  name: "",
  nameEn: "",
  location: "",
  address: "",
  addressEn: "",
  city: "",
  phone: "",
  email: "",
  hours: "",
  pickupHours: "",
  image: "",
  latitude: null,
  longitude: null,
  mapUrl: "",
  isPickupEnabled: true,
  sortOrder: 0,
  isActive: true,
  managerName: "",
  managerPhone: "",
  managerPassword: "",
};

function StatTile({
  icon: Icon, label, value, accent = "text-[#2B2B60]",
}: { icon: any; label: string; value: number | string; accent?: string }) {
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

export default function AdminBranches() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive" | "pickup">("all");
  const [showPwd, setShowPwd] = useState(false);

  const { data: branches, isLoading } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const createForm = useForm<BranchFormValues>({
    resolver: zodResolver(branchFormSchema),
    defaultValues: emptyBranch,
  });

  const editForm = useForm<BranchFormValues>({
    resolver: zodResolver(branchFormSchema),
    defaultValues: emptyBranch,
  });

  const createMutation = useMutation({
    mutationFn: async (data: BranchFormValues) => {
      const res = await apiRequest("POST", "/api/admin/branches", data);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/branches"] });
      if (data?.managerError) {
        toast({ title: "تم إنشاء الفرع — لكن تعذّر إنشاء حساب المسؤول", description: data.managerError, variant: "destructive" });
      } else if (data?.manager) {
        toast({ title: "تم بنجاح", description: `تم إنشاء الفرع وحساب المسؤول (${data.manager.phone})` });
      } else {
        toast({ title: "تم بنجاح", description: "تم إضافة الفرع الجديد" });
      }
      setIsCreateOpen(false);
      createForm.reset(emptyBranch);
    },
    onError: (err: any) => {
      console.error("[AdminBranches] create failed:", err);
      toast({
        title: "تعذّر إنشاء الفرع",
        description: err?.message || "حدث خطأ غير متوقع — حاول مرة أخرى",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<BranchFormValues> }) => {
      const res = await apiRequest("PATCH", `/api/admin/branches/${id}`, data);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/branches"] });
      if (data?.managerError) {
        toast({ title: "تم تحديث الفرع — لكن تعذّر تحديث المسؤول", description: data.managerError, variant: "destructive" });
      } else if (data?.manager) {
        toast({ title: "تم التحديث", description: `تم تحديث الفرع وكلمة مرور المسؤول (${data.manager.phone})` });
      } else {
        toast({ title: "تم التحديث", description: "تم حفظ تعديلات الفرع" });
      }
      setEditingBranch(null);
    },
    onError: (err: any) => toast({
      title: "تعذّر التحديث",
      description: err?.message || "حدث خطأ",
      variant: "destructive",
    }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/branches/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branches"] });
      toast({ title: "تم الحذف", description: "تم حذف الفرع" });
      setDeleteId(null);
    },
    onError: (err: any) => toast({
      title: "تعذّر الحذف",
      description: err?.message || "حدث خطأ",
      variant: "destructive",
    }),
  });

  const startEdit = (branch: Branch) => {
    editForm.reset({
      name: branch.name || "",
      nameEn: branch.nameEn || "",
      location: branch.location || "",
      address: branch.address || "",
      addressEn: branch.addressEn || "",
      city: branch.city || "",
      phone: branch.phone || "",
      email: branch.email || "",
      hours: branch.hours || "",
      pickupHours: (branch as any).pickupHours || "",
      image: branch.image || "",
      latitude: branch.latitude ?? null,
      longitude: branch.longitude ?? null,
      mapUrl: branch.mapUrl || "",
      isPickupEnabled: branch.isPickupEnabled ?? true,
      sortOrder: branch.sortOrder ?? 0,
      isActive: branch.isActive ?? true,
      managerName: "",
      managerPhone: "",
      managerPassword: "",
    });
    setEditingBranch(branch);
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  // Build a unique login URL per branch so the link clearly identifies which
  // branch the staff is signing into. The /login page reads ?branch= and shows
  // the branch name as a header to make it obvious.
  const buildBranchLoginUrl = (branchId: string) =>
    `${origin}/login?branch=${encodeURIComponent(branchId)}`;

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "تم النسخ", description: label });
    } catch {
      toast({ title: "تعذّر النسخ", variant: "destructive" });
    }
  };

  const filtered = useMemo(() => {
    let list = branches || [];
    if (filter === "active") list = list.filter(b => b.isActive);
    if (filter === "inactive") list = list.filter(b => !b.isActive);
    if (filter === "pickup") list = list.filter(b => b.isPickupEnabled);
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      list = list.filter(b =>
        (b.name || "").toLowerCase().includes(s) ||
        (b.nameEn || "").toLowerCase().includes(s) ||
        (b.city || "").toLowerCase().includes(s) ||
        (b.address || "").toLowerCase().includes(s) ||
        (b.location || "").toLowerCase().includes(s) ||
        (b.phone || "").includes(s),
      );
    }
    return [...list].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [branches, search, filter]);

  const stats = useMemo(() => {
    const list = branches || [];
    return {
      total: list.length,
      active: list.filter(b => b.isActive).length,
      pickup: list.filter(b => b.isPickupEnabled && b.isActive).length,
      cities: new Set(list.map(b => b.city).filter(Boolean)).size,
    };
  }, [branches]);

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
        onSubmit={form.handleSubmit(
          (data) => {
            // Auto-build a Google Maps URL whenever the admin entered
            // coordinates but didn't paste a custom map link. This guarantees
            // the "عرض على الخريطة" button on the branch card actually works.
            const finalData = { ...data };
            if (
              (!finalData.mapUrl || !finalData.mapUrl.trim()) &&
              typeof finalData.latitude === "number" &&
              typeof finalData.longitude === "number"
            ) {
              finalData.mapUrl = `https://maps.google.com/?q=${finalData.latitude},${finalData.longitude}`;
            }
            if (isEdit && editingBranch) {
              updateMutation.mutate({ id: editingBranch.id, data: finalData });
            } else {
              createMutation.mutate(finalData);
            }
          },
          (errors) => {
            console.error("[AdminBranches] form validation errors:", errors);
            const firstField = Object.keys(errors)[0];
            const firstMessage =
              (errors as any)?.[firstField]?.message || "يرجى تعبئة الحقول المطلوبة";
            toast({
              title: "تعذّر حفظ الفرع",
              description: String(firstMessage),
              variant: "destructive",
            });
          },
        )}
        className="space-y-5"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem className="text-right">
                <FormLabel className="font-black">اسم الفرع (عربي) *</FormLabel>
                <FormControl><Input {...field} placeholder="مثلاً: فرع الرياض" data-testid="input-branch-name" /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="nameEn"
            render={({ field }) => (
              <FormItem className="text-right">
                <FormLabel className="font-black">اسم الفرع (English)</FormLabel>
                <FormControl><Input {...field} value={field.value || ""} placeholder="e.g., Riyadh Branch" dir="ltr" /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem className="text-right">
                <FormLabel className="font-black">المدينة</FormLabel>
                <FormControl><Input {...field} value={field.value || ""} placeholder="الرياض" /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem className="text-right">
                <FormLabel className="font-black">رقم الهاتف</FormLabel>
                <FormControl><Input {...field} value={field.value || ""} placeholder="0501234567" dir="ltr" /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem className="text-right">
              <FormLabel className="font-black">العنوان التفصيلي</FormLabel>
              <FormControl><Textarea {...field} value={field.value || ""} placeholder="مثلاً: حي المروج، شارع التحلية، مبنى رقم 12" rows={2} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem className="text-right">
                <FormLabel className="font-black">البريد الإلكتروني</FormLabel>
                <FormControl><Input {...field} value={field.value || ""} type="email" placeholder="branch@rfperfume.sa" dir="ltr" /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="hours"
            render={({ field }) => (
              <FormItem className="text-right">
                <FormLabel className="font-black flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> ساعات العمل</FormLabel>
                <FormControl><Input {...field} value={field.value || ""} placeholder="9:00 ص — 11:00 م" /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Dedicated pickup hours — when staff is available to hand over orders.
            Falls back to general hours on the storefront if left empty. */}
        <FormField
          control={form.control}
          name="pickupHours"
          render={({ field }) => (
            <FormItem className="text-right">
              <FormLabel className="font-black flex items-center gap-1.5 justify-end">
                <Package className="h-3.5 w-3.5" /> مواقيت الاستلام
              </FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value || ""}
                  placeholder="مثلاً: السبت — الخميس 10:00 ص — 10:00 م | الجمعة 4:00 م — 11:00 م"
                  data-testid="input-branch-pickup-hours"
                />
              </FormControl>
              <p className="text-[10px] text-gray-700 font-bold mt-1">
                المواقيت التي يستطيع العميل خلالها استلام طلبه من الفرع (إن تركتها فارغة سنستخدم ساعات العمل العامة)
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="image"
          render={({ field }) => (
            <FormItem className="text-right">
              <FormLabel className="font-black flex items-center gap-2 justify-end">
                <ImageIcon className="h-4 w-4" />
                صورة الفرع (رابط)
              </FormLabel>
              <FormControl><Input {...field} value={field.value || ""} placeholder="https://..." dir="ltr" /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Interactive Apple Map for picking the branch location.
            Selecting on the map updates latitude/longitude/address/mapUrl in
            the form so the branch ends up with real coordinates that all the
            "Open in Maps" buttons can use. */}
        <FormItem className="text-right">
          <FormLabel className="font-black flex items-center gap-2 justify-end">
            <MapPin className="h-4 w-4" />
            تحديد موقع الفرع على الخريطة
          </FormLabel>
          <LocationMap
            initialLat={Number(form.watch("latitude")) || 24.7136}
            initialLng={Number(form.watch("longitude")) || 46.6753}
            onLocationSelect={(coords, addr) => {
              form.setValue("latitude", coords.lat, { shouldDirty: true });
              form.setValue("longitude", coords.lng, { shouldDirty: true });
              if (addr && !form.getValues("address")) {
                form.setValue("address", addr, { shouldDirty: true });
              }
              form.setValue(
                "mapUrl",
                `https://maps.google.com/?q=${coords.lat},${coords.lng}`,
                { shouldDirty: true },
              );
              toast({ title: "تم تحديد الموقع", description: `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` });
            }}
          />
        </FormItem>

        <FormField
          control={form.control}
          name="mapUrl"
          render={({ field }) => (
            <FormItem className="text-right rounded-xl border-2 border-dashed border-[#DFB369]/40 bg-gradient-to-br from-[#FAF8F4] to-white p-4">
              <FormLabel className="font-black flex items-center gap-2 justify-end text-[#2B2B60]">
                <ExternalLink className="h-4 w-4" />
                رابط الخريطة (Google Maps)
              </FormLabel>
              <p className="text-[11px] text-gray-700 font-bold mb-2 text-right">
                هذا الرابط يفتح للعميل عند الضغط على "عرض على الخريطة". يتم تعبئته تلقائياً من الخريطة أعلاه، ويمكنك لصق رابط مخصص هنا (Google Maps أو Apple Maps).
              </p>
              <div className="flex gap-2">
                <FormControl>
                  <Input
                    {...field}
                    value={field.value || ""}
                    placeholder="https://maps.google.com/?q=24.7136,46.6753"
                    dir="ltr"
                    data-testid="input-branch-map-url"
                  />
                </FormControl>
                {field.value && (
                  <a
                    href={field.value}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 inline-flex items-center gap-1 h-10 px-3 rounded-md bg-[#2B2B60] text-white text-xs font-black hover:bg-[#1c1c45] transition-colors"
                    data-testid="link-test-map-url"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    فتح
                  </a>
                )}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="latitude"
            render={({ field }) => (
              <FormItem className="text-right">
                <FormLabel className="font-black">خط العرض (Latitude)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.0000001"
                    value={field.value ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "" || v === "-") return field.onChange(null);
                      const n = Number(v);
                      field.onChange(Number.isFinite(n) ? n : null);
                    }}
                    placeholder="24.7136"
                    dir="ltr"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="longitude"
            render={({ field }) => (
              <FormItem className="text-right">
                <FormLabel className="font-black">خط الطول (Longitude)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.0000001"
                    value={field.value ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "" || v === "-") return field.onChange(null);
                      const n = Number(v);
                      field.onChange(Number.isFinite(n) ? n : null);
                    }}
                    placeholder="46.6753"
                    dir="ltr"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="sortOrder"
          render={({ field }) => (
            <FormItem className="text-right">
              <FormLabel className="font-black">ترتيب العرض</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  value={field.value ?? 0}
                  onChange={(e) => field.onChange(Number(e.target.value) || 0)}
                  placeholder="0"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#FAF8F4] rounded-xl p-4">
          <FormField
            control={form.control}
            name="isActive"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between gap-4">
                <div className="text-right">
                  <FormLabel className="font-black">الفرع نشط</FormLabel>
                  <p className="text-[11px] text-gray-700 font-bold">يُعرض ضمن الفروع المتاحة</p>
                </div>
                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="isPickupEnabled"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between gap-4">
                <div className="text-right">
                  <FormLabel className="font-black">يتيح الاستلام</FormLabel>
                  <p className="text-[11px] text-gray-700 font-bold">Click & Collect مفعّل</p>
                </div>
                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
              </FormItem>
            )}
          />
        </div>

        {/* ── Manager Login (optional) ─────────────────────── */}
        <div className="rounded-xl border-2 border-dashed border-[#DFB369]/40 bg-gradient-to-br from-[#FAF8F4] to-white p-5 space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-[#2B2B60] flex items-center justify-center">
              <KeyRound className="h-4 w-4 text-[#DFB369]" />
            </div>
            <div className="text-right flex-1">
              <h4 className="font-black text-[#2B2B60]">حساب دخول مسؤول الفرع</h4>
              <p className="text-[11px] text-gray-700 font-bold">
                {isEdit
                  ? "أدخل رقم وكلمة مرور لإنشاء/تحديث حساب المسؤول لهذا الفرع. اتركها فارغة لعدم التغيير."
                  : "اختياري: ينشئ حساب موظف يدخل من /login بهذا الرقم وكلمة المرور لإدارة الفرع."}
              </p>
            </div>
          </div>

          <FormField
            control={form.control}
            name="managerName"
            render={({ field }) => (
              <FormItem className="text-right">
                <FormLabel className="font-black flex items-center gap-1.5"><UserIcon className="h-3.5 w-3.5" /> اسم المسؤول</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value || ""} placeholder="مثال: محمد العتيبي" data-testid="input-manager-name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="managerPhone"
              render={({ field }) => (
                <FormItem className="text-right">
                  <FormLabel className="font-black flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> رقم الجوال (يستخدم للدخول)</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} placeholder="5XXXXXXXX" dir="ltr" data-testid="input-manager-phone" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="managerPassword"
              render={({ field }) => (
                <FormItem className="text-right">
                  <FormLabel className="font-black flex items-center gap-1.5"><KeyRound className="h-3.5 w-3.5" /> كلمة المرور (6 أحرف فأكثر)</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        {...field}
                        value={field.value || ""}
                        type={showPwd ? "text" : "password"}
                        placeholder="••••••"
                        dir="ltr"
                        data-testid="input-manager-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPwd(s => !s)}
                        className="absolute left-2 top-1/2 -translate-y-1/2 p-1 rounded text-gray-600 hover:text-[#2B2B60]"
                        data-testid="button-toggle-password"
                        tabIndex={-1}
                      >
                        {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <button
            type="button"
            onClick={() => {
              const pw = Math.random().toString(36).slice(-8) + Math.floor(Math.random() * 100);
              form.setValue("managerPassword", pw);
              setShowPwd(true);
              copyToClipboard(pw, "كلمة المرور المُولّدة");
            }}
            className="text-xs font-black text-[#2B2B60] hover:text-[#850935] underline-offset-4 hover:underline"
            data-testid="button-generate-password"
          >
            توليد كلمة مرور قوية ونسخها
          </button>
        </div>

        <DialogFooter>
          <Button
            type="submit"
            className="bg-[#2B2B60] hover:bg-[#1c1c45] text-white font-black"
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            {(createMutation.isPending || updateMutation.isPending) ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isEdit ? "حفظ التعديلات" : "إضافة الفرع"}
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
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[#2B2B60]">إدارة الفروع</h1>
          <p className="text-sm text-gray-700 font-bold mt-1">أضف وعدّل بيانات فروع المتجر، وفعّل خاصية الاستلام لكل فرع.</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={(v) => { setIsCreateOpen(v); if (!v) createForm.reset(emptyBranch); }}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-[#DFB369] hover:bg-[#c89853] text-[#0F0F0F] font-black h-12 px-6 shadow-lg shadow-[#DFB369]/30" data-testid="button-add-branch">
              <Plus className="h-5 w-5" />
              إضافة فرع جديد
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-right text-2xl font-black text-[#2B2B60]">إضافة فرع جديد</DialogTitle>
              <DialogDescription className="text-right text-gray-700">أدخل بيانات الفرع الكاملة لتظهر للعملاء عند اختيار الاستلام.</DialogDescription>
            </DialogHeader>
            {renderForm(createForm, false)}
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile icon={Building2} label="إجمالي الفروع" value={stats.total} />
        <StatTile icon={CheckCircle} label="فروع نشطة" value={stats.active} accent="text-emerald-600" />
        <StatTile icon={Package} label="تتيح الاستلام" value={stats.pickup} accent="text-[#DFB369]" />
        <StatTile icon={MapPin} label="عدد المدن" value={stats.cities} accent="text-[#850935]" />
      </div>

      {/* Search + Filters */}
      <Card className="p-4 border border-[#DFB369]/20">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-700" />
            <Input
              placeholder="ابحث باسم الفرع أو المدينة أو الهاتف…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-10 h-11 font-bold"
              data-testid="input-search-branches"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {[
              { v: "all", l: "الكل" },
              { v: "active", l: "نشط" },
              { v: "inactive", l: "مغلق" },
              { v: "pickup", l: "استلام" },
            ].map(o => (
              <Button
                key={o.v}
                variant={filter === o.v ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(o.v as any)}
                className={filter === o.v ? "bg-[#2B2B60] hover:bg-[#1c1c45] text-white font-black" : "font-bold"}
                data-testid={`filter-branches-${o.v}`}
              >
                {o.l}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      {/* Branches Grid */}
      {filtered.length === 0 ? (
        <Card className="p-16 text-center border-dashed border-2">
          <AlertCircle className="h-12 w-12 text-gray-700 mx-auto mb-4" />
          <p className="font-black text-lg text-gray-800 mb-2">
            {(branches || []).length === 0 ? "لا توجد فروع بعد" : "لا توجد نتائج للبحث"}
          </p>
          <p className="text-sm text-gray-700 font-bold">
            {(branches || []).length === 0 ? "ابدأ بإضافة فرعك الأول" : "جرّب بحثاً آخر أو امسح الفلاتر"}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((branch) => (
            <Card
              key={branch.id}
              className="overflow-hidden border border-[#DFB369]/20 hover:border-[#DFB369] transition-all hover:shadow-xl hover:shadow-[#DFB369]/10 group"
              data-testid={`card-branch-${branch.id}`}
            >
              {/* Image header */}
              <div className="relative h-36 bg-gradient-to-br from-[#2B2B60] to-[#0F0F0F] overflow-hidden">
                {branch.image ? (
                  <img
                    src={branch.image}
                    alt={branch.name}
                    className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                    loading="lazy"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Building2 className="h-12 w-12 text-[#DFB369]/40" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider backdrop-blur-md ${
                      branch.isActive
                        ? "bg-emerald-500/90 text-white"
                        : "bg-red-500/90 text-white"
                    }`}
                  >
                    {branch.isActive ? "نشط" : "مغلق"}
                  </span>
                  {branch.isPickupEnabled && (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#DFB369]/90 text-[#0F0F0F] backdrop-blur-md">
                      استلام
                    </span>
                  )}
                </div>
                <div className="absolute bottom-3 right-3 left-3">
                  <h3 className="text-white font-black text-xl drop-shadow-lg" data-testid={`text-branch-name-${branch.id}`}>
                    {branch.name}
                  </h3>
                  {branch.city && (
                    <p className="text-white/80 text-xs font-bold mt-0.5">{branch.city}</p>
                  )}
                </div>
              </div>

              {/* Body */}
              <div className="p-4 space-y-2.5">
                {branch.address && (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-[#DFB369] shrink-0 mt-0.5" />
                    <span className="text-gray-800 font-medium">{branch.address}</span>
                  </div>
                )}
                {branch.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-[#DFB369] shrink-0" />
                    <a href={`tel:${branch.phone}`} className="text-gray-800 font-bold hover:text-[#DFB369] transition-colors" dir="ltr">
                      {branch.phone}
                    </a>
                  </div>
                )}
                {branch.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-[#DFB369] shrink-0" />
                    <a href={`mailto:${branch.email}`} className="text-gray-800 font-bold hover:text-[#DFB369] transition-colors truncate" dir="ltr">
                      {branch.email}
                    </a>
                  </div>
                )}
                {branch.hours && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-[#DFB369] shrink-0" />
                    <span className="text-gray-800 font-bold">{branch.hours}</span>
                  </div>
                )}
                {(branch as any).pickupHours && (
                  <div className="flex items-start gap-2 text-sm">
                    <Package className="h-4 w-4 text-[#DFB369] shrink-0 mt-0.5" />
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-[#2B2B60]">مواقيت الاستلام</div>
                      <span className="text-gray-800 font-bold">{(branch as any).pickupHours}</span>
                    </div>
                  </div>
                )}
                {branch.mapUrl && (
                  <a
                    href={branch.mapUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-xs font-black text-[#2B2B60] hover:text-[#DFB369] transition-colors mt-1"
                  >
                    عرض على الخريطة
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}

                {/* Branch login link block — unique per branch */}
                {(() => {
                  const branchLoginUrl = buildBranchLoginUrl(branch.id);
                  return (
                    <div className="mt-3 rounded-lg bg-gradient-to-l from-[#2B2B60] to-[#1c1c45] text-white p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#DFB369]">
                          <Link2 className="h-3 w-3" />
                          رابط دخول الفرع
                        </div>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(branchLoginUrl, "تم نسخ رابط الدخول")}
                          className="flex items-center gap-1 text-[10px] font-black bg-[#DFB369] text-[#0F0F0F] hover:bg-[#c89853] px-2 py-1 rounded transition-colors"
                          data-testid={`button-copy-link-${branch.id}`}
                        >
                          <Copy className="h-3 w-3" />
                          نسخ
                        </button>
                      </div>
                      <a
                        href={`/login?branch=${encodeURIComponent(branch.id)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="block text-xs font-mono font-bold text-white/90 hover:text-[#DFB369] truncate"
                        dir="ltr"
                        data-testid={`link-login-${branch.id}`}
                      >
                        {branchLoginUrl}
                      </a>
                      <div className="text-[10px] text-white/60 font-bold">
                        رابط مخصص لهذا الفرع — شاركه مع المسؤول، يدخل برقم جواله وكلمة المرور
                      </div>
                    </div>
                  );
                })()}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-3 border-t border-gray-100 mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateMutation.mutate({ id: branch.id, data: { isActive: !branch.isActive } })}
                    disabled={updateMutation.isPending}
                    className="flex-1 font-bold"
                    data-testid={`button-toggle-active-${branch.id}`}
                  >
                    {branch.isActive ? <XCircle className="h-3.5 w-3.5 ml-1" /> : <CheckCircle className="h-3.5 w-3.5 ml-1" />}
                    {branch.isActive ? "إغلاق" : "تفعيل"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => startEdit(branch)}
                    className="font-bold border-[#DFB369]/40 text-[#2B2B60] hover:bg-[#DFB369]/10"
                    data-testid={`button-edit-${branch.id}`}
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteId(branch.id)}
                    className="font-bold border-red-200 text-red-600 hover:bg-red-50"
                    data-testid={`button-delete-${branch.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editingBranch} onOpenChange={(v) => { if (!v) setEditingBranch(null); }}>
        <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-right text-2xl font-black text-[#2B2B60]">
              تعديل الفرع
            </DialogTitle>
            <DialogDescription className="text-right text-gray-700">
              {editingBranch?.name}
            </DialogDescription>
          </DialogHeader>
          {editingBranch && renderForm(editForm, true)}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(v) => { if (!v) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-right">تأكيد حذف الفرع</AlertDialogTitle>
            <AlertDialogDescription className="text-right">
              هل أنت متأكد من حذف هذا الفرع؟ لن تتمكن من استرجاعه. الطلبات المرتبطة بهذا الفرع لن تُحذف.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-bold">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-red-600 hover:bg-red-700 font-black"
              data-testid="button-confirm-delete"
            >
              نعم، احذف الفرع
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
