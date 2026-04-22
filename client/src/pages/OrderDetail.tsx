import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Loader2, ShoppingBag, MapPin, CreditCard, ChevronLeft,
  Clock, Truck, CheckCircle, Package, Phone, User, AlertCircle,
  FileText, Bike, Wallet, X, Share2, Copy, Calendar,
  ArrowRight, Star, RefreshCw, MessageCircle, ChevronRight, ChevronLeft as ChevronLeftIcon
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Status Config ──────────────────────────────────────────────────────────
const statusConfig: Record<string, { icon: any; color: string; label: string; bg: string; border: string; step: number; }> = {
  new:              { icon: Clock,        color: "text-amber-600",  bg: "bg-amber-50",   border: "border-amber-100",  step: 0, label: "طلب جديد" },
  pending:          { icon: Clock,        color: "text-amber-600",  bg: "bg-amber-50",   border: "border-amber-100",  step: 0, label: "قيد الانتظار" },
  pending_payment:  { icon: CreditCard,   color: "text-orange-600", bg: "bg-orange-50",  border: "border-orange-200", step: 1, label: "مراجعة إيصال الدفع" },
  processing:       { icon: Package,      color: "text-blue-600",   bg: "bg-blue-50",    border: "border-blue-100",   step: 2, label: "قيد التجهيز" },
  out_for_delivery: { icon: Bike,         color: "text-violet-600", bg: "bg-violet-50",  border: "border-violet-100", step: 3, label: "خرج للتوصيل" },
  shipped:          { icon: Truck,        color: "text-purple-600", bg: "bg-purple-50",  border: "border-purple-100", step: 3, label: "تم الشحن" },
  completed:        { icon: CheckCircle,  color: "text-green-600",  bg: "bg-green-50",   border: "border-green-100",  step: 4, label: "تم التوصيل" },
  delivered:        { icon: CheckCircle,  color: "text-green-600",  bg: "bg-green-50",   border: "border-green-100",  step: 4, label: "تم التوصيل" },
  cancelled:        { icon: AlertCircle,  color: "text-red-600",    bg: "bg-red-50",     border: "border-red-100",    step: -1, label: "ملغي" },
};

const trackingSteps = [
  { key: "new",              icon: ShoppingBag, label: "تم استلام الطلب",  sublabel: "طلبك وصلنا" },
  { key: "processing",       icon: Package,     label: "قيد التجهيز",       sublabel: "نجهّز طلبك بعناية" },
  { key: "out_for_delivery", icon: Bike,        label: "خرج للتوصيل",      sublabel: "السائق في طريقه" },
  { key: "completed",        icon: CheckCircle, label: "تم التوصيل",        sublabel: "وصل بسلامة" },
];

const paymentMethodLabel: Record<string, string> = {
  wallet: "محفظة إلكترونية",
  tap: "بطاقة بنكية",
  stc_pay: "STC Pay",
  apple_pay: "Apple Pay",
  bank_transfer: "تحويل بنكي",
  tabby: "Tabby — أقساط",
  tamara: "Tamara — أقساط",
};

// ─── Auto-print when ?print=1 ───────────────────────────────────────────────
function useAutoPrint(ready: boolean) {
  useEffect(() => {
    if (!ready) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("print") === "1") {
      const t = setTimeout(() => window.print(), 600);
      return () => clearTimeout(t);
    }
  }, [ready]);
}

// ─── Pickup QR / Code Card ──────────────────────────────────────────────────
function PickupCodeCard({ orderId }: { orderId: string }) {
  const { data } = useQuery<{ pickupCode: string | null; pickupBranch: string | null }>({
    queryKey: ["/api/orders", orderId, "pickup-code"],
    queryFn: async () => {
      const res = await fetch(`/api/orders/${orderId}/pickup-code`);
      if (!res.ok) return { pickupCode: null, pickupBranch: null };
      return res.json();
    },
  });
  const [qrUrl, setQrUrl] = useState<string>("");
  useEffect(() => {
    if (!data?.pickupCode) return;
    (async () => {
      try {
        const QR = (await import("qrcode")).default;
        const url = await QR.toDataURL(`PICKUP:${orderId}:${data.pickupCode}`, {
          width: 320, margin: 1, color: { dark: "#000000", light: "#ffffff" },
        });
        setQrUrl(url);
      } catch {}
    })();
  }, [data?.pickupCode, orderId]);
  if (!data?.pickupCode) return null;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
      className="bg-white border-2 border-primary/20 rounded-3xl p-6 shadow-sm text-center"
    >
      <p className="text-xs font-black uppercase tracking-widest text-primary mb-3">
        كود الاستلام من الفرع
      </p>
      {qrUrl && (
        <img
          src={qrUrl}
          alt="QR Code"
          className="w-48 h-48 mx-auto rounded-xl border border-black/10"
          data-testid="img-pickup-qr"
        />
      )}
      <p
        className="font-mono text-3xl font-black tracking-[0.3em] mt-4"
        data-testid="text-pickup-code"
      >
        {data.pickupCode}
      </p>
      <p className="text-[11px] text-gray-700 font-bold mt-3 leading-relaxed">
        أظهر هذا الكود أو امسح الـ QR لموظف الفرع عند الاستلام
      </p>
    </motion.div>
  );
}

