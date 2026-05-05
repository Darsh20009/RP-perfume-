import { Layout } from "@/components/Layout";
import { useCart } from "@/hooks/use-cart";
import { useCoupon } from "@/hooks/use-coupon";
import { Button } from "@/components/ui/button";
import { Trash2, ShoppingBag, Check, Tag, ChevronLeft, Shield } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useLanguage } from "@/hooks/use-language";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { AuthModal } from "@/components/AuthModal";
import { RiyalSign } from "@/components/RiyalSign";

export default function Cart() {
  const { items, removeItem, updateQuantity, total } = useCart();
  const { appliedCoupon, setCoupon, clearCoupon } = useCoupon();
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [couponCode, setCouponCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  const handleCheckoutClick = () => {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    setLocation("/checkout");
  };

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
  });
  const bundleSavings = bundleResult?.savings || 0;

  const applyCouponMutation = useMutation({
    mutationFn: async (code: string) => {
      setLoading(true);
      const res = await fetch(`/api/coupons/${code}`);
      if (!res.ok) throw new Error(t('invalidCode'));
      return res.json();
    },
    onSuccess: (coupon) => {
      setCoupon(coupon);
      setCouponCode("");
      toast({ title: t('couponAdded') });
      setLoading(false);
    },
    onError: (err: any) => {
      toast({ title: t('error'), description: err.message || t('couponFailed'), variant: "destructive" });
      setLoading(false);
    }
  });

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
  const finalTotal = Math.max(0, subtotal - discountAmount - bundleSavings);

  if (items.length === 0) {
    return (
      <Layout>
        <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 text-center" dir={language === "ar" ? "rtl" : "ltr"}>
          <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gray-100 rounded-3xl flex items-center justify-center mx-auto mb-5">
            <ShoppingBag className="h-9 w-9 sm:h-11 sm:w-11 text-gray-300" />
          </div>
          <h1 className="font-black text-xl sm:text-2xl mb-2 text-gray-900">{t('emptyCart')}</h1>
          <p className="text-sm sm:text-base text-gray-400 font-medium mb-7 max-w-xs">{t('emptyCartDesc')}</p>
          <Link href="/products">
            <Button size="lg" className="rounded-2xl font-black h-12 sm:h-14 px-8 text-sm">
              {t('browseProducts')}
            </Button>
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="bg-[#f9f8f6] min-h-screen" dir={language === "ar" ? "rtl" : "ltr"}>
        <div className="container px-3 sm:px-4 py-6 sm:py-10 md:py-14">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 sm:mb-10 gap-2 pb-4 sm:pb-6 border-b border-black/5">
            <h1 className="font-black text-2xl sm:text-3xl md:text-4xl uppercase tracking-tight">
              {t('shoppingBag')}
            </h1>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400 flex-wrap">
              <span className="text-gray-900">{t('shoppingBag')}</span>
              <ChevronLeft className={`h-3 w-3 opacity-30 ${language === "ar" ? "rotate-180" : ""}`} />
              <span className="text-primary">{t('checkout')}</span>
              <ChevronLeft className={`h-3 w-3 opacity-30 ${language === "ar" ? "rotate-180" : ""}`} />
              <span>{t('payment')}</span>
            </div>
          </div>

          <div className="grid lg:grid-cols-12 gap-5 sm:gap-6 lg:gap-10 items-start">

            {/* ── Cart Items ── */}
            <div className="lg:col-span-8 space-y-3 sm:space-y-4">
              {items.map((item) => (
                <div
                  key={`${item.productId}-${item.variantSku}`}
                  className="group bg-white rounded-2xl p-3 sm:p-4 md:p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300"
                >
                  <div className="flex gap-3 sm:gap-4">
                    {/* Image */}
                    <Link href={`/products/${item.productId}`}>
                      <div className="w-20 h-24 sm:w-24 sm:h-28 md:w-28 md:h-32 bg-gray-50 overflow-hidden shrink-0 rounded-xl border border-gray-100 cursor-pointer">
                        <img
                          src={item.image}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      </div>
                    </Link>

                    {/* Details */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0">
                          <h3 className="font-black text-sm sm:text-base md:text-lg uppercase tracking-tight leading-tight line-clamp-2">
                            {item.title}
                          </h3>
                          <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-gray-400 mt-1">
                            {item.color}
                            {item.color && item.size && <span className="mx-1.5 opacity-30">·</span>}
                            {item.size}
                          </p>
                        </div>
                        <button
                          onClick={() => removeItem(item.productId, item.variantSku)}
                          className="text-gray-300 hover:text-red-500 transition-colors shrink-0 p-1"
                          aria-label="حذف"
                          data-testid={`button-remove-${item.productId}`}
                        >
                          <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between mt-3 sm:mt-4 gap-3 flex-wrap">
                        {/* Price */}
                        <span className="font-black text-base sm:text-lg md:text-xl tracking-tight">
                          {(item.price * item.quantity).toLocaleString()} <RiyalSign />
                        </span>

                        {/* Quantity controls */}
                        <div className="flex items-center bg-gray-100 rounded-xl p-0.5">
                          <button
                            onClick={() => updateQuantity(item.productId, item.variantSku, Math.max(1, item.quantity - 1))}
                            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg hover:bg-white transition-all text-lg font-light"
                            data-testid={`button-decrease-${item.productId}`}
                          >
                            −
                          </button>
                          <span className="text-xs sm:text-sm font-black w-8 sm:w-9 text-center tabular-nums">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.productId, item.variantSku, item.quantity + 1)}
                            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg hover:bg-white transition-all text-lg font-light"
                            data-testid={`button-increase-${item.productId}`}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Summary ── */}
            <div className="lg:col-span-4">
              <div className="lg:sticky lg:top-24 space-y-3 sm:space-y-4">
                <div className="bg-white rounded-2xl p-4 sm:p-5 md:p-6 border border-gray-100 shadow-sm">
                  <h3 className="text-xs font-black uppercase tracking-[0.3em] text-gray-400 mb-5 pb-4 border-b border-gray-100">
                    {t('bagSummary')}
                  </h3>

                  <div className="space-y-3">
                    <div className="flex justify-between text-sm font-bold text-gray-600">
                      <span className="font-black text-gray-900">{subtotal.toLocaleString()} <RiyalSign /></span>
                      <span>{t('subtotal')}</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold text-gray-400">
                      <span>{vatIncluded.toLocaleString()} <RiyalSign /></span>
                      <span>ضريبة ١٥٪ (مشمولة)</span>
                    </div>

                    {appliedCoupon && discountAmount > 0 && (
                      <div className="flex justify-between text-sm font-black text-emerald-600">
                        <div className="flex items-center gap-2">
                          <span>-{discountAmount.toLocaleString()} <RiyalSign /></span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="opacity-80">{t('discount')}</span>
                          <button
                            onClick={() => clearCoupon()}
                            className="text-gray-300 hover:text-red-400 transition-colors text-[10px]"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    )}

                    {bundleSavings > 0 && (
                      <div className="flex justify-between text-sm font-black text-purple-600" data-testid="row-bundle-savings">
                        <span>-{bundleSavings.toLocaleString()} <RiyalSign /></span>
                        <span>عرض الباقة</span>
                      </div>
                    )}

                    {bundleResult?.applications && bundleResult.applications.length > 0 && (
                      <div className="bg-purple-50 border border-purple-100 rounded-xl p-2.5 space-y-1">
                        {bundleResult.applications.map((a: any, i: number) => (
                          <div key={i} className="text-[10px] text-purple-700 font-bold flex items-center gap-1">
                            <Check className="h-3 w-3 shrink-0" />
                            {a.offerTitle || `${a.tierQuantity} قطع`} — وفّرت {a.savings?.toLocaleString()} <RiyalSign />
                          </div>
                        ))}
                      </div>
                    )}

                    {appliedCoupon && cashbackAmount > 0 && (
                      <div className="flex justify-between text-sm font-black text-blue-600">
                        <div className="flex items-center gap-1.5">
                          <span>+{cashbackAmount.toLocaleString()} <RiyalSign /></span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="opacity-80">{t('cashback')}</span>
                          <button onClick={() => clearCoupon()} className="text-gray-300 hover:text-red-400 transition-colors text-[10px]">✕</button>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-between pt-4 mt-2 border-t border-gray-100 font-black text-xl sm:text-2xl tracking-tight">
                      <span className="text-primary">{finalTotal.toLocaleString()} <RiyalSign /></span>
                      <span>{t('total')}</span>
                    </div>
                  </div>

                  {/* Coupon */}
                  {!appliedCoupon && (
                    <div className="mt-5 space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 flex items-center gap-1.5">
                        <Tag className="h-3 w-3" />
                        {t('discountCode')}
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && couponCode.trim()) {
                              applyCouponMutation.mutate(couponCode.trim());
                            }
                          }}
                          placeholder={t('enterCoupon')}
                          className="flex-1 min-w-0 bg-gray-50 border border-gray-100 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all uppercase tracking-widest disabled:opacity-50"
                          disabled={loading}
                          data-testid="input-coupon-code"
                        />
                        <Button
                          variant="outline"
                          onClick={() => { if (couponCode.trim()) applyCouponMutation.mutate(couponCode.trim()); }}
                          disabled={loading || !couponCode.trim()}
                          className="h-10 px-4 shrink-0 border-gray-100 hover:bg-black hover:text-white transition-all rounded-xl text-[10px] font-black tracking-widest"
                          data-testid="button-apply-coupon"
                        >
                          {loading ? '...' : t('apply')}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Applied coupon badge */}
                  {appliedCoupon && (
                    <div className="mt-4 flex items-center justify-between bg-emerald-50 border border-emerald-100 rounded-xl px-3.5 py-2.5">
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-emerald-600" />
                        <span className="text-xs font-black text-emerald-700 uppercase tracking-widest">{appliedCoupon.code}</span>
                      </div>
                      <button onClick={() => clearCoupon()} className="text-gray-300 hover:text-red-400 text-xs font-black transition-colors">إلغاء</button>
                    </div>
                  )}

                  {/* Checkout button */}
                  <Button
                    size="lg"
                    onClick={handleCheckoutClick}
                    data-testid="button-proceed-checkout"
                    className="w-full font-black h-13 h-12 sm:h-14 uppercase tracking-[0.2em] rounded-2xl mt-5 shadow-lg shadow-primary/20 active:scale-95 transition-all text-xs sm:text-sm"
                  >
                    {t('checkout')}
                    <ChevronLeft className={`h-4 w-4 mr-1 ${language === "ar" ? "rotate-180" : ""}`} />
                  </Button>
                </div>

                {/* Security badge */}
                <div className="bg-white rounded-2xl p-3.5 border border-gray-100 shadow-sm flex items-center justify-center gap-2.5 text-gray-400">
                  <Shield className="h-4 w-4 shrink-0" />
                  <span className="text-[10px] font-black uppercase tracking-widest">{t('secureShipping')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {!user && <AuthModal open={authOpen} onOpenChange={setAuthOpen} defaultTab="login" />}
    </Layout>
  );
}
