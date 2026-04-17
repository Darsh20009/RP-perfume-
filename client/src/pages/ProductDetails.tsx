import { Layout } from "@/components/Layout";
import { useProduct } from "@/hooks/use-products";
import { useCart } from "@/hooks/use-cart";
import { Button } from "@/components/ui/button";
import { useRoute } from "wouter";
import { useState, useEffect, useMemo } from "react";
import { ShoppingBag, Check, Heart, Star, Send, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { useLanguage } from "@/hooks/use-language";
import { InstallmentSection } from "@/components/payment/InstallmentSection";
import { SizeAdvisor } from "@/components/ai/SizeAdvisor";
import { OutfitSuggestions } from "@/components/ai/OutfitSuggestions";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import type { ProductReview } from "@shared/schema";

export default function ProductDetails() {
  const [, params] = useRoute("/products/:id");
  const id = params?.id;
  const { data: product, isLoading } = useProduct(id || "");
  const { addItem } = useCart();
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const qc = useQueryClient();
  const isAr = language === "ar";

  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  // Wishlist state
  const { data: wishlistIds = [] } = useQuery<string[]>({
    queryKey: ["/api/wishlist/ids"],
    enabled: !!user,
  });
  const isWishlisted = product ? wishlistIds.includes(product.id) : false;

  const toggleWishlist = useMutation({
    mutationFn: async () => {
      if (!product) return;
      if (isWishlisted) {
        await apiRequest("DELETE", `/api/wishlist/${product.id}`);
      } else {
        await apiRequest("POST", "/api/wishlist", { productId: product.id });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/wishlist/ids"] });
      qc.invalidateQueries({ queryKey: ["/api/wishlist"] });
      toast({ title: isWishlisted ? (isAr ? "تمت الإزالة من المفضلة" : "Removed from wishlist") : (isAr ? "تمت الإضافة للمفضلة ❤️" : "Added to wishlist ❤️") });
    },
  });

  // Reviews state
  const { data: reviews = [] } = useQuery<ProductReview[]>({
    queryKey: ["/api/products", id, "reviews"],
    queryFn: async () => {
      const res = await fetch(`/api/products/${id}/reviews`);
      return res.ok ? res.json() : [];
    },
    enabled: !!id,
  });

  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [hoverRating, setHoverRating] = useState(0);

  const submitReview = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/products/${id}/reviews`, { rating: reviewRating, comment: reviewComment });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "خطأ");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/products", id, "reviews"] });
      setReviewComment("");
      setReviewRating(5);
      toast({ title: isAr ? "تم إرسال تقييمك بنجاح" : "Review submitted successfully" });
    },
    onError: (err: any) => {
      toast({ title: err.message || (isAr ? "حدث خطأ" : "Error"), variant: "destructive" });
    },
  });

  const avgRating = reviews.length > 0
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : 0;

  // Collect all unique images (product images only, excluding variant images as per request)
  const allImages = product?.images || [];

  // Auto-rotate images every 2 seconds
  useEffect(() => {
    if (allImages.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % allImages.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [allImages.length]);

  // Update current image when variant changes (if variant has an image)
  useEffect(() => {
    if (selectedVariant?.image) {
      const index = allImages.indexOf(selectedVariant.image);
      if (index !== -1) {
        setCurrentImageIndex(index);
      }
    }
  }, [selectedVariant, allImages]);

  // Ensure variants exist, otherwise provide default (memoized)
  const variants = useMemo(() =>
    product?.variants && product.variants.length > 0
      ? product.variants
      : [{ sku: 'default', color: 'Default', size: 'One Size', stock: 10, image: '' }],
    [product?.variants]
  );
  
  // Extract unique colors (memoized)
  const colors = useMemo(() => Array.from(new Set(variants.map((v: any) => v.color))), [variants]);
  
  // Get available sizes for selected color (memoized)
  const availableSizes = useMemo(() => selectedColor 
    ? Array.from(new Set(variants.filter((v: any) => v.color === selectedColor).map((v: any) => v.size)))
    : Array.from(new Set(variants.map((v: any) => v.size))),
    [selectedColor, variants]
  );
  
  // Get variant images grouped by color
  const colorImages: Record<string, string> = {};
  colors.forEach(color => {
    const variant = variants.find((v: any) => v.color === color);
    if (variant?.image) {
      colorImages[color] = variant.image;
    }
  });
  
  // Auto select first color if not selected
  useEffect(() => {
    if (!selectedColor && colors.length > 0) {
      setSelectedColor(colors[0]);
    }
  }, [colors, selectedColor]);

  // Auto select first size when color changes
  useEffect(() => {
    if (availableSizes.length > 0 && !selectedSize) {
      setSelectedSize(availableSizes[0]);
    } else if (selectedSize && !availableSizes.includes(selectedSize)) {
      setSelectedSize(availableSizes[0] || null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedColor, availableSizes]);

  // Find and set selected variant based on color and size
  useEffect(() => {
    if (selectedColor && selectedSize) {
      const variant = variants.find((v: any) => v.color === selectedColor && v.size === selectedSize);
      if (variant) {
        setSelectedVariant(variant);
      }
    }
  }, [selectedColor, selectedSize, variants]);

  if (isLoading) {
    return (
      <Layout>
        <div className="container py-12 animate-pulse">
          <div className="grid md:grid-cols-2 gap-12">
            <div className="aspect-[3/4] bg-muted rounded-xl" />
            <div className="space-y-4">
              <div className="h-8 bg-muted w-2/3 rounded" />
              <div className="h-4 bg-muted w-1/3 rounded" />
              <div className="h-32 bg-muted rounded" />
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!product) {
    return (
      <Layout>
        <div className="container py-24 text-center">
          <h2 className="text-2xl font-bold">{t('productNotFound')}</h2>
          <p className="text-muted-foreground mt-4">{t('noResults')}</p>
        </div>
      </Layout>
    );
  }

  const handleVariantSelect = (variant: any) => {
    setSelectedVariant(variant);
    // Find index of the variant's image in product images to sync gallery
    const imageIndex = product.images.findIndex(img => img === variant.image);
    if (imageIndex !== -1) {
      setCurrentImageIndex(imageIndex);
    }
  };

  const handleAddToCart = () => {
    if (!selectedVariant) return;
    
    setIsAnimating(true);
    // Ensure the variant image is passed correctly to the cart
    addItem(product, selectedVariant, quantity);
    
    // Animation reset
    setTimeout(() => setIsAnimating(false), 1000);
  };

  return (
    <Layout>
      <div className="container py-12 sm:py-16 md:py-20 lg:py-24">
        <div className={`grid lg:grid-cols-2 gap-8 sm:gap-10 md:gap-12 lg:gap-16 xl:gap-24 items-start ${language === 'ar' ? '' : 'lg:flex-row-reverse'}`}>
          {/* Image Gallery */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div 
              className="aspect-[3/4] bg-white overflow-hidden shadow-2xl border border-black/5 group flex flex-col items-center justify-center p-2 sm:p-3 md:p-4 cursor-pointer pt-[1px] pb-[1px] pl-[40px] pr-[40px]"
              onClick={() => {
                const img = allImages[currentImageIndex];
                if (img) window.open(img, '_blank');
              }}
            >
              <div className="relative w-full h-full flex items-center justify-center">
                <img 
                  key={currentImageIndex}
                  src={allImages[currentImageIndex] || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80"} 
                  alt={product.name} 
                  className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-1000"
                />
              </div>
              
              {/* Thumbnails */}
              {allImages.length > 1 && (
                <div className="flex gap-3 mt-6 overflow-x-auto py-2 w-full justify-center no-scrollbar px-2">
                  {allImages.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentImageIndex(idx)}
                      className={`
                        relative w-16 h-20 flex-shrink-0 border-2 transition-all duration-300 overflow-hidden
                        ${currentImageIndex === idx ? 'border-black scale-105 shadow-md' : 'border-black/5 opacity-60 hover:opacity-100'}
                      `}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" />
                      {currentImageIndex === idx && (
                        <div className="absolute bottom-0 left-0 w-full h-1 bg-black" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>

          {/* Details */}
          <div className={`flex flex-col ${language === 'ar' ? 'text-right' : 'text-left'}`}>
            <div className="border-b border-black/5 pb-6 sm:pb-8 mb-6 sm:mb-8">
              <h1 className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black mb-4 sm:mb-6 uppercase tracking-tighter">{product.name}</h1>
              <p className="text-3xl font-light text-primary tracking-tight">
                {Number(product.price).toLocaleString()} {t('currency')}
              </p>
            </div>

            <div className="prose prose-lg max-w-none text-muted-foreground mb-12 font-light leading-relaxed italic">
              <p>{product.description}</p>
            </div>

            {/* SKU Display */}
            {selectedVariant && selectedVariant.sku && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-12 p-6 bg-black/2 border border-black/5 backdrop-blur-sm"
                data-testid="section-sku"
              >
                <p className="text-xs font-bold uppercase tracking-[0.2em] mb-2 text-black/40">{language === 'ar' ? 'رمز المنتج' : 'Product Code'}</p>
                <p className="font-mono text-lg font-bold tracking-widest text-black" data-testid="text-product-sku">{selectedVariant.sku}</p>
              </motion.div>
            )}

            {/* Variants - Colors Section */}
            <div className="space-y-10 mb-12">
              {/* Colors */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-[0.2em] mb-6 text-black/40">{t('colorLabel')}</label>
                <div className={`flex flex-wrap gap-4 ${language === 'ar' ? 'justify-end' : 'justify-start'}`}>
                  {colors.map((color: string) => (
                    <div key={color} className="relative group">
                      <button
                        onClick={() => setSelectedColor(color)}
                        className={`
                          relative w-20 h-20 rounded-full overflow-hidden transition-all duration-300 p-0.5 border-2
                          ${selectedColor === color 
                            ? 'border-black scale-110 shadow-xl' 
                            : 'border-transparent hover:border-black/20 hover:scale-105'}
                        `}
                        data-testid={`button-color-${color}`}
                      >
                        {colorImages[color] ? (
                          <div className="w-full h-full rounded-full overflow-hidden bg-muted">
                            <img 
                              src={colorImages[color]} 
                              alt={color} 
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-full h-full rounded-full bg-black/5 flex items-center justify-center text-[10px] font-black uppercase text-center px-1">
                            {color}
                          </div>
                        )}
                        
                        {selectedColor === color && (
                          <div className="absolute inset-0 bg-black/10 flex items-center justify-center backdrop-blur-[1px]">
                            <Check className="h-5 w-5 text-white drop-shadow-md" />
                          </div>
                        )}
                      </button>
                      
                      {/* Tooltip-like label */}
                      <div className={`
                        absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap transition-all duration-300 pointer-events-none
                        ${selectedColor === color ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0'}
                      `}>
                        <span className="text-[10px] font-black uppercase tracking-widest bg-black text-white px-2 py-0.5">
                          {color}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sizes */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-[0.2em] mb-6 text-black/40">{t('sizeLabel')}</label>
                <div className={`flex flex-wrap gap-4 ${language === 'ar' ? 'justify-end' : 'justify-start'}`}>
                  {availableSizes.map((size: string) => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      className={`
                        px-6 py-3 border-2 rounded-none font-bold uppercase tracking-widest text-sm transition-all duration-300
                        ${selectedSize === size
                          ? 'border-black bg-black text-white shadow-lg'
                          : 'border-black/20 hover:border-black text-black hover:bg-black/5'}
                      `}
                      data-testid={`button-size-${size}`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              {/* AI Size Advisor */}
              {availableSizes.length > 0 && availableSizes[0] !== "One Size" && (
                <SizeAdvisor
                  productName={(product as any).title || product.name || ""}
                  productCategory={(product as any).category || "ملابس"}
                  availableSizes={availableSizes}
                  onSizeSelect={(size) => setSelectedSize(size)}
                />
              )}

              {/* AI Outfit Suggestions */}
              <OutfitSuggestions
                productName={(product as any).title || product.name || ""}
                productCategory={(product as any).category || "ملابس"}
              />

              {/* Quantity */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-[0.2em] mb-4 text-black/40">{t('quantityLabel')}</label>
                <div className={`flex items-center gap-6 ${language === 'ar' ? 'justify-end' : 'justify-start'}`}>
                  <button 
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-12 h-12 border border-black/10 flex items-center justify-center hover:bg-black hover:text-white transition-colors text-xl font-light"
                    data-testid="button-decrease-quantity"
                  >
                    -
                  </button>
                  <span className="text-xl font-light w-12 text-center" data-testid="text-quantity">{quantity}</span>
                  <button 
                    onClick={() => setQuantity(quantity + 1)}
                    className="w-12 h-12 border border-black/10 flex items-center justify-center hover:bg-black hover:text-white transition-colors text-xl font-light"
                    data-testid="button-increase-quantity"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Installment Plans Section */}
            <InstallmentSection price={product.price} language={language} />

            {user && (
              <button
                onClick={() => toggleWishlist.mutate()}
                disabled={toggleWishlist.isPending}
                className={`w-full h-14 flex items-center justify-center gap-3 border-2 font-bold text-sm uppercase tracking-widest transition-all ${
                  isWishlisted ? "border-red-400 bg-red-50 text-red-500" : "border-black/20 hover:border-red-400 hover:text-red-500 text-black/60"
                }`}
                data-testid="button-toggle-wishlist"
              >
                <Heart className={`w-5 h-5 ${isWishlisted ? "fill-red-500 text-red-500" : ""}`} />
                {isWishlisted ? (isAr ? "في المفضلة ❤️" : "In Wishlist ❤️") : (isAr ? "أضف للمفضلة" : "Add to Wishlist")}
              </button>
            )}

            <Button 
              size="lg" 
              className="w-full h-20 text-sm font-bold uppercase tracking-[0.3em] rounded-none bg-black text-white hover-elevate active-elevate-2 border-none relative overflow-visible"
              onClick={handleAddToCart}
              disabled={isAnimating}
            >
              {isAnimating && (
                <motion.div
                  initial={{ scale: 0.5, opacity: 1, x: 0, y: 0 }}
                  animate={{ 
                    scale: 0.2, 
                    opacity: 0,
                    x: language === 'ar' ? -400 : 400,
                    y: -800,
                    rotate: 360
                  }}
                  transition={{ duration: 0.8, ease: "easeInOut" }}
                  className="absolute inset-0 flex items-center justify-center pointer-events-none z-50"
                >
                  <div className="w-20 h-20 bg-white shadow-2xl p-1 border border-black/5">
                    <img 
                      src={selectedVariant?.image || product.images[0]} 
                      alt="" 
                      className="w-full h-full object-contain"
                    />
                  </div>
                </motion.div>
              )}
              {language === 'ar' ? <ShoppingBag className="ml-3 h-5 w-5" /> : <ShoppingBag className="mr-3 h-5 w-5" />}
              {t('addToCart')}
            </Button>

            <div className="mt-12 pt-8 border-t border-black/5 flex flex-col gap-4 text-xs font-bold uppercase tracking-widest text-black/40">
               <div className={`flex items-center gap-3 ${language === 'ar' ? 'justify-end' : 'justify-start'}`}><Check className="h-4 w-4 text-black"/> {t('originalProduct')}</div>
               <div className={`flex items-center gap-3 ${language === 'ar' ? 'justify-end' : 'justify-start'}`}><Check className="h-4 w-4 text-black"/> {t('luxuryPackaging')}</div>
               <div className={`flex items-center gap-3 ${language === 'ar' ? 'justify-end' : 'justify-start'}`}><Check className="h-4 w-4 text-black"/> {t('secureShipping')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Reviews Section ─────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-4 md:px-8 lg:px-16 pb-20" dir={isAr ? "rtl" : "ltr"}>
        <div className="border-t border-black/5 pt-12">
          <div className="flex items-center gap-4 mb-8">
            <h2 className="text-xl font-black uppercase tracking-tight">
              {isAr ? "آراء العملاء" : "Customer Reviews"}
            </h2>
            {reviews.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex">
                  {[1,2,3,4,5].map(s => (
                    <Star key={s} className={`w-4 h-4 ${s <= Math.round(avgRating) ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />
                  ))}
                </div>
                <span className="text-sm font-bold text-slate-600">{avgRating.toFixed(1)} ({reviews.length})</span>
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Write a review */}
            {user ? (
              <div className="space-y-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-black/50">{isAr ? "اكتب تقييمك" : "Write a Review"}</h3>
                <div className="flex items-center gap-1">
                  {[1,2,3,4,5].map(s => (
                    <button
                      key={s}
                      onMouseEnter={() => setHoverRating(s)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setReviewRating(s)}
                      className="p-0.5 transition-transform hover:scale-110"
                      data-testid={`button-star-${s}`}
                    >
                      <Star className={`w-7 h-7 transition-colors ${s <= (hoverRating || reviewRating) ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
                    </button>
                  ))}
                </div>
                <textarea
                  value={reviewComment}
                  onChange={e => setReviewComment(e.target.value)}
                  placeholder={isAr ? "شاركنا رأيك في المنتج..." : "Share your thoughts about this product..."}
                  rows={4}
                  className="w-full border border-black/10 px-4 py-3 text-sm font-medium focus:outline-none focus:border-black resize-none bg-white"
                  data-testid="textarea-review"
                />
                <button
                  onClick={() => submitReview.mutate()}
                  disabled={submitReview.isPending}
                  className="flex items-center gap-2 px-6 py-3 bg-black text-white text-xs font-black uppercase tracking-widest hover:bg-black/80 transition-colors disabled:opacity-50"
                  data-testid="button-submit-review"
                >
                  {submitReview.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {isAr ? "إرسال التقييم" : "Submit Review"}
                </button>
              </div>
            ) : (
              <div className="bg-slate-50 p-6 flex flex-col items-center justify-center text-center gap-3">
                <Star className="w-8 h-8 text-slate-300" />
                <p className="text-sm font-bold text-slate-500">{isAr ? "سجّل دخولك لكتابة تقييم" : "Sign in to write a review"}</p>
              </div>
            )}

            {/* Existing reviews */}
            <div className="space-y-4 max-h-[400px] overflow-y-auto no-scrollbar">
              {reviews.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <p className="text-sm font-bold">{isAr ? "لا توجد تقييمات بعد" : "No reviews yet"}</p>
                  <p className="text-xs mt-1">{isAr ? "كن أول من يقيّم هذا المنتج" : "Be the first to review this product"}</p>
                </div>
              ) : (
                reviews.map((review: ProductReview) => (
                  <div key={review.id} className="border-b border-black/5 pb-4" data-testid={`review-${review.id}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-black text-sm">{review.userName || (isAr ? "عميل" : "Customer")}</span>
                      <div className="flex">
                        {[1,2,3,4,5].map(s => (
                          <Star key={s} className={`w-3.5 h-3.5 ${s <= review.rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />
                        ))}
                      </div>
                    </div>
                    {review.comment && <p className="text-sm text-slate-600 leading-relaxed">{review.comment}</p>}
                    <p className="text-[10px] text-slate-400 mt-2">{new Date(review.createdAt).toLocaleDateString(isAr ? "ar-SA" : "en-US")}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
