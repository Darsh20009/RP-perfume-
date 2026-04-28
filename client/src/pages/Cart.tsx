import { Layout } from "@/components/Layout";
import { useCart } from "@/hooks/use-cart";
import { useCoupon } from "@/hooks/use-coupon";
import { Button } from "@/components/ui/button";
import { Trash2, ShoppingBag, Check, AlertCircle } from "lucide-react";
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

  // ── Bundle offers: ask the server to compute best bundle pricing for the cart
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
    
    // Check minimum order amount
    if (appliedCoupon.minOrderAmount && subtotal < appliedCoupon.minOrderAmount) {
      return 0;
    }

    if (appliedCoupon.type === "percentage") {
      return (subtotal * appliedCoupon.value) / 100;
    } else if (appliedCoupon.type === "cashback") {
      // Cashback doesn't reduce the order total, it's credited after purchase
      return 0;
    } else {
      return appliedCoupon.value;
    }
  };

  const calculateCashback = () => {
    if (!appliedCoupon || appliedCoupon.type !== "cashback") return 0;
    const subtotal = total();
    const cashbackAmount = (subtotal * appliedCoupon.value) / 100;
    // Apply max cashback limit if exists
    if (appliedCoupon.maxCashback && cashbackAmount > appliedCoupon.maxCashback) {
      return appliedCoupon.maxCashback;
    }
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
        <div className="container py-12 sm:py-16 md:py-24 text-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
            <ShoppingBag className="h-7 w-7 sm:h-9 sm:w-9 md:h-10 md:w-10 text-muted-foreground" />
          </div>
          <h1 className="font-display text-xl sm:text-2xl md:text-3xl font-bold mb-3 sm:mb-4">{t('emptyCart')}</h1>
          <p className="text-sm sm:text-base text-muted-foreground mb-6 sm:mb-8">{t('emptyCartDesc')}</p>
          <Link href="/products">
            <Button size="lg">{t('browseProducts')}</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="bg-[#fcfcfc] min-h-screen">
        <div className="container py-5 sm:py-10 md:py-14 lg:py-20 px-3 sm:px-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-5 sm:mb-8 md:mb-12 lg:mb-16 gap-2 sm:gap-4 border-b border-black/5 pb-3 sm:pb-6 md:pb-8">
            <h1 className={`font-display text-xl sm:text-2xl md:text-4xl lg:text-5xl font-black uppercase tracking-tighter ${language === 'ar' ? 'text-right' : 'text-left'}`}>
              {t('shoppingBag')}
            </h1>
            <div className="flex items-center gap-2 sm:gap-4 text-[10px] sm:text-[10px] font-black uppercase tracking-widest text-muted-foreground flex-wrap">
              <span className="text-foreground">{t('shoppingBag')}</span>
              <span className="opacity-20">/</span>
              <span>{t('checkout')}</span>
              <span className="opacity-20">/</span>
              <span>{t('payment')}</span>
            </div>
          </div>
          
          <div className="grid lg:grid-cols-12 gap-4 sm:gap-6 lg:gap-12 items-start">
            {/* Cart Items */}
            <div className="lg:col-span-8 space-y-3 sm:space-y-4 md:space-y-6">
              {items.map((item) => (
                <div key={`${item.productId}-${item.variantSku}`} className="group relative bg-card p-3 sm:p-4 md:p-6 shadow-sm hover:shadow-md transition-all duration-500 border border-border rounded-md">
                  <div className="flex gap-3 sm:gap-5 md:gap-8">
                    <div className="w-16 sm:w-24 md:w-28 lg:w-36 aspect-[3/4] bg-muted overflow-hidden shrink-0 border border-border rounded-sm">
                      <img src={item.image} alt={item.title} className="w-full h-full object-cover transition-transform duration-700 " />
                    </div>
                    
                    <div className={`flex-1 flex flex-col justify-between min-w-0 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                      <div className="space-y-1.5 sm:space-y-2">
                        <div className="flex justify-between items-start gap-2">
                          <h3 className="font-black text-xs sm:text-base md:text-lg lg:text-xl uppercase tracking-tighter leading-tight line-clamp-2 break-words">{item.title}</h3>
                          <button 
                            onClick={() => removeItem(item.productId, item.variantSku)}
                            className="text-muted-foreground/50 hover:text-red-500 transition-colors shrink-0"
                            aria-label="حذف"
                          >
                            <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
                          </button>
                        </div>
                        <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                          {item.color} <span className="mx-1.5 sm:mx-2 opacity-20">|</span> {item.size}
                        </p>
                        <div className="pt-2 sm:pt-3 md:pt-4">
                          <span className="font-black text-base sm:text-lg md:text-xl tracking-tight">{(item.price * item.quantity).toLocaleString()} <RiyalSign /></span>
                        </div>
                      </div>
                      
                      <div className={`flex items-center gap-3 sm:gap-6 mt-3 sm:mt-5 md:mt-6 ${language === 'ar' ? 'justify-end' : 'justify-start'}`}>
                        <div className="flex items-center bg-muted p-0.5 sm:p-1 rounded-md">
                          <button 
                            onClick={() => updateQuantity(item.productId, item.variantSku, Math.max(1, item.quantity - 1))}
                            className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center hover:bg-background transition-all text-base sm:text-lg font-light"
                          >
                            -
                          </button>
                          <span className="text-xs sm:text-sm font-black w-8 sm:w-10 text-center">{item.quantity}</span>
                          <button 
                            onClick={() => updateQuantity(item.productId, item.variantSku, item.quantity + 1)}
                            className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center hover:bg-background transition-all text-base sm:text-lg font-light"
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

            {/* Summary */}
            <div className="lg:col-span-4">
              <div className="lg:sticky lg:top-24 space-y-4 sm:space-y-6">
                <div className="bg-white p-4 sm:p-6 md:p-8 border border-black/5 shadow-sm rounded-md">
                  <h3 className={`text-xs font-black uppercase tracking-[0.3em] text-black/40 mb-8 pb-4 border-b border-black/5 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                    {t('bagSummary')}
                  </h3>
                  
                  <div className="space-y-4 text-[11px] font-bold uppercase tracking-widest">
                    <div className={`flex justify-between ${language === 'ar' ? '' : 'flex-row-reverse'}`}>
                      <span className="text-black">{subtotal.toLocaleString()} <RiyalSign /></span>
                      <span className="opacity-40">{t('subtotal')}</span>
                    </div>
                    <div className={`flex justify-between ${language === 'ar' ? '' : 'flex-row-reverse'}`}>
                      <span className="text-black/50">{vatIncluded.toLocaleString()} <RiyalSign /></span>
                      <span className="opacity-40">ضريبة ١٥٪ (مشمولة)</span>
                    </div>
                    
                    {appliedCoupon && discountAmount > 0 && (
                      <div className={`flex justify-between text-green-600 ${language === 'ar' ? '' : 'flex-row-reverse'}`}>
                        <span>-{discountAmount.toLocaleString()} <RiyalSign /></span>
                        <div className="flex items-center gap-2">
                          <span className="opacity-60">{t('discount')}</span>
                          <button
                            onClick={() => clearCoupon()}
                            className="opacity-40 hover:opacity-100 transition-opacity text-[9px]"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    )}

                    {bundleSavings > 0 && (
                      <div
                        className={`flex justify-between text-[#850935] ${language === 'ar' ? '' : 'flex-row-reverse'}`}
                        data-testid="row-bundle-savings"
                      >
                        <span className="font-bold">-{bundleSavings.toLocaleString()} <RiyalSign /></span>
                        <span className="opacity-80">عرض الباقة</span>
                      </div>
                    )}
                    {bundleResult?.applications && bundleResult.applications.length > 0 && (
                      <div className="text-[10px] text-[#2B2B60] bg-[#F5F2ED] rounded p-2 leading-relaxed">
                        {bundleResult.applications.map((a: any, i: number) => (
                          <div key={i}>
                            ✓ {a.offerTitle || `${a.tierQuantity} قطع`} — وفّرت {a.savings?.toLocaleString()} <RiyalSign />
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {appliedCoupon && cashbackAmount > 0 && (
                      <div className={`flex justify-between text-blue-600 ${language === 'ar' ? '' : 'flex-row-reverse'}`}>
                        <span>+{cashbackAmount.toLocaleString()} <RiyalSign /></span>
                        <div className="flex items-center gap-2">
                          <span className="opacity-60">{t('cashback')}</span>
                          <button
                            onClick={() => clearCoupon()}
                            className="opacity-40 hover:opacity-100 transition-opacity text-[9px]"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    )}
                    
                    <div className={`flex justify-between pt-4 sm:pt-5 md:pt-6 mt-4 sm:mt-5 md:mt-6 border-t border-black/5 font-black text-lg sm:text-2xl md:text-3xl tracking-tighter text-black ${language === 'ar' ? '' : 'flex-row-reverse'}`}>
                      <span className="text-primary">{finalTotal.toLocaleString()} <RiyalSign /></span>
                      <span>{t('total')}</span>
                    </div>
                  </div>

                  <div className="mt-5 sm:mt-7 md:mt-10 space-y-3 sm:space-y-4">
                    {!appliedCoupon && (
                      <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase tracking-[0.2em] text-black/30 block">{t('discountCode')}</label>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={couponCode}
                            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter' && couponCode.trim()) {
                                applyCouponMutation.mutate(couponCode.trim());
                              }
                            }}
                            placeholder={t('enterCoupon')}
                            className="flex-1 min-w-0 bg-black/5 border-none p-3 sm:p-4 text-xs focus:ring-1 focus:ring-black/10 transition-all uppercase tracking-widest disabled:opacity-50 rounded-md"
                            disabled={loading}
                            data-testid="input-coupon-code"
                          />
                          <Button 
                            variant="outline" 
                            onClick={() => {
                              if (couponCode.trim()) {
                                applyCouponMutation.mutate(couponCode.trim());
                              }
                            }}
                            disabled={loading || !couponCode.trim()}
                            className="h-10 sm:h-12 px-3 sm:px-6 shrink-0 border-black/10 hover:bg-black hover:text-white transition-all rounded-md uppercase text-[10px] font-black tracking-widest disabled:opacity-50"
                            data-testid="button-apply-coupon"
                          >
                            {loading ? '...' : t('apply')}
                          </Button>
                        </div>
                      </div>
                    )}

                    <Button
                      size="lg"
                      onClick={handleCheckoutClick}
                      data-testid="button-proceed-checkout"
                      className="w-full font-black h-12 sm:h-14 md:h-16 uppercase tracking-[0.25em] sm:tracking-[0.4em] rounded-md bg-black text-white hover:bg-primary border-none transition-all text-[11px] sm:text-xs shadow-xl shadow-black/10 active:scale-95"
                    >
                      {t('checkout')}
                    </Button>
                  </div>
                  
                  <div className="mt-5 sm:mt-7 md:mt-8 pt-5 sm:pt-7 md:pt-8 border-t border-black/5">
                    <p className="text-[9px] uppercase tracking-[0.25em] sm:tracking-[0.3em] opacity-30 text-center font-black leading-relaxed">
                      {t('freeShippingPromo')}
                    </p>
                  </div>
                </div>
                
                {/* Security Badge */}
                <div className="bg-black/[0.02] p-4 sm:p-6 border border-black/5 flex items-center justify-center gap-3 sm:gap-4 opacity-40 rounded-md">
                  <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="text-[9px] font-black uppercase tracking-widest">{t('secureShipping')}</span>
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
