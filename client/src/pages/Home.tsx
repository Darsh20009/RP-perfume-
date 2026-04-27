import { Layout } from "@/components/Layout";
import { CustomerTestimonials } from "@/components/CustomerTestimonials";
import { ProductCard } from "@/components/ProductCard";
import { useProducts } from "@/hooks/use-products";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import * as LucideIcons from "lucide-react";
import {
  ShoppingBag, Star, ShieldCheck, Truck, ChevronRight, ChevronLeft,
  Zap, Clock, RotateCcw, Headphones, Package, Tag, ArrowLeft, ArrowRight,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useLanguage } from "@/hooks/use-language";
import { useAuth } from "@/hooks/use-auth";
import { useAuthProviders } from "@/hooks/use-auth-providers";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { MarketingBanners } from "@/components/marketing-banners";
const logoImg = "/images/logos/logo-dark.png";
import { useQuery } from "@tanstack/react-query";
import brandCtaImg from "@assets/Screenshot_2026-04-16_at_2.09.21_PM_1777231488177.png";
import { useCart } from "@/hooks/use-cart";
import { useToast } from "@/hooks/use-toast";
import { RiyalSign } from "@/components/RiyalSign";

const heroSlides: Array<{ img: string; webp?: string }> = [
  { img: "/images/banners/banner-hero-opt.png", webp: "/images/banners/banner-hero.webp" },
];

