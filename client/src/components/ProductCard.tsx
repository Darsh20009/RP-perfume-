import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Product } from "@shared/schema";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/hooks/use-language";
import { useState, useEffect } from "react";
import { Heart, ShoppingCart, Check } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useCart } from "@/hooks/use-cart";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const { t, tx, language } = useLanguage();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { addItem } = useCart();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [addedToCart, setAddedToCart] = useState(false);
  const images = product.images && product.images.length > 0
    ? product.images
    : ["https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80"];

  const { data: wishlistIds = [] } = useQuery<string[]>({
    queryKey: ["/api/wishlist/ids"],
    enabled: !!user,
  });

  const isWishlisted = wishlistIds.includes(product.id);

  const toggleWishlist = useMutation({
    mutationFn: async () => {
      if (isWishlisted) {
        await apiRequest("DELETE", `/api/wishlist/${product.id}`);
      } else {
        await apiRequest("POST", "/api/wishlist", { productId: product.id });
      }
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["/api/wishlist/ids"] });
      const prev = qc.getQueryData<string[]>(["/api/wishlist/ids"]) || [];
      qc.setQueryData<string[]>(
        ["/api/wishlist/ids"],
        isWishlisted ? prev.filter(id => id !== product.id) : [...prev, product.id]
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["/api/wishlist/ids"], ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["/api/wishlist/ids"] });
      qc.invalidateQueries({ queryKey: ["/api/wishlist"] });
    },
  });

  useEffect(() => {
    if (images.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % images.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [images]);

  const imageVariants = {
    enter: (direction: number) => ({ opacity: 0, scale: 1.1, x: direction > 0 ? 100 : -100 }),
    center: { opacity: 1, scale: 1, x: 0 },
    exit: (direction: number) => ({ opacity: 0, scale: 0.9, x: direction > 0 ? -100 : 100 }),
  };

  const transition = {
    x: { type: "spring", stiffness: 300, damping: 30 },
    opacity: { duration: 0.6 },
    scale: { duration: 0.6 },
  };

  return (
    <motion.div className="relative" whileHover={{ y: -5 }} transition={{ duration: 0.3 }}>
      <Link href={`/products/${product.id}`}>
        <Card className="group overflow-hidden border-none rounded-none bg-white hover-elevate transition-all duration-500 cursor-pointer">
          <div className="relative aspect-[3/4] overflow-hidden bg-secondary/20">
            <AnimatePresence mode="wait" custom={1}>
              <motion.div
                key={currentImageIndex}
                custom={1}
                variants={imageVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={transition}
                className="absolute inset-0"
              >
                <img
                  src={images[currentImageIndex]}
                  alt={product.name}
                  className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-700"
                />
              </motion.div>
            </AnimatePresence>

            <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            {images.length > 1 && (
              <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 flex gap-1 z-10">
                {images.map((_, idx) => (
                  <motion.div
                    key={idx}
                    className={`h-1.5 rounded-full transition-all ${idx === currentImageIndex ? "bg-white w-6" : "bg-white/50 w-1.5"}`}
                    animate={{ width: idx === currentImageIndex ? 24 : 6 }}
                  />
                ))}
              </div>
            )}

            <div className="absolute bottom-4 left-4 right-4 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500 flex gap-2">
              <Button
                size="sm"
                className="flex-1 rounded-none font-black uppercase text-[10px]"
              >
                {t('viewDetails')}
              </Button>
            </div>

            {product.isFeatured && (
              <motion.div
                initial={{ opacity: 0, x: language === 'ar' ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className={`absolute top-4 ${language === 'ar' ? 'right-4' : 'left-4'} bg-black text-white text-[10px] font-black uppercase tracking-widest px-3 py-1`}
              >
                {t('featured')}
              </motion.div>
            )}
          </div>

          <CardContent className="p-4 text-center">
            <h3 className="font-black uppercase tracking-tighter text-sm mb-1 group-hover:text-primary transition-colors">
              {product.name}
            </h3>
            <p className="text-xs text-muted-foreground font-bold">{Number(product.price).toLocaleString()} {t('currency')}</p>
            {(() => {
              const variants = (product as any).variants as Array<{color?:string; size?:string}> | undefined;
              if (!variants || variants.length === 0) return null;
              const colors = Array.from(new Set(variants.map(v => v.color).filter(Boolean))) as string[];
              const sizes = Array.from(new Set(variants.map(v => v.size).filter(Boolean))) as string[];
              const colorSwatch = (c: string) => {
                const map: Record<string,string> = {
                  'ذهبي':'#c9a96e','أسود':'#1a1a1a','أبيض':'#ffffff','أحمر':'#b91c1c','أزرق':'#1a2744',
                  'وردي':'#ec4899','بني':'#78350f','فضي':'#c0c0c0','أخضر':'#15803d','بنفسجي':'#7c3aed',
                  'gold':'#c9a96e','black':'#1a1a1a','white':'#ffffff','red':'#b91c1c','blue':'#1a2744',
                  'pink':'#ec4899','brown':'#78350f','silver':'#c0c0c0','green':'#15803d','purple':'#7c3aed',
                };
                return map[c.toLowerCase()] || map[c] || '#c9a96e';
              };
              return (
                <div className="mt-2 flex flex-col gap-1.5 items-center">
                  {colors.length > 0 && (
                    <div className="flex gap-1.5 items-center">
                      {colors.slice(0, 5).map((c) => (
                        <motion.span
                          key={c}
                          whileHover={{ scale: 1.25 }}
                          className="w-3.5 h-3.5 rounded-full border border-gray-300 ring-1 ring-white shadow-sm"
                          style={{ background: colorSwatch(c) }}
                          title={c}
                        />
                      ))}
                      {colors.length > 5 && (
                        <span className="text-[9px] font-bold text-gray-800">+{colors.length - 5}</span>
                      )}
                    </div>
                  )}
                  {sizes.length > 0 && (
                    <div className="flex gap-1 items-center flex-wrap justify-center">
                      {sizes.slice(0, 4).map((s) => (
                        <span key={s} className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border border-[#c9a96e]/40 text-[#1a2744] bg-[#faf8f5]">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
            {(product as any).vendorId && (
              <p className="text-[9px] font-bold text-primary/70 uppercase tracking-widest mt-1 flex items-center justify-center gap-0.5">
                🏪 {t('seller')}
              </p>
            )}
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const variants = (product as any).variants;
                if (variants && variants.length > 0) {
                  const variant = variants[0];
                  addItem(product, variant, 1);
                  setAddedToCart(true);
                  setTimeout(() => setAddedToCart(false), 2000);
                }
              }}
              className={`mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all duration-300 ${
                addedToCart
                  ? "bg-green-500 text-white"
                  : "bg-[#1a2744] text-white hover:bg-[#243454] active:scale-95"
              }`}
            >
              {addedToCart ? (
                <>
                  <Check className="w-4 h-4" />
                  {t('added')}
                </>
              ) : (
                <>
                  <ShoppingCart className="w-4 h-4" />
                  {t('addToCart')}
                </>
              )}
            </button>
          </CardContent>
        </Card>
      </Link>

      {user && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleWishlist.mutate(); }}
          className={`absolute top-3 ${language === 'ar' ? 'left-3' : 'right-3'} z-20 w-9 h-9 rounded-full flex items-center justify-center shadow-md transition-all duration-200 ${
            isWishlisted ? "bg-red-500 text-white" : "bg-white/90 text-slate-600 hover:bg-white"
          }`}
          title={isWishlisted ? tx("إزالة من المفضلة", "Remove from wishlist") : t('addToWishlist')}
          data-testid={`button-wishlist-${product.id}`}
        >
          <Heart className={`w-4 h-4 ${isWishlisted ? "fill-white" : ""}`} />
        </button>
      )}
    </motion.div>
  );
}
