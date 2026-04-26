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
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { MarketingBanners } from "@/components/marketing-banners";
const logoImg = "/images/logos/logo-dark.png";
import { useQuery } from "@tanstack/react-query";

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
  const isRtl = language === "ar";
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

      {/* ── CATEGORY CARDS (option-b style) ──────────── */}
      {dbCategories && dbCategories.length > 0 && (
        <section className="py-8 md:py-12 bg-white">
          <div className="container px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              {dbCategories.map((cat: any, i: number) => (
                <motion.div
                  key={cat.id || i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                >
                  <Link href={`/products?category=${cat.slug}`}>
                    <div className="relative overflow-hidden rounded-xl aspect-[3/4] group cursor-pointer bg-[#F5F2ED]">
                      {cat.image ? (
                        <img
                          src={cat.image}
                          alt={isRtl ? (cat.nameAr || cat.name) : cat.name}
                          className="absolute inset-0 w-full h-full object-cover  transition-transform duration-700"
                          loading="lazy"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-[#F5F2ED] flex items-center justify-center">
                          <Tag className="w-12 h-12 text-[#DFB369]/30" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-4 text-center">
                        <h3 className="text-white text-sm md:text-base font-bold drop-shadow-lg">
                          {isRtl ? (cat.nameAr || cat.name) : cat.name}
                        </h3>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── TRUST STRIP (admin-controlled with hardcoded fallback) ─────── */}
      <PromoStripSection isRtl={isRtl} t={t} isAr={language === 'ar'} />

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
                            <div className="text-xl font-bold">{t.price} <span className="text-xs font-normal">ر.س</span></div>
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

      {/* ── CATEGORY SECTIONS WITH BANNERS ──────────── */}
      {dbCategories?.map((cat: any, catIdx: number) => {
        const catProducts = getProductsForCategory(cat.id || cat._id);
        if (catProducts.length === 0) return null;
        return (
          <section key={cat.id || catIdx} className={`py-10 md:py-14 ${catIdx % 2 === 0 ? "bg-white" : "bg-[#FFFFFF]"}`}>
            <div className="container px-4">
              {cat.image && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="mb-8"
                >
                  <Link href={`/products?category=${cat.slug}`}>
                    <div className="relative overflow-hidden rounded-xl bg-[#F5F2ED] cursor-pointer group">
                      {/* Natural-size image — no cropping, no fixed height */}
                      <img
                        src={cat.image}
                        alt={isRtl ? (cat.nameAr || cat.name) : cat.name}
                        className="block w-full h-auto max-h-[480px] object-contain mx-auto"
                        loading="lazy"
                      />
                      <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-black/55 via-black/15 to-transparent pointer-events-none" />
                      <div className={`absolute bottom-0 left-0 right-0 p-5 ${isRtl ? "text-right" : "text-left"}`}>
                        <h2 className="text-white text-2xl md:text-3xl font-bold drop-shadow-lg">
                          {isRtl ? (cat.nameAr || cat.name) : cat.name}
                        </h2>
                        <p className="text-white/80 text-sm mt-1 drop-shadow">
                          {t('discoverFullCollection')}
                        </p>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              )}

              <div className={`flex items-center justify-between mb-6 ${isRtl ? "flex-row-reverse" : ""}`}>
                {!cat.image && (
                  <h2 className="text-xl md:text-2xl font-bold text-[#2B2B60]">
                    {isRtl ? (cat.nameAr || cat.name) : cat.name}
                  </h2>
                )}
                {cat.image && <div />}
                <Link href={`/products?category=${cat.slug}`}>
                  <span className={`text-sm font-bold text-[#DFB369] hover:text-[#c89853] transition-colors flex items-center gap-1 ${isRtl ? "flex-row-reverse" : ""}`}>
                    {t('viewAll')}
                    {isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </span>
                </Link>
              </div>

              {catProducts.length >= 5 ? (
                <div className="relative overflow-hidden group" dir="ltr">
                  <div
                    className="flex gap-3 animate-marquee-products group-hover:[animation-play-state:paused] py-2"
                    style={{ width: "max-content" }}
                  >
                    {[...catProducts, ...catProducts, ...catProducts].map((product: any, i: number) => (
                      <div
                        key={`${product.id || product._id || i}-${i}`}
                        className="w-[170px] sm:w-[200px] md:w-[230px] shrink-0"
                      >
                        <ProductCard product={product} />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {catProducts.map((product: any, i: number) => (
                    <motion.div
                      key={product.id || product._id || i}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.08 }}
                    >
                      <ProductCard product={product} />
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </section>
        );
      })}

      {/* ── BEST SELLERS ───────────────────────────────── */}
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

      {/* ── PROMOTIONAL BANNERS ────────────────────────── */}
      <section className="py-8 md:py-12 bg-[#FFFFFF]">
        <div className="container px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative overflow-hidden rounded-xl h-44 md:h-56 group cursor-pointer bg-[#2B2B60]"
            >
              <img src="/images/banners/promo-luxury-1.png" alt="" className="absolute inset-0 w-full h-full object-cover  transition-transform duration-700" loading="lazy" />
              <div className="absolute inset-0 bg-gradient-to-tr from-[#2B2B60]/85 via-[#2B2B60]/40 to-transparent" />
              <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle at 80% 70%, #DFB369 0%, transparent 50%)" }} />
              <img src={logoImg} alt="" className="absolute -right-6 -bottom-6 w-32 h-32 object-contain opacity-15 rotate-12" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
              <div className={`absolute inset-0 p-6 flex flex-col justify-end ${isRtl ? "text-right items-end" : "text-left items-start"}`}>
                <Link href="/products">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-white hover:text-[#DFB369] transition-colors flex items-center gap-1 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full">
                    {t('discoverMore')} {isRtl ? <ArrowLeft className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
                  </span>
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative overflow-hidden rounded-xl h-44 md:h-56 group cursor-pointer bg-[#0F0F0F]"
            >
              <img src="/images/banners/promo-luxury-2.png" alt="" className="absolute inset-0 w-full h-full object-cover  transition-transform duration-700" loading="lazy" />
              <div className="absolute inset-0 bg-gradient-to-tl from-[#0F0F0F]/85 via-[#0F0F0F]/30 to-transparent" />
              <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle at 30% 80%, #DFB369 0%, transparent 50%)" }} />
              <img src={logoImg} alt="" className="absolute -left-6 -bottom-6 w-32 h-32 object-contain opacity-15 -rotate-12" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
              <div className={`absolute inset-0 p-6 flex flex-col justify-end ${isRtl ? "text-right items-end" : "text-left items-start"}`}>
                <Link href="/products">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-white hover:text-[#DFB369] transition-colors flex items-center gap-1 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full">
                    {t('shopNow')} {isRtl ? <ArrowLeft className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
                  </span>
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── STATS ──────────────────────────────────────── */}
      <section className="border-y border-[#E8E5E0] bg-white py-10">
        <div className="container px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { num: "+٥٠٠", num_en: "500+", label: t('happyCustomers') },
              { num: "+١٥٠", num_en: "150+", label: t('luxuryFragrances') },
              { num: "٩٩٪", num_en: "99%", label: t('customerSatisfaction') },
              { num: "٢-٤", num_en: "2-4", label: t('deliveryDays') },
            ].map((stat: any, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="flex flex-col items-center"
              >
                <span className="text-4xl md:text-5xl font-bold text-[#DFB369] tracking-tighter">
                  {isRtl ? stat.num : stat.num_en}
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-gray-700 mt-2">
                  {stat.label}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

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
            <Link href="/products">
              <Button
                size="lg"
                className="h-14 md:h-16 px-10 md:px-16 text-xs md:text-sm font-bold uppercase tracking-[0.3em] rounded-lg bg-white text-[#2B2B60] hover:bg-[#DFB369] hover:text-white border-none transition-all duration-500"
              >
                <ShoppingBag className={`${isRtl ? "ml-3" : "mr-3"} h-5 w-5`} />
                {tx("ابدأ التسوق الآن", "Start Shopping Now")}
              </Button>
            </Link>

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