function FlashCountdown({ endTime }: { endTime?: string }) {
  const getRemaining = () => {
    if (!endTime) return { h: 5, m: 59, s: 59 };
    const diff = Math.max(0, new Date(endTime).getTime() - Date.now());
    const totalSecs = Math.floor(diff / 1000);
    return {
      h: Math.floor(totalSecs / 3600),
      m: Math.floor((totalSecs % 3600) / 60),
      s: totalSecs % 60,
    };
  };
  const [time, setTime] = useState(getRemaining);
  useEffect(() => {
    const iv = setInterval(() => setTime(getRemaining()), 1000);
    return () => clearInterval(iv);
  }, [endTime]);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <div className="flex items-center gap-1" dir="ltr">
      {[pad(time.h), pad(time.m), pad(time.s)].map((v, i) => (
        <span key={i} className="flex items-center gap-1">
          <span className="bg-[#2B2B60] text-white font-bold text-lg w-10 h-10 flex items-center justify-center rounded-lg tabular-nums">
            {v}
          </span>
          {i < 2 && <span className="text-[#2B2B60] font-bold text-lg">:</span>}
        </span>
      ))}
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: products, isLoading } = useProducts();
  const { t, tx, language } = useLanguage();
  const { toast } = useToast();
  const { googleEnabled, appleEnabled, anyEnabled } = useAuthProviders();
  const isRtl = language === "ar";

  // Show a friendly toast if redirected back with an OAuth error
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const err = params.get("auth_error");
    if (err) {
      const map: Record<string, string> = {
        invalid_state: "انتهت صلاحية الجلسة، حاول مرة أخرى",
        missing_code: "تم إلغاء عملية تسجيل الدخول",
        access_denied: "تم رفض الوصول",
      };
      toast({
        title: "تعذّر تسجيل الدخول",
        description: map[err] || "حدث خطأ أثناء تسجيل الدخول، يرجى المحاولة مرة أخرى",
        variant: "destructive",
      });
      params.delete("auth_error");
      const newUrl = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
      window.history.replaceState({}, "", newUrl);
    }
  }, [toast]);
  const { data: dbCategories } = useQuery<any[]>({ queryKey: ["/api/categories"] });
  const [heroIdx, setHeroIdx] = useState(0);
  const [isAutoPlay, setIsAutoPlay] = useState(true);
  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const featuredProducts = products?.slice(0, 8) || [];
  const bestSellers = products?.slice(0, 4) || [];

  const { data: flashDealsData = [] } = useQuery<any[]>({ queryKey: ["/api/flash-deals"] });
  const { data: bundleOffers = [] } = useQuery<any[]>({ queryKey: ["/api/bundle-offers"] });
  const homeBundles = (bundleOffers || []).filter((b: any) => b.showOnHome !== false);
  const hasFlashDeals = flashDealsData.length > 0;
  const flashEndTime = hasFlashDeals
    ? flashDealsData.sort((a, b) => new Date(a.endTime).getTime() - new Date(b.endTime).getTime())[0]?.endTime
    : undefined;
  const flashDealProducts = hasFlashDeals
    ? flashDealsData.map((deal: any) => ({
        ...deal.product,
        _flashDeal: deal,
        price: deal.product?.price
          ? (deal.product.price * (1 - deal.discountPercent / 100)).toFixed(2)
          : deal.product?.price,
        originalPrice: deal.product?.price,
        discountBadge: `${deal.discountPercent}%`,
      }))
    : [];

  useEffect(() => {
    if (user && ["admin", "employee", "support"].includes(user.role)) {
      setLocation("/admin");
    }
  }, [user, setLocation]);

  const nextSlide = useCallback(() => setHeroIdx(p => (p + 1) % heroSlides.length), []);
  const prevSlide = useCallback(() => setHeroIdx(p => (p - 1 + heroSlides.length) % heroSlides.length), []);

  useEffect(() => {
    if (!isAutoPlay) return;
    autoRef.current = setInterval(nextSlide, 5000);
    return () => { if (autoRef.current) clearInterval(autoRef.current); };
  }, [isAutoPlay, nextSlide, heroIdx]);

  const slide = heroSlides[heroIdx];

  const getProductsForCategory = (categoryId: string) => {
    return (products || []).filter((p: any) =>
      p.categoryId === categoryId || (p.categoryIds || []).includes(categoryId)
    ).slice(0, 4);
  };

  return (
    <Layout>
      <MarketingBanners />

      {/* ── HERO BANNER ─────────────────────────────── */}
      <section
        className="relative w-full overflow-hidden"
        onMouseEnter={() => setIsAutoPlay(false)}
        onMouseLeave={() => setIsAutoPlay(true)}
      >
        {/* Sizing image (invisible, sets the natural height) */}
        <img
          src={heroSlides[0].img}
          alt=""
          aria-hidden
          className="w-full h-auto block invisible"
          draggable={false}
        />
        {/* Stacked slides, cross-fade */}
        {heroSlides.map((s, i) => (
          <motion.div
            key={i}
            className="absolute inset-0 w-full h-full"
            initial={false}
            animate={{ opacity: i === heroIdx ? 1 : 0 }}
            transition={{ duration: 1.2, ease: "easeInOut" }}
            style={{ pointerEvents: i === heroIdx ? "auto" : "none" }}
          >
            <Link href="/products">
              <picture>
                {s.webp && <source srcSet={s.webp} type="image/webp" />}
                <img
                  src={s.img}
                  alt="RF Perfume"
                  className="w-full h-full object-cover block cursor-pointer"
                  draggable={false}
                  loading={i === 0 ? "eager" : "lazy"}
                  {...(i === 0 ? { fetchpriority: "high" as any } : {})}
                />
              </picture>
            </Link>
          </motion.div>
        ))}

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20">
          {heroSlides.map((_, i) => (
            <button
              key={i}
              onClick={() => { setHeroIdx(i); setIsAutoPlay(false); }}
              className={`h-2 rounded-full transition-all duration-500 ${i === heroIdx ? "bg-white w-8" : "bg-white/40 w-2 hover:bg-white/70"}`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      </section>

      {/* ── CATEGORY PREVIEW MOSAIC (above the fold) ─────────────── */}
      {dbCategories && dbCategories.length > 0 && products && products.length > 0 && (
        <section className="py-8 md:py-12 bg-white" data-testid="section-category-mosaic">
          <div className="container px-4">
            <div className={`grid gap-4 md:gap-5 ${
              dbCategories.filter((c: any) => !c.parentId).length >= 3
                ? "grid-cols-2 sm:grid-cols-3"
                : "grid-cols-2"
            }`}>
              {dbCategories
                .filter((cat: any) => !cat.parentId)
                .map((cat: any, idx: number) => {
                  const catProducts = getProductsForCategory(cat.id);
                  const catName = isRtl ? (cat.nameAr || cat.name) : cat.name;
                  const tiles = catProducts.slice(0, 4);
                  return (
                    <motion.div
                      key={cat.id || idx}
                      initial={{ opacity: 0, y: 18 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.45, delay: idx * 0.08 }}
                    >
                      <Link href={`/products?category=${cat.slug}`}>
                        <div
                          className="group cursor-pointer"
                          data-testid={`tile-cat-mosaic-${cat.slug}`}
                        >
                          {/* Mosaic of 4 product images per category */}
                          <div className="grid grid-cols-2 gap-1.5 sm:gap-2 rounded-3xl overflow-hidden bg-[#F7F3EC] aspect-square transition-transform duration-500 group-hover:scale-[1.02]">
                            {tiles.length > 0 ? (
                              [...tiles, ...Array(Math.max(0, 4 - tiles.length)).fill(null)].slice(0, 4).map((p: any, i: number) => {
                                const imgSrc = p?.images?.[0] || p?.image;
                                return (
                                  <div
                                    key={i}
                                    className="relative bg-[#F7F3EC] flex items-center justify-center overflow-hidden"
                                  >
                                    {imgSrc && (
                                      <img
                                        src={imgSrc}
                                        alt={isRtl ? (p.nameAr || p.name) : p.name}
                                        className="w-full h-full object-contain p-1.5 sm:p-2"
                                        loading="lazy"
                                      />
                                    )}
                                  </div>
                                );
                              })
                            ) : cat.image ? (
                              <img
                                src={cat.image}
                                alt={catName}
                                className="col-span-2 row-span-2 w-full h-full object-contain p-3 sm:p-4"
                                loading="lazy"
                              />
                            ) : null}
                          </div>
                          {/* Category label coming from the right (RTL aware) */}
                          <div className={`mt-3 flex items-center justify-between gap-2 ${isRtl ? "flex-row-reverse text-right" : "text-left"}`}>
                            <h3 className="text-sm sm:text-base md:text-lg font-bold text-[#2B2B60] truncate">
                              {catName}
                            </h3>
                            <span className={`inline-flex items-center gap-0.5 text-[10px] sm:text-xs font-bold text-[#DFB369] group-hover:text-[#c89853] transition-colors whitespace-nowrap ${isRtl ? "flex-row-reverse" : ""}`}>
                              {t("viewAll")}
                              {isRtl ? <ChevronLeft className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
                            </span>
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
            </div>
          </div>
        </section>
      )}

      {/* ── NEWEST PRODUCTS — auto-scrolling marquee strip ─────── */}
      {(products && products.length >= 5) && (
        <section className="py-10 md:py-14 bg-[#FFFFFF]">
          <div className="container px-4">
            <div className={`flex items-center justify-between mb-6 ${isRtl ? "flex-row-reverse" : ""}`}>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#DFB369] block mb-1">
                  {language === 'ar' ? 'وصل حديثًا' : 'Just In'}
                </span>
                <h2 className="text-2xl md:text-3xl font-bold text-[#2B2B60]">
                  {language === 'ar' ? 'أحدث المنتجات' : 'Latest Arrivals'}
                </h2>
              </div>
              <Link href="/products">
                <span className={`text-sm font-bold text-[#DFB369] hover:text-[#c89853] transition-colors flex items-center gap-1 ${isRtl ? "flex-row-reverse" : ""}`}>
                  {t('viewAll')}
                  {isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </span>
              </Link>
            </div>
            <div
              className="relative overflow-hidden group"
              data-testid="strip-latest-products"
              dir="ltr"
            >
              <div
                className="flex gap-3 animate-marquee-products group-hover:[animation-play-state:paused] py-2"
                style={{ width: "max-content" }}
              >
                {(() => {
                  const base = (products || []);
                  return [...base, ...base, ...base];
                })().map((product: any, i: number) => (
                  <div
                    key={`${product.id || product._id || i}-${i}`}
                    className="w-[170px] sm:w-[200px] md:w-[230px] shrink-0"
                  >
                    <ProductCard product={product} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── FLASH DEALS ────────────────────────────────── */}
      {flashDealProducts.length > 0 && (
        <section className="py-10 md:py-14 bg-white">
          <div className="container px-4">
            <div className={`flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8 ${isRtl ? "md:flex-row-reverse text-right" : "text-left"}`}>
              <div className={`flex items-center gap-3 ${isRtl ? "flex-row-reverse" : ""}`}>
                <div className="bg-red-500 text-white p-2.5 rounded-lg">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <span className="bg-red-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-sm uppercase tracking-wider">
                    {t('limitedTime')}
                  </span>
                  <h2 className="text-2xl md:text-3xl font-bold text-[#2B2B60] mt-1">
                    {t('todaysDeals')}
                  </h2>
                </div>
              </div>
              <div className={`flex items-center gap-3 ${isRtl ? "flex-row-reverse" : ""}`}>
                <span className="text-gray-700 text-xs font-bold uppercase tracking-widest">
                  {t('endsInShort')}
                </span>
                <FlashCountdown endTime={flashEndTime} />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {flashDealProducts.slice(0, 4).map((product: any, i: number) => (
                <motion.div
                  key={product.id || product._id || i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className="relative"
                >
                  {product.discountBadge && (
                    <div className="absolute top-2 right-2 z-10 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      -{product.discountBadge}
                    </div>
                  )}
                  <ProductCard product={product} />
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── BUNDLE OFFERS ─────────────────────────────── */}
      {homeBundles.length > 0 && (
        <section className="py-10 md:py-14 bg-gradient-to-br from-[#2B2B60] via-[#0F0F0F] to-[#850935] text-white">
          <div className="container mx-auto px-4">
            <div className="text-center mb-8">
              <span className="inline-block px-4 py-1 rounded-full bg-[#DFB369] text-[#0F0F0F] text-xs font-bold tracking-wider mb-3">
                عروض الباقات
              </span>
              <h2 className="text-3xl md:text-4xl font-display font-bold mb-2">وفّر أكثر مع باقاتنا الفاخرة</h2>
              <p className="text-white/70">اختر مجموعة من العطور بسعر مميز — يُطبَّق الخصم تلقائياً عند الدفع</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {homeBundles.slice(0, 6).map((b: any) => (
                <Link key={b.id} href="/products" data-testid={`link-bundle-home-${b.id}`}>
                  <div className="bg-white/5 backdrop-blur border border-[#DFB369]/30 rounded-2xl p-6 h-full transition-colors hover:bg-white/10 cursor-pointer">
                    {b.badgeText && (
                      <span className="inline-block px-3 py-1 rounded-full text-xs font-bold mb-3"
                            style={{ backgroundColor: b.badgeColor || "#850935", color: "#fff" }}>
                        {b.badgeText}
                      </span>
                    )}
                    <h3 className="text-xl font-display font-bold mb-1">{b.title}</h3>
                    {b.description && <p className="text-sm text-white/70 mb-4">{b.description}</p>}
                    <div className="space-y-2 mt-4">
                      {(b.tiers || []).map((t: any, i: number) => (
                        <div key={i} className="flex items-center justify-between bg-white/10 rounded-lg px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-display font-bold text-[#DFB369]">{t.quantity}</span>
                            <span className="text-sm text-white/80">قطع</span>
                          </div>
                          <div className="text-right">
                            <div className="text-xl font-bold">{t.price} <span className="text-xs font-normal"><RiyalSign /></span></div>
                            {t.label && <div className="text-[10px] text-[#DFB369]">{t.label}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-5 text-center">
                      <span className="inline-block px-5 py-2 rounded-full bg-[#DFB369] text-[#0F0F0F] text-sm font-bold">
                        تسوق الآن ←
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── CATEGORIES WITH PRODUCTS (full sections) ──────────── */}
      {dbCategories && dbCategories.length > 0 && (
        <div className="bg-white">
          {dbCategories
            .filter((cat: any) => !cat.parentId)
            .map((cat: any, i: number) => {
              const catProducts = getProductsForCategory(cat.id);
              if (catProducts.length === 0) return null;
              const catName = isRtl ? (cat.nameAr || cat.name) : cat.name;
              return (
                <section
                  key={cat.id || i}
                  className={`py-10 md:py-14 ${i % 2 === 0 ? "bg-white" : "bg-[#FAF8F4]"}`}
                  data-testid={`section-category-${cat.slug}`}
                >
                  <div className="container px-4">
                    {/* Category image (top) — frameless, soft rounded, no crop on mobile */}
                    <Link href={`/products?category=${cat.slug}`}>
                      <div className="relative w-full mb-4 cursor-pointer group flex items-center justify-center">
                        {cat.image && (
                          <img
                            src={cat.image}
                            alt={catName}
                            className="w-full h-auto max-h-72 sm:max-h-80 md:max-h-96 lg:max-h-[28rem] object-contain rounded-3xl mx-auto transition-transform duration-700 group-hover:scale-[1.02]"
                            loading="lazy"
                          />
                        )}
                      </div>
                    </Link>

                    {/* Category text header (below image) */}
                    <div
                      className={`flex items-end justify-between gap-3 mb-6 ${isRtl ? "flex-row-reverse text-right" : "text-left"}`}
                    >
                      <div>
                        <span className="inline-block text-[10px] md:text-xs font-bold uppercase tracking-[0.3em] text-[#DFB369] mb-1.5">
                          {isRtl ? "تشكيلة" : "Collection"}
                        </span>
                        <h2 className="text-2xl md:text-4xl font-bold text-[#2B2B60]">
                          {catName}
                        </h2>
                      </div>
                      <Link href={`/products?category=${cat.slug}`}>
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs md:text-sm font-bold text-[#DFB369] hover:text-[#c89853] transition-colors whitespace-nowrap ${isRtl ? "flex-row-reverse" : ""}`}
                        >
                          {t("viewAll")}
                          {isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </span>
                      </Link>
                    </div>

                    {/* Products grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                      {catProducts.map((p: any, idx: number) => (
                        <motion.div
                          key={p.id || p._id || idx}
                          initial={{ opacity: 0, y: 16 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true }}
                          transition={{ delay: idx * 0.05 }}
                        >
                          <ProductCard product={p} />
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </section>
              );
            })}
        </div>
      )}

      {/* ── PROMOTIONAL BANNERS ────────────────────────── */}
      <section className="py-8 md:py-12 bg-[#FFFFFF]">
        <div className="container px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FeaturedBestSellerCard isRtl={isRtl} t={t} bestSellers={bestSellers} />

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative overflow-hidden rounded-xl h-44 md:h-56 group cursor-pointer bg-[#0F0F0F]"
            >
              <img src={brandCtaImg} alt="عطور آر اف - فخامتك تكمل بي عطور رفيف" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" />
              {/* Top inset shadow — makes the image look recessed/integrated into the page */}
              <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/70 via-black/25 to-transparent" />
              {/* Soft bottom shade for button readability */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/55 to-transparent" />
              {/* Subtle inner ring to enhance depth */}
              <div className="pointer-events-none absolute inset-0 rounded-xl shadow-[inset_0_2px_18px_rgba(0,0,0,0.55)]" />
              <div className={`absolute inset-0 p-6 flex flex-col justify-end ${isRtl ? "text-right items-end" : "text-left items-start"}`}>
                <Link href="/products">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-white hover:text-[#DFB369] transition-colors flex items-center gap-1 bg-white/15 backdrop-blur-sm px-4 py-2 rounded-full">
                    {t('shopNow')} {isRtl ? <ArrowLeft className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
                  </span>
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── STATS ──────────────────────────────────────── */}
      <StatsSection isRtl={isRtl} t={t} />


      {/* ── ماذا يقول عملاؤنا — TESTIMONIALS CAROUSEL ─────────────── */}
      <CustomerTestimonials />

      {/* ── TABBY & TAMARA ─────────────────────────────── */}
      <section className="py-12 md:py-16 bg-[#FFFFFF]">
        <div className="container px-4">
          <div className="text-center mb-10">
            <span className="inline-block px-4 py-1.5 rounded-full bg-[#DFB369]/10 border border-[#DFB369]/20 text-[10px] font-bold uppercase tracking-[0.3em] text-[#DFB369] mb-3">
              {t('flexiblePayment')}
            </span>
            <h2 className="text-2xl md:text-4xl font-bold text-[#2B2B60] leading-tight">
              {t('buyNow')} <span className="text-gray-700">{t('payLater')}</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Tabby */}
            <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="h-1 w-full bg-gradient-to-r from-transparent via-emerald-400 to-transparent" />
              <div className="p-6">
                <div className={`flex items-center justify-between mb-5 ${isRtl ? "flex-row-reverse" : ""}`}>
                  <div className="bg-gray-50 rounded-xl px-4 py-2 border border-gray-100">
                    <img src="/uploads/tabby-logo.png" alt="Tabby" className="h-6 w-auto object-contain" />
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 text-[10px] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {tx("متاح الآن", "Available")}
                  </span>
                </div>
                <h3 className={`text-lg font-bold text-[#2B2B60] mb-1 ${isRtl ? "text-right" : "text-left"}`}>
                  {tx("٤ أقساط بدون فوائد", "4 Payments, Zero Interest")}
                </h3>
                <p className={`text-gray-700 text-sm mb-5 ${isRtl ? "text-right" : "text-left"}`}>
                  {tx("قسّم فاتورتك على ٤ دفعات", "Split your bill into 4 payments")}
                </p>
                <div className="flex gap-2 mb-4" dir="ltr">
                  {[1, 2, 3, 4].map((n) => (
                    <div key={n} className="flex-1 flex flex-col items-center gap-1">
                      <div className={`w-full h-1 rounded-full ${n === 1 ? "bg-emerald-500" : "bg-emerald-100"}`} />
                      <span className={`text-[9px] font-bold ${n === 1 ? "text-emerald-600" : "text-gray-700"}`}>
                        {n === 1 ? (isRtl ? "الآن" : "Today") : `+${(n - 1) * 30}d`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Tamara */}
            <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="h-1 w-full bg-gradient-to-r from-transparent via-purple-400 to-transparent" />
              <div className="p-6">
                <div className={`flex items-center justify-between mb-5 ${isRtl ? "flex-row-reverse" : ""}`}>
                  <div className="bg-purple-50 rounded-xl px-4 py-2 border border-purple-100">
                    <img src="/uploads/tamara-logo.png" alt="Tamara" className="h-6 w-auto object-contain" />
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-50 border border-purple-200 text-purple-600 text-[10px] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                    {tx("متاح الآن", "Available")}
                  </span>
                </div>
                <h3 className={`text-lg font-bold text-[#2B2B60] mb-1 ${isRtl ? "text-right" : "text-left"}`}>
                  {tx("٣ أقساط بدون فوائد", "3 Payments, Zero Interest")}
                </h3>
                <p className={`text-gray-700 text-sm mb-5 ${isRtl ? "text-right" : "text-left"}`}>
                  {tx("قسّم طلبك على ٣ دفعات", "Split your order into 3 payments")}
                </p>
                <div className="flex gap-2 mb-4" dir="ltr">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="flex-1 flex flex-col items-center gap-1">
                      <div className={`w-full h-1 rounded-full ${n === 1 ? "bg-purple-500" : "bg-purple-100"}`} />
                      <span className={`text-[9px] font-bold ${n === 1 ? "text-purple-600" : "text-gray-700"}`}>
                        {n === 1 ? (isRtl ? "الآن" : "Today") : `+${(n - 1) * 30}d`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 md:gap-10">
            {[
              { icon: "🛡️", ar: "دفع آمن ومشفر", en: "Encrypted & Secure" },
              { icon: "⚡", ar: "موافقة خلال ثوانٍ", en: "Approved in Seconds" },
              { icon: "🔁", ar: "بدون أي رسوم خفية", en: "No Hidden Fees" },
              { icon: "📱", ar: "يعمل على جميع الأجهزة", en: "Works on All Devices" },
            ].map((item) => (
              <div key={item.ar} className={`flex items-center gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
                <span className="text-base">{item.icon}</span>
                <span className="text-gray-700 text-xs font-bold">{isRtl ? item.ar : item.en}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BEST SELLERS (Customer Favorites — moved to bottom) ───────── */}
      <section className="py-12 md:py-16 bg-white">
        <div className="container px-4">
          <div className={`flex items-center justify-between mb-8 ${isRtl ? "flex-row-reverse" : ""}`}>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#DFB369] block mb-1">
                {t('bestSellers')}
              </span>
              <h2 className="text-2xl md:text-4xl font-bold text-[#2B2B60]">
                {t('customerFavorites')}
              </h2>
            </div>
            <Link href="/products">
              <Button className="rounded-lg bg-[#2B2B60] text-white hover:bg-[#3A3A75] font-bold text-xs tracking-wider h-10 px-6">
                {t('viewAll')}
                {isRtl ? <ChevronLeft className="mr-2 h-4 w-4" /> : <ChevronRight className="ml-2 h-4 w-4" />}
              </Button>
            </Link>
          </div>
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="aspect-[3/4] bg-[#F5F2ED] animate-pulse rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {featuredProducts.slice(0, 8).map((product: any, i: number) => (
                <motion.div
                  key={product.id || product._id || i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06 }}
                >
                  <ProductCard product={product} />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── BRAND CTA ──────────────────────────────────── */}
      <section className="relative py-24 md:py-36 overflow-hidden bg-[#2B2B60]">
        <img src="/images/banners/promo-luxury-1.png" alt="" className="absolute inset-0 w-full h-full object-cover opacity-40" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#2B2B60]/80 via-[#2B2B60]/70 to-[#2B2B60]/90" />
        <div className="absolute inset-0 opacity-25" style={{ backgroundImage: "radial-gradient(circle at 15% 25%, #DFB369 0%, transparent 40%), radial-gradient(circle at 85% 75%, #DFB369 0%, transparent 40%)" }} />
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: `url("${logoImg}")`, backgroundRepeat: "repeat", backgroundSize: "120px" }} />
        <div className="container px-4 relative z-10 text-center max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="flex justify-center mb-8">
              <img src={logoImg} alt="RF Perfume" className="h-14 md:h-18 w-auto opacity-90 rounded-sm" />
            </div>
            <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white uppercase tracking-tight leading-[0.95] mb-6">
              {isRtl ? (
                <>فخامتك تكمل<br /><span className="text-[#DFB369]">بعطور آر اف</span></>
              ) : (
                <>Your Elegance<br /><span className="text-[#DFB369]">With RF Perfume</span></>
              )}
            </h2>
            <p className="text-white/50 text-lg font-light italic mb-10 max-w-2xl mx-auto leading-relaxed">
              {isRtl
                ? "فخامة لا تُنسى وحضور ساحر. كل عطر يحكي قصة فريدة."
                : "Unforgettable luxury and enchanting presence. Every fragrance tells a unique story."}
            </p>
            {user ? (
              <Link href="/products">
                <Button
                  size="lg"
                  className="h-14 md:h-16 px-10 md:px-16 text-xs md:text-sm font-bold uppercase tracking-[0.3em] rounded-lg bg-white text-[#2B2B60] hover:bg-[#DFB369] hover:text-white border-none transition-all duration-500"
                >
                  <ShoppingBag className={`${isRtl ? "ml-3" : "mr-3"} h-5 w-5`} />
                  {tx("ابدأ التسوق الآن", "Start Shopping Now")}
                </Button>
              </Link>
            ) : (
              <div className="flex flex-col items-center gap-4 max-w-md mx-auto px-2">
                {/* Primary: Sign up now */}
                <Link href="/register" className="w-full">
                  <Button
                    size="lg"
                    className="w-full h-14 md:h-16 text-[11px] sm:text-xs md:text-sm font-bold uppercase tracking-[0.2em] sm:tracking-[0.3em] rounded-lg bg-[#DFB369] text-[#0F0F0F] hover:bg-white hover:text-[#2B2B60] border-none shadow-2xl shadow-[#DFB369]/30 transition-all duration-500"
                    data-testid="button-cta-register"
                  >
                    <LucideIcons.UserPlus className={`${isRtl ? "ml-2 sm:ml-3" : "mr-2 sm:mr-3"} h-4 w-4 sm:h-5 sm:w-5`} />
                    {tx("سجّل الآن مجاناً", "Sign Up Now — Free")}
                  </Button>
                </Link>

                {anyEnabled && (
                  <>
                    {/* Divider */}
                    <div className="flex items-center gap-3 w-full">
                      <div className="flex-1 h-px bg-white/15" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-white/40 whitespace-nowrap">
                        {tx("أو سجّل بسرعة عبر", "or quick sign-in")}
                      </span>
                      <div className="flex-1 h-px bg-white/15" />
                    </div>

                    {/* Google + Apple — only render the providers that are configured */}
                    <div className={`grid ${googleEnabled && appleEnabled ? "grid-cols-2" : "grid-cols-1"} gap-3 w-full`}>
                      {googleEnabled && (
                        <a
                          href="/api/auth/google/start"
                          className="h-12 bg-white text-[#2B2B60] rounded-lg font-bold text-xs flex items-center justify-center gap-2 hover:bg-[#DFB369] hover:text-white transition-all"
                          data-testid="button-cta-google"
                        >
                          <svg viewBox="0 0 48 48" className="h-4 w-4">
                            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                          </svg>
                          Google
                        </a>
                      )}
                      {appleEnabled && (
                        <a
                          href="/api/auth/apple/start"
                          className="h-12 bg-black text-white rounded-lg font-bold text-xs flex items-center justify-center gap-2 hover:bg-white hover:text-black transition-all"
                          data-testid="button-cta-apple"
                        >
                          <svg viewBox="0 0 20 24" className="h-4 w-auto fill-current">
                            <path d="M13.23 3.02C14.28 1.71 14.94 0 14.94 0s-1.71.28-2.76 1.59c-.96 1.21-1.57 2.86-1.47 3.64.97.07 2.53-.3 3.52-2.21zM16.44 8.74c-1.77-.07-3.28 1-4.13 1-.85 0-2.14-.94-3.55-.91-1.82.03-3.5 1.06-4.43 2.71-1.9 3.28-.49 8.15 1.35 10.82.9 1.31 1.97 2.77 3.38 2.72 1.35-.05 1.86-.87 3.49-.87 1.62 0 2.09.87 3.51.84 1.46-.03 2.39-1.32 3.29-2.63.97-1.47 1.37-2.9 1.4-2.97-.03-.01-2.71-1.04-2.74-4.13-.03-2.59 2.11-3.83 2.21-3.9-1.2-1.78-3.08-1.68-3.78-1.68z" />
                          </svg>
                          Apple
                        </a>
                      )}
                    </div>
                  </>
                )}

                {/* Already have an account */}
                <Link
                  href="/login"
                  className="text-[11px] font-bold text-white/60 hover:text-[#DFB369] transition-colors mt-1"
                  data-testid="link-cta-login"
                >
                  {tx("لديك حساب؟ تسجيل الدخول", "Already a member? Sign in")}
                </Link>
              </div>
            )}

            <div className="mt-12 pt-8 border-t border-white/10">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/30 mb-4">
                {tx("نقبل جميع وسائل الدفع", "We Accept All Payment Methods")}
              </p>
              <div className="flex justify-center flex-wrap gap-3">
                {[
                  "https://media.zid.store/cdn-cgi/image/h=80,q=100/https://media.zid.store/apps/296480bb-8f91-40d7-884d-496b563c1629.jpg",
                  "https://media.zid.store/cdn-cgi/image/h=80,q=100/https://media.zid.store/static/apple_pay.svg",
                  "https://media.zid.store/cdn-cgi/image/h=80,q=100/https://media.zid.store/static/mada-circle.png",
                  "https://media.zid.store/cdn-cgi/image/h=80,q=100/https://media.zid.store/static/visa-circle.png",
                  "https://media.zid.store/cdn-cgi/image/h=80,q=100/https://media.zid.store/static/mastercard-circle.png",
                  "https://media.zid.store/cdn-cgi/image/h=80,q=100/https://media.zid.store/static/stc_pay.png",
                  "https://media.zid.store/cdn-cgi/image/h=80,q=100/https://media.zid.store/static/tabby2.svg",
                  "https://media.zid.store/cdn-cgi/image/h=80,q=100/https://media.zid.store/static/tamara2.svg",
                ].map((src, i) => (
                  <div key={i} className="h-9 w-9 bg-white/10 rounded-lg flex items-center justify-center hover:bg-white/20 transition-all">
                    <img src={src} alt="" className="h-6 w-6 object-contain" loading="lazy" />
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
}

function FeaturedBestSellerCard({ isRtl, t, bestSellers }: { isRtl: boolean; t: (k: string) => string; bestSellers: any[] }) {
  const { addItem } = useCart();
  const { toast } = useToast();
  const [index, setIndex] = useState(0);
  const [isHover, setIsHover] = useState(false);

  const list = useMemo(() => (bestSellers || []).filter(p => p && p.id).slice(0, 5), [bestSellers]);
  const product = list[index] || null;

  // Auto-rotate every 7s, pause on hover
  useEffect(() => {
    if (!list.length || isHover) return;
    const id = setInterval(() => setIndex(i => (i + 1) % list.length), 7000);
    return () => clearInterval(id);
  }, [list.length, isHover]);

  const { data: highlights } = useQuery<any>({
    queryKey: ["/api/products", product?.id, "highlights"],
    enabled: !!product?.id,
    staleTime: 24 * 60 * 60_000,
  });

  const handleAdd = () => {
    if (!product) return;
    const variant = (product.variants && product.variants[0]) || { sku: `${product.id}-default`, price: Number(product.price) || 0 };
    addItem(product, variant, 1);
    toast({ title: isRtl ? "تمت الإضافة إلى السلة" : "Added to cart", description: isRtl ? product.name : (product.nameEn || product.name) });
  };

  if (!product) {
    return (
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        className="relative overflow-hidden rounded-xl h-44 md:h-56 bg-gradient-to-br from-[#2B2B60] via-[#2B2B60] to-[#1c1c45] animate-pulse"
      />
    );
  }

  const productImg = (product.images && product.images[0]) || (product.variants?.[0]?.image) || "/images/logos/logo-light.png";
  const bullets: string[] = (isRtl ? highlights?.highlights_ar : highlights?.highlights_en) || [];
  const tagline: string = (isRtl ? highlights?.tagline_ar : highlights?.tagline_en) || (isRtl ? product.description : (product.descriptionEn || product.description)) || "";

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      onMouseEnter={() => setIsHover(true)}
      onMouseLeave={() => setIsHover(false)}
      className="relative overflow-hidden rounded-xl h-44 md:h-56 bg-gradient-to-br from-[#2B2B60] via-[#2B2B60] to-[#1c1c45] group"
      data-testid="featured-bestseller-card"
    >
      {/* Decorative gold radial */}
      <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ backgroundImage: "radial-gradient(circle at 80% 70%, #DFB369 0%, transparent 50%)" }} />
      {/* Top inset shadow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-black/40 to-transparent" />
      {/* Gold AI badge */}
      <div className={`absolute top-3 ${isRtl ? "right-3" : "left-3"} flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#DFB369]/20 backdrop-blur-md border border-[#DFB369]/40 z-10`}>
        <LucideIcons.Sparkles className="w-3 h-3 text-[#DFB369]" />
        <span className="text-[9px] font-bold uppercase tracking-wider text-[#DFB369]">{isRtl ? "الأكثر مبيعاً" : "Best Seller"}</span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={product.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.4 }}
          className={`absolute inset-0 flex ${isRtl ? "flex-row-reverse" : "flex-row"} items-stretch`}
        >
          {/* Product image side */}
          <Link href={`/products/${product.id}`} className="relative w-[42%] md:w-[40%] shrink-0 flex items-center justify-center p-3">
            <div className="absolute inset-2 rounded-xl bg-gradient-to-br from-white/15 to-white/5 backdrop-blur-sm border border-white/10" />
            <img
              src={productImg}
              alt={product.name}
              loading="lazy"
              className="relative max-h-[85%] max-w-[85%] object-contain drop-shadow-[0_8px_20px_rgba(0,0,0,0.5)] transition-transform duration-500 group-hover:scale-105"
              onError={(e: any) => { e.currentTarget.src = "/images/logos/logo-light.png"; }}
            />
          </Link>

          {/* Content side */}
          <div className={`flex-1 min-w-0 px-3 py-3 md:px-4 md:py-4 flex flex-col justify-between ${isRtl ? "text-right items-end" : "text-left items-start"}`}>
            <div className="w-full">
              <Link href={`/products/${product.id}`}>
                <h3 className="text-white text-sm md:text-base font-bold leading-tight line-clamp-1 hover:text-[#DFB369] transition-colors">
                  {isRtl ? product.name : (product.nameEn || product.name)}
                </h3>
              </Link>
              <div className={`mt-1 flex items-center gap-1.5 ${isRtl ? "flex-row-reverse" : ""}`}>
                <span className="text-[#DFB369] text-base md:text-lg font-bold">{Number(product.price).toFixed(0)}</span>
                <span className="text-[10px] text-white/70 font-bold"><RiyalSign /></span>
              </div>

              {bullets.length > 0 ? (
                <ul className="mt-1.5 space-y-0.5">
                  {bullets.slice(0, 2).map((b, i) => (
                    <li key={i} className={`text-[10px] md:text-[11px] text-white/85 leading-snug flex items-center gap-1 ${isRtl ? "flex-row-reverse" : ""}`}>
                      <span className="w-1 h-1 rounded-full bg-[#DFB369] shrink-0" />
                      <span className="line-clamp-1">{b}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1.5 text-[10px] md:text-[11px] text-white/75 leading-snug line-clamp-2">{tagline}</p>
              )}
            </div>

            <button
              onClick={handleAdd}
              data-testid={`button-add-featured-${product.id}`}
              className={`mt-2 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#DFB369] hover:bg-white text-[#2B2B60] text-[11px] font-bold uppercase tracking-wider transition-all shadow-lg hover:shadow-xl ${isRtl ? "flex-row-reverse" : ""}`}
            >
              <LucideIcons.ShoppingBag className="w-3.5 h-3.5" />
              {isRtl ? "أضف إلى السلة" : "Add to Cart"}
            </button>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Pagination dots */}
      {list.length > 1 && (
        <div className={`absolute bottom-1.5 ${isRtl ? "right-3" : "left-3"} flex gap-1 z-10`}>
          {list.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              aria-label={`Slide ${i + 1}`}
              data-testid={`featured-dot-${i}`}
              className={`h-1 rounded-full transition-all ${i === index ? "w-4 bg-[#DFB369]" : "w-1 bg-white/40 hover:bg-white/70"}`}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}

function StatsSection({ isRtl, t }: { isRtl: boolean; t: (k: string) => string }) {
  const { data: items } = useQuery<any[]>({
    queryKey: ["/api/stats"],
    staleTime: 5 * 60_000,
  });

  const fallback = [
    { valueAr: "+٥٠٠", valueEn: "500+", labelAr: t('happyCustomers'), labelEn: t('happyCustomers'), color: "#DFB369" },
    { valueAr: "+١٥٠", valueEn: "150+", labelAr: t('luxuryFragrances'), labelEn: t('luxuryFragrances'), color: "#DFB369" },
    { valueAr: "٩٩٪", valueEn: "99%", labelAr: t('customerSatisfaction'), labelEn: t('customerSatisfaction'), color: "#DFB369" },
    { valueAr: "٢-٤", valueEn: "2-4", labelAr: t('deliveryDays'), labelEn: t('deliveryDays'), color: "#DFB369" },
  ];

  const list = (items && items.length > 0) ? items : fallback;
  if (list.length === 0) return null;

  const cols = list.length === 1 ? "grid-cols-1"
    : list.length === 2 ? "grid-cols-2"
    : list.length === 3 ? "grid-cols-1 sm:grid-cols-3"
    : list.length === 4 ? "grid-cols-2 md:grid-cols-4"
    : "grid-cols-2 md:grid-cols-5";

  return (
    <section className="border-y border-[#E8E5E0] bg-white py-10" data-testid="stats-section">
      <div className="container px-4">
        <div className={`grid ${cols} gap-8 text-center`}>
          {list.map((stat: any, i: number) => (
            <motion.div
              key={(stat.id as string) || i}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="flex flex-col items-center"
              data-testid={`stat-item-${i}`}
            >
              <span
                className="text-4xl md:text-5xl font-bold tracking-tighter"
                style={{ color: stat.color || "#DFB369" }}
              >
                {isRtl ? (stat.valueAr || stat.valueEn) : (stat.valueEn || stat.valueAr)}
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-gray-700 mt-2">
                {isRtl ? (stat.labelAr || stat.labelEn) : (stat.labelEn || stat.labelAr)}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PromoStripSection({ isRtl, t, isAr }: { isRtl: boolean; t: (k: string) => string; isAr: boolean }) {
  const { data: items } = useQuery<any[]>({
    queryKey: ["/api/promo-strip"],
    staleTime: 5 * 60_000,
  });

  const fallback = [
    { icon: "Truck", titleAr: t('freeShippingTitle'), titleEn: t('freeShippingTitle'), subtitleAr: t('freeShippingSub'), subtitleEn: t('freeShippingSub'), color: "#DFB369", link: "" },
    { icon: "ShieldCheck", titleAr: t('original100'), titleEn: t('original100'), subtitleAr: t('qualityGuaranteed'), subtitleEn: t('qualityGuaranteed'), color: "#DFB369", link: "" },
    { icon: "RotateCcw", titleAr: t('freeReturns'), titleEn: t('freeReturns'), subtitleAr: t('within14Days'), subtitleEn: t('within14Days'), color: "#DFB369", link: "" },
    { icon: "Headphones", titleAr: t('support247'), titleEn: t('support247'), subtitleAr: t('dedicatedTeam'), subtitleEn: t('dedicatedTeam'), color: "#DFB369", link: "" },
  ];

  const list = (items && items.length > 0) ? items : fallback;
  const cols = list.length === 1 ? "grid-cols-1" : list.length === 2 ? "grid-cols-2" : list.length === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2 md:grid-cols-4";

  return (
    <section className="bg-[#f9f7f4] py-6 md:py-8 border-y border-[#E8E5E0]" data-testid="promo-strip">
      <div className="container px-4">
        <div className={`grid ${cols} gap-4`}>
          {list.map((badge: any, i: number) => {
            const Icon = (LucideIcons as any)[badge.icon] || Truck;
            const inner = (
              <div className={`flex items-center gap-3 ${isRtl ? "flex-row-reverse text-right" : ""} ${badge.link ? "cursor-pointer  transition-transform" : ""}`}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${badge.color || "#DFB369"}1f` }}>
                  <Icon className="w-5 h-5" style={{ color: badge.color || "#DFB369" }} />
                </div>
                <div>
                  <p className="text-[#2B2B60] text-xs font-bold">{isAr ? (badge.titleAr || badge.titleEn) : (badge.titleEn || badge.titleAr)}</p>
                  <p className="text-gray-700 text-[10px]">{isAr ? (badge.subtitleAr || badge.subtitleEn) : (badge.subtitleEn || badge.subtitleAr)}</p>
                </div>
              </div>
            );
            return badge.link
              ? <Link key={i} href={badge.link}>{inner}</Link>
              : <div key={i}>{inner}</div>;
          })}
        </div>
      </div>
    </section>
  );
}
