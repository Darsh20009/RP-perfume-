import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Loader2, ShoppingBag, MapPin, CreditCard, ChevronRight,
  Clock, Truck, CheckCircle, Hash, Calendar, Wallet,
  Package, Phone, User, AlertCircle, FileText, Bike, RotateCcw
} from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { RiyalSign } from "@/components/RiyalSign";
import riyalIconUrl from "@assets/dummy_1777292322734.png";

const RIYAL_IMG = `<img src="${typeof window !== "undefined" ? window.location.origin : ""}${riyalIconUrl}" alt="ر.س" style="height:0.85em;width:auto;display:inline-block;vertical-align:-0.08em;margin:0 0.18em 0 0.05em;object-fit:contain;" />`;

// ─── Status Config ─────────────────────────────────────────────────────────
const statusConfig: Record<string, {
  icon: any; color: string; label: string; bg: string; border: string; step: number;
}> = {
  new:              { icon: Clock,         color: "text-amber-600",  bg: "bg-amber-50",   border: "border-amber-100",  step: 0, label: "طلب جديد" },
  pending:          { icon: Clock,         color: "text-amber-600",  bg: "bg-amber-50",   border: "border-amber-100",  step: 0, label: "قيد الانتظار" },
  pending_payment:  { icon: CreditCard,    color: "text-orange-600", bg: "bg-orange-50",  border: "border-orange-200", step: 1, label: "مراجعة إيصال الدفع" },
  processing:       { icon: Package,       color: "text-blue-600",   bg: "bg-blue-50",    border: "border-blue-100",   step: 2, label: "قيد التجهيز" },
  ready_for_pickup: { icon: Package,       color: "text-emerald-600",bg: "bg-emerald-50", border: "border-emerald-100",step: 3, label: "📦 جاهز للاستلام" },
  out_for_delivery: { icon: Bike,          color: "text-violet-600", bg: "bg-violet-50",  border: "border-violet-100", step: 3, label: "خرج للتوصيل" },
  shipped:          { icon: Truck,         color: "text-purple-600", bg: "bg-purple-50",  border: "border-purple-100", step: 3, label: "تم الشحن" },
  completed:        { icon: CheckCircle,   color: "text-green-600",  bg: "bg-green-50",   border: "border-green-100",  step: 4, label: "تم التوصيل" },
  delivered:        { icon: CheckCircle,   color: "text-green-600",  bg: "bg-green-50",   border: "border-green-100",  step: 4, label: "تم التوصيل" },
  cancelled:        { icon: AlertCircle,   color: "text-red-600",    bg: "bg-red-50",     border: "border-red-100",    step: -1, label: "ملغي" },
};

// ─── Tracking Steps Definition ──────────────────────────────────────────────
const trackingSteps = [
  { key: "new",              icon: ShoppingBag, label: "تم استلام الطلب",   sublabel: "طلبك وصلنا ونتحضر له" },
  { key: "processing",       icon: Package,     label: "قيد التجهيز",        sublabel: "نجهّز طلبك بعناية" },
  { key: "out_for_delivery", icon: Bike,        label: "خرج للتوصيل",       sublabel: "السائق في طريقه إليك" },
  { key: "completed",        icon: CheckCircle, label: "تم التوصيل",         sublabel: "وصل طلبك بسلامة" },
];

const getStepIndex = (status: string) => {
  if (status === "cancelled") return -1;
  if (status === "pending_payment") return 0;
  const s = statusConfig[status];
  return s ? s.step : 0;
};

