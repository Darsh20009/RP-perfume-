import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Quote, ChevronLeft, ChevronRight, Sparkles, ImageIcon } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";

type FeaturedReview = {
  id: string;
  productId: string;
  productName?: string;
  productImage?: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  comment: string;
  images?: string[];
  isFeatured?: boolean;
  createdAt: string;
};

export function CustomerTestimonials() {
  const { language } = useLanguage();
  const isAr = language === "ar";

  const { data: reviews = [] } = useQuery<FeaturedReview[]>({
    queryKey: ["/api/reviews/featured"],
    queryFn: async () => {
      const res = await fetch("/api/reviews/featured?limit=12");
      return res.ok ? res.json() : [];
    },
    staleTime: 5 * 60_000,
  });

  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (paused || reviews.length <= 1) return;
    timerRef.current = setInterval(() => {
      setActive((i) => (i + 1) % reviews.length);
    }, 6000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [paused, reviews.length]);

  // Clamp active index when reviews length changes (refetch / invalidation)
  useEffect(() => {
    if (reviews.length > 0 && active >= reviews.length) setActive(0);
  }, [reviews.length, active]);

  if (reviews.length === 0) return null;
  const safeActive = Math.min(active, reviews.length - 1);
  const current = reviews[safeActive];

  const next = () => setActive((i) => (i + 1) % reviews.length);
  const prev = () => setActive((i) => (i - 1 + reviews.length) % reviews.length);

  return (
    <section
      className="relative py-16 md:py-24 overflow-hidden bg-gradient-to-b from-[#FFFFFF] via-white to-[#FFFFFF]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      dir={isAr ? "rtl" : "ltr"}
      data-testid="testimonials-section"
    >
      {/* Decorative gold blobs */}
      <div className="absolute -top-24 -end-24 w-96 h-96 rounded-full bg-gradient-to-br from-[#DFB369]/15 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -start-24 w-96 h-96 rounded-full bg-gradient-to-tr from-[#DFB369]/10 to-transparent blur-3xl pointer-events-none" />

      <div className="container px-4 relative">
        {/* Header */}
        <div className="text-center mb-10">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#DFB369]/10 border border-[#DFB369]/30 text-[10px] font-black uppercase tracking-[0.3em] text-[#DFB369] mb-4">
            <Sparkles className="w-3 h-3" />
            {isAr ? "آراء حقيقية من عملائنا" : "Real Words From Our Clients"}
          </span>
          <h2 className="text-3xl md:text-5xl font-black text-[#2B2B60] tracking-tight">
            {isAr ? "ماذا يقول عملاؤنا" : "What Our Customers Say"}
          </h2>
          <div className="mt-3 mx-auto h-px w-16 bg-gradient-to-r from-transparent via-[#DFB369] to-transparent" />
        </div>

        {/* Main testimonial card */}
        <div className="max-w-4xl mx-auto relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              initial={{ opacity: 0, y: 30, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -30, scale: 0.97 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="bg-white rounded-3xl shadow-[0_30px_80px_-30px_rgba(26,39,68,0.25)] border border-[#E8E5E0] overflow-hidden"
              data-testid={`testimonial-${current.id}`}
            >
              <div className="grid md:grid-cols-[1fr_1.2fr]">
                {/* Left — gold gradient + avatar */}
                <div className="relative bg-gradient-to-br from-[#2B2B60] via-[#243558] to-[#2B2B60] p-8 md:p-10 flex flex-col items-center justify-center text-center text-white min-h-[260px]">
                  <Quote className="absolute top-6 start-6 w-10 h-10 text-[#DFB369]/30 rotate-180" />
                  <div className="relative">
                    {current.userAvatar ? (
                      <img src={current.userAvatar} alt="" className="w-20 h-20 rounded-full object-cover ring-4 ring-[#DFB369]/40 shadow-xl" />
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#DFB369] to-[#a88550] flex items-center justify-center text-3xl font-black text-white shadow-xl ring-4 ring-[#DFB369]/30">
                        {(current.userName || "ع").charAt(0)}
                      </div>
                    )}
                    <div className="absolute -bottom-1 -end-1 w-7 h-7 rounded-full bg-[#DFB369] border-2 border-[#2B2B60] flex items-center justify-center">
                      <Sparkles className="w-3.5 h-3.5 text-white" />
                    </div>
                  </div>
                  <p className="mt-4 text-lg font-black tracking-tight" data-testid={`testimonial-name-${current.id}`}>
                    {current.userName || (isAr ? "عميل" : "Customer")}
                  </p>
                  <div className="mt-2 flex">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} className={`w-4 h-4 ${s <= current.rating ? "fill-[#DFB369] text-[#DFB369]" : "text-white/20"}`} />
                    ))}
                  </div>
                  {current.productName && (
                    <Link href={`/products/${current.productId}`}>
                      <span className="mt-3 inline-flex items-center gap-2 text-[11px] font-bold text-[#DFB369] hover:text-white transition-colors cursor-pointer" data-testid={`testimonial-product-${current.id}`}>
                        {current.productImage && <img src={current.productImage} alt="" className="w-5 h-5 rounded object-cover" />}
                        {current.productName}
                      </span>
                    </Link>
                  )}
                </div>

                {/* Right — quote + photos */}
                <div className="p-8 md:p-12 flex flex-col justify-center bg-white">
                  <p className="text-base md:text-lg text-[#2B2B60]/85 leading-loose font-medium relative">
                    <span className="text-4xl text-[#DFB369]/40 font-serif leading-none">"</span>
                    {current.comment}
                    <span className="text-4xl text-[#DFB369]/40 font-serif leading-none">"</span>
                  </p>
                  {current.images && current.images.length > 0 && (
                    <div className="flex gap-2 mt-5 flex-wrap">
                      {current.images.slice(0, 4).map((url, i) => (
                        <div key={url + i} className="w-14 h-14 rounded-lg overflow-hidden border border-[#E8E5E0] shadow-sm">
                          <img src={url} alt="" className="w-full h-full object-cover" />
                        </div>
                      ))}
                      {current.images.length > 4 && (
                        <div className="w-14 h-14 rounded-lg bg-[#FFFFFF] border border-[#E8E5E0] flex items-center justify-center text-[10px] font-black text-[#DFB369]">
                          +{current.images.length - 4}
                        </div>
                      )}
                    </div>
                  )}
                  <p className="mt-5 text-[10px] text-slate-400 font-bold tracking-wide">
                    {new Date(current.createdAt).toLocaleDateString(isAr ? "ar-SA" : "en-US", { year: "numeric", month: "long", day: "numeric" })}
                  </p>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Nav arrows */}
          {reviews.length > 1 && (
            <>
              <button
                type="button"
                onClick={prev}
                className="absolute top-1/2 -translate-y-1/2 -start-3 md:-start-6 w-11 h-11 rounded-full bg-white shadow-lg border border-[#E8E5E0] flex items-center justify-center text-[#2B2B60] hover:bg-[#DFB369] hover:text-white hover:border-[#DFB369] transition-all z-10"
                data-testid="button-testimonial-prev"
                aria-label="Previous"
              >
                {isAr ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
              </button>
              <button
                type="button"
                onClick={next}
                className="absolute top-1/2 -translate-y-1/2 -end-3 md:-end-6 w-11 h-11 rounded-full bg-white shadow-lg border border-[#E8E5E0] flex items-center justify-center text-[#2B2B60] hover:bg-[#DFB369] hover:text-white hover:border-[#DFB369] transition-all z-10"
                data-testid="button-testimonial-next"
                aria-label="Next"
              >
                {isAr ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
              </button>
            </>
          )}
        </div>

        {/* Dots */}
        {reviews.length > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            {reviews.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActive(i)}
                className={`transition-all rounded-full ${i === safeActive ? "w-8 h-2 bg-[#DFB369]" : "w-2 h-2 bg-[#2B2B60]/15 hover:bg-[#2B2B60]/30"}`}
                aria-label={`Go to testimonial ${i + 1}`}
                data-testid={`button-testimonial-dot-${i}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
