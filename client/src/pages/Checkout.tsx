import { useCart } from "@/hooks/use-cart";
import { useCoupon } from "@/hooks/use-coupon";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef, useMemo } from "react";
import { useLocation, Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  MapPin, Truck, CreditCard, Apple, Lock,
  Check, Wallet, Smartphone, CheckCircle2,
  ShieldCheck, ChevronDown, ChevronUp, Store, Phone, Clock, Package,
  AlertTriangle, Trash2, ArrowLeftRight
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { X, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { AuthModal } from "@/components/AuthModal";
import {
  CardBrandsLogo, STCPayLogo, ApplePayLogo,
  TabbyLogo, TamaraLogo,
} from "@/components/payment/PaymentBrands";
import { STCPayForm } from "@/components/payment/STCPayForm";
import { RiyalSign } from "@/components/RiyalSign";
import { Badge } from "@/components/ui/badge";

const SAUDI_CITIES = [
  "الرياض","جدة","مكة المكرمة","المدينة المنورة","الدمام","الخبر","الطائف","تبوك",
  "بريدة","القطيف","خميس مشيط","حفر الباطن","الجبيل","حائل","نجران","ينبع",
  "الأحساء","المجمعة","عرعر","سكاكا","الباحة","أبها","عنيزة","الخرج","الدوادمي",
  "جيزان","الزلفي","رابغ","الليث","القنفذة","المذنب","الرس","الجموم","ضباء",
  "الوجه","رفحاء","طريف","بلجرشي","القريات","دومة الجندل","شرورة","نجران",
  "بيشة","النماص","محايل عسير","أحد رفيدة","صبيا","صامطة","بقيق","الخفجي",
];

export default function Checkout() {
  const { items, total, clearCart, removeItem } = useCart();
  const { appliedCoupon } = useCoupon();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [paymentMethod, setPaymentMethod] = useState<
    "wallet" | "tap" | "stc_pay" | "apple_pay" | "tabby" | "tamara"
  >("wallet");
  const [tamaraInstallments, setTamaraInstallments] = useState<2 | 3 | 4>(3);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);

  const isAppleDevice = useMemo(() => {
    if (typeof window === "undefined" || typeof navigator === "undefined") return false;
    const ua = navigator.userAgent || "";
    const platform = (navigator as any).platform || "";
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (platform === "MacIntel" && (navigator as any).maxTouchPoints > 1);
    const isMacSafari = /Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|CriOS|FxiOS|Edg|OPR/.test(ua);
    const hasApplePay = typeof (window as any).ApplePaySession !== "undefined";
    return isIOS || isMacSafari || hasApplePay;
  }, []);

  const [paymobSheetOpen, setPaymobSheetOpen] = useState(false);
  const [paymobIframeUrl, setPaymobIframeUrl] = useState<string>("");
  const [paymobOrderIdState, setPaymobOrderIdState] = useState<string>("");
  const [redirectingTo, setRedirectingTo] = useState<null | "tamara" | "tabby">(null);

  const [shippingMode, setShippingMode] = useState<"pickup" | "delivery">("pickup");
  const [pickupBranchId, setPickupBranchId] = useState<string>("");
  const [deliveryCity, setDeliveryCity] = useState("");
  const [deliveryStreet, setDeliveryStreet] = useState("");
  const [deliveryDistrict, setDeliveryDistrict] = useState("");
  const [deliveryName, setDeliveryName] = useState("");
  const [deliveryPhone, setDeliveryPhone] = useState("");
  const [citySearch, setCitySearch] = useState("");
  const [cityDropOpen, setCityDropOpen] = useState(false);
  const [orderNotes, setOrderNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);

  // Auth gating
  const [authOpen, setAuthOpen] = useState(false);
  const [phoneDialogOpen, setPhoneDialogOpen] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");
  const [phoneSaving, setPhoneSaving] = useState(false);
  const userMissingPhone = !!user && !((user as any).phone) && (user as any).role === "customer";

  useEffect(() => {
    if (!user) setAuthOpen(true);
    else {
      setAuthOpen(false);
      if (userMissingPhone) setPhoneDialogOpen(true);
      else setPhoneDialogOpen(false);
    }
  }, [user, userMissingPhone]);

  const savePhone = async () => {
    const cleaned = phoneInput.trim();
    if (!/^0?5\d{8}$/.test(cleaned)) {
      toast({ title: "رقم غير صالح", description: "أدخل رقماً يبدأ بـ 5 أو 05", variant: "destructive" });
      return;
    }
    setPhoneSaving(true);
    try {
      const res = await fetch("/api/user/phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleaned }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "تعذّر حفظ الرقم");
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: "تم حفظ رقم جوالك" });
      setPhoneDialogOpen(false);
      setPhoneInput("");
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally {
      setPhoneSaving(false);
    }
  };

  const { data: branches = [] } = useQuery<any[]>({
    queryKey: ["/api/branches"],
    queryFn: async () => {
      const res = await fetch("/api/branches");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const activeBranches = (branches || []).filter((b: any) => b.isActive !== false && b.isPickupEnabled !== false);
  const selectedBranch = activeBranches.find((b: any) => (b.id || b._id) === pickupBranchId);

  const { data: storeSettings } = useQuery({
    queryKey: ["/api/store/settings"],
    queryFn: async () => {
      const res = await fetch("/api/store/settings");
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
  });

  const { data: loyaltyData } = useQuery<any>({
    queryKey: ["/api/user/loyalty"],
    queryFn: async () => {
      if (!user) return null;
      const res = await fetch("/api/user/loyalty");
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!user,
  });

  const [useLoyaltyPoints, setUseLoyaltyPoints] = useState(false);
  const availableLoyaltyPoints = loyaltyData?.points || 0;
  const loyaltyDiscount = useLoyaltyPoints ? Math.min(availableLoyaltyPoints / 100, 50) : 0;

  const enabledMethods = storeSettings?.paymentMethods || {
    wallet: true, tap: true, stc_pay: true, apple_pay: true,
    tamara: true, tabby: true,
  };

  // ── Shipping rate from Storage Station ──────────────────────────────────────
  const subtotal = total();
  const { data: shippingRateData, isFetching: isLoadingRate } = useQuery<{
    cost: number; zoneName: string; methodTitle: string; isFree: boolean;
  }>({
    queryKey: ["/api/shipping/rate", deliveryCity, subtotal],
    queryFn: async () => {
      if (!deliveryCity) return { cost: 0, zoneName: "", methodTitle: "", isFree: true };
      const res = await fetch(`/api/shipping/rate?city=${encodeURIComponent(deliveryCity)}&total=${subtotal}`);
      if (!res.ok) return { cost: 30, zoneName: "افتراضي", methodTitle: "توصيل", isFree: false };
      return res.json();
    },
    enabled: shippingMode === "delivery" && !!deliveryCity,
    staleTime: 5 * 60 * 1000,
  });

  const shippingCostValue = shippingMode === "delivery" && deliveryCity
    ? (shippingRateData?.cost ?? 0)
    : 0;

  // ── Bundle offer savings ─────────────────────────────────────────────────────
  const bundleCalcKey = items.map(i => `${i.productId}:${i.quantity}:${i.price}`).join("|");
  const { data: bundleResult } = useQuery<{ originalTotal: number; bundleTotal: number; savings: number; applications: any[] }>({
    queryKey: ["/api/bundle-offers/calculate", bundleCalcKey],
    queryFn: async () => {
      if (items.length === 0) return { originalTotal: 0, bundleTotal: 0, savings: 0, applications: [] };
      const res = await fetch("/api/bundle-offers/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map(it => ({
            productId: it.productId,
            quantity: it.quantity,
            price: it.price,
            categoryId: (it as any).categoryId,
          })),
        }),
      });
      if (!res.ok) return { originalTotal: 0, bundleTotal: 0, savings: 0, applications: [] };
      return res.json();
    },
    enabled: items.length > 0,
    staleTime: 30_000,
  });
  const bundleSavings = bundleResult?.savings || 0;

  useEffect(() => {
    if (items.length === 0 && !paymobSheetOpen && !redirectingTo) {
      setLocation("/cart");
    }
  }, [items.length, paymobSheetOpen, redirectingTo, setLocation]);

  const calculateDiscount = () => {
    if (!appliedCoupon) return 0;
    if (appliedCoupon.minOrderAmount && subtotal < appliedCoupon.minOrderAmount) return 0;
    if (appliedCoupon.type === "percentage") return (subtotal * appliedCoupon.value) / 100;
    if (appliedCoupon.type === "cashback") return 0;
    return appliedCoupon.value;
  };

  const calculateCashback = () => {
    if (!appliedCoupon || appliedCoupon.type !== "cashback") return 0;
    const cashbackAmount = (subtotal * appliedCoupon.value) / 100;
    if (appliedCoupon.maxCashback && cashbackAmount > appliedCoupon.maxCashback)
      return appliedCoupon.maxCashback;
    return cashbackAmount;
  };

  const discountAmount = calculateDiscount();
  const cashbackAmount = calculateCashback();
  const vatIncluded = Math.round(subtotal * 15 / 115 * 100) / 100;
  const finalTotal = Math.max(0, subtotal - discountAmount - loyaltyDiscount - bundleSavings + shippingCostValue);

  // Branch stock check
  const branchStockIssues = (() => {
    if (!selectedBranch) return [] as string[];
    const issues: string[] = [];
    const branchInv: any[] = (selectedBranch as any).inventory || [];
    for (const it of items) {
      if (!it.variantSku) continue;
      const rec = branchInv.find((b: any) => b.sku === it.variantSku || b.variantSku === it.variantSku);
      const stock = rec ? Number(rec.stock || 0) : null;
      if (stock !== null && stock < it.quantity) {
        issues.push(`${it.title} — متوفر ${stock} فقط`);
      }
    }
    return issues;
  })();

  const handleCheckout = async () => {
    if (!user) { setAuthOpen(true); return; }
    if (userMissingPhone) { setPhoneDialogOpen(true); return; }
    if (shippingMode === "pickup") {
      if (!pickupBranchId) {
        toast({ title: "اختر الفرع", description: "يرجى اختيار فرع الاستلام", variant: "destructive" });
        return;
      }
      if (branchStockIssues.length > 0) {
        toast({ title: "منتج غير متوفر", description: branchStockIssues[0], variant: "destructive" });
        return;
      }
    } else {
      if (!deliveryCity) {
        toast({ title: "اختر المدينة", description: "يرجى اختيار مدينة التوصيل", variant: "destructive" });
        return;
      }
      if (!deliveryStreet.trim()) {
        toast({ title: "أدخل العنوان", description: "يرجى إدخال اسم الشارع", variant: "destructive" });
        return;
      }
    }
    if (paymentMethod === "wallet" && Number(user.walletBalance) < finalTotal) {
      toast({
        title: "رصيد المحفظة غير كافٍ",
        description: `رصيدك: ${user.walletBalance} ر.س، المطلوب: ${finalTotal.toFixed(2)} ر.س`,
        variant: "destructive",
      });
      return;
    }
    if (paymentMethod === "stc_pay" && !paymentConfirmed) {
      toast({ title: "يجب إتمام التحقق من STC Pay أولاً", variant: "destructive" });
      return;
    }
    await handleFinalCheckout();
  };

  const handleFinalCheckout = async () => {
    setIsSubmitting(true);
    try {
      const NEEDS_GATEWAY = ["tap", "apple_pay", "tabby", "tamara"];
      const requiresGateway = NEEDS_GATEWAY.includes(paymentMethod);

      const isDelivery = shippingMode === "delivery";
      const deliveryAddrStr = isDelivery
        ? [deliveryStreet, deliveryDistrict, deliveryCity].filter(Boolean).join("، ")
        : `استلام من فرع: ${selectedBranch?.name || ""}`;

      const orderData: any = {
        userId: user!.id,
        total: finalTotal.toFixed(2),
        subtotal: subtotal.toFixed(2),
        vatAmount: vatIncluded.toFixed(2),
        shippingCost: shippingCostValue.toFixed(2),
        shippingCompany: isDelivery ? (shippingRateData?.methodTitle || "توصيل") : "",
        deliveryAddress: deliveryAddrStr,
        customerName: user?.name || "",
        customerPhone: (user as any)?.phone || "",
        notes: orderNotes || undefined,
        discountAmount: discountAmount.toFixed(2),
        cashbackAmount: cashbackAmount.toFixed(2),
        couponCode: appliedCoupon?.code || undefined,
        tapCommission: "0",
        netProfit: (finalTotal - items.reduce((acc, i) => acc + (i.cost || 0) * i.quantity, 0)).toFixed(2),
        items: items.map((item) => ({
          productId: item.productId,
          variantSku: item.variantSku,
          quantity: item.quantity,
          price: item.price,
          cost: item.cost || 0,
          title: item.title,
        })),
        shippingMethod: isDelivery ? "delivery" : "pickup",
        pickupBranch: isDelivery ? undefined : pickupBranchId,
        shippingAddress: isDelivery ? {
          city: deliveryCity,
          street: deliveryStreet,
          district: deliveryDistrict,
          country: "SA",
        } : undefined,
        paymentMethod,
        status: requiresGateway ? "pending_payment" : "new",
        paymentStatus: paymentMethod === "wallet" ? "paid" : "pending",
      };

      const res = await apiRequest("POST", "/api/orders", orderData);
      const order = await res.json();

      const cancelPendingOrder = async (reason: string) => {
        try {
          await apiRequest("POST", `/api/orders/${order.id}/cancel`, {
            reason: `gateway_init_failed: ${reason}`.slice(0, 200),
          });
        } catch (err) { console.warn("[Checkout] cancel pending order failed:", err); }
      };

      if (paymentMethod === "tap" || paymentMethod === "apple_pay") {
        try {
          const paymobRes = await fetch("/api/paymob/initiate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              orderId: order.id || order._id,
              amount: finalTotal,
              items: items.map(i => ({ title: i.title, price: i.price, quantity: i.quantity })),
              address: isDelivery ? deliveryAddrStr : `استلام من فرع: ${selectedBranch?.name || ""}`,
              city: isDelivery ? deliveryCity : (selectedBranch?.city || "الرياض"),
            }),
          });
          const paymobData = await paymobRes.json();
          if (paymobData.success && paymobData.iframeUrl) {
            setPaymobIframeUrl(paymobData.iframeUrl);
            setPaymobOrderIdState(String(order.id || order._id));
            setPaymobSheetOpen(true);
            setIsSubmitting(false);
            return;
          } else {
            await cancelPendingOrder(paymobData.error || "paymob_no_url");
            toast({
              title: "تعذّر فتح بوابة الدفع",
              description: paymobData.error || "Paymob لم ترجع رابط دفع",
              variant: "destructive",
              duration: 8000,
            });
            setIsSubmitting(false);
            return;
          }
        } catch (e: any) {
          await cancelPendingOrder(e?.message || "network");
          toast({ title: "خطأ في الاتصال ببوابة الدفع", description: e.message, variant: "destructive", duration: 8000 });
          setIsSubmitting(false);
          return;
        }
      }

      if (paymentMethod === "tamara") {
        const tamaraRes = await apiRequest("POST", "/api/payments/tamara/checkout", {
          orderId: order.id, amount: finalTotal,
          customer: { name: user?.name || "", phone: (user as any)?.phone || "", email: user?.email || "" },
          installments: tamaraInstallments,
        });
        const tamaraData = await tamaraRes.json();
        if (tamaraData.checkoutUrl) {
          clearCart();
          setRedirectingTo("tamara");
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              if (/^https?:\/\//i.test(tamaraData.checkoutUrl)) {
                window.location.href = tamaraData.checkoutUrl;
              } else {
                setLocation(tamaraData.checkoutUrl + `&orderId=${order.id}`);
              }
            });
          });
          return;
        }
        await cancelPendingOrder(tamaraData.error || "tamara_no_url");
        toast({ title: "تمارا", description: tamaraData.error || "تمارا لم تستجب", variant: "destructive", duration: 8000 });
        setIsSubmitting(false);
        return;
      }

      if (paymentMethod === "tabby") {
        const tabbyRes = await apiRequest("POST", "/api/payments/tabby/checkout", {
          orderId: order.id,
          amount: finalTotal,
          customer: { name: user?.name || "", phone: (user as any)?.phone || "", email: user?.email || "" },
          items: items.map((it: any) => ({
            title: it.title || "Perfume",
            quantity: it.quantity || 1,
            price: Number(it.price) || 0,
            sku: it.variantSku || it.productId,
          })),
          shipping: { city: isDelivery ? deliveryCity : (selectedBranch?.city || "الرياض"), address: isDelivery ? deliveryAddrStr : (selectedBranch?.name || ""), zip: "" },
        });
        const tabbyData = await tabbyRes.json();
        if (tabbyData.checkoutUrl) {
          clearCart();
          setRedirectingTo("tabby");
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              if (/^https?:\/\//i.test(tabbyData.checkoutUrl)) {
                window.location.href = tabbyData.checkoutUrl;
              } else {
                setLocation(tabbyData.checkoutUrl + `&orderId=${order.id}`);
              }
            });
          });
          return;
        }
        await cancelPendingOrder(tabbyData.error || tabbyData.rejectionReason || "tabby_no_url");
        toast({ title: "تابي", description: tabbyData.error || "تابي لم تستجب", variant: "destructive", duration: 8000 });
        setIsSubmitting(false);
        return;
      }

      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      clearCart();
      let toastMsg = shippingMode === "delivery"
        ? "سيتم التواصل معك لتأكيد موعد التوصيل"
        : "سيتم إشعارك عند جاهزية طلبك للاستلام";
      if (cashbackAmount > 0) toastMsg = `تم إضافة ${cashbackAmount} ر.س كاش باك! ${toastMsg}`;
      toast({ title: "تم استلام طلبك بنجاح ✓", description: toastMsg });
      setLocation("/orders");
    } catch (error: any) {
      toast({ title: "خطأ في إتمام الطلب", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Paymob sheet polling (kept for fallback)
  const paymobCompletedRef = useRef(false);
  useEffect(() => {
    if (!paymobSheetOpen || !paymobOrderIdState) return;
    paymobCompletedRef.current = false;
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const verifyOrder = async (): Promise<"paid" | "failed" | "pending"> => {
      try {
        const r = await fetch(`/api/orders/${paymobOrderIdState}`, { credentials: "include" });
        if (!r.ok) return "pending";
        const o = await r.json();
        const ps = String(o?.paymentStatus || "").toLowerCase();
        const st = String(o?.status || "").toLowerCase();
        if (ps === "paid" || ps === "captured" || ps === "completed") return "paid";
        if (st === "cancelled" || ps === "failed" || ps === "refunded") return "failed";
        return "pending";
      } catch { return "pending"; }
    };

    const finish = (paid: boolean) => {
      if (cancelled || paymobCompletedRef.current) return;
      paymobCompletedRef.current = true;
      cancelled = true;
      if (intervalId) { clearInterval(intervalId); intervalId = null; }
      setPaymobSheetOpen(false);
      if (paid) {
        clearCart();
        setLocation(`/orders/${paymobOrderIdState}/success?paid=paymob`);
      } else {
        toast({
          title: "رُفض الدفع",
          description: "لم تكتمل عملية الدفع. يمكنك المحاولة مرة أخرى.",
          variant: "destructive",
          duration: 6000,
        });
      }
    };

    const ALLOWED_ORIGINS = ["https://accept.paymob.com", "https://ksa.paymob.com"];
    const onMessage = async (ev: MessageEvent) => {
      if (!ALLOWED_ORIGINS.includes(ev.origin)) return;
      const d = ev?.data;
      const looksLikeSuccessHint = d && ((typeof d === "object" && (d.success === true || d?.txn_response_code === "APPROVED")) || (typeof d === "string" && /success|approved|paid/i.test(d)));
      if (!looksLikeSuccessHint) return;
      const status = await verifyOrder();
      if (status === "paid") finish(true);
    };
    window.addEventListener("message", onMessage);

    const tick = async () => {
      const status = await verifyOrder();
      if (status === "paid") return finish(true);
      if (status === "failed") return finish(false);
    };
    intervalId = setInterval(tick, 2500);
    tick();

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      window.removeEventListener("message", onMessage);
    };
  }, [paymobSheetOpen, paymobOrderIdState, setLocation]);

  if (items.length === 0 && !paymobSheetOpen && !redirectingTo) return null;

  const CtaButton = () => (
    <Button
      onClick={handleCheckout}
      disabled={isSubmitting || (paymentMethod === "stc_pay" && !paymentConfirmed)}
      data-testid="button-confirm-order"
      className="w-full h-14 rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-primary/20 disabled:opacity-50 active:scale-95 transition-all"
    >
      {isSubmitting ? (
        <span className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          جاري المعالجة...
        </span>
      ) : (
        <span className="flex items-center justify-center gap-2">
          تأكيد الطلب
          <span className="opacity-80 font-bold text-xs">— {finalTotal.toLocaleString()} <RiyalSign /></span>
        </span>
      )}
    </Button>
  );

  return (
    <div className="min-h-screen bg-[#f7f6f3]" dir="rtl">

      {/* ── Header ── */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <Link href="/">
            <span className="font-black text-lg tracking-tight cursor-pointer">RF PERFUME</span>
          </Link>
          <div className="flex items-center gap-1.5 text-xs font-bold text-green-600">
            <ShieldCheck className="h-4 w-4" />
            <span className="hidden sm:block">دفع آمن ومشفّر</span>
            <span className="sm:hidden">دفع آمن</span>
          </div>
        </div>
      </header>

      {/* ── Mobile order summary toggle ── */}
      <div className="lg:hidden bg-white border-b border-gray-100">
        <button
          onClick={() => setSummaryOpen(v => !v)}
          className="w-full px-4 py-3 flex items-center justify-between gap-3 text-sm font-bold"
          data-testid="button-toggle-summary"
        >
          <div className="flex items-center gap-2 text-primary">
            <Package className="h-4 w-4" />
            <span>{summaryOpen ? "إخفاء ملخص الطلب" : "عرض ملخص الطلب"}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-black text-base">{finalTotal.toLocaleString()} <RiyalSign /></span>
            {summaryOpen ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
          </div>
        </button>
        {summaryOpen && (
          <div className="px-4 pb-4 border-t border-gray-50 space-y-3 pt-3">
            {items.map((item) => (
              <div key={item.variantSku} className="flex gap-3 items-center">
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 shrink-0 border border-gray-100">
                  <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-xs truncate">{item.title}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{item.quantity}× · {item.color} · {item.size}</p>
                </div>
                <p className="font-black text-sm shrink-0">{(item.price * item.quantity).toLocaleString()} <RiyalSign /></p>
              </div>
            ))}
            <div className="pt-2 border-t border-gray-100 space-y-1 text-xs font-bold">
              <div className="flex justify-between text-gray-500">
                <span>{subtotal.toLocaleString()} <RiyalSign /></span>
                <span>المجموع الفرعي</span>
              </div>
              {bundleSavings > 0 && (
                <div className="flex justify-between text-purple-600 font-black">
                  <span>-{bundleSavings.toLocaleString()} <RiyalSign /></span>
                  <span>عرض الباقة 🎁</span>
                </div>
              )}
              {discountAmount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>-{discountAmount.toLocaleString()} <RiyalSign /></span>
                  <span>الخصم</span>
                </div>
              )}
              <div className="flex justify-between font-black text-sm pt-1 border-t border-gray-100">
                <span className="text-primary">{finalTotal.toLocaleString()} <RiyalSign /></span>
                <span>الإجمالي</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="max-w-5xl mx-auto px-4 py-5 sm:py-7">
        <div className="grid lg:grid-cols-[1fr_340px] gap-5 items-start">

          {/* ── Left: Steps ── */}
          <div className="space-y-4">

            {/* Contact info */}
            {user && (
              <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-gray-100">
                <h2 className="font-black text-sm text-gray-400 uppercase tracking-widest mb-3">معلومات التواصل</h2>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="font-black text-primary text-sm">{(user.name || "م").charAt(0)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-sm truncate">{user.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{(user as any).phone || user.email}</p>
                  </div>
                  <Link href="/profile">
                    <button className="text-[11px] font-black text-primary hover:underline shrink-0">تعديل</button>
                  </Link>
                </div>
              </div>
            )}

            {/* ── Shipping mode toggle ── */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-gray-100">
              <h2 className="font-black text-sm mb-3">
                <span className="inline-flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-black flex items-center justify-center">١</span>
                  طريقة الاستلام
                </span>
              </h2>
              <div className="grid grid-cols-2 gap-2 mb-4">
                <button
                  type="button"
                  data-testid="option-shipping-pickup"
                  onClick={() => setShippingMode("pickup")}
                  className={`flex items-center gap-2 justify-center p-3 rounded-xl border-2 font-black text-sm transition-all ${
                    shippingMode === "pickup"
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  <Store className="h-4 w-4 shrink-0" />
                  <span>استلام من فرع</span>
                </button>
                <button
                  type="button"
                  data-testid="option-shipping-delivery"
                  onClick={() => setShippingMode("delivery")}
                  className={`flex items-center gap-2 justify-center p-3 rounded-xl border-2 font-black text-sm transition-all ${
                    shippingMode === "delivery"
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  <Truck className="h-4 w-4 shrink-0" />
                  <span>توصيل للمنزل</span>
                </button>
              </div>

              {/* ── Pickup: branch list ── */}
              {shippingMode === "pickup" && (
                <>
                  <p className="text-[11px] text-gray-400 font-bold mb-3">استلام مجاني من الفرع — بدون رسوم شحن</p>
                  {activeBranches.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <Store className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm font-bold">لا توجد فروع متاحة حالياً</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {activeBranches.map((br: any) => {
                        const id = br.id || br._id;
                        const isSelected = pickupBranchId === id;
                        const branchInv: any[] = (br as any).inventory || [];
                        const itemsAvail = items.map((it) => {
                          const rec = branchInv.find((b: any) => b.sku === it.variantSku || b.variantSku === it.variantSku);
                          const stock = rec ? Number(rec.stock || 0) : null;
                          return { item: it, stock, available: stock === null || stock >= it.quantity };
                        });
                        const allAvail = itemsAvail.every(x => x.available);
                        const noneAvail = itemsAvail.every(x => !x.available);
                        return (
                          <div
                            key={id}
                            onClick={() => !noneAvail && setPickupBranchId(id)}
                            data-testid={`option-branch-${id}`}
                            className={`border-2 rounded-xl cursor-pointer transition-all overflow-hidden ${
                              isSelected ? "border-primary shadow-sm" : "border-gray-200 hover:border-gray-300"
                            } ${noneAvail ? "opacity-50 cursor-not-allowed" : ""}`}
                          >
                            {br.image && (
                              <div className="w-full h-28 overflow-hidden">
                                <img src={br.image} alt={br.name} className="w-full h-full object-cover" />
                              </div>
                            )}
                            <div className={`p-3.5 sm:p-4 ${isSelected ? "bg-primary/5" : ""}`}>
                              <div className="flex items-start gap-3">
                                <div className={`mt-0.5 w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${
                                  isSelected ? "border-primary bg-primary" : "border-gray-300"
                                }`}>
                                  {isSelected && <Check className="h-3 w-3 text-white" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2 flex-wrap">
                                    <p className="font-black text-sm">{br.name}</p>
                                    {allAvail ? (
                                      <span className="text-[10px] font-black bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                                        <CheckCircle2 className="h-3 w-3" /> متوفر
                                      </span>
                                    ) : noneAvail ? (
                                      <span className="text-[10px] font-black bg-red-50 text-red-600 px-2 py-0.5 rounded-full shrink-0">نفد المخزون</span>
                                    ) : (
                                      <span className="text-[10px] font-black bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full shrink-0">⚠ متوفر جزئياً</span>
                                    )}
                                  </div>
                                  {(br.address || br.city) && (
                                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                      <MapPin className="h-3 w-3 shrink-0" /> {br.address || br.city}
                                    </p>
                                  )}
                                  {(br.hours || br.pickupHours) && (
                                    <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                                      <Clock className="h-3 w-3 shrink-0" /> {br.pickupHours || br.hours}
                                    </p>
                                  )}
                                  {br.phone && (
                                    <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1" dir="ltr">
                                      <Phone className="h-3 w-3 shrink-0" />{br.phone}
                                    </p>
                                  )}
                                  {!allAvail && !noneAvail && isSelected && (
                                    <div className="mt-2 pt-2 border-t border-amber-200 space-y-1">
                                      {itemsAvail.filter(x => !x.available).map((x, i) => (
                                        <p key={i} className="text-[11px] text-amber-700 font-bold">• {x.item.title} — متوفر {x.stock ?? 0} فقط</p>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {branchStockIssues.length > 0 && (
                    <div className="mt-3 bg-red-50 border-2 border-red-200 rounded-2xl overflow-hidden">
                      <div className="p-3 flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-black text-red-700 mb-1">منتجات غير متوفرة في هذا الفرع:</p>
                          <ul className="text-[11px] text-red-600 font-bold space-y-0.5 mb-3">
                            {branchStockIssues.map((m, i) => <li key={i}>• {m}</li>)}
                          </ul>
                          <p className="text-[11px] text-red-600 font-bold mb-2">اختر أحد الخيارات التالية:</p>
                          <div className="space-y-2">
                            <button
                              type="button"
                              data-testid="button-remove-unavailable"
                              onClick={() => {
                                const branchInv: any[] = (selectedBranch as any)?.inventory || [];
                                items.forEach(it => {
                                  if (!it.variantSku) return;
                                  const rec = branchInv.find((b: any) => b.sku === it.variantSku || b.variantSku === it.variantSku);
                                  const stock = rec ? Number(rec.stock || 0) : null;
                                  if (stock !== null && stock < it.quantity) {
                                    removeItem(it.productId, it.variantSku);
                                  }
                                });
                                toast({ title: "تم حذف المنتجات غير المتوفرة من السلة" });
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-red-100 border border-red-300 text-red-700 text-xs font-black hover:bg-red-200 transition-colors text-right"
                            >
                              <Trash2 className="h-3.5 w-3.5 shrink-0" />
                              حذف المنتجات غير المتوفرة واكمال الطلب
                            </button>
                            <button
                              type="button"
                              data-testid="button-switch-to-delivery"
                              onClick={() => {
                                setShippingMode("delivery");
                                setPickupBranchId("");
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-xs font-black hover:bg-blue-100 transition-colors text-right"
                            >
                              <Truck className="h-3.5 w-3.5 shrink-0" />
                              التبديل إلى التوصيل للمنزل
                            </button>
                            <button
                              type="button"
                              data-testid="button-change-branch"
                              onClick={() => setPickupBranchId("")}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-red-200 text-gray-600 text-xs font-black hover:bg-gray-50 transition-colors text-right"
                            >
                              <ArrowLeftRight className="h-3.5 w-3.5 shrink-0" />
                              اختيار فرع آخر
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ── Delivery: address form ── */}
              {shippingMode === "delivery" && (
                <div className="space-y-3">
                  {/* City selector */}
                  <div className="relative">
                    <label className="text-[11px] font-black text-gray-500 mb-1 block">المدينة *</label>
                    <button
                      type="button"
                      data-testid="select-delivery-city"
                      onClick={() => setCityDropOpen(v => !v)}
                      className={`w-full h-11 px-3 border-2 rounded-xl text-sm font-bold text-right flex items-center justify-between transition-all ${
                        deliveryCity ? "border-primary/40 bg-primary/5" : "border-gray-200"
                      }`}
                    >
                      <span className={deliveryCity ? "text-gray-900" : "text-gray-400"}>
                        {deliveryCity || "اختر المدينة..."}
                      </span>
                      <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${cityDropOpen ? "rotate-180" : ""}`} />
                    </button>
                    {cityDropOpen && (
                      <div className="absolute z-20 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                        <div className="p-2 border-b border-gray-100">
                          <Input
                            placeholder="ابحث عن مدينة..."
                            value={citySearch}
                            onChange={(e) => setCitySearch(e.target.value)}
                            className="h-9 text-sm border-gray-200 rounded-lg"
                            autoFocus
                          />
                        </div>
                        <div className="max-h-52 overflow-y-auto">
                          {SAUDI_CITIES
                            .filter(c => !citySearch || c.includes(citySearch))
                            .map(city => (
                              <button
                                key={city}
                                type="button"
                                data-testid={`city-option-${city}`}
                                onClick={() => {
                                  setDeliveryCity(city);
                                  setCityDropOpen(false);
                                  setCitySearch("");
                                }}
                                className={`w-full text-right px-4 py-2.5 text-sm font-bold hover:bg-gray-50 transition-colors ${
                                  deliveryCity === city ? "bg-primary/5 text-primary" : ""
                                }`}
                              >
                                {city}
                              </button>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Street */}
                  <div>
                    <label className="text-[11px] font-black text-gray-500 mb-1 block">الشارع *</label>
                    <Input
                      placeholder="اسم الشارع أو رقم المبنى..."
                      value={deliveryStreet}
                      onChange={(e) => setDeliveryStreet(e.target.value)}
                      className="h-11 border-gray-200 rounded-xl focus-visible:ring-primary/30"
                      data-testid="input-delivery-street"
                    />
                  </div>

                  {/* District */}
                  <div>
                    <label className="text-[11px] font-black text-gray-500 mb-1 block">الحي (اختياري)</label>
                    <Input
                      placeholder="اسم الحي..."
                      value={deliveryDistrict}
                      onChange={(e) => setDeliveryDistrict(e.target.value)}
                      className="h-11 border-gray-200 rounded-xl focus-visible:ring-primary/30"
                      data-testid="input-delivery-district"
                    />
                  </div>

                  {/* Shipping rate display */}
                  {deliveryCity && (
                    <div className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all ${
                      shippingRateData?.isFree ? "border-emerald-200 bg-emerald-50" : "border-blue-100 bg-blue-50"
                    }`}>
                      <div className="flex items-center gap-2">
                        <Truck className={`h-4 w-4 ${shippingRateData?.isFree ? "text-emerald-600" : "text-blue-600"}`} />
                        <div>
                          <p className={`text-xs font-black ${shippingRateData?.isFree ? "text-emerald-700" : "text-blue-700"}`}>
                            {shippingRateData?.methodTitle || "التوصيل"}
                          </p>
                          {shippingRateData?.zoneName && (
                            <p className="text-[10px] text-gray-400 font-bold">{shippingRateData.zoneName}</p>
                          )}
                        </div>
                      </div>
                      {isLoadingRate ? (
                        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                      ) : (
                        <span className={`font-black text-sm ${shippingRateData?.isFree ? "text-emerald-600" : "text-blue-700"}`}>
                          {shippingRateData?.isFree ? "مجاني" : `${shippingRateData?.cost?.toLocaleString() ?? 0} ر.س`}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-gray-100">
              <h2 className="font-black text-sm mb-3">
                <span className="inline-flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-black flex items-center justify-center">٢</span>
                  ملاحظات (اختياري)
                </span>
              </h2>
              <Input
                placeholder="أي ملاحظات تريد إرسالها مع طلبك..."
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                className="h-11 border-gray-200 rounded-xl focus-visible:ring-primary/30"
                data-testid="input-order-notes"
              />
            </div>

            {/* Payment method */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-gray-100">
              <h2 className="font-black text-sm mb-4">
                <span className="inline-flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-black flex items-center justify-center">٣</span>
                  طريقة الدفع
                </span>
              </h2>

              <RadioGroup
                value={paymentMethod}
                onValueChange={(v) => { setPaymentMethod(v as any); setPaymentConfirmed(false); }}
                className="space-y-2.5"
              >
                {/* Wallet */}
                {enabledMethods.wallet !== false && (
                  <label htmlFor="pay-wallet" className={`flex items-center gap-3 p-3.5 border-2 rounded-xl cursor-pointer transition-all ${paymentMethod === "wallet" ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300"}`}>
                    <RadioGroupItem value="wallet" id="pay-wallet" className="shrink-0" />
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${paymentMethod === "wallet" ? "bg-primary/10" : "bg-gray-100"}`}>
                      <Wallet className={`h-5 w-5 ${paymentMethod === "wallet" ? "text-primary" : "text-gray-500"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-sm">رصيد المحفظة</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">رصيدك: <span className="font-black text-gray-700">{user?.walletBalance || 0} <RiyalSign /></span></p>
                    </div>
                  </label>
                )}

                {/* Card (Paymob) */}
                {enabledMethods.tap !== false && (
                  <label htmlFor="pay-tap" className={`flex items-center gap-3 p-3.5 border-2 rounded-xl cursor-pointer transition-all ${paymentMethod === "tap" ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300"}`}>
                    <RadioGroupItem value="tap" id="pay-tap" className="shrink-0" />
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${paymentMethod === "tap" ? "bg-primary/10" : "bg-gray-100"}`}>
                      <CreditCard className={`h-5 w-5 ${paymentMethod === "tap" ? "text-primary" : "text-gray-500"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-sm">بطاقة بنكية</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">مدى · فيزا · ماستركارد</p>
                    </div>
                    <CardBrandsLogo className="h-5 shrink-0 opacity-70" />
                  </label>
                )}

                {/* Apple Pay */}
                {enabledMethods.apple_pay !== false && isAppleDevice && (
                  <label htmlFor="pay-apple" className={`flex items-center gap-3 p-3.5 border-2 rounded-xl cursor-pointer transition-all ${paymentMethod === "apple_pay" ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300"}`}>
                    <RadioGroupItem value="apple_pay" id="pay-apple" className="shrink-0" />
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${paymentMethod === "apple_pay" ? "bg-black" : "bg-gray-900"}`}>
                      <Apple className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="font-black text-sm">توجيه (Apple Pay)</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">دفع سريع وآمن</p>
                    </div>
                  </label>
                )}

                {/* STC Pay */}
                {enabledMethods.stc_pay !== false && (
                  <div className={`border-2 rounded-xl transition-all ${paymentMethod === "stc_pay" ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300"}`}>
                    <label htmlFor="pay-stc" className="flex items-center gap-3 p-3.5 cursor-pointer">
                      <RadioGroupItem value="stc_pay" id="pay-stc" className="shrink-0" />
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${paymentMethod === "stc_pay" ? "bg-primary/10" : "bg-gray-100"}`}>
                        <Smartphone className={`h-5 w-5 ${paymentMethod === "stc_pay" ? "text-primary" : "text-gray-500"}`} />
                      </div>
                      <div className="flex-1">
                        <p className="font-black text-sm">STC Pay</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">دفع بمحفظة STC</p>
                      </div>
                      <STCPayLogo className="h-6 shrink-0 opacity-80" />
                    </label>
                    {paymentMethod === "stc_pay" && (
                      <div className="px-4 pb-4">
                        <STCPayForm
                          orderId=""
                          amount={finalTotal}
                          onSuccess={() => setPaymentConfirmed(true)}
                          onError={(msg) => toast({ title: "STC Pay", description: msg, variant: "destructive" })}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Tabby */}
                {enabledMethods.tabby !== false && (
                  <div className={`border-2 rounded-xl transition-all ${paymentMethod === "tabby" ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300"}`}>
                    <label htmlFor="pay-tabby" className="flex items-center gap-3 p-3.5 cursor-pointer">
                      <RadioGroupItem value="tabby" id="pay-tabby" className="shrink-0" />
                      <TabbyLogo className="h-7 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-sm">Tabby — قسّمها على 4</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">بدون فوائد · بدون رسوم</p>
                      </div>
                      <Badge className="text-[10px] bg-[#3eb489] text-white border-0 font-black shrink-0">٤ أقساط</Badge>
                    </label>
                    {paymentMethod === "tabby" && finalTotal > 0 && (
                      <div className="px-4 pb-4 -mt-1">
                        <div className="bg-white rounded-xl border border-[#3eb489]/20 p-3">
                          <p className="text-[10px] font-black text-[#3eb489] mb-2">خطة السداد</p>
                          <div className="grid grid-cols-4 gap-1.5">
                            {[0,1,2,3].map((i) => (
                              <div key={i} className={`rounded-lg p-2 text-center ${i===0 ? "bg-[#3eb489] text-white" : "bg-[#3eb489]/8 text-gray-700 border border-gray-100"}`}>
                                <p className={`text-[9px] font-black ${i===0 ? "opacity-90" : "opacity-50"}`}>{i===0 ? "الآن" : `الشهر ${i+1}`}</p>
                                <p className="font-black text-xs mt-0.5">{(finalTotal/4).toFixed(0)}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Tamara */}
                {enabledMethods.tamara !== false && (
                  <div className={`border-2 rounded-xl transition-all ${paymentMethod === "tamara" ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300"}`}>
                    <label htmlFor="pay-tamara" className="flex items-center gap-3 p-3.5 cursor-pointer">
                      <RadioGroupItem value="tamara" id="pay-tamara" className="shrink-0" />
                      <TamaraLogo className="h-7 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-sm">Tamara — قسّمها على {tamaraInstallments}</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">بدون فوائد · موافقة فورية</p>
                      </div>
                      <Badge className="text-[10px] bg-[#fff6e5] text-[#b76e00] border-0 font-black shrink-0">{tamaraInstallments} أقساط</Badge>
                    </label>
                    {paymentMethod === "tamara" && finalTotal > 0 && (
                      <div className="px-4 pb-4 -mt-1 space-y-2">
                        <div className="grid grid-cols-3 gap-1.5">
                          {([2, 3, 4] as const).map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setTamaraInstallments(n)}
                              data-testid={`button-tamara-${n}`}
                              className={`rounded-xl py-2 text-center border-2 transition-all ${tamaraInstallments === n ? "border-[#b76e00] bg-[#fff6e5] text-[#b76e00]" : "border-gray-200 bg-white text-gray-500"}`}
                            >
                              <p className="font-black text-base">{n}</p>
                              <p className="text-[9px] font-black uppercase opacity-80">دفعات</p>
                            </button>
                          ))}
                        </div>
                        <div className="bg-white rounded-xl border border-[#b76e00]/15 p-3">
                          <p className="text-[10px] font-black text-[#b76e00] mb-2">خطة السداد</p>
                          <div className={`grid gap-1.5 ${tamaraInstallments === 2 ? "grid-cols-2" : tamaraInstallments === 3 ? "grid-cols-3" : "grid-cols-4"}`}>
                            {Array.from({ length: tamaraInstallments }).map((_, i) => (
                              <div key={i} className={`rounded-lg p-2 text-center ${i===0 ? "bg-[#b76e00] text-white" : "bg-[#fff6e5] text-gray-700"}`}>
                                <p className={`text-[9px] font-black ${i===0 ? "opacity-90" : "opacity-50"}`}>{i===0 ? "الآن" : `الشهر ${i+1}`}</p>
                                <p className="font-black text-xs mt-0.5">{(finalTotal/tamaraInstallments).toFixed(0)}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

              </RadioGroup>

              {/* Security badge */}
              <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-gray-400 font-bold">
                <Lock className="h-3.5 w-3.5" />
                <span>دفع آمن ومشفّر بالكامل</span>
              </div>
            </div>

            {/* Mobile CTA */}
            <div className="lg:hidden pb-4">
              <CtaButton />
            </div>
          </div>

          {/* ── Right: Summary (desktop only) ── */}
          <div className="hidden lg:block lg:sticky lg:top-20">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-5 border-b border-gray-50">
                <h3 className="font-black text-sm">ملخص الطلب</h3>
                <p className="text-xs text-gray-400 font-bold mt-0.5">{items.length} {items.length === 1 ? "منتج" : "منتجات"}</p>
              </div>

              <div className="p-5 space-y-3 max-h-[260px] overflow-y-auto border-b border-gray-50">
                {items.map((item) => (
                  <div key={item.variantSku} className="flex gap-3 items-center">
                    <div className="w-13 h-13 w-12 h-12 rounded-xl overflow-hidden bg-gray-100 shrink-0 border border-gray-100">
                      <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-xs leading-tight truncate">{item.title}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5 truncate">{item.quantity}× · {item.color} · {item.size}</p>
                    </div>
                    <p className="font-black text-xs shrink-0 text-gray-600">{(item.price * item.quantity).toLocaleString()} <RiyalSign /></p>
                  </div>
                ))}
              </div>

              <div className="p-5 space-y-2 border-b border-gray-50 text-xs font-bold">
                <div className="flex justify-between text-gray-500">
                  <span>{subtotal.toLocaleString()} <RiyalSign /></span>
                  <span>المجموع الفرعي</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>{vatIncluded.toLocaleString()} <RiyalSign /></span>
                  <span>ضريبة ١٥٪ (مشمولة)</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  {shippingMode === "pickup" ? (
                    <span className="text-emerald-600 font-black">مجاني</span>
                  ) : isLoadingRate && deliveryCity ? (
                    <span className="flex items-center gap-1 text-gray-400"><Loader2 className="h-3 w-3 animate-spin" /> جاري الحساب...</span>
                  ) : shippingCostValue === 0 && deliveryCity ? (
                    <span className="text-emerald-600 font-black">مجاني</span>
                  ) : deliveryCity ? (
                    <span className="font-black text-gray-700">{shippingCostValue.toLocaleString()} ر.س</span>
                  ) : (
                    <span className="text-gray-400">اختر المدينة</span>
                  )}
                  <span>الشحن</span>
                </div>
                {bundleSavings > 0 && (
                  <div className="flex justify-between text-purple-600 font-black" data-testid="row-bundle-savings">
                    <span>-{bundleSavings.toLocaleString()} <RiyalSign /></span>
                    <span>عرض الباقة 🎁</span>
                  </div>
                )}
                {bundleResult?.applications && bundleResult.applications.length > 0 && (
                  <div className="bg-purple-50 rounded-lg px-2.5 py-1.5 text-[10px] text-purple-700 font-bold space-y-0.5">
                    {bundleResult.applications.map((a: any, i: number) => (
                      <p key={i}>{a.offerTitle || `${a.tierQuantity} قطع`} — وفّرت {a.savings?.toLocaleString()} <RiyalSign /></p>
                    ))}
                  </div>
                )}
                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-black">
                    <span>-{discountAmount.toLocaleString()} <RiyalSign /></span>
                    <span>الخصم</span>
                  </div>
                )}
                {cashbackAmount > 0 && (
                  <div className="flex justify-between text-blue-600 font-black">
                    <span>+{cashbackAmount.toLocaleString()} <RiyalSign /></span>
                    <span>كاش باك</span>
                  </div>
                )}

                {/* Loyalty points */}
                {user && availableLoyaltyPoints >= 100 && (
                  <div className="border border-amber-200 rounded-xl p-3 bg-amber-50 space-y-2 mt-1">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setUseLoyaltyPoints(p => !p)}
                        className={`w-10 h-5 rounded-full transition-all relative shrink-0 ${useLoyaltyPoints ? "bg-amber-500" : "bg-gray-200"}`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${useLoyaltyPoints ? "right-0.5" : "left-0.5"}`} />
                      </button>
                      <div className="text-right flex-1">
                        <p className="text-xs font-black text-amber-800">نقاط الولاء</p>
                        <p className="text-[10px] text-amber-600">{availableLoyaltyPoints.toLocaleString()} نقطة</p>
                      </div>
                    </div>
                    {useLoyaltyPoints && (
                      <div className="flex justify-between text-amber-700 font-black">
                        <span>-{loyaltyDiscount.toFixed(2)} <RiyalSign /></span>
                        <span>خصم النقاط</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-between font-black text-base pt-2 border-t border-gray-100">
                  <span className="text-primary">{finalTotal.toLocaleString()} <RiyalSign /></span>
                  <span>الإجمالي</span>
                </div>
              </div>

              <div className="p-5">
                <CtaButton />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Auth modal */}
      {!user && <AuthModal open={authOpen} onOpenChange={setAuthOpen} defaultTab="login" />}

      {/* Paymob bottom-sheet */}
      <Sheet open={paymobSheetOpen} onOpenChange={(open) => {
        if (!open && !paymobCompletedRef.current && paymobOrderIdState) {
          fetch(`/api/orders/${paymobOrderIdState}/cancel`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ reason: "user_cancelled_payment" }),
          }).catch(() => {});
          toast({ title: "تم إلغاء عملية الدفع", description: "يمكنك المحاولة مرة أخرى", duration: 4000 });
        }
        if (!open) setPaymobSheetOpen(false);
      }}>
        <SheetContent side="bottom" className="h-[92vh] sm:h-[88vh] p-0 rounded-t-3xl overflow-hidden border-t-2 border-primary flex flex-col bg-white" data-testid="sheet-paymob-checkout">
          <SheetHeader className="px-4 py-3 border-b border-gray-200 bg-white shrink-0">
            <div className="flex items-center justify-between gap-3">
              <SheetTitle className="text-sm font-black text-right flex items-center gap-2">
                <Lock className="h-4 w-4 text-primary" />
                الدفع الآمن — Paymob
              </SheetTitle>
              <button
                type="button"
                aria-label="إغلاق"
                onClick={() => setPaymobSheetOpen(false)}
                className="h-9 w-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition"
                data-testid="button-close-paymob-sheet"
              >
                <X className="h-4 w-4 text-gray-600" />
              </button>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500 pt-1">
              <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
              <span>اتصال مشفّر · لا تُحفظ بيانات بطاقتك</span>
            </div>
          </SheetHeader>
          <div className="flex-1 relative bg-white">
            {paymobIframeUrl ? (
              <iframe src={paymobIframeUrl} title="Paymob Checkout" className="absolute inset-0 w-full h-full border-0" allow="payment *" data-testid="iframe-paymob" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Redirecting overlay */}
      {redirectingTo && (
        <div className="fixed inset-0 z-[100] bg-white flex items-center justify-center" dir="rtl" data-testid={`overlay-redirect-${redirectingTo}`}>
          <div className="text-center space-y-6 px-6 max-w-xs">
            <div className="relative w-20 h-20 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-gray-100" />
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                {redirectingTo === "tamara" ? (
                  <span className="text-base font-black text-[#b76e00]">tamara</span>
                ) : redirectingTo === "tabby" ? (
                  <span className="text-base font-black text-[#3eb489]">tabby</span>
                ) : (
                  <Lock className="h-6 w-6 text-primary" />
                )}
              </div>
            </div>
            <div>
              <h3 className="text-lg font-black text-gray-900">
                {redirectingTo === "tamara" ? "جاري التحويل إلى تمارا" : redirectingTo === "tabby" ? "جاري التحويل إلى تابي" : "جاري فتح بوابة الدفع"}
              </h3>
              <p className="text-sm text-gray-500 font-bold mt-1">لحظات قليلة...</p>
            </div>
            <div className="flex items-center justify-center gap-1.5">
              {[0,150,300].map((d,i) => (
                <span key={i} className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${d}ms` }} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Phone required dialog */}
      <Dialog open={phoneDialogOpen} onOpenChange={(o) => {
        if (!o && userMissingPhone) return;
        setPhoneDialogOpen(o);
      }}>
        <DialogContent className="sm:max-w-md rounded-2xl" data-testid="dialog-require-phone">
          <DialogHeader>
            <DialogTitle className="text-right font-black">رقم الجوال مطلوب</DialogTitle>
            <DialogDescription className="text-right text-xs">
              أدخل رقم جوالك السعودي لإتمام الطلب وتحديثك بحالة الشحن.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              id="phone-required"
              type="tel"
              inputMode="numeric"
              dir="ltr"
              placeholder="05xxxxxxxx"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, "").slice(0, 10))}
              data-testid="input-required-phone"
              className="text-center tracking-widest h-12 rounded-xl"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button onClick={savePhone} disabled={phoneSaving || phoneInput.length < 9} className="w-full font-black rounded-xl h-12" data-testid="button-save-required-phone">
              {phoneSaving ? "جاري الحفظ..." : "حفظ ومتابعة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
