import { useCart } from "@/hooks/use-cart";
import { useCoupon } from "@/hooks/use-coupon";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import {
  MapPin, Truck, CreditCard, Apple, Landmark, Lock,
  Check, Wallet, Eye, EyeOff, Smartphone, CheckCircle2,
  ChevronLeft, Pencil, ShieldCheck
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import { LocationMap } from "@/components/LocationMap";
import { useQuery } from "@tanstack/react-query";
import { AuthModal } from "@/components/AuthModal";
import {
  CardBrandsLogo, STCPayLogo, ApplePayLogo,
  TabbyLogo, TamaraLogo, BankLogo
} from "@/components/payment/PaymentBrands";
import { STCPayForm } from "@/components/payment/STCPayForm";
import { RiyalSign } from "@/components/RiyalSign";

export default function Checkout() {
  const { items, total, clearCart } = useCart();
  const { appliedCoupon } = useCoupon();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);

  const [paymentMethod, setPaymentMethod] = useState<
    "wallet" | "bank_transfer" | "tap" | "stc_pay" | "apple_pay" | "tabby" | "tamara"
  >("wallet");
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [isCardProcessing, setIsCardProcessing] = useState(false);
  const [applePayLoading, setApplePayLoading] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReceiptFile(file);
  };

  const uploadReceipt = async (): Promise<string | null> => {
    if (!receiptFile) return null;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", receiptFile);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("فشل رفع الإيصال");
      const data = await res.json();
      return data.url;
    } catch (error: any) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    user?.addresses?.[0]?.id || null
  );
  const [showAddAddressForm, setShowAddAddressForm] = useState(false);
  const [showMapForm, setShowMapForm] = useState(false);
  const [newAddress, setNewAddress] = useState({ street: "", city: "" });
  // Customer's pinned coordinates for the new address (driver/employee navigates exactly here)
  const [newAddressCoords, setNewAddressCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [saveAddressToBook, setSaveAddressToBook] = useState(true);
  // Recipient (defaults to logged-in user but the customer can ship to someone else)
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [shipToOther, setShipToOther] = useState(false);
  const [shippingCompany, setShippingCompany] = useState<string>("");
  const [shippingMethod, setShippingMethod] = useState<"delivery" | "pickup">("delivery");
  const [pickupBranchId, setPickupBranchId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Auth gating ────────────────────────────────────────────
  const [authOpen, setAuthOpen] = useState(false);
  const [phoneDialogOpen, setPhoneDialogOpen] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");
  const [phoneSaving, setPhoneSaving] = useState(false);
  const userMissingPhone = !!user && !((user as any).phone) && (user as any).role === "customer";

  useEffect(() => {
    if (!user) {
      setAuthOpen(true);
    } else {
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

  const selectedBranch = branches.find((b: any) => (b.id || b._id) === pickupBranchId);

  // Out-of-stock check at selected pickup branch
  const branchStockIssues = (() => {
    if (shippingMethod !== "pickup" || !selectedBranch) return [] as string[];
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
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const { data: shippingCompanies = [] } = useQuery({
    queryKey: ["/api/shipping-companies"],
    queryFn: async () => {
      const res = await fetch("/api/shipping-companies");
      return res.json();
    },
  });

  const { data: storeSettings } = useQuery({
    queryKey: ["/api/store/settings"],
    queryFn: async () => {
      const res = await fetch("/api/store/settings");
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
  });

  // Loyalty Points
  const [useLoyaltyPoints, setUseLoyaltyPoints] = useState(false);
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
  const availableLoyaltyPoints = loyaltyData?.points || 0;
  const loyaltyDiscount = useLoyaltyPoints ? Math.min(availableLoyaltyPoints / 100, 50) : 0; // Max 50 SAR redemption

  const enabledMethods = storeSettings?.paymentMethods || {
    wallet: true, tap: true, stc_pay: true, apple_pay: true,
    bank_transfer: true, tamara: true, tabby: true,
  };

  useEffect(() => {
    if (items.length === 0) setLocation("/cart");
  }, [items.length, setLocation]);

  useEffect(() => {
    if (shippingCompany === "" && shippingCompanies.length > 0)
      setShippingCompany(shippingCompanies[0].id);
  }, [shippingCompanies, shippingCompany]);

  if (items.length === 0) return null;

  const selectedShipping =
    shippingCompanies.find(
      (c: any) => c._id === shippingCompany || c.id === shippingCompany
    ) || shippingCompanies[0];
  const shippingPrice = selectedShipping?.price || 0;

  const calculateDiscount = () => {
    if (!appliedCoupon) return 0;
    const subtotal = total();
    if (appliedCoupon.minOrderAmount && subtotal < appliedCoupon.minOrderAmount) return 0;
    if (appliedCoupon.type === "percentage") return (subtotal * appliedCoupon.value) / 100;
    if (appliedCoupon.type === "cashback") return 0;
    return appliedCoupon.value;
  };

  const calculateCashback = () => {
    if (!appliedCoupon || appliedCoupon.type !== "cashback") return 0;
    const subtotal = total();
    const cashbackAmount = (subtotal * appliedCoupon.value) / 100;
    if (appliedCoupon.maxCashback && cashbackAmount > appliedCoupon.maxCashback)
      return appliedCoupon.maxCashback;
    return cashbackAmount;
  };

  const discountAmount = calculateDiscount();
  const cashbackAmount = calculateCashback();
  const subtotal = total();
  const vatIncluded = Math.round(subtotal * 15 / 115 * 100) / 100;
  const shipping = shippingPrice;
  const finalTotal = Math.max(0, subtotal + shipping - discountAmount - loyaltyDiscount);

  const handleCheckoutInitiate = () => {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    if (userMissingPhone) {
      setPhoneDialogOpen(true);
      toast({ title: "رقم الجوال مطلوب", description: "أضف رقم جوالك لإتمام الطلب", variant: "destructive" });
      return;
    }
    if (paymentMethod === "wallet" && Number(user.walletBalance) < finalTotal) {
      toast({
        title: "رصيد المحفظة غير كافٍ",
        description: `رصيدك الحالي: ${user.walletBalance} ر.س، المطلوب: ${finalTotal.toFixed(2)} ر.س`,
        variant: "destructive",
      });
      return;
    }
    // Card (tap) and Apple Pay both go through Paymob's hosted checkout
    if (paymentMethod === "tap" || paymentMethod === "apple_pay") {
      handleFinalCheckout();
      return;
    }
    if (paymentMethod === "stc_pay") {
      if (!paymentConfirmed) {
        toast({
          title: "يجب إتمام الدفع أولاً",
          description: "يرجى التحقق من رقم جوال STC Pay أولاً",
          variant: "destructive",
        });
        return;
      }
      handleFinalCheckout();
      return;
    }
    if (["tamara", "tabby"].includes(paymentMethod)) {
      handleFinalCheckout();
      return;
    }
    setShowConfirmDialog(true);
  };

  const handleFinalCheckout = async () => {
    const noPasswordNeeded = ["tamara", "tabby", "tap", "stc_pay", "apple_pay"].includes(paymentMethod);
    // Any method that REQUIRES an external gateway redirect:
    const NEEDS_GATEWAY = ["tap", "apple_pay", "tabby", "tamara"];
    const requiresGateway = NEEDS_GATEWAY.includes(paymentMethod);
    if (!confirmPassword && !noPasswordNeeded) {
      toast({ title: "خطأ", description: "يرجى إدخال كلمة المرور للتأكيد", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      if (!noPasswordNeeded) {
        const verifyRes = await fetch("/api/auth/verify-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: confirmPassword }),
        });
        if (!verifyRes.ok) throw new Error("كلمة المرور غير صحيحة");
      }
      const selectedAddr = user?.addresses?.find((a) => a.id === selectedAddressId);
      const deliveryAddress = shippingMethod === "pickup"
        ? `استلام من فرع: ${selectedBranch?.name || ""}`
        : (selectedAddr ? `${selectedAddr.street}, ${selectedAddr.city}` : `${newAddress.street}, ${newAddress.city}`);
      if (shippingMethod === "delivery" && !selectedAddr && !newAddress.street.trim()) {
        toast({ title: "العنوان مطلوب", description: "يرجى إدخال عنوان الشحن أو اختيار عنوان محفوظ", variant: "destructive" });
        setIsSubmitting(false);
        return;
      }
      // Resolve coords: from picked saved address OR from the map pin on the new address
      const orderLat =
        shippingMethod === "delivery"
          ? (selectedAddr ? (selectedAddr as any).lat : newAddressCoords?.lat)
          : undefined;
      const orderLng =
        shippingMethod === "delivery"
          ? (selectedAddr ? (selectedAddr as any).lng : newAddressCoords?.lng)
          : undefined;
      // Resolve recipient (defaults to logged-in user)
      const finalRecipientName = (shipToOther && recipientName.trim()) ? recipientName.trim() : (user?.name || "");
      const finalRecipientPhone = (shipToOther && recipientPhone.trim()) ? recipientPhone.trim() : (user?.phone || "");
      // Resolve city/street for shippingAddress object
      const orderCity = selectedAddr ? selectedAddr.city : newAddress.city;
      const orderStreet = selectedAddr ? selectedAddr.street : newAddress.street;
      if (shippingMethod === "pickup" && !pickupBranchId) {
        toast({ title: "اختر الفرع", description: "يرجى اختيار فرع الاستلام", variant: "destructive" });
        setIsSubmitting(false);
        return;
      }
      let receiptUrl = null;
      if (paymentMethod === "bank_transfer") {
        if (!receiptFile) {
          toast({ title: "الإيصال مطلوب", description: "يرجى رفع صورة إيصال التحويل البنكي قبل إتمام الطلب", variant: "destructive" });
          setIsSubmitting(false);
          return;
        }
        receiptUrl = await uploadReceipt();
        if (!receiptUrl) { setIsSubmitting(false); return; }
      }
      const orderData: any = {
        userId: user!.id,
        total: finalTotal.toFixed(2),
        subtotal: subtotal.toFixed(2),
        vatAmount: vatIncluded.toFixed(2),
        shippingCost: shipping.toFixed(2),
        shippingCompany: selectedShipping?.name || "",
        deliveryAddress,
        shippingAddress: shippingMethod === "delivery"
          ? { street: orderStreet, city: orderCity, lat: orderLat, lng: orderLng }
          : undefined,
        latitude: orderLat,
        longitude: orderLng,
        customerName: finalRecipientName,
        customerPhone: finalRecipientPhone,
        notes: orderNotes || undefined,
        discountAmount: discountAmount.toFixed(2),
        cashbackAmount: cashbackAmount.toFixed(2),
        couponCode: appliedCoupon?.code || undefined,
        tapCommission: (finalTotal * 0.02).toFixed(2),
        netProfit: (finalTotal - items.reduce((acc, i) => acc + (i.cost || 0) * i.quantity, 0) - shipping).toFixed(2),
        items: items.map((item) => ({
          productId: item.productId,
          variantSku: item.variantSku,
          quantity: item.quantity,
          price: item.price,
          cost: item.cost || 0,
          title: item.title,
        })),
        shippingMethod,
        pickupBranch: shippingMethod === "pickup" ? pickupBranchId : undefined,
        paymentMethod,
        bankTransferReceipt: receiptUrl || undefined,
        // CRITICAL: any method that needs an external gateway OR manual review must be pending_payment
        // until the gateway/admin confirms. Only wallet (with sufficient balance) is paid up-front.
        status: requiresGateway || paymentMethod === "bank_transfer" ? "pending_payment" : "new",
        paymentStatus: paymentMethod === "wallet" ? "paid" : "pending",
      };
      const res = await apiRequest("POST", "/api/orders", orderData);
      const order = await res.json();
      console.log("[Checkout] Order created:", order.id, "paymentMethod=", paymentMethod, "requiresGateway=", requiresGateway);

      // Helper: cancel a pending_payment order if gateway init fails so it doesn't pile up.
      const cancelPendingOrder = async (reason: string) => {
        try {
          await apiRequest("POST", `/api/orders/${order.id}/cancel`, {
            reason: `gateway_init_failed: ${reason}`.slice(0, 200),
          });
        } catch (err) { console.warn("[Checkout] cancel pending order failed:", err); }
      };

      // Card (tap) AND Apple Pay both go through Paymob's hosted unified checkout
      if (paymentMethod === "tap" || paymentMethod === "apple_pay") {
        console.log("[Checkout] → Paymob initiate for order", order.id);
        try {
          const selectedAddr = user?.addresses?.find((a) => a.id === selectedAddressId);
          const paymobRes = await fetch("/api/paymob/initiate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              orderId: order.id || order._id,
              amount: finalTotal,
              items: items.map(i => ({ title: i.title, price: i.price, quantity: i.quantity })),
              address: selectedAddr ? `${selectedAddr.street}, ${selectedAddr.city}` : `${newAddress.street}, ${newAddress.city}`,
              city: selectedAddr?.city || newAddress.city || "",
            }),
          });
          const paymobData = await paymobRes.json();
          console.log("[Checkout] Paymob response:", paymobRes.status, paymobData);
          if (paymobData.success && paymobData.iframeUrl) {
            clearCart();
            window.location.href = paymobData.iframeUrl;
            return;
          } else {
            await cancelPendingOrder(paymobData.error || "paymob_no_url");
            toast({
              title: "تعذّر فتح بوابة الدفع",
              description: paymobData.error
                ? `Paymob: ${paymobData.error}`
                : "Paymob لم ترجع رابط دفع — تحقّق من Integration ID وHMAC في لوحة Paymob KSA",
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
          customer: { name: user?.name || "", phone: user?.phone || "", email: user?.email || "" },
          installments: 4,
        });
        const tamaraData = await tamaraRes.json();
        if (tamaraData.checkoutUrl) {
          clearCart();
          if (/^https?:\/\//i.test(tamaraData.checkoutUrl)) {
            window.location.href = tamaraData.checkoutUrl;
          } else {
            setLocation(tamaraData.checkoutUrl + `&orderId=${order.id}`);
          }
          return;
        }
        await cancelPendingOrder(tamaraData.error || "tamara_no_url");
        toast({ title: "تمارا", description: tamaraData.error || "تمارا لم تستجب — جرّب طريقة أخرى", variant: "destructive", duration: 8000 });
        setIsSubmitting(false);
        return;
      }
      if (paymentMethod === "tabby") {
        // Build a clean address object for Tabby from whatever the user picked
        const addrSel = user?.addresses?.find((a: any) => a.id === selectedAddressId);
        const addrCity = (addrSel?.city || newAddress.city || "الرياض").trim();
        const addrStreet = (addrSel?.street || newAddress.street || "").trim();
        const tabbyRes = await apiRequest("POST", "/api/payments/tabby/checkout", {
          orderId: order.id,
          amount: finalTotal,
          customer: { name: user?.name || "", phone: user?.phone || "", email: user?.email || "" },
          items: items.map((it: any) => ({
            title: it.title || "Perfume",
            quantity: it.quantity || 1,
            price: Number(it.price) || 0,
            sku: it.variantSku || it.productId,
          })),
          shipping: { city: addrCity, address: addrStreet, zip: "" },
        });
        const tabbyData = await tabbyRes.json();
        console.log("[Checkout] Tabby response:", tabbyRes.status, tabbyData);
        if (tabbyData.checkoutUrl) {
          clearCart();
          if (/^https?:\/\//i.test(tabbyData.checkoutUrl)) {
            window.location.href = tabbyData.checkoutUrl;
          } else {
            setLocation(tabbyData.checkoutUrl + `&orderId=${order.id}`);
          }
          return;
        }
        await cancelPendingOrder(tabbyData.error || tabbyData.rejectionReason || "tabby_no_url");
        toast({
          title: "تابي",
          description: tabbyData.error || tabbyData.rejectionReason || "تابي لم تستجب — جرّب طريقة أخرى",
          variant: "destructive",
          duration: 8000,
        });
        setIsSubmitting(false);
        return;
      }
      try {
        await apiRequest("POST", "/api/shipping/storage-station/create-order", {
          orderId: order.id, provider: selectedShipping?.name || "", deliveryAddress,
        });
      } catch (e) { console.warn("Shipping creation failed, but order was created"); }
      // Save the new address to the user's address book if requested
      if (
        shippingMethod === "delivery" &&
        showAddAddressForm &&
        saveAddressToBook &&
        newAddress.street &&
        !selectedAddressId
      ) {
        try {
          await apiRequest("POST", "/api/addresses", {
            name: shipToOther && recipientName ? recipientName : (user?.name || "العنوان الافتراضي"),
            street: newAddress.street,
            city: newAddress.city || "الرياض",
            phone: shipToOther ? recipientPhone : (user?.phone || ""),
            lat: newAddressCoords?.lat,
            lng: newAddressCoords?.lng,
            notes: orderNotes || undefined,
          });
        } catch (e) {
          console.warn("Failed to save address to address book:", e);
        }
      }
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      clearCart();
      let toastMessage = "سيتم التوصيل عبر Storage X قريباً";
      if (cashbackAmount > 0)
        toastMessage = `تم إضافة ${cashbackAmount.toLocaleString()} ر.س كاش باك إلى محفظتك! ${toastMessage}`;
      toast({ title: "تم استلام طلبك بنجاح", description: toastMessage });
      setLocation("/orders");
    } catch (error: any) {
      toast({ title: "خطأ في إتمام الطلب", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
      setShowConfirmDialog(false);
      setConfirmPassword("");
    }
  };

  const selectedAddr = user?.addresses?.find((a) => a.id === selectedAddressId);
  const addressSummary = selectedAddr
    ? `${selectedAddr.street}, ${selectedAddr.city}`
    : newAddress.street
    ? `${newAddress.street}, ${newAddress.city}`
    : null;

  const paymentLabels: Record<string, string> = {
    wallet: "رصيد المحفظة",
    tap: "بطاقة بنكية",
    stc_pay: "STC Pay",
    apple_pay: "توجيه",
    tabby: "Tabby — أقساط",
    tamara: "Tamara — أقساط",
    bank_transfer: "تحويل بنكي",
  };

  const StepHeader = ({
    step, title, summary, isActive, isCompleted,
  }: {
    step: number; title: string; summary?: string | null;
    isActive: boolean; isCompleted: boolean;
  }) => (
    <button
      onClick={() => !isActive && setActiveStep(step as 1 | 2 | 3)}
      className={`w-full flex items-center gap-3 sm:gap-4 p-3 sm:p-5 text-right transition-colors ${isActive ? "cursor-default" : "hover:bg-gray-50"}`}
    >
      <div
        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-black shrink-0 transition-colors ${
          isCompleted
            ? "bg-green-500 text-white"
            : isActive
            ? "bg-primary text-white"
            : "bg-gray-200 text-gray-800"
        }`}
      >
        {isCompleted ? <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : step}
      </div>
      <div className="flex-1 text-right min-w-0">
        <p className={`font-black text-xs sm:text-sm ${isActive ? "text-black" : isCompleted ? "text-black" : "text-gray-700"}`}>{title}</p>
        {!isActive && summary && (
          <p className="text-[10px] sm:text-xs text-gray-800 mt-0.5 font-medium truncate">{summary}</p>
        )}
      </div>
      {isCompleted && !isActive && (
        <span className="text-[9px] sm:text-[10px] text-primary font-black uppercase tracking-widest flex items-center gap-1 shrink-0">
          <Pencil className="h-3 w-3" />
          تعديل
        </span>
      )}
      {!isActive && !isCompleted && (
        <ChevronLeft className="h-4 w-4 text-gray-700 shrink-0 rotate-180" />
      )}
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-100" dir="rtl">
      {/* ── Checkout Header ── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 h-14 sm:h-16 flex items-center justify-between gap-2">
          <Link href="/">
            <span className="font-black text-base sm:text-xl tracking-tighter cursor-pointer">RF PERFUME</span>
          </Link>
          <div className="hidden md:flex items-center gap-2 text-xs text-gray-800 font-bold">
            <span className={activeStep >= 1 ? "text-primary font-black" : ""}>العنوان</span>
            <ChevronLeft className="h-3 w-3 rotate-180 text-gray-700" />
            <span className={activeStep >= 2 ? "text-primary font-black" : ""}>الشحن</span>
            <ChevronLeft className="h-3 w-3 rotate-180 text-gray-700" />
            <span className={activeStep >= 3 ? "text-primary font-black" : ""}>الدفع</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold text-green-600">
            <ShieldCheck className="h-4 w-4" />
            <span className="hidden sm:block">دفع آمن ١٠٠٪</span>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6 md:py-8">
        <div className="grid lg:grid-cols-3 gap-4 sm:gap-6 items-start">

          {/* ── Left Column: Steps ── */}
          <div className="lg:col-span-2 space-y-3 sm:space-y-4">

            {/* ── Step 1: Address ── */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <StepHeader
                step={1} title="عنوان التوصيل"
                summary={addressSummary}
                isActive={activeStep === 1}
                isCompleted={activeStep > 1 && !!addressSummary}
              />
              {activeStep === 1 && (
                <div className="px-3 sm:px-6 pb-4 sm:pb-6 border-t border-gray-100">
                  <div className="pt-5 space-y-4">
                    {!showAddAddressForm && user?.addresses && user.addresses.length > 0 ? (
                      <>
                        <div className="space-y-3">
                          {user.addresses.map((addr) => (
                            <div
                              key={addr.id}
                              onClick={() => setSelectedAddressId(addr.id)}
                              className={`p-4 border-2 rounded-lg cursor-pointer transition-all flex items-start gap-3 ${
                                selectedAddressId === addr.id
                                  ? "border-primary bg-primary/5"
                                  : "border-gray-200 hover:border-gray-300"
                              }`}
                            >
                              <div className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                                selectedAddressId === addr.id ? "border-primary" : "border-gray-300"
                              }`}>
                                {selectedAddressId === addr.id && (
                                  <div className="w-2 h-2 rounded-full bg-primary" />
                                )}
                              </div>
                              <div>
                                <p className="font-black text-sm">{addr.name}</p>
                                <p className="text-xs text-gray-800 mt-0.5">{addr.street}, {addr.city}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={() => { setShowAddAddressForm(true); setSelectedAddressId(null); }}
                          className="w-full py-3 border-2 border-dashed border-gray-200 rounded-lg text-sm font-bold text-gray-800 hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
                        >
                          <MapPin className="h-4 w-4" />
                          إضافة عنوان جديد
                        </button>
                      </>
                    ) : (
                      <div className="space-y-3">
                        {!showMapForm ? (
                          <>
                            <Input
                              placeholder="الشارع والرقم"
                              value={newAddress.street}
                              onChange={(e) => setNewAddress({ ...newAddress, street: e.target.value })}
                              className="h-12 border-gray-200 rounded-lg focus-visible:ring-primary/30"
                            />
                            <Input
                              placeholder="المدينة"
                              value={newAddress.city}
                              onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                              className="h-12 border-gray-200 rounded-lg focus-visible:ring-primary/30"
                            />
                            <button
                              onClick={() => setShowMapForm(true)}
                              className="w-full py-3 border-2 border-dashed border-gray-200 rounded-lg text-sm font-bold text-gray-800 hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
                            >
                              <MapPin className="h-4 w-4" />
                              حدد الموقع من الخريطة
                            </button>
                            {showAddAddressForm && (
                              <button
                                onClick={() => { setShowAddAddressForm(false); setSelectedAddressId(user?.addresses?.[0]?.id || null); }}
                                className="w-full text-xs text-gray-700 hover:text-gray-600 font-bold py-2"
                              >
                                إلغاء
                              </button>
                            )}
                          </>
                        ) : (
                          <>
                            <LocationMap
                              onLocationSelect={(coords, address) => {
                                setNewAddress({ street: address, city: "الرياض" });
                                setNewAddressCoords({ lat: coords.lat, lng: coords.lng });
                                setShowMapForm(false);
                                setSelectedAddressId(null);
                              }}
                            />
                            <button
                              onClick={() => setShowMapForm(false)}
                              className="w-full py-3 border border-gray-200 rounded-lg text-sm font-bold text-gray-800 hover:bg-gray-50 transition-colors"
                            >
                              إغلاق الخريطة
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    {/* ── Save this new address to address book ── */}
                    {showAddAddressForm && (newAddress.street || newAddressCoords) && (
                      <label className="flex items-center gap-2 cursor-pointer p-3 bg-[#FAF8F4] rounded-lg border border-[#DFB369]/20" data-testid="toggle-save-address">
                        <input
                          type="checkbox"
                          checked={saveAddressToBook}
                          onChange={(e) => setSaveAddressToBook(e.target.checked)}
                          className="h-4 w-4 accent-primary"
                        />
                        <span className="text-xs font-bold text-gray-800">احفظ هذا العنوان في دفتر عناويني</span>
                      </label>
                    )}

                    {/* ── Recipient (different person) ── */}
                    <div className="rounded-lg border border-gray-100 bg-[#FAFAFA] p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-gray-900">المستلم</span>
                        <button
                          type="button"
                          onClick={() => {
                            const next = !shipToOther;
                            setShipToOther(next);
                            if (!next) {
                              setRecipientName("");
                              setRecipientPhone("");
                            }
                          }}
                          className="text-[11px] font-bold text-primary hover:underline"
                          data-testid="button-toggle-recipient"
                        >
                          {shipToOther ? "إلغاء" : "إرسال لشخص آخر"}
                        </button>
                      </div>

                      {!shipToOther ? (
                        <div className="text-[11px] text-gray-700 font-medium">
                          سيتم تسليم الطلب باسم: <span className="font-black text-gray-900">{user?.name || "—"}</span>
                          {user?.phone && <span className="text-gray-700"> · {user.phone}</span>}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <Input
                            placeholder="اسم المستلم"
                            value={recipientName}
                            onChange={(e) => setRecipientName(e.target.value)}
                            className="h-11 border-gray-200 rounded-lg"
                            data-testid="input-recipient-name"
                          />
                          <Input
                            placeholder="جوال المستلم (05XXXXXXXX)"
                            value={recipientPhone}
                            onChange={(e) => setRecipientPhone(e.target.value)}
                            dir="ltr"
                            className="h-11 border-gray-200 rounded-lg"
                            data-testid="input-recipient-phone"
                          />
                        </div>
                      )}
                    </div>

                    {/* ── Optional order notes ── */}
                    <div>
                      <Input
                        placeholder="ملاحظات للسائق (اختياري)"
                        value={orderNotes}
                        onChange={(e) => setOrderNotes(e.target.value)}
                        className="h-11 border-gray-200 rounded-lg"
                        data-testid="input-order-notes"
                      />
                    </div>

                    <Button
                      onClick={() => {
                        if (!addressSummary) {
                          toast({ title: "العنوان مطلوب", description: "يرجى تحديد عنوان التوصيل", variant: "destructive" });
                          return;
                        }
                        if (shipToOther) {
                          if (!recipientName.trim()) {
                            toast({ title: "اسم المستلم مطلوب", variant: "destructive" });
                            return;
                          }
                          if (!/^0?5\d{8}$/.test(recipientPhone.trim())) {
                            toast({ title: "رقم المستلم غير صالح", description: "يبدأ بـ 5 أو 05", variant: "destructive" });
                            return;
                          }
                        }
                        setActiveStep(2);
                      }}
                      className="w-full h-12 rounded-lg font-black text-sm uppercase tracking-widest"
                    >
                      متابعة
                      <ChevronLeft className="h-4 w-4 mr-2 rotate-180" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* ── Step 2: Shipping ── */}
            <div className={`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden ${activeStep < 2 ? "opacity-60" : ""}`}>
              <StepHeader
                step={2} title="طريقة الاستلام"
                summary={
                  shippingMethod === "pickup"
                    ? (selectedBranch ? `استلام من فرع: ${selectedBranch.name}` : "استلام من فرع")
                    : (selectedShipping ? `${selectedShipping.name} — ${selectedShipping.price} ر.س` : null)
                }
                isActive={activeStep === 2}
                isCompleted={activeStep > 2 && (shippingMethod === "delivery" || !!pickupBranchId)}
              />
              {activeStep === 2 && (
                <div className="px-3 sm:px-6 pb-4 sm:pb-6 border-t border-gray-100">
                  <div className="pt-4 sm:pt-5 space-y-3 sm:space-y-4">
                    {/* Delivery vs Pickup toggle */}
                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                      <button
                        type="button"
                        data-testid="button-method-delivery"
                        onClick={() => setShippingMethod("delivery")}
                        className={`p-4 border-2 rounded-lg text-right transition-all ${
                          shippingMethod === "delivery" ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <Truck className={`h-5 w-5 mb-2 ${shippingMethod === "delivery" ? "text-primary" : "text-gray-700"}`} />
                        <p className="font-black text-sm">توصيل للمنزل</p>
                        <p className="text-[10px] text-gray-700 font-bold mt-0.5">عبر شركة شحن</p>
                      </button>
                      <button
                        type="button"
                        data-testid="button-method-pickup"
                        onClick={() => setShippingMethod("pickup")}
                        className={`p-4 border-2 rounded-lg text-right transition-all ${
                          shippingMethod === "pickup" ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <MapPin className={`h-5 w-5 mb-2 ${shippingMethod === "pickup" ? "text-primary" : "text-gray-700"}`} />
                        <p className="font-black text-sm">استلام من فرع</p>
                        <p className="text-[10px] text-gray-700 font-bold mt-0.5">بدون رسوم شحن</p>
                      </button>
                    </div>

                    {shippingMethod === "pickup" ? (
                      <div className="space-y-3">
                        {branches.length === 0 ? (
                          <p className="text-sm text-gray-700 font-bold text-center py-4">لا توجد فروع متاحة حالياً</p>
                        ) : (
                          branches.map((br: any) => {
                            const id = br.id || br._id;
                            const isSelected = pickupBranchId === id;
                            return (
                              <div
                                key={id}
                                onClick={() => setPickupBranchId(id)}
                                data-testid={`option-branch-${id}`}
                                className={`p-4 border-2 rounded-lg cursor-pointer transition-all flex items-start gap-3 ${
                                  isSelected ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300"
                                }`}
                              >
                                <div className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                                  isSelected ? "border-primary" : "border-gray-300"
                                }`}>
                                  {isSelected && <div className="w-2 h-2 rounded-full bg-primary" />}
                                </div>
                                <MapPin className={`h-5 w-5 shrink-0 ${isSelected ? "text-primary" : "text-gray-700"}`} />
                                <div className="flex-1">
                                  <p className="font-black text-sm">{br.name}</p>
                                  <p className="text-[11px] text-gray-700 font-bold mt-0.5">{br.address || br.city || ""}</p>
                                  {br.workingHours && <p className="text-[10px] text-gray-700 mt-1">{br.workingHours}</p>}
                                </div>
                              </div>
                            );
                          })
                        )}
                        {branchStockIssues.length > 0 && (
                          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-3 text-right">
                            <p className="text-sm font-black text-red-700 mb-1">⚠️ منتجات غير متوفرة في هذا الفرع:</p>
                            <ul className="text-xs text-red-700 font-bold space-y-1 list-disc pr-5">
                              {branchStockIssues.map((m, i) => <li key={i}>{m}</li>)}
                            </ul>
                            <p className="text-xs text-gray-800 mt-2 font-bold">جرّب فرعاً آخر أو اختر التوصيل للمنزل</p>
                          </div>
                        )}
                      </div>
                    ) : shippingCompanies.length === 0 ? (
                      <p className="text-sm text-gray-700 font-bold text-center py-4">لا توجد شركات شحن متاحة</p>
                    ) : (
                      <div className="space-y-3">
                        {shippingCompanies.map((company: any) => {
                          const id = company.id || company._id;
                          const isSelected = shippingCompany === id;
                          return (
                            <div
                              key={id}
                              onClick={() => setShippingCompany(id)}
                              className={`p-4 border-2 rounded-lg cursor-pointer transition-all flex items-center gap-3 ${
                                isSelected ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300"
                              }`}
                            >
                              <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                                isSelected ? "border-primary" : "border-gray-300"
                              }`}>
                                {isSelected && <div className="w-2 h-2 rounded-full bg-primary" />}
                              </div>
                              <Truck className={`h-5 w-5 shrink-0 ${isSelected ? "text-primary" : "text-gray-700"}`} />
                              <div className="flex-1">
                                <p className="font-black text-sm">{company.name}</p>
                                <p className="text-[10px] text-gray-700 font-bold mt-0.5">التوصيل خلال ٢-٤ أيام عمل</p>
                              </div>
                              <span className={`font-black text-sm ${isSelected ? "text-primary" : "text-gray-600"}`}>
                                {company.price} <RiyalSign />
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <Button
                      data-testid="button-shipping-continue"
                      disabled={shippingMethod === "pickup" && (!pickupBranchId || branchStockIssues.length > 0)}
                      onClick={() => {
                        if (shippingMethod === "pickup" && !pickupBranchId) {
                          toast({ title: "اختر الفرع", description: "يرجى اختيار الفرع للاستلام", variant: "destructive" });
                          return;
                        }
                        if (shippingMethod === "pickup" && branchStockIssues.length > 0) {
                          toast({ title: "منتج غير متوفر", description: "بعض المنتجات غير متوفرة في هذا الفرع", variant: "destructive" });
                          return;
                        }
                        setActiveStep(3);
                      }}
                      className="w-full h-12 rounded-lg font-black text-sm uppercase tracking-widest"
                    >
                      متابعة
                      <ChevronLeft className="h-4 w-4 mr-2 rotate-180" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* ── Step 3: Payment ── */}
            <div className={`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden ${activeStep < 3 ? "opacity-60" : ""}`}>
              <StepHeader
                step={3} title="طريقة الدفع"
                summary={activeStep > 3 ? paymentLabels[paymentMethod] : null}
                isActive={activeStep === 3}
                isCompleted={false}
              />
              {activeStep === 3 && (
                <div className="px-3 sm:px-6 pb-4 sm:pb-6 border-t border-gray-100">
                  <div className="pt-4 sm:pt-5 space-y-4 sm:space-y-5">
                    <RadioGroup
                      value={paymentMethod}
                      onValueChange={(v) => { setPaymentMethod(v as any); setPaymentConfirmed(false); }}
                      className="space-y-3"
                    >
                      {/* Wallet */}
                      {enabledMethods.wallet !== false && (
                        <label
                          htmlFor="pay-wallet"
                          className={`flex items-center gap-2 sm:gap-3 p-3 sm:p-4 border-2 rounded-lg cursor-pointer transition-all ${
                            paymentMethod === "wallet" ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <RadioGroupItem value="wallet" id="pay-wallet" className="shrink-0" />
                          <div className={`p-1.5 rounded-md ${paymentMethod === "wallet" ? "bg-primary/10" : "bg-gray-100"}`}>
                            <Wallet className={`h-5 w-5 ${paymentMethod === "wallet" ? "text-primary" : "text-gray-800"}`} />
                          </div>
                          <div className="flex-1">
                            <p className="font-black text-sm">رصيد المحفظة</p>
                            <p className="text-[10px] text-gray-700 font-bold mt-0.5">رصيدك: {user?.walletBalance} <RiyalSign /></p>
                          </div>
                        </label>
                      )}

                      {/* Card */}
                      {enabledMethods.tap !== false && (
                        <label
                          htmlFor="pay-tap"
                          className={`flex items-center gap-2 sm:gap-3 p-3 sm:p-4 border-2 rounded-lg cursor-pointer transition-all ${
                            paymentMethod === "tap" ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <RadioGroupItem value="tap" id="pay-tap" className="shrink-0" />
                          <div className="flex-1 flex items-center gap-3">
                            <CardBrandsLogo className="h-6" />
                            <div>
                              <p className="font-black text-sm">بطاقة بنكية</p>
                              <p className="text-[10px] text-gray-700 font-bold mt-0.5">مدى / فيزا / ماستركارد</p>
                            </div>
                          </div>
                          {paymentMethod === "tap" && paymentConfirmed && (
                            <span className="text-[10px] text-green-600 font-black flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              تم التحقق
                            </span>
                          )}
                        </label>
                      )}

                      {/* Apple Pay (visible label: "توجيه") */}
                      {enabledMethods.apple_pay !== false && (
                        <label
                          htmlFor="pay-apple"
                          className={`flex items-center gap-2 sm:gap-3 p-3 sm:p-4 border-2 rounded-lg cursor-pointer transition-all ${
                            paymentMethod === "apple_pay" ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <RadioGroupItem value="apple_pay" id="pay-apple" className="shrink-0" />
                          <ApplePayLogo className="h-6 shrink-0" />
                          <div className="flex-1">
                            <p className="font-black text-sm">توجيه</p>
                            <p className="text-[10px] text-gray-700 font-bold mt-0.5">دفع موجّه عبر بوابة آمنة</p>
                          </div>
                          {paymentMethod === "apple_pay" && paymentConfirmed && (
                            <span className="text-[10px] text-green-600 font-black flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              تم التحقق
                            </span>
                          )}
                        </label>
                      )}

                      {/* Tabby */}
                      {enabledMethods.tabby !== false && (
                        <label
                          htmlFor="pay-tabby"
                          className={`flex items-center gap-2 sm:gap-3 p-3 sm:p-4 border-2 rounded-lg cursor-pointer transition-all ${
                            paymentMethod === "tabby" ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <RadioGroupItem value="tabby" id="pay-tabby" className="shrink-0" />
                          <TabbyLogo className="h-7 shrink-0" />
                          <div className="flex-1">
                            <p className="font-black text-sm">Tabby</p>
                            <p className="text-[10px] text-gray-700 font-bold mt-0.5">٤ دفعات بدون فوائد</p>
                          </div>
                          <Badge className="text-[9px] bg-green-100 text-green-700 border-0 font-black">٤ أقساط</Badge>
                        </label>
                      )}

                      {/* Tamara */}
                      {enabledMethods.tamara !== false && (
                        <label
                          htmlFor="pay-tamara"
                          className={`flex items-center gap-2 sm:gap-3 p-3 sm:p-4 border-2 rounded-lg cursor-pointer transition-all ${
                            paymentMethod === "tamara" ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <RadioGroupItem value="tamara" id="pay-tamara" className="shrink-0" />
                          <TamaraLogo className="h-7 shrink-0" />
                          <div className="flex-1">
                            <p className="font-black text-sm">Tamara</p>
                            <p className="text-[10px] text-gray-700 font-bold mt-0.5">٣ دفعات بدون فوائد</p>
                          </div>
                          <Badge className="text-[9px] bg-amber-100 text-amber-700 border-0 font-black">٣ أقساط</Badge>
                        </label>
                      )}

                    </RadioGroup>

                    {/* Paymob card info */}
                    {paymentMethod === "tap" && (
                      <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                        <div className="flex items-center gap-2 mb-3">
                          <CreditCard className="h-4 w-4 text-primary" />
                          <p className="font-black text-sm text-gray-700">الدفع بالبطاقة</p>
                        </div>
                        <div className="space-y-2">
                          <p className="text-xs text-gray-800 font-bold leading-relaxed">
                            سيتم توجيهك إلى بوابة الدفع الآمنة (Paymob) لإدخال بيانات بطاقتك الائتمانية أو مدى.
                          </p>
                          <div className="flex items-center gap-3 pt-2">
                            <div className="bg-[#1A1F71] text-white font-black italic text-xs px-2 py-0.5 rounded">VISA</div>
                            <div className="flex">
                              <div className="w-5 h-5 rounded-full bg-[#EB001B] opacity-90" />
                              <div className="w-5 h-5 rounded-full bg-[#F79E1B] -ml-2 opacity-90" />
                            </div>
                            <div className="bg-[#0a5aa5] text-white font-black text-[10px] px-2 py-0.5 rounded">مدى</div>
                          </div>
                          <div className="flex items-center gap-2 pt-2 text-[10px] text-gray-700 font-bold">
                            <Lock className="h-3 w-3" />
                            <span>دفع آمن ومشفر بالكامل عبر Paymob</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* "توجيه" (Apple Pay) — handled by Paymob hosted checkout (no inline confirm needed) */}
                    {paymentMethod === "apple_pay" && (
                      <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-black flex items-center justify-center shrink-0">
                          <Apple className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="font-black text-sm text-black">توجيه</p>
                          <p className="text-[10px] text-gray-700 font-bold mt-0.5">
                            عند الضغط على "تأكيد الطلب" ستُنقل إلى صفحة دفع آمنة لإكمال العملية
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Right Column: Order Summary ── */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-24 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-3 sm:p-5 border-b border-gray-100">
                <h3 className="font-black text-sm sm:text-base">ملخص الطلب</h3>
                <p className="text-[10px] sm:text-xs text-gray-700 font-bold mt-0.5">{items.length} منتج</p>
              </div>

              {/* Product list */}
              <div className="p-3 sm:p-5 space-y-3 sm:space-y-4 max-h-[200px] sm:max-h-[260px] overflow-y-auto border-b border-gray-100">
                {items.map((item) => (
                  <div key={item.variantSku} className="flex gap-2 sm:gap-3 items-center">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden bg-gray-100 shrink-0 border border-gray-100">
                      <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-[11px] sm:text-xs truncate">{item.title}</p>
                      <p className="text-[9px] sm:text-[10px] text-gray-700 font-bold mt-0.5 truncate">
                        {item.quantity}x · {item.color} · {item.size}
                      </p>
                    </div>
                    <p className="font-black text-[11px] sm:text-xs shrink-0 text-gray-700">{item.price.toLocaleString()} <RiyalSign /></p>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="p-3 sm:p-5 space-y-2.5 sm:space-y-3 border-b border-gray-100 text-xs sm:text-sm">
                <div className="flex justify-between text-gray-800 font-bold">
                  <span>{subtotal.toLocaleString()} <RiyalSign /></span>
                  <span>المجموع الفرعي</span>
                </div>
                <div className="flex justify-between text-gray-500 font-bold">
                  <span>{vatIncluded.toLocaleString()} <RiyalSign /></span>
                  <span>ضريبة ١٥٪ (مشمولة)</span>
                </div>
                <div className="flex justify-between text-gray-800 font-bold">
                  <span>{shipping.toLocaleString()} <RiyalSign /></span>
                  <span>رسوم الشحن</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-green-600 font-black">
                    <span>- {discountAmount.toLocaleString()} <RiyalSign /></span>
                    <span>الخصم</span>
                  </div>
                )}
                {cashbackAmount > 0 && (
                  <div className="flex justify-between text-blue-600 font-black">
                    <span>+ {cashbackAmount.toLocaleString()} <RiyalSign /></span>
                    <span>كاش باك</span>
                  </div>
                )}
                {/* Loyalty Points Toggle */}
                {user && availableLoyaltyPoints >= 100 && (
                  <div className="border border-amber-200 rounded-xl p-3 bg-amber-50 space-y-2">
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setUseLoyaltyPoints(p => !p)}
                        className={`w-10 h-5 rounded-full transition-all relative ${useLoyaltyPoints ? "bg-amber-500" : "bg-gray-200"}`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${useLoyaltyPoints ? "right-0.5" : "left-0.5"}`} />
                      </button>
                      <div className="text-right">
                        <p className="text-xs font-black text-amber-800">استخدام نقاط الولاء</p>
                        <p className="text-[10px] text-amber-600">{availableLoyaltyPoints.toLocaleString()} نقطة متاحة</p>
                      </div>
                    </div>
                    {useLoyaltyPoints && (
                      <div className="flex justify-between text-amber-700 font-black text-sm">
                        <span>- {loyaltyDiscount.toFixed(2)} <RiyalSign /></span>
                        <span>خصم النقاط</span>
                      </div>
                    )}
                  </div>
                )}
                <div className="flex justify-between font-black text-base sm:text-lg pt-3 border-t border-gray-100">
                  <span className="text-primary">{finalTotal.toLocaleString()} <RiyalSign /></span>
                  <span>الإجمالي</span>
                </div>
              </div>

              {/* CTA */}
              <div className="p-3 sm:p-5 space-y-3">
                {activeStep < 3 ? (
                  <div className="w-full py-3 sm:py-4 bg-gray-100 rounded-lg text-center">
                    <p className="text-[11px] sm:text-xs text-gray-700 font-bold">
                      أكمل الخطوات أعلاه للمتابعة
                    </p>
                  </div>
                ) : paymentMethod === "stc_pay" && !paymentConfirmed ? (
                  <div className="w-full py-3 sm:py-4 bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center gap-1.5">
                    <Lock className="h-4 w-4 text-gray-700" />
                    <p className="text-[10px] text-gray-700 font-black text-center">
                      تحقق من STC Pay أولاً
                    </p>
                  </div>
                ) : (
                  <Button
                    onClick={handleCheckoutInitiate}
                    disabled={isSubmitting || (paymentMethod === "bank_transfer" && !receiptFile)}
                    className="w-full h-12 sm:h-14 rounded-xl font-black text-xs sm:text-sm uppercase tracking-widest shadow-lg shadow-primary/20 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        جاري المعالجة...
                      </span>
                    ) : "تأكيد الطلب"}
                  </Button>
                )}
                <div className="flex items-center justify-center gap-1.5 text-[10px] text-gray-700 font-bold">
                  <Lock className="h-3 w-3" />
                  <span>دفع آمن ومشفر بالكامل</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Password Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl border-gray-100 shadow-2xl p-8" dir="rtl">
          <DialogHeader className="text-right space-y-4">
            <div className="w-14 h-14 bg-primary/5 rounded-2xl flex items-center justify-center mb-2">
              <Lock className="h-7 w-7 text-primary" />
            </div>
            <DialogTitle className="font-black text-2xl tracking-tight">تأكيد الهوية</DialogTitle>
            <DialogDescription className="font-bold text-sm text-gray-700 leading-relaxed">
              لحماية حسابك، يرجى إدخال كلمة المرور لتأكيد الطلب.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-5">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-gray-700">كلمة المرور</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-12 bg-gray-50 border-gray-200 rounded-xl px-5 font-bold focus-visible:ring-primary/20"
                  placeholder="ادخل كلمة المرور"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-700 hover:text-primary transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Link href="/forgot-password">
              <button
                className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline"
                onClick={() => setShowConfirmDialog(false)}
              >
                نسيت كلمة المرور؟
              </button>
            </Link>
          </div>
          <DialogFooter className="gap-3 sm:justify-start">
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}
              className="rounded-xl h-12 px-6 font-black uppercase tracking-widest text-[10px] border-gray-200">
              إلغاء
            </Button>
            <Button
              onClick={handleFinalCheckout}
              disabled={isSubmitting || !confirmPassword}
              className="rounded-xl h-12 px-10 font-black uppercase tracking-widest text-[10px] flex-1 sm:flex-none"
            >
              {isSubmitting ? "جاري التأكيد..." : "تأكيد وإتمام الطلب"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Auth required modal */}
      {!user && <AuthModal open={authOpen} onOpenChange={setAuthOpen} defaultTab="login" />}

      {/* Phone required dialog (for OAuth users without phone) */}
      <Dialog open={phoneDialogOpen} onOpenChange={(o) => {
        if (!o && userMissingPhone) return;
        setPhoneDialogOpen(o);
      }}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-require-phone">
          <DialogHeader>
            <DialogTitle className="text-right">رقم الجوال مطلوب</DialogTitle>
            <DialogDescription className="text-right text-xs">
              لإتمام طلبك ولتحديثك بحالة الشحن، يرجى إدخال رقم جوالك السعودي. يُحفظ مرة واحدة فقط ولن نطلبه مجدداً.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="phone-required" className="text-right block text-xs font-bold">
              رقم الجوال
            </Label>
            <Input
              id="phone-required"
              type="tel"
              inputMode="numeric"
              dir="ltr"
              placeholder="05xxxxxxxx"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, "").slice(0, 10))}
              data-testid="input-required-phone"
              className="text-center tracking-widest"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              onClick={savePhone}
              disabled={phoneSaving || phoneInput.length < 9}
              className="w-full font-black uppercase tracking-widest"
              data-testid="button-save-required-phone"
            >
              {phoneSaving ? "جاري الحفظ..." : "حفظ ومتابعة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
