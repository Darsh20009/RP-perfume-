import { Layout } from "@/components/Layout";
import { useCart } from "@/hooks/use-cart";
import { useCoupon } from "@/hooks/use-coupon";
import { Button } from "@/components/ui/button";
import { Trash2, ShoppingBag, Check, AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { useLanguage } from "@/hooks/use-language";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function Cart() {
  const { items, removeItem, updateQuantity, total } = useCart();
  const { appliedCoupon, setCoupon, clearCoupon } = useCoupon();
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [couponCode, setCouponCode] = useState("");
  const [loading, setLoading] = useState(false);

  const applyCouponMutation = useMutation({
    mutationFn: async (code: string) => {
      setLoading(true);
      const res = await fetch(`/api/coupons/${code}`);
      if (!res.ok) throw new Error("كود الخصم غير صحيح أو منتهي");
      return res.json();
    },
    onSuccess: (coupon) => {
      setCoupon(coupon);
      setCouponCode("");
      toast({ title: "تمت إضافة كود الخصم بنجاح" });
      setLoading(false);
    },
    onError: (err: any) => {
      toast({ title: "خطأ", description: err.message || "فشل تطبيق الكود", variant: "destructive" });
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
  const tax = (subtotal * 0.15);
  const finalTotal = subtotal + tax - discountAmount;

  if (items.length === 0) {
    return (
      <Layout>
        <div className="container py-24 text-center">
          <div className="w-24 h-24 bg-secondary rounded-full flex items-center justify-center mx-auto mb-6">
            <ShoppingBag className="h-10 w-10 text-muted-foreground" />
          </div>
          <h1 className="font-display text-3xl font-bold mb-4">{t('emptyCart')}</h1>
          <p className="text-muted-foreground mb-8">{t('emptyCartDesc')}</p>
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
        <div className="container py-12 sm:py-14 md:py-16 lg:py-20 px-3 sm:px-4">
          <div className="flex flex-col md:flex-row items-center justify-between mb-10 sm:mb-12 md:mb-14 lg:mb-16 gap-4 sm:gap-6 border-b border-black/5 pb-6 sm:pb-8">
            <h1 className={`font-display text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tighter ${language === 'ar' ? 'text-right' : 'text-left'}`}>
              {t('shoppingBag')}
            </h1>
            <div className="flex items-center gap-2 sm:gap-4 text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-muted-foreground flex-wrap justify-center md:justify-end">
              <span className="text-foreground">{t('shoppingBag')}</span>
              <span className="opacity-20">/</span>
              <span>{t('checkout')}</span>
              <span className="opacity-20">/</span>
              <span>{t('payment')}</span>
            </div>
          </div>
          
          <div className="grid lg:grid-cols-12 gap-12 items-start">
            {/* Cart Items */}
            <div className="lg:col-span-8 space-y-6">
              {items.map((item) => (
                <div key={`${item.productId}-${item.variantSku}`} className="group relative bg-card p-6 shadow-sm hover:shadow-md transition-all duration-500 border border-border">
                  <div className="flex gap-4 sm:gap-6 md:gap-8">
                    <div className="w-20 sm:w-24 md:w-28 lg:w-36 aspect-[3/4] bg-muted overflow-hidden shrink-0 border border-border">
                      <img src={item.image} alt={item.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                    </div>
                    
                    <div className={`flex-1 flex flex-col justify-between ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                      <div className="space-y-2">
                        <div className="flex justify-between items-start gap-2">
                          <h3 className="font-black text-sm sm:text-base md:text-lg lg:text-xl uppercase tracking-tighter leading-none">{item.title}</h3>
                          <button 
                            onClick={() => removeItem(item.productId, item.variantSku)}
                            className="text-muted-foreground/50 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                          {item.color} <span className="mx-2 opacity-20">|</span> {item.size}
                        </p>
                        <div className="pt-4">
                          <span className="font-black text-xl tracking-tight">{(item.price * item.quantity).toLocaleString()} {t('currency')}</span>
                        </div>
                      </div>
                      
                      <div className={`flex items-center gap-8 mt-6 ${language === 'ar' ? 'justify-end' : 'justify-start'}`}>
                        <div className="flex items-center bg-muted p-1 rounded-none">
                          <button 
                            onClick={() => updateQuantity(item.productId, item.variantSku, Math.max(1, item.quantity - 1))}
                            className="w-10 h-10 flex items-center justify-center hover:bg-background transition-all text-lg font-light"
                          >
                            -
                          </button>
                          <span className="text-sm font-black w-10 text-center">{item.quantity}</span>
                          <button 
                            onClick={() => updateQuantity(item.productId, item.variantSku, item.quantity + 1)}
                            className="w-10 h-10 flex items-center justify-center hover:bg-background transition-all text-lg font-light"
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
              <div className="sticky top-24 space-y-6">
                <div className="bg-white p-8 border border-black/5 shadow-sm">
                  <h3 className={`text-xs font-black uppercase tracking-[0.3em] text-black/40 mb-8 pb-4 border-b border-black/5 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                    {t('bagSummary')}
                  </h3>
                  
                  <div className="space-y-4 text-[11px] font-bold uppercase tracking-widest">
                    <div className={`flex justify-between ${language === 'ar' ? '' : 'flex-row-reverse'}`}>
                      <span className="text-black">{subtotal.toLocaleString()} {t('currency')}</span>
                      <span className="opacity-40">{t('subtotal')}</span>
                    </div>
                    <div className={`flex justify-between ${language === 'ar' ? '' : 'flex-row-reverse'}`}>
                      <span className="text-black">{tax.toLocaleString()} {t('currency')}</span>
                      <span className="opacity-40">{t('tax')}</span>
                    </div>
                    
                    {appliedCoupon && discountAmount > 0 && (
                      <div className={`flex justify-between text-green-600 ${language === 'ar' ? '' : 'flex-row-reverse'}`}>
                        <span>-{discountAmount.toLocaleString()} {t('currency')}</span>
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
                    
                    {appliedCoupon && cashbackAmount > 0 && (
                      <div className={`flex justify-between text-blue-600 ${language === 'ar' ? '' : 'flex-row-reverse'}`}>
                        <span>+{cashbackAmount.toLocaleString()} {t('currency')}</span>
                        <div className="flex items-center gap-2">
                          <span className="opacity-60">كاش باك</span>
                          <button
                            onClick={() => clearCoupon()}
                            className="opacity-40 hover:opacity-100 transition-opacity text-[9px]"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    )}
                    
                    <div className={`flex justify-between pt-6 mt-6 border-t border-black/5 font-black text-3xl tracking-tighter text-black ${language === 'ar' ? '' : 'flex-row-reverse'}`}>
                      <span className="text-primary">{finalTotal.toLocaleString()} {t('currency')}</span>
                      <span>{t('total')}</span>
                    </div>
                  </div>

                  <div className="mt-10 space-y-4">
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
                            className="flex-1 bg-black/5 border-none p-4 text-xs focus:ring-1 focus:ring-black/10 transition-all uppercase tracking-widest disabled:opacity-50"
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
                            className="h-12 px-6 border-black/10 hover:bg-black hover:text-white transition-all rounded-none uppercase text-[10px] font-black tracking-widest disabled:opacity-50"
                            data-testid="button-apply-coupon"
                          >
                            {loading ? '...' : t('apply')}
                          </Button>
                        </div>
                      </div>
                    )}

                    <Link href="/checkout">
                      <Button size="lg" className="w-full font-black h-16 uppercase tracking-[0.4em] rounded-none bg-black text-white hover:bg-primary border-none transition-all text-xs shadow-xl shadow-black/10 active:scale-95">
                        {t('checkout')}
                      </Button>
                    </Link>
                  </div>
                  
                  <div className="mt-8 pt-8 border-t border-black/5">
                    <p className="text-[9px] uppercase tracking-[0.3em] opacity-30 text-center font-black leading-relaxed">
                      {t('freeShippingPromo')}
                    </p>
                  </div>
                </div>
                
                {/* Security Badge */}
                <div className="bg-black/[0.02] p-6 border border-black/5 flex items-center justify-center gap-4 opacity-40">
                  <Check className="h-4 w-4" />
                  <span className="text-[9px] font-black uppercase tracking-widest">{t('secureShipping')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