// ─── Order Tracking Stepper ──────────────────────────────────────────────────
const TrackingStepper = ({ order }: { order: any }) => {
  const currentStep = getStepIndex(order.status);
  const isCancelled = order.status === "cancelled";
  const isShippedViaCarrier = order.status === "shipped" && order.shippingProvider;

  if (isCancelled) {
    return (
      <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl">
        <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
        <div>
          <p className="font-black text-sm text-red-700">تم إلغاء هذا الطلب</p>
          <p className="text-xs text-red-400 font-bold">إذا دفعت مسبقاً سيتم استرداد مبلغك</p>
        </div>
      </div>
    );
  }

  const steps = isShippedViaCarrier
    ? [
        { key: "new", icon: ShoppingBag, label: "تم الاستلام", sublabel: "طلبك وصلنا" },
        { key: "processing", icon: Package, label: "قيد التجهيز", sublabel: "نجهّز طلبك" },
        { key: "shipped", icon: Truck, label: "تم الشحن", sublabel: `${order.shippingProvider || ""}${order.trackingNumber ? " · " + order.trackingNumber : ""}` },
        { key: "completed", icon: CheckCircle, label: "تم التوصيل", sublabel: "وصل طلبك" },
      ]
    : trackingSteps;

  return (
    <div className="w-full" dir="rtl">
      {/* Step row */}
      <div className="flex items-start justify-between relative">
        {/* Connector line */}
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
          const done = i < currentStep;
          const active = i === currentStep;
          const future = i > currentStep;

          return (
            <div key={step.key} className="flex flex-col items-center gap-2 z-10 flex-1">
              <motion.div
                initial={false}
                animate={active ? { scale: [1, 1.15, 1] } : {}}
                transition={{ duration: 1, repeat: Infinity, repeatDelay: 2 }}
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-500
                  ${done  ? "bg-primary border-primary text-white shadow-md shadow-primary/20" : ""}
                  ${active ? "bg-primary border-primary text-white shadow-lg shadow-primary/30 ring-4 ring-primary/15" : ""}
                  ${future ? "bg-white border-black/10 text-black/20" : ""}
                `}
              >
                {done ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  <StepIcon className={`h-4 w-4 ${active ? "animate-pulse" : ""}`} />
                )}
              </motion.div>
              <div className="text-center max-w-[70px]">
                <p className={`text-[10px] font-black leading-tight ${done || active ? "text-black/80" : "text-black/25"}`}>
                  {step.label}
                </p>
                {(done || active) && (
                  <p className="text-[9px] text-black/35 font-bold leading-tight mt-0.5">{step.sublabel}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Delivery driver banner */}
      {order.status === "out_for_delivery" && order.deliveryDriver?.name && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-5 p-4 bg-violet-50 border border-violet-200 rounded-2xl flex items-center gap-4"
        >
          <div className="w-12 h-12 bg-violet-100 rounded-2xl flex items-center justify-center shrink-0">
            <Bike className="h-6 w-6 text-violet-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-violet-500 mb-1">السائق في طريقه إليك الآن</p>
            <p className="font-black text-base text-violet-800">{order.deliveryDriver.name}</p>
          </div>
          {order.deliveryDriver.phone && (
            <a
              href={`tel:${order.deliveryDriver.phone}`}
              className="w-11 h-11 bg-violet-600 hover:bg-violet-700 rounded-2xl flex items-center justify-center text-white transition-colors shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <Phone className="h-5 w-5" />
            </a>
          )}
        </motion.div>
      )}

      {/* Shipped via carrier */}
      {order.status === "shipped" && order.trackingNumber && (
        <div className="mt-5 p-4 bg-purple-50 border border-purple-200 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center shrink-0">
            <Truck className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-purple-500 mb-1">
              {order.shippingProvider || "شركة الشحن"}
            </p>
            <p className="font-black text-base text-purple-800">رقم التتبع: {order.trackingNumber}</p>
          </div>
        </div>
      )}

      {/* Pending payment banner */}
      {order.status === "pending_payment" && (
        <div className="mt-5 p-4 bg-orange-50 border border-orange-200 rounded-2xl flex items-center gap-3">
          <CreditCard className="h-5 w-5 text-orange-500 shrink-0" />
          <p className="text-sm font-bold text-orange-700">جاري مراجعة إيصال التحويل البنكي — ستصلك إشعار فور التأكيد</p>
        </div>
      )}
    </div>
  );
};

// ─── Order Card ─────────────────────────────────────────────────────────────
const OrderCard = ({ order }: { order: any }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [returnDetail, setReturnDetail] = useState("");
  const [returnMethod, setReturnMethod] = useState<"wallet" | "original">("wallet");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const status = statusConfig[order.status] || statusConfig.new;
  const StatusIcon = status.icon;

  const returnMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/returns", data),
    onSuccess: () => {
      toast({ title: "✅ تم إرسال طلب الإرجاع", description: "سيتم مراجعة طلبك خلال 24-48 ساعة" });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      setShowReturnDialog(false);
    },
    onError: (e: any) => {
      toast({ title: "خطأ", description: e.message || "فشل إرسال طلب الإرجاع", variant: "destructive" });
    },
  });

  const handleReturnSubmit = () => {
    if (!returnReason) return toast({ title: "اختر سبب الإرجاع", variant: "destructive" });
    returnMutation.mutate({
      orderId: order.id,
      reason: returnReason,
      reasonDetail: returnDetail,
      refundMethod: returnMethod,
      refundAmount: Number(order.total || 0),
      items: (order.items || []).map((item: any) => ({
        productId: item.productId || "",
        title: item.title || "",
        quantity: item.quantity || 1,
        price: Number(item.price || 0),
      })),
    });
  };

  const canRequestReturn = ["completed", "shipped", "delivered"].includes(order.status);
  const canCancel = ["new", "pending", "pending_payment", "processing", "out_for_delivery"].includes(order.status);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const cancelMutation = useMutation({
    mutationFn: async (reason: string) =>
      apiRequest("POST", `/api/orders/${order.id}/cancel`, { reason }),
    onSuccess: async (res: any) => {
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({
        title: "تم إلغاء الطلب ✅",
        description: data?.refundAmount > 0
          ? `تم استرداد ${Number(data.refundAmount).toFixed(2)} ر.س لمحفظتك`
          : "تم إلغاء طلبك بنجاح",
      });
      setShowCancelDialog(false);
      setCancelReason("");
    },
    onError: async (e: any) => {
      let msg = "تعذر إلغاء الطلب";
      try { const d = await e?.response?.json(); msg = d?.message || msg; } catch {}
      toast({ title: "تعذر الإلغاء", description: msg, variant: "destructive" });
    },
  });
  const returnReasons = [
    "المنتج وصل تالفاً",
    "المنتج لا يطابق الوصف",
    "خطأ في الطلب",
    "حجم غير مناسب",
    "تغيير رأي",
    "سبب آخر",
  ];

  const handlePrintInvoice = () => {
    // Open the server-rendered ZATCA Phase-1 tax invoice in a new tab. The
    // server endpoint produces a fully bilingual A4 layout, embedded TLV QR,
    // and a built-in print button — keeping the source of truth in one place
    // (`server/invoice-html.ts`), shared with the email attachment.
    window.open(`/api/orders/${order.id}/invoice`, "_blank", "noopener,noreferrer");
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <Card className="overflow-hidden border-black/5 hover:border-black/10 transition-all group rounded-[2.5rem] shadow-sm hover:shadow-2xl bg-white mb-6 border">
        <CardContent className="p-0">
          <div className="flex flex-col lg:flex-row">
            {/* Status Side Panel */}
            <div className={`lg:w-52 ${status.bg} p-7 flex flex-col items-center justify-center text-center gap-3 border-b lg:border-b-0 lg:border-l ${status.border} shrink-0`}>
              <motion.div
                whileHover={{ scale: 1.1, rotate: 5 }}
                className={`w-16 h-16 rounded-3xl bg-white shadow-xl flex items-center justify-center ${status.color} border-2 ${status.border}`}
              >
                <StatusIcon className="h-8 w-8" />
              </motion.div>
              <div className="space-y-0.5">
                <span className={`text-[9px] font-black uppercase tracking-widest ${status.color} opacity-40`}>حالة الطلب</span>
                <p className={`font-black text-sm uppercase tracking-tight ${status.color} leading-tight`}>{status.label}</p>
              </div>
              <div className="text-[9px] font-bold text-black/25 bg-white/60 px-3 py-1 rounded-full">
                #{order.id.slice(-6).toUpperCase()}
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 p-7 lg:p-9 space-y-6" dir="rtl">
              {/* Header row */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="bg-black/5 p-3 rounded-2xl">
                    <Calendar className="h-5 w-5 text-black/30" />
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-black/25">تاريخ الطلب</span>
                    <p className="font-bold text-sm text-black/60">
                      {new Date(order.createdAt).toLocaleDateString("ar-SA", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-baseline gap-1">
                    <p className="font-black text-2xl text-primary">{order.total}</p>
                    <span className="text-[10px] font-black text-black/20"><RiyalSign /></span>
                  </div>
                </div>
              </div>

              {/* ── LIVE TRACKING STEPPER ── */}
              <TrackingStepper order={order} />

              {/* Action buttons */}
              <div className="flex flex-wrap gap-3 pt-2 border-t border-black/5">
                <Button
                  variant="outline"
                  onClick={handlePrintInvoice}
                  className="rounded-full px-6 h-11 font-black uppercase tracking-widest text-[10px] border-black/8 hover:bg-black hover:text-white transition-all flex items-center gap-2"
                >
                  <FileText className="h-3.5 w-3.5" />
                  الفاتورة
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setLocation(`/orders/${order.id}`)}
                  className="rounded-full px-6 h-11 font-black uppercase tracking-widest text-[10px] border-black/8 hover:bg-black hover:text-white transition-all flex items-center gap-2"
                >
                  محتويات الطلب
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
                {canRequestReturn && (
                  <Button
                    variant="outline"
                    onClick={() => setShowReturnDialog(true)}
                    className="rounded-full px-6 h-11 font-black uppercase tracking-widest text-[10px] border-amber-200 text-amber-700 hover:bg-amber-50 transition-all flex items-center gap-2"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    طلب إرجاع
                  </Button>
                )}
                {canCancel && (
                  <Button
                    variant="outline"
                    onClick={() => setShowCancelDialog(true)}
                    data-testid={`button-cancel-order-${order.id}`}
                    className="rounded-full px-6 h-11 font-black uppercase tracking-widest text-[10px] border-red-200 text-red-700 hover:bg-red-50 transition-all flex items-center gap-2"
                  >
                    <AlertCircle className="h-3.5 w-3.5" />
                    إلغاء الطلب
                  </Button>
                )}
              </div>

              {/* Cancel Dialog */}
              {showCancelDialog && (
                <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
                  <DialogContent dir="rtl" className="max-w-md">
                    <DialogHeader>
                      <DialogTitle className="font-black text-right flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-500" />
                        إلغاء الطلب — #{order.id.slice(-6).toUpperCase()}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                      <div className="p-3 rounded-xl bg-red-50 border border-red-100">
                        <p className="text-xs font-bold text-red-700">سيتم إلغاء طلبك فوراً</p>
                        {order.paymentStatus === "paid" && (
                          <p className="text-[11px] text-red-600 mt-1">
                            ✓ سيتم استرداد <b>{Number(order.total).toLocaleString()} <RiyalSign /></b> لمحفظتك تلقائياً
                          </p>
                        )}
                        <p className="text-[11px] text-red-600 mt-0.5">
                          ✓ ستُعاد الكمية للمخزون تلقائياً
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold">سبب الإلغاء (اختياري)</Label>
                        <Textarea
                          value={cancelReason}
                          onChange={e => setCancelReason(e.target.value)}
                          data-testid={`input-cancel-reason-${order.id}`}
                          placeholder="مثلاً: غيّرت رأيي، خطأ في الطلب..."
                          className="text-right text-sm resize-none"
                          rows={3}
                        />
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button
                          className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm"
                          onClick={() => cancelMutation.mutate(cancelReason)}
                          disabled={cancelMutation.isPending}
                          data-testid={`button-confirm-cancel-${order.id}`}
                        >
                          {cancelMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "تأكيد الإلغاء"}
                        </Button>
                        <Button variant="outline" className="rounded-xl text-sm" onClick={() => setShowCancelDialog(false)}>
                          تراجع
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}

              {/* Return Dialog */}
              {showReturnDialog && (
                <Dialog open={showReturnDialog} onOpenChange={setShowReturnDialog}>
                  <DialogContent dir="rtl" className="max-w-md">
                    <DialogHeader>
                      <DialogTitle className="font-black text-right flex items-center gap-2">
                        <RotateCcw className="w-4 h-4 text-amber-500" />
                        طلب إرجاع - #{order.id.slice(-6).toUpperCase()}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                      <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
                        <p className="text-xs font-bold text-amber-700">مبلغ الاسترداد المتوقع: {Number(order.total).toLocaleString()} <RiyalSign /></p>
                        <p className="text-[10px] text-amber-600 mt-0.5">سيتم إعادة المبلغ للمحفظة أو وسيلة الدفع الأصلية</p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold">سبب الإرجاع</Label>
                        <Select value={returnReason} onValueChange={setReturnReason}>
                          <SelectTrigger className="text-right text-sm">
                            <SelectValue placeholder="اختر السبب..." />
                          </SelectTrigger>
                          <SelectContent>
                            {returnReasons.map(r => (
                              <SelectItem key={r} value={r}>{r}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold">تفاصيل إضافية (اختياري)</Label>
                        <Textarea
                          value={returnDetail}
                          onChange={e => setReturnDetail(e.target.value)}
                          placeholder="صف المشكلة بالتفصيل..."
                          className="text-right text-sm resize-none"
                          rows={3}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold">طريقة الاسترداد</Label>
                        <Select value={returnMethod} onValueChange={(v: any) => setReturnMethod(v)}>
                          <SelectTrigger className="text-right text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="wallet">محفظة المتجر</SelectItem>
                            <SelectItem value="original">وسيلة الدفع الأصلية</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button
                          className="flex-1 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm"
                          onClick={handleReturnSubmit}
                          disabled={returnMutation.isPending}
                        >
                          {returnMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "إرسال طلب الإرجاع"}
                        </Button>
                        <Button variant="outline" className="rounded-xl text-sm" onClick={() => setShowReturnDialog(false)}>
                          إلغاء
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}

              {/* ── Expanded: Order items ── */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-4 space-y-4">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="h-[2px] w-8 bg-black/10" />
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-black/30">محتويات الشحنة ({(order.items || []).length})</h4>
                      </div>

                      <div className="grid gap-3">
                        {(order.items || []).map((item: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center p-4 bg-black/[0.02] rounded-2xl border border-black/[0.03]">
                            <div className="flex items-center gap-4">
                              {item.image && (
                                <img src={item.image} alt={item.title} className="w-12 h-12 rounded-xl object-cover border border-black/5" />
                              )}
                              <div>
                                <p className="font-black text-sm text-black/80">{item.title}</p>
                                {(item.color || item.size) && (
                                  <p className="text-[10px] font-bold text-black/30 mt-0.5">
                                    {item.color && `اللون: ${item.color}`}{item.color && item.size && " · "}{item.size && `المقاس: ${item.size}`}
                                  </p>
                                )}
                                <p className="text-[10px] font-bold text-black/25 uppercase tracking-widest">{item.variantSku || ""}</p>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="font-black text-base">{(item.price * item.quantity).toFixed(2)}<span className="text-[9px] text-black/20 mr-1"><RiyalSign /></span></p>
                              <p className="text-[10px] text-black/30 font-bold">×{item.quantity}</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Totals */}
                      <div className="bg-black/[0.02] rounded-2xl p-4 space-y-2 border border-black/[0.03]">
                        <div className="flex justify-between text-xs font-bold text-black/40">
                          <span>المجموع الفرعي</span><span>{Number(order.subtotal || 0).toFixed(2)} <RiyalSign /></span>
                        </div>
                        <div className="flex justify-between text-xs font-bold text-black/40">
                          <span>ضريبة القيمة المضافة (15%)</span><span>{Number(order.vatAmount || 0).toFixed(2)} <RiyalSign /></span>
                        </div>
                        {Number(order.shippingCost || 0) > 0 && (
                          <div className="flex justify-between text-xs font-bold text-black/40">
                            <span>رسوم الشحن</span><span>{Number(order.shippingCost).toFixed(2)} <RiyalSign /></span>
                          </div>
                        )}
                        <div className="flex justify-between font-black text-base border-t border-black/8 pt-2 mt-2">
                          <span>الإجمالي</span><span className="text-primary">{Number(order.total || 0).toFixed(2)} <RiyalSign /></span>
                        </div>
                      </div>

                      {/* Shipping address */}
                      {order.shippingAddress && (
                        <div className="flex items-start gap-4 p-4 bg-primary/[0.03] rounded-2xl border border-primary/10">
                          <div className="bg-white p-2.5 rounded-xl shadow-sm text-primary shrink-0">
                            <MapPin className="h-4 w-4" />
                          </div>
                          <div>
                            <h4 className="text-[9px] font-black uppercase tracking-widest text-primary mb-1">عنوان التوصيل</h4>
                            <p className="font-bold text-sm text-black/60 leading-relaxed">
                              {[order.shippingAddress.city, order.shippingAddress.district, order.shippingAddress.street].filter(Boolean).join("، ")}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Status history timeline */}
                      {order.statusHistory && order.statusHistory.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="h-[2px] w-8 bg-black/10" />
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-black/30">سجل تاريخ الطلب</h4>
                          </div>
                          <div className="relative pr-4 space-y-3">
                            <div className="absolute right-[7px] top-2 bottom-2 w-[2px] bg-black/8" />
                            {[...order.statusHistory].reverse().map((entry: any, i: number) => {
                              const s = statusConfig[entry.status] || statusConfig.new;
                              return (
                                <div key={i} className="flex items-start gap-3 relative">
                                  <div className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 mt-0.5 ${i === 0 ? "border-primary bg-primary" : "border-black/15 bg-white"}`} />
                                  <div className="flex-1">
                                    <p className={`text-xs font-black ${i === 0 ? "text-primary" : "text-black/50"}`}>
                                      {s.label}
                                    </p>
                                    {entry.note && <p className="text-[10px] text-black/35 font-bold">{entry.note}</p>}
                                    <p className="text-[9px] text-black/25 font-bold mt-0.5">
                                      {new Date(entry.at).toLocaleString("ar-SA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

// ─── Orders Page ─────────────────────────────────────────────────────────────
export default function Orders() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: orders, isLoading } = useQuery({
    queryKey: [api.orders.my.path],
    queryFn: async () => {
      const res = await fetch(api.orders.my.path);
      if (!res.ok) throw new Error("Failed to fetch orders");
      return await res.json();
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  // ── Handle return-from-gateway non-success query params (?tamara=cancelled|pending|error|notfound)
  // (Successful payments redirect to /orders/:id/success — handled there.)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const tamara = params.get("tamara");
    const tabby = params.get("tabby");
    if (!tamara && !tabby) return;

    const gateway = tamara ? "تمارا" : "تابي";
    const status = tamara || tabby || "";

    const messages: Record<string, { title: string; desc: string; variant?: "default" | "destructive" }> = {
      pending:   { title: `الدفع قيد المراجعة`, desc: `سنحدّث حالة الطلب فور تأكيد ${gateway}.`, variant: "default" },
      cancelled: { title: `تم إلغاء الدفع`, desc: `لم يكتمل الدفع عبر ${gateway}. يمكنك المحاولة مجدداً.`, variant: "destructive" },
      mismatch:  { title: `قيمة الدفع لا تطابق الطلب`, desc: `يرجى التواصل مع الدعم.`, variant: "destructive" },
      error:     { title: `حدث خطأ أثناء التأكيد`, desc: `حاول التحقق من الطلب بعد دقيقة.`, variant: "destructive" },
      notfound:  { title: `الطلب غير موجود`, desc: ``, variant: "destructive" },
    };
    if (status && messages[status]) {
      const m = messages[status];
      toast({ title: m.title, description: m.desc, variant: m.variant });
      queryClient.invalidateQueries({ queryKey: [api.orders.my.path] });
    }

    // Strip the query params from the URL without a navigation.
    const url = new URL(window.location.href);
    ["tamara", "tabby", "paymob", "orderId"].forEach(k => url.searchParams.delete(k));
    window.history.replaceState({}, "", url.pathname + (url.search || ""));
  }, [toast]);

  if (authLoading) return (
    <Layout>
      <div className="container py-24 text-center">
        <Loader2 className="animate-spin mx-auto text-primary h-12 w-12 opacity-20" />
      </div>
    </Layout>
  );

  if (!user) { setLocation("/login"); return null; }

  return (
    <Layout>
      <div className="container py-16 px-4 max-w-5xl mx-auto min-h-[80vh]">
        <header className="mb-14 space-y-4">
          <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} className="space-y-3">
            <h1 className="font-black text-6xl md:text-8xl uppercase tracking-tighter leading-none">طلباتي</h1>
            <div className="flex items-center gap-4 mt-6 mb-6">
              <div className="h-[3px] w-16 bg-primary rounded-full" />
              <p className="text-black/30 font-black text-[11px] uppercase tracking-[0.4em]">RF PERFUME • LIVE TRACKING</p>
            </div>
          </motion.div>
        </header>

        {isLoading ? (
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 w-full bg-black/[0.03] animate-pulse rounded-[3rem]" />
            ))}
          </div>
        ) : !orders || orders.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-32 px-10 bg-black/[0.01] rounded-[4rem] border-2 border-dashed border-black/5"
          >
            <div className="w-32 h-32 bg-white rounded-[2.5rem] flex items-center justify-center mx-auto mb-10 shadow-2xl border border-black/5">
              <ShoppingBag className="h-14 w-14 text-black/10" />
            </div>
            <h2 className="font-black text-4xl mb-4 tracking-tight">صندوق طلباتك فارغ</h2>
            <p className="text-black/30 font-bold text-sm mb-12 uppercase tracking-[0.2em] max-w-sm mx-auto leading-relaxed">
              لم تقم بأي عمليات شراء حتى الآن. اكتشف أحدث صيحات الموضة في متجرنا
            </p>
            <Button
              onClick={() => setLocation("/products")}
              size="lg"
              className="rounded-full px-16 h-16 font-black uppercase tracking-[0.2em] text-xs shadow-2xl hover:shadow-primary/20 active:scale-95 transition-all"
            >
              اكتشف المتجر
            </Button>
          </motion.div>
        ) : (
          <div className="space-y-6">
            {orders.map((order: any) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
