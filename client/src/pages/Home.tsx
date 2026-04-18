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

const heroSlides = [
  { img: "/images/banners/banner-1.png" },
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
          <span className="bg-[#1a2744] text-white font-bold text-lg w-10 h-10 flex items-center justify-center rounded-lg tabular-nums">
            {v}
          </span>
          {i < 2 && <span className="text-[#1a2744] font-bold text-lg">:</span>}
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
              <img
                src={s.img}
                alt="RF Perfume"
                className="w-full h-full object-cover block cursor-pointer"
                draggable={false}
                loading={i === 0 ? "eager" : "lazy"}
              />
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
                    <div className="relative overflow-hidden rounded-xl aspect-[3/4] group cursor-pointer bg-[#f5f0eb]">
                      {cat.image ? (
                        <img
                          src={cat.image}
                          alt={isRtl ? (cat.nameAr || cat.name) : cat.name}
                          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                          loading="lazy"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-[#f5f0eb] flex items-center justify-center">
                          <Tag className="w-12 h-12 text-[#c9a96e]/30" />
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
                  <h2 className="text-2xl md:text-3xl font-bold text-[#1a2744] mt-1">
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

      {/* ── CATEGORY SECTIONS WITH BANNERS ──────────── */}
      {dbCategories?.map((cat: any, catIdx: number) => {
        const catProducts = getProductsForCategory(cat.id || cat._id);
        if (catProducts.length === 0) return null;
        return (
          <section key={cat.id || catIdx} className={`py-10 md:py-14 ${catIdx % 2 === 0 ? "bg-white" : "bg-[#faf8f5]"}`}>
            <div className="container px-4">
              {cat.image && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="mb-8"
                >
                  <Link href={`/products?category=${cat.slug}`}>
                    <div className="relative overflow-hidden rounded-xl h-40 md:h-56 group cursor-pointer">
                      <img
                        src={cat.image}
                        alt={isRtl ? (cat.nameAr || cat.name) : cat.name}
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                      <div className={`absolute bottom-0 left-0 right-0 p-5 ${isRtl ? "text-right" : "text-left"}`}>
                        <h2 className="text-white text-2xl md:text-3xl font-bold drop-shadow-lg">
                          {isRtl ? (cat.nameAr || cat.name) : cat.name}
                        </h2>
                        <p className="text-white/70 text-sm mt-1">
                          {t('discoverFullCollection')}
                        </p>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              )}

              <div className={`flex items-center justify-between mb-6 ${isRtl ? "flex-row-reverse" : ""}`}>
                {!cat.image && (
                  <h2 className="text-xl md:text-2xl font-bold text-[#1a2744]">
                    {isRtl ? (cat.nameAr || cat.name) : cat.name}
                  </h2>
                )}
                {cat.image && <div />}
                <Link href={`/products?category=${cat.slug}`}>
                  <span className={`text-sm font-bold text-[#c9a96e] hover:text-[#b8944f] transition-colors flex items-center gap-1 ${isRtl ? "flex-row-reverse" : ""}`}>
                    {t('viewAll')}
                    {isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </span>
                </Link>
              </div>

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
            </div>
          </section>
        );
      })}

      {/* ── BEST SELLERS ───────────────────────────────── */}
      <section className="py-12 md:py-16 bg-white">
        <div className="container px-4">
          <div className={`flex items-center justify-between mb-8 ${isRtl ? "flex-row-reverse" : ""}`}>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#c9a96e] block mb-1">
                {t('bestSellers')}
              </span>
              <h2 className="text-2xl md:text-4xl font-bold text-[#1a2744]">
                {t('customerFavorites')}
              </h2>
            </div>
            <Link href="/products">
              <Button className="rounded-lg bg-[#1a2744] text-white hover:bg-[#243454] font-bold text-xs tracking-wider h-10 px-6">
                {t('viewAll')}
                {isRtl ? <ChevronLeft className="mr-2 h-4 w-4" /> : <ChevronRight className="ml-2 h-4 w-4" />}
              </Button>
            </Link>
          </div>
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="aspect-[3/4] bg-[#f5f0eb] animate-pulse rounded-xl" />
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
      <section className="py-8 md:py-12 bg-[#faf8f5]">
        <div className="container px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative overflow-hidden rounded-xl h-44 md:h-56 group cursor-pointer bg-gradient-to-br from-[#1a2744] via-[#2a3856] to-[#1a2744]"
            >
              <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 20% 30%, #c9a96e 0%, transparent 40%), radial-gradient(circle at 80% 70%, #c9a96e 0%, transparent 40%)" }} />
              <img src={logoImg} alt="" className="absolute -right-6 -bottom-6 w-40 h-40 object-contain opacity-10 rotate-12" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
              <div className={`absolute inset-0 p-6 flex flex-col justify-end ${isRtl ? "text-right items-end" : "text-left items-start"}`}>
                <Link href="/products">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-white hover:text-[#c9a96e] transition-colors flex items-center gap-1 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full">
                    {t('discoverMore')} {isRtl ? <ArrowLeft className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
                  </span>
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative overflow-hidden rounded-xl h-44 md:h-56 group cursor-pointer bg-gradient-to-br from-[#3d2817] via-[#5a3a22] to-[#c9a96e]"
            >
              <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 70% 30%, #fff 0%, transparent 35%), radial-gradient(circle at 30% 80%, #fff 0%, transparent 35%)" }} />
              <img src={logoImg} alt="" className="absolute -left-6 -bottom-6 w-40 h-40 object-contain opacity-10 -rotate-12" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
              <div className={`absolute inset-0 p-6 flex flex-col justify-end ${isRtl ? "text-right items-end" : "text-left items-start"}`}>
                <Link href="/products">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-white hover:text-[#c9a96e] transition-colors flex items-center gap-1 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full">
                    {t('shopNow')} {isRtl ? <ArrowLeft className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
                  </span>
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── STATS ──────────────────────────────────────── */}
      <section className="border-y border-[#e8e2d9] bg-white py-10">
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
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="flex flex-col items-center"
              >
                <span className="text-4xl md:text-5xl font-bold text-[#c9a96e] tracking-tighter">
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
      <section className="py-12 md:py-16 bg-[#faf8f5]">
        <div className="container px-4">
          <div className="text-center mb-10">
            <span className="inline-block px-4 py-1.5 rounded-full bg-[#c9a96e]/10 border border-[#c9a96e]/20 text-[10px] font-bold uppercase tracking-[0.3em] text-[#c9a96e] mb-3">
              {t('flexiblePayment')}
            </span>
            <h2 className="text-2xl md:text-4xl font-bold text-[#1a2744] leading-tight">
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
                <h3 className={`text-lg font-bold text-[#1a2744] mb-1 ${isRtl ? "text-right" : "text-left"}`}>
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
                <h3 className={`text-lg font-bold text-[#1a2744] mb-1 ${isRtl ? "text-right" : "text-left"}`}>
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
      <section className="relative py-24 md:py-36 overflow-hidden bg-[#1a2744]">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 15% 25%, #c9a96e 0%, transparent 35%), radial-gradient(circle at 85% 75%, #c9a96e 0%, transparent 35%), linear-gradient(135deg, #1a2744 0%, #2a3856 50%, #1a2744 100%)" }} />
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
                <>فخامتك تكمل<br /><span className="text-[#c9a96e]">بعطور رفيف</span></>
              ) : (
                <>Your Elegance<br /><span className="text-[#c9a96e]">With RF Perfume</span></>
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
                className="h-14 md:h-16 px-10 md:px-16 text-xs md:text-sm font-bold uppercase tracking-[0.3em] rounded-lg bg-white text-[#1a2744] hover:bg-[#c9a96e] hover:text-white border-none transition-all duration-500"
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
    { icon: "Truck", titleAr: t('freeShippingTitle'), titleEn: t('freeShippingTitle'), subtitleAr: t('freeShippingSub'), subtitleEn: t('freeShippingSub'), color: "#c9a96e", link: "" },
    { icon: "ShieldCheck", titleAr: t('original100'), titleEn: t('original100'), subtitleAr: t('qualityGuaranteed'), subtitleEn: t('qualityGuaranteed'), color: "#c9a96e", link: "" },
    { icon: "RotateCcw", titleAr: t('freeReturns'), titleEn: t('freeReturns'), subtitleAr: t('within14Days'), subtitleEn: t('within14Days'), color: "#c9a96e", link: "" },
    { icon: "Headphones", titleAr: t('support247'), titleEn: t('support247'), subtitleAr: t('dedicatedTeam'), subtitleEn: t('dedicatedTeam'), color: "#c9a96e", link: "" },
  ];

  const list = (items && items.length > 0) ? items : fallback;
  const cols = list.length === 1 ? "grid-cols-1" : list.length === 2 ? "grid-cols-2" : list.length === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2 md:grid-cols-4";

  return (
    <section className="bg-[#f9f7f4] py-6 md:py-8 border-y border-[#e8e2d9]" data-testid="promo-strip">
      <div className="container px-4">
        <div className={`grid ${cols} gap-4`}>
          {list.map((badge: any, i: number) => {
            const Icon = (LucideIcons as any)[badge.icon] || Truck;
            const inner = (
              <div className={`flex items-center gap-3 ${isRtl ? "flex-row-reverse text-right" : ""} ${badge.link ? "cursor-pointer hover:scale-[1.02] transition-transform" : ""}`}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${badge.color || "#c9a96e"}1f` }}>
                  <Icon className="w-5 h-5" style={{ color: badge.color || "#c9a96e" }} />
                </div>
                <div>
                  <p className="text-[#1a2744] text-xs font-bold">{isAr ? (badge.titleAr || badge.titleEn) : (badge.titleEn || badge.titleAr)}</p>
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