// ─── Image Carousel ─────────────────────────────────────────────────────────
function ImageCarousel({ images }: { images: string[] }) {
  const [current, setCurrent] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (images.length <= 1) return;
    timerRef.current = setInterval(() => {
      setCurrent(p => (p + 1) % images.length);
    }, 3500);
    return () => clearInterval(timerRef.current!);
  }, [images.length]);

  const go = (dir: number) => {
    clearInterval(timerRef.current!);
    setCurrent(p => (p + dir + images.length) % images.length);
  };

  if (!images.length) return (
    <div className="w-full h-full bg-black/5 flex items-center justify-center">
      <ShoppingBag className="h-16 w-16 text-black/10" />
    </div>
  );

  return (
    <div
      className="relative w-full h-full overflow-hidden select-none"
      onMouseDown={(e) => { setDragging(true); startX.current = e.clientX; }}
      onMouseUp={(e) => { if (dragging) { go(e.clientX < startX.current ? 1 : -1); setDragging(false); }}}
      onTouchStart={(e) => { startX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => { const dx = e.changedTouches[0].clientX - startX.current; if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); }}
    >
      <AnimatePresence initial={false}>
        <motion.img
          key={current}
          src={images[current]}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          draggable={false}
        />
      </AnimatePresence>

      {/* Dark overlay at bottom */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />

      {images.length > 1 && (
        <>
          <button
            onClick={() => go(-1)}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/40 transition-all"
          >
            <ChevronRight className="h-5 w-5 text-white" />
          </button>
          <button
            onClick={() => go(1)}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/40 transition-all"
          >
            <ChevronLeftIcon className="h-5 w-5 text-white" />
          </button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`rounded-full transition-all ${i === current ? "w-5 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/40"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Tracking Stepper ────────────────────────────────────────────────────────
function TrackingStepper({ order }: { order: any }) {
  const currentStep = statusConfig[order.status]?.step ?? 0;
  const isCancelled = order.status === "cancelled";
  const isShipped = order.status === "shipped" && order.shippingProvider;

  if (isCancelled) {
    return (
      <div className="flex items-center gap-3 p-5 bg-red-50 border border-red-100 rounded-2xl">
        <AlertCircle className="h-6 w-6 text-red-500 shrink-0" />
        <div>
          <p className="font-black text-sm text-red-700">تم إلغاء هذا الطلب</p>
          <p className="text-xs text-red-400 font-bold mt-0.5">إذا دفعت مسبقاً سيتم استرداد مبلغك</p>
        </div>
      </div>
    );
  }

  const steps = isShipped
    ? [
        { key: "new",       icon: ShoppingBag, label: "تم الاستلام", sublabel: "طلبك وصلنا" },
        { key: "processing",icon: Package,     label: "قيد التجهيز", sublabel: "نجهّز طلبك" },
        { key: "shipped",   icon: Truck,       label: "تم الشحن",    sublabel: order.trackingNumber || "" },
        { key: "completed", icon: CheckCircle, label: "تم التوصيل",  sublabel: "وصل بسلامة" },
      ]
    : trackingSteps;

  return (
    <div className="w-full" dir="rtl">
      <div className="flex items-start justify-between relative">
        <div className="absolute top-5 right-5 left-5 h-0.5 bg-black/8 z-0" />
        <div
          className="absolute top-5 right-5 h-0.5 bg-primary z-0 transition-all duration-700"
          style={{
            width: currentStep <= 0 ? "0%" : `${Math.min((currentStep / (steps.length - 1)) * 100, 100)}%`,
            maxWidth: "calc(100% - 40px)",
          }}
        />
        {steps.map((step, i) => {
          const StepIcon = step.icon;
          const done   = i < currentStep;
          const active = i === currentStep;
          const future = i > currentStep;
          return (
            <div key={step.key} className="flex flex-col items-center gap-2 z-10 flex-1">
              <motion.div
                initial={false}
                animate={active ? { scale: [1, 1.15, 1] } : {}}
                transition={{ duration: 1, repeat: Infinity, repeatDelay: 2 }}
                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-500
                  ${done   ? "bg-primary border-primary text-white shadow-md shadow-primary/20" : ""}
                  ${active ? "bg-primary border-primary text-white shadow-lg shadow-primary/30 ring-4 ring-primary/15" : ""}
                  ${future ? "bg-white border-black/10 text-black/20" : ""}`}
              >
                {done ? <CheckCircle className="h-5 w-5" /> : <StepIcon className={`h-4 w-4 ${active ? "animate-pulse" : ""}`} />}
              </motion.div>
              <div className="text-center max-w-[70px]">
                <p className={`text-[10px] font-black leading-tight ${done || active ? "text-black/80" : "text-black/25"}`}>{step.label}</p>
                {(done || active) && <p className="text-[9px] text-black/35 font-bold leading-tight mt-0.5">{step.sublabel}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function OrderDetail() {
  const params = useParams<{ id: string }>();
  const orderId = params.id;
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: order, isLoading } = useQuery({
    queryKey: [`/api/orders/${orderId}`],
    queryFn: async () => {
      const res = await fetch(`/api/orders/${orderId}`);
      if (!res.ok) throw new Error("لم يُعثر على الطلب");
      return res.json();
    },
    enabled: !!orderId && !!user,
    refetchInterval: 30000,
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/orders/${orderId}/status`, { status: "cancelled" });
      if (!res.ok) throw new Error("فشل الإلغاء");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${orderId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders/my"] });
      setShowCancelConfirm(false);
      toast({ title: "تم إلغاء الطلب", description: "سيتم استرداد مبلغك إن وُجد" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const copyOrderId = () => {
    navigator.clipboard.writeText(order?.id || orderId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useAutoPrint(!!order);

  if (!user) { setLocation("/login"); return null; }

  if (isLoading) return (
    <Layout>
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin h-12 w-12 text-primary opacity-30" />
      </div>
    </Layout>
  );

  if (!order) return (
    <Layout>
      <div className="container py-32 text-center">
        <AlertCircle className="h-16 w-16 mx-auto text-black/10 mb-6" />
        <h2 className="font-black text-3xl mb-3">الطلب غير موجود</h2>
        <Button onClick={() => setLocation("/orders")} className="mt-4 rounded-full px-8">عودة للطلبات</Button>
      </div>
    </Layout>
  );

  // Collect product images for carousel
  const productImages: string[] = [];
  (order.items || []).forEach((item: any) => {
    if (item.image) productImages.push(item.image);
  });

  const sc = statusConfig[order.status] || statusConfig.new;
  const StatusIcon = sc.icon;
  const canCancel = ["new", "processing"].includes(order.status);
  const isCompleted = order.status === "completed" || order.status === "delivered";

  return (
    <Layout>
      <div className="min-h-screen bg-[#fafafa]" dir="rtl">

        {/* ── Hero Banner with image carousel ─── */}
        <div className="relative w-full h-[55vw] max-h-[480px] min-h-[280px] overflow-hidden">
          <ImageCarousel images={productImages} />

          {/* Back button */}
          <button
            onClick={() => setLocation("/orders")}
            className="absolute top-5 right-5 z-20 flex items-center gap-2 px-4 h-10 rounded-full bg-white/90 backdrop-blur-sm text-black font-black text-[11px] uppercase tracking-widest shadow-lg hover:bg-white transition-all"
          >
            <ArrowRight className="h-4 w-4" />
            طلباتي
          </button>

          {/* Share button */}
          <button
            onClick={copyOrderId}
            className="absolute top-5 left-5 z-20 w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-lg hover:bg-white transition-all"
          >
            {copied ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-black/60" />}
          </button>

          {/* Status badge over image */}
          <div className="absolute bottom-6 right-6 z-20">
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${sc.bg} ${sc.border} border backdrop-blur-sm shadow-lg`}>
              <StatusIcon className={`h-4 w-4 ${sc.color}`} />
              <span className={`text-xs font-black ${sc.color}`}>{sc.label}</span>
            </div>
          </div>

          {/* Order ref over image */}
          <div className="absolute bottom-6 left-6 z-20 text-white/70 font-mono text-[10px] font-bold">
            #{(order.id || "").slice(-8).toUpperCase()}
          </div>
        </div>

        {/* ── Content ─── */}
        <div className="container max-w-3xl mx-auto px-4 py-8 space-y-6">

          {/* Pickup ready banner */}
          {(order as any).shippingMethod === "pickup" && (order as any).status === "ready_for_pickup" && !(order as any).pickupVerified && (
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-gradient-to-l from-emerald-500 to-green-500 text-white rounded-3xl p-5 shadow-lg shadow-green-500/30 relative overflow-hidden"
              data-testid="banner-pickup-ready"
            >
              <div className="absolute inset-0 bg-white/10 animate-pulse" />
              <div className="relative flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-2xl shrink-0">📦</div>
                <div className="flex-1">
                  <p className="font-black text-lg">طلبك جاهز للاستلام!</p>
                  <p className="text-xs font-bold opacity-90 mt-0.5">توجّه للفرع وأظهر رمز QR أدناه للموظف</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Pickup QR Code (only for pickup orders that aren't yet verified) */}
          {(order as any).shippingMethod === "pickup" && !(order as any).pickupVerified && (
            <PickupCodeCard orderId={order.id} />
          )}
          {(order as any).shippingMethod === "pickup" && (order as any).pickupVerified && (
            <div className="bg-green-50 border-2 border-green-200 rounded-3xl p-5 text-center">
              <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <p className="font-black text-green-800">تم استلام الطلب من الفرع ✓</p>
            </div>
          )}

          {/* Order header */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-3xl border border-black/5 p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h1 className="font-black text-2xl tracking-tight mb-1">تفاصيل الطلب</h1>
                <div className="flex items-center gap-2 text-black/40">
                  <Calendar className="h-3.5 w-3.5" />
                  <span className="text-xs font-bold">
                    {new Date(order.createdAt).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="font-black text-3xl text-primary leading-none">{Number(order.total || 0).toLocaleString()}</p>
                <p className="text-[10px] text-black/30 font-bold mt-0.5">ريال سعودي</p>
              </div>
            </div>

            {/* Tracking stepper */}
            <TrackingStepper order={order} />
          </motion.div>

          {/* Driver banner (out_for_delivery) */}
          {order.status === "out_for_delivery" && order.deliveryDriver && (
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-l from-violet-600 to-violet-700 rounded-3xl p-6 text-white shadow-xl shadow-violet-200"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                  <Bike className="h-7 w-7 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-white/60 text-[10px] font-black uppercase tracking-widest mb-1">السائق في طريقه إليك</p>
                  <p className="font-black text-xl leading-none">{order.deliveryDriver.name}</p>
                  <p className="text-white/60 text-xs font-bold mt-1">{order.deliveryDriver.phone}</p>
                </div>
                {order.deliveryDriver.phone && (
                  <a
                    href={`tel:${order.deliveryDriver.phone}`}
                    className="w-12 h-12 rounded-2xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all active:scale-95"
                  >
                    <Phone className="h-5 w-5 text-white" />
                  </a>
                )}
              </div>
            </motion.div>
          )}

          {/* Completed card */}
          {isCompleted && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
              className="bg-gradient-to-l from-green-500 to-emerald-600 rounded-3xl p-6 text-white shadow-xl shadow-green-200 text-center"
            >
              <CheckCircle className="h-10 w-10 mx-auto mb-3 text-white" />
              <p className="font-black text-xl mb-1">وصل طلبك بسلامة!</p>
              <p className="text-white/70 text-sm font-bold">نتمنى تكون راضي عن تجربتك مع رفيف العود</p>
              <div className="flex items-center justify-center gap-1 mt-4">
                {[1,2,3,4,5].map(s => <Star key={s} className="h-6 w-6 fill-white/40 text-white/40 hover:fill-white hover:text-white cursor-pointer transition-all" />)}
              </div>
            </motion.div>
          )}

          {/* Order items */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-white rounded-3xl border border-black/5 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <ShoppingBag className="h-4 w-4 text-primary" />
              </div>
              <h2 className="font-black text-base uppercase tracking-widest">المنتجات ({(order.items || []).length})</h2>
            </div>
            <div className="space-y-3">
              {(order.items || []).map((item: any, idx: number) => (
                <div key={idx} className="flex items-center gap-4 p-4 rounded-2xl bg-black/[0.02] border border-black/[0.03]">
                  {item.image ? (
                    <img src={item.image} alt={item.title} className="w-16 h-16 rounded-xl object-cover border border-black/5 shrink-0" />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-black/5 flex items-center justify-center shrink-0">
                      <Package className="h-6 w-6 text-black/20" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-sm text-black/80 leading-tight truncate">{item.title}</p>
                    {(item.color || item.size) && (
                      <p className="text-[10px] font-bold text-black/35 mt-1">
                        {[item.color && `اللون: ${item.color}`, item.size && `المقاس: ${item.size}`].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    {item.variantSku && <p className="text-[9px] text-black/20 font-bold uppercase tracking-wider mt-0.5">{item.variantSku}</p>}
                  </div>
                  <div className="text-left shrink-0">
                    <p className="font-black text-base">{(item.price * item.quantity).toFixed(2)}<span className="text-[9px] text-black/25 mr-0.5">ر.س</span></p>
                    <p className="text-[10px] text-black/30 font-bold text-center">×{item.quantity}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Financial summary */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white rounded-3xl border border-black/5 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <CreditCard className="h-4 w-4 text-primary" />
              </div>
              <h2 className="font-black text-base uppercase tracking-widest">ملخص الدفع</h2>
            </div>
            <div className="space-y-3">
              {[
                { label: "المجموع الفرعي",          value: Number(order.subtotal || 0).toFixed(2) },
                { label: "ضريبة القيمة المضافة (15%)", value: Number(order.vatAmount || 0).toFixed(2) },
                { label: "رسوم الشحن",               value: Number(order.shippingCost || 0).toFixed(2) },
                order.discountAmount && Number(order.discountAmount) > 0
                  ? { label: "الخصم", value: `-${Number(order.discountAmount).toFixed(2)}`, green: true }
                  : null,
                order.cashbackAmount && Number(order.cashbackAmount) > 0
                  ? { label: "كاش باك للمحفظة", value: `+${Number(order.cashbackAmount).toFixed(2)}`, green: true }
                  : null,
              ].filter(Boolean).map((row: any, i) => (
                <div key={i} className="flex justify-between text-sm font-bold text-black/45">
                  <span>{row.label}</span>
                  <span className={row.green ? "text-green-600 font-black" : ""}>{row.value} ر.س</span>
                </div>
              ))}
              <div className="flex justify-between items-center pt-4 border-t border-black/8 mt-2">
                <span className="font-black text-base">الإجمالي</span>
                <span className="font-black text-2xl text-primary">{Number(order.total || 0).toLocaleString()} <span className="text-xs font-bold text-black/30">ر.س</span></span>
              </div>
            </div>

            {/* Payment method */}
            <div className="mt-5 pt-4 border-t border-black/5 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-black/30">طريقة الدفع</span>
              <span className="text-sm font-black flex items-center gap-2">
                <Wallet className="h-4 w-4 text-black/30" />
                {paymentMethodLabel[order.paymentMethod] || order.paymentMethod}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-black/30">حالة الدفع</span>
              <span className={`text-xs font-black px-3 py-1 rounded-full ${order.paymentStatus === "paid" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                {order.paymentStatus === "paid" ? "✓ مدفوع" : "معلق"}
              </span>
            </div>
          </motion.div>

          {/* Delivery address */}
          {order.shippingAddress && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-white rounded-3xl border border-black/5 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                  <MapPin className="h-4 w-4 text-primary" />
                </div>
                <h2 className="font-black text-base uppercase tracking-widest">عنوان التوصيل</h2>
              </div>
              <p className="font-bold text-black/60 leading-relaxed">
                {[order.shippingAddress.city, order.shippingAddress.district, order.shippingAddress.street].filter(Boolean).join("، ")}
              </p>
              {order.shippingCompany && (
                <p className="text-[11px] text-black/35 font-bold mt-2 flex items-center gap-1.5">
                  <Truck className="h-3.5 w-3.5" />
                  شركة الشحن: {order.shippingCompany}
                </p>
              )}
            </motion.div>
          )}

          {/* Status timeline */}
          {order.statusHistory && order.statusHistory.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white rounded-3xl border border-black/5 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-primary" />
                </div>
                <h2 className="font-black text-base uppercase tracking-widest">سجل الطلب</h2>
              </div>
              <div className="relative pr-4 space-y-4">
                <div className="absolute right-[7px] top-2 bottom-2 w-[2px] bg-black/8" />
                {[...order.statusHistory].reverse().map((entry: any, i: number) => {
                  const s = statusConfig[entry.status] || statusConfig.new;
                  const Ic = s.icon;
                  return (
                    <div key={i} className="flex items-start gap-4 relative">
                      <div className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 mt-0.5 z-10 ${i === 0 ? "border-primary bg-primary" : "border-black/15 bg-white"}`} />
                      <div className="flex-1 pb-3">
                        <p className={`text-sm font-black ${i === 0 ? "text-black" : "text-black/50"}`}>{s.label}</p>
                        {entry.note && <p className="text-xs text-black/35 font-bold mt-0.5">{entry.note}</p>}
                        <p className="text-[10px] text-black/25 font-bold mt-1">
                          {new Date(entry.at).toLocaleString("ar-SA", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Actions */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="grid grid-cols-2 gap-3">
            <button
              onClick={copyOrderId}
              className="flex items-center justify-center gap-2 h-14 rounded-2xl border-2 border-black/8 bg-white font-black text-[11px] uppercase tracking-widest hover:bg-black hover:text-white hover:border-black transition-all active:scale-95"
            >
              {copied ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              {copied ? "تم النسخ!" : "نسخ رقم الطلب"}
            </button>

            <a
              href={`/api/invoices/${orderId}`}
              target="_blank"
              className="flex items-center justify-center gap-2 h-14 rounded-2xl border-2 border-black/8 bg-white font-black text-[11px] uppercase tracking-widest hover:bg-black hover:text-white hover:border-black transition-all active:scale-95"
            >
              <FileText className="h-4 w-4" />
              الفاتورة
            </a>

            <button
              onClick={() => window.open(`https://wa.me/966?text=مرحباً، لدي استفسار عن الطلب #${(order.id || "").slice(-8).toUpperCase()}`, "_blank")}
              className="flex items-center justify-center gap-2 h-14 rounded-2xl border-2 border-black/8 bg-white font-black text-[11px] uppercase tracking-widest hover:bg-green-500 hover:text-white hover:border-green-500 transition-all active:scale-95"
            >
              <MessageCircle className="h-4 w-4" />
              تواصل معنا
            </button>

            {canCancel ? (
              <button
                onClick={() => setShowCancelConfirm(true)}
                className="flex items-center justify-center gap-2 h-14 rounded-2xl border-2 border-red-100 bg-red-50 text-red-600 font-black text-[11px] uppercase tracking-widest hover:bg-red-600 hover:text-white hover:border-red-600 transition-all active:scale-95"
              >
                <X className="h-4 w-4" />
                إلغاء الطلب
              </button>
            ) : (
              <button
                onClick={() => setLocation("/products")}
                className="flex items-center justify-center gap-2 h-14 rounded-2xl border-2 border-black/8 bg-white font-black text-[11px] uppercase tracking-widest hover:bg-black hover:text-white hover:border-black transition-all active:scale-95"
              >
                <RefreshCw className="h-4 w-4" />
                تسوق مجدداً
              </button>
            )}
          </motion.div>

          <div className="pb-8" />
        </div>
      </div>

      {/* ── Cancel Confirm Dialog ── */}
      <AnimatePresence>
        {showCancelConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowCancelConfirm(false)}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-sm bg-white rounded-3xl p-8 shadow-2xl"
            >
              <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="h-8 w-8 text-red-500" />
              </div>
              <h3 className="font-black text-2xl text-center mb-2">إلغاء الطلب؟</h3>
              <p className="text-black/40 font-bold text-sm text-center leading-relaxed mb-8">
                هل أنت متأكد من إلغاء هذا الطلب؟ لا يمكن التراجع عن هذا الإجراء بعد تأكيده.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  className="h-14 rounded-2xl border-2 border-black/8 font-black text-[11px] uppercase tracking-widest hover:bg-black/5 transition-all"
                >
                  تراجع
                </button>
                <button
                  onClick={() => cancelMutation.mutate()}
                  disabled={cancelMutation.isPending}
                  className="h-14 rounded-2xl bg-red-600 text-white font-black text-[11px] uppercase tracking-widest hover:bg-red-700 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {cancelMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  نعم، إلغاء
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
