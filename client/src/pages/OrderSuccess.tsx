import { Layout } from "@/components/Layout";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Package, ArrowLeft, ShoppingBag, Sparkles, Truck, Receipt, XCircle, RefreshCw, MapPin, Clock, Phone, Store } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { RiyalSign } from "@/components/RiyalSign";
import { trackPixelEvent } from "@/lib/pixels";

type OrderApi = {
  id: string;
  total: number | string;
  status: string;
  paymentStatus?: string;
  paymentMethod?: string;
  shippingMethod?: string;
  pickupBranch?: string;
  installments?: number;
  createdAt?: string;
  items?: Array<{ title: string; quantity: number; price: number; image?: string }>;
};

type BranchApi = {
  id?: string;
  _id?: string;
  name: string;
  address?: string;
  city?: string;
  phone?: string;
  hours?: string;
  pickupHours?: string;
  mapUrl?: string;
};

const TERMINAL_FAIL_STATUSES = new Set(["cancelled", "failed", "rejected", "refunded"]);

const GATEWAY_LABEL: Record<string, string> = {
  tamara: "تمارا",
  tabby: "تابي",
  paymob: "البطاقة الائتمانية",
  stc_pay: "STC Pay",
  apple_pay: "Apple Pay",
  wallet: "المحفظة",
  bank_transfer: "تحويل بنكي",
};

export default function OrderSuccess() {
  const params = useParams<{ id: string }>();
  const orderId = params?.id;
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Pull paid=<gateway>&inst=<n> from URL once and clean it up.
  const { gateway, installments } = useMemo(() => {
    if (typeof window === "undefined") return { gateway: "", installments: 0 };
    const p = new URLSearchParams(window.location.search);
    return {
      gateway: p.get("paid") || p.get("gateway") || "",
      installments: Number(p.get("inst") || 0),
    };
  }, []);

  const { data: order, isLoading } = useQuery<OrderApi>({
    queryKey: ["/api/orders", orderId],
    queryFn: async () => {
      const r = await fetch(`/api/orders/${orderId}`, { credentials: "include" });
      if (!r.ok) throw new Error("order_fetch_failed");
      return r.json();
    },
    enabled: !!orderId,
    refetchInterval: (q) => {
      // Stop polling once we reach a terminal state (paid OR cancelled/failed/refunded).
      const o = q.state.data as OrderApi | undefined;
      if (!o) return 4000;
      if (o.paymentStatus === "paid") return false;
      if (TERMINAL_FAIL_STATUSES.has(String(o.status || "").toLowerCase())) return false;
      if (TERMINAL_FAIL_STATUSES.has(String(o.paymentStatus || "").toLowerCase())) return false;
      return 4000;
    },
  });

  const isPaymentFailed = !!order && (
    TERMINAL_FAIL_STATUSES.has(String(order.status || "").toLowerCase()) ||
    TERMINAL_FAIL_STATUSES.has(String(order.paymentStatus || "").toLowerCase())
  );

  // Pickup branch lookup — only fetched when needed
  const isPickup = order?.shippingMethod === "pickup" && !!order?.pickupBranch;
  const { data: branches = [] } = useQuery<BranchApi[]>({
    queryKey: ["/api/branches"],
    enabled: !!isPickup,
  });
  const pickupBranch = isPickup
    ? branches.find((b) => (b.id || b._id) === order!.pickupBranch)
    : null;

  const purchaseFired = useRef(false);
  useEffect(() => {
    if (!gateway) return;
    toast({
      title: `تم الدفع بنجاح عبر ${GATEWAY_LABEL[gateway] || gateway} ✅`,
      description: orderId ? `الطلب #${String(orderId).slice(-6)} قيد التجهيز.` : "طلبك قيد التجهيز.",
    });
    // Strip URL params so a refresh doesn't re-toast.
    const u = new URL(window.location.href);
    ["paid", "gateway", "inst"].forEach((k) => u.searchParams.delete(k));
    window.history.replaceState({}, "", u.pathname + (u.search || ""));
  }, [gateway, orderId, toast]);

  const total = Number(order?.total || 0);

  useEffect(() => {
    if (!order || purchaseFired.current || isPaymentFailed) return;
    purchaseFired.current = true;
    try {
      trackPixelEvent("Purchase", {
        value: total,
        currency: "SAR",
        orderId: String(order.id),
        numItems: (order as any).items?.reduce((s: number, i: any) => s + (i.quantity || 1), 0) || 1,
      });
    } catch {}
  }, [order, total, isPaymentFailed]);

  const inst = installments || order?.installments || 0;
  const perInstallment = inst > 0 ? Math.round((total / inst) * 100) / 100 : 0;
  const gatewayLabel = GATEWAY_LABEL[gateway] || GATEWAY_LABEL[order?.paymentMethod || ""] || "";

  return (
    <Layout>
      <div className="min-h-[80vh] bg-gradient-to-b from-emerald-50/30 via-white to-white" dir="rtl">
        <div className="max-w-2xl mx-auto px-4 py-8 sm:py-14 md:py-20">
          {/* ── Hero — success / failed badge ── */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="text-center mb-6 sm:mb-10"
          >
            <div className="relative inline-flex items-center justify-center mb-5">
              <div className={`absolute inset-0 rounded-full blur-2xl opacity-25 animate-pulse ${isPaymentFailed ? "bg-red-400" : "bg-emerald-400"}`} />
              <div className={`relative w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center shadow-xl ${
                isPaymentFailed
                  ? "bg-gradient-to-br from-red-400 to-red-600 shadow-red-500/30"
                  : "bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-emerald-500/30"
              }`}>
                {isPaymentFailed
                  ? <XCircle className="h-10 w-10 sm:h-12 sm:w-12 text-white" strokeWidth={2.5} />
                  : <CheckCircle2 className="h-10 w-10 sm:h-12 sm:w-12 text-white" strokeWidth={2.5} />
                }
              </div>
            </div>
            <h1 className="font-black text-2xl sm:text-3xl md:text-4xl tracking-tight mb-2">
              {isPaymentFailed ? "لم يكتمل الدفع" : "تم الدفع بنجاح"}
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground font-bold">
              {isPaymentFailed
                ? <>تم إلغاء عملية الدفع أو رفضها. يمكنك المحاولة بطريقة أخرى.</>
                : <>شكراً لشرائك من <span className="text-primary">RF Perfume</span> — طلبك تأكد ووصلنا.</>
              }
            </p>
          </motion.div>

          {/* ── Order summary card ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.4 }}
            className="bg-white rounded-2xl border border-black/5 shadow-lg shadow-black/5 overflow-hidden"
          >
            {/* Header row */}
            <div className="px-5 sm:px-7 py-4 sm:py-5 border-b border-black/5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Receipt className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-black/40">رقم الطلب</p>
                  <p className="font-black text-sm sm:text-base tracking-tight" data-testid="text-order-id">
                    #{String(orderId || "").slice(-8).toUpperCase()}
                  </p>
                </div>
              </div>
              {gatewayLabel && (
                <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full">
                  ✓ {gatewayLabel}
                </span>
              )}
            </div>

            {/* Total + installment plan */}
            <div className="px-5 sm:px-7 py-5 sm:py-6 space-y-4">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">الإجمالي</span>
                <span className="font-black text-2xl sm:text-3xl tracking-tight" data-testid="text-order-total">
                  {total.toLocaleString()} <RiyalSign />
                </span>
              </div>

              {inst > 1 && (
                <div className="bg-gradient-to-r from-primary/5 to-amber-50/50 border border-primary/10 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                      مقسّمة على {inst} دفعات
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {Array.from({ length: inst }).map((_, i) => (
                      <div
                        key={i}
                        className={`rounded-lg px-2.5 py-2.5 text-center border ${
                          i === 0
                            ? "bg-primary text-white border-primary"
                            : "bg-white border-black/10 text-black/70"
                        }`}
                      >
                        <p className={`text-[9px] font-black uppercase tracking-wider ${i === 0 ? "opacity-90" : "opacity-50"}`}>
                          {i === 0 ? "الآن" : `دفعة ${i + 1}`}
                        </p>
                        <p className="font-black text-xs sm:text-sm mt-0.5 tracking-tight">
                          {perInstallment.toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-center text-black/40 mt-3 font-bold">
                    بدون فوائد · بدون رسوم خفية
                  </p>
                </div>
              )}
            </div>

            {/* Next steps */}
            <div className="px-5 sm:px-7 pb-5 sm:pb-7">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-black/40 mb-3">ماذا بعد؟</p>
              <div className="space-y-2.5">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-black/[0.02] border border-black/5">
                  <Package className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <div className="flex-1 text-xs sm:text-sm">
                    <p className="font-black mb-0.5">جاري تجهيز طلبك</p>
                    <p className="text-[11px] text-muted-foreground font-medium leading-relaxed">
                      {isPickup
                        ? "فريق الفرع يجهّز طلبك. ستصلك رسالة فور الجاهزية للاستلام."
                        : "فريقنا يجهّز عطورك بعناية. ستصلك رسالة عند الشحن."}
                    </p>
                  </div>
                </div>
                {!isPickup && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-black/[0.02] border border-black/5">
                    <Truck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div className="flex-1 text-xs sm:text-sm">
                      <p className="font-black mb-0.5">تابع طلبك مباشرة</p>
                      <p className="text-[11px] text-muted-foreground font-medium leading-relaxed">
                        من صفحة "طلباتي" تشاهد الحالة لحظة بلحظة.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* ── Pickup branch details (shown after payment when pickup) ── */}
          {!isPaymentFailed && isPickup && pickupBranch && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22, duration: 0.4 }}
              className="mt-4 sm:mt-6 bg-white rounded-2xl border-2 border-primary/20 shadow-lg overflow-hidden"
              data-testid="card-pickup-branch"
            >
              <div className="px-5 sm:px-7 py-4 sm:py-5 bg-gradient-to-l from-primary/5 to-transparent border-b border-primary/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                    <Store className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-primary/70">استلام من فرع</p>
                    <p className="font-black text-base sm:text-lg tracking-tight" data-testid="text-pickup-branch-name">
                      {pickupBranch.name}
                    </p>
                  </div>
                </div>
              </div>

              <div className="px-5 sm:px-7 py-4 sm:py-5 space-y-3">
                {(pickupBranch.address || pickupBranch.city) && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div className="flex-1 text-xs sm:text-sm">
                      <p className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-0.5">العنوان</p>
                      <p className="font-bold text-black/80" data-testid="text-pickup-branch-address">
                        {pickupBranch.address || pickupBranch.city}
                      </p>
                    </div>
                  </div>
                )}

                {(pickupBranch.pickupHours || pickupBranch.hours) && (
                  <div className="flex items-start gap-3">
                    <Clock className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div className="flex-1 text-xs sm:text-sm">
                      <p className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-0.5">مواعيد العمل</p>
                      <p className="font-bold text-black/80" data-testid="text-pickup-branch-hours">
                        {pickupBranch.pickupHours || pickupBranch.hours}
                      </p>
                    </div>
                  </div>
                )}

                {pickupBranch.phone && (
                  <div className="flex items-start gap-3">
                    <Phone className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div className="flex-1 text-xs sm:text-sm">
                      <p className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-0.5">للاستفسار</p>
                      <a
                        href={`tel:${pickupBranch.phone}`}
                        className="font-bold text-primary hover:underline"
                        data-testid="link-pickup-branch-phone"
                      >
                        {pickupBranch.phone}
                      </a>
                    </div>
                  </div>
                )}

                {pickupBranch.mapUrl && (
                  <a
                    href={pickupBranch.mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="link-pickup-branch-map"
                    className="flex items-center justify-center gap-2 mt-2 w-full h-11 bg-primary text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-primary/90 active:scale-95 transition-all"
                  >
                    <MapPin className="h-4 w-4" />
                    فتح الموقع على خرائط جوجل
                  </a>
                )}

                <div className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5 mt-3 leading-relaxed">
                  💡 ستصلك رسالة عبر واتساب/البريد فور جاهزية طلبك للاستلام. اصطحب رقم الطلب أو رمز الاستلام عند الحضور.
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Actions ── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="mt-6 sm:mt-8 flex flex-col sm:flex-row gap-3"
          >
            {isPaymentFailed ? (
              <>
                <Button
                  size="lg"
                  onClick={() => setLocation("/checkout")}
                  data-testid="button-retry-payment"
                  className="flex-1 h-12 sm:h-14 bg-black text-white hover:bg-black/90 rounded-xl font-black text-xs uppercase tracking-[0.25em] shadow-lg shadow-black/20 active:scale-95 transition-all"
                >
                  حاول مجدداً
                  <RefreshCw className="h-4 w-4 mr-2" />
                </Button>
                <Link href="/products" className="flex-1">
                  <Button
                    size="lg"
                    variant="outline"
                    data-testid="button-continue-shopping"
                    className="w-full h-12 sm:h-14 border-2 border-black/10 hover:border-black hover:bg-black hover:text-white rounded-xl font-black text-xs uppercase tracking-[0.25em] transition-all"
                  >
                    <ShoppingBag className="h-4 w-4 ml-2" />
                    متابعة التسوق
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Button
                  size="lg"
                  onClick={() => setLocation(`/orders/${orderId}`)}
                  data-testid="button-track-order"
                  className="flex-1 h-12 sm:h-14 bg-black text-white hover:bg-black/90 rounded-xl font-black text-xs uppercase tracking-[0.25em] shadow-lg shadow-black/20 active:scale-95 transition-all"
                >
                  تتبّع الطلب
                  <Package className="h-4 w-4 mr-2" />
                </Button>
                <Link href="/products" className="flex-1">
                  <Button
                    size="lg"
                    variant="outline"
                    data-testid="button-continue-shopping"
                    className="w-full h-12 sm:h-14 border-2 border-black/10 hover:border-black hover:bg-black hover:text-white rounded-xl font-black text-xs uppercase tracking-[0.25em] transition-all"
                  >
                    <ShoppingBag className="h-4 w-4 ml-2" />
                    متابعة التسوق
                  </Button>
                </Link>
              </>
            )}
          </motion.div>

          <div className="mt-8 text-center">
            <Link href="/orders" className="inline-flex items-center gap-1.5 text-xs text-black/40 hover:text-black font-bold transition-colors">
              <ArrowLeft className="h-3 w-3" />
              عرض كل طلباتي
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
}
