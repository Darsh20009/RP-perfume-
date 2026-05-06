import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import type { Product } from "@shared/schema";
import { motion } from "framer-motion";
import { useLanguage } from "@/hooks/use-language";
import { useState } from "react";
import { Heart, ShoppingCart, Check, AlertCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useCart } from "@/hooks/use-cart";
import { flyToCart } from "@/lib/flyToCart";
import { RiyalSign } from "@/components/RiyalSign";

const CATEGORY_BADGE_MAP: Record<string, { labelAr: string; labelEn: string; cls: string }> = {
  men:         { labelAr: "رجالي",    labelEn: "Men",     cls: "bg-[#2B2B60] text-white" },
  women:       { labelAr: "نسائي",    labelEn: "Women",   cls: "bg-[#850935] text-white" },
  unisex:      { labelAr: "للجنسين",  labelEn: "Unisex",  cls: "bg-[#4a3060] text-white" },
  spray:       { labelAr: "بخاخ",     labelEn: "Spray",   cls: "bg-[#1a6b4a] text-white" },
  accessories: { labelAr: "إكسسوار",  labelEn: "Accessory", cls: "bg-[#7a5c1e] text-white" },
  oud:         { labelAr: "عود",      labelEn: "Oud",     cls: "bg-[#5c3a1e] text-white" },
};

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const { t, tx, language } = useLanguage();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { addItem } = useCart();
  const [addedToCart, setAddedToCart] = useState(false);
  const images = product.images && product.images.length > 0
    ? product.images
    : ["https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80"];

  const { data: allCategories = [] } = useQuery<any[]>({
    queryKey: ["/api/categories"],
    staleTime: 10 * 60 * 1000,
  });

  const categoryBadge = (() => {
    const productCategoryIds: string[] = (product as any).categoryIds || [];
    if (!productCategoryIds.length || !allCategories.length) return null;
    for (const cat of allCategories) {
      const catId = String(cat._id || cat.id || "");
      if (productCategoryIds.includes(catId)) {
        const slug = (cat.slug || "").toLowerCase();
        const mapped = CATEGORY_BADGE_MAP[slug];
        if (mapped) return { ...mapped, slug };
      }
    }
    return null;
  })();

  // Total stock across variants — used to badge & disable add-to-cart
  const variantsList = ((product as any).variants || []) as Array<{ stock?: number }>;
  const totalStock = variantsList.reduce((acc, v) => acc + (Number(v?.stock) || 0), 0);
  const isOutOfStock = variantsList.length > 0 && totalStock <= 0;

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

  return (
    <motion.div className="relative" whileHover={{ y: -5 }} transition={{ duration: 0.3 }}>
      <Link href={`/products/${product.id}`}>
        <Card className="group overflow-hidden border-none rounded-none bg-white hover-elevate transition-all duration-500 cursor-pointer">
          <div className="relative aspect-[4/5] overflow-hidden bg-secondary/20">
            <img
              src={images[0]}
              alt={product.name}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
            />

            <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            {/* Category badge — top-left */}
            {categoryBadge && !isOutOfStock && (
              <motion.div
                initial={{ opacity: 0, x: language === 'ar' ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 }}
                className={`absolute top-3 ${language === 'ar' ? 'right-3' : 'left-3'} text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-sm shadow-md ${categoryBadge.cls}`}
                data-testid={`badge-category-${product.id}`}
              >
                {language === 'ar' ? categoryBadge.labelAr : categoryBadge.labelEn}
              </motion.div>
            )}

            {product.isFeatured && !isOutOfStock && (
              <motion.div
                initial={{ opacity: 0, x: language === 'ar' ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className={`absolute ${categoryBadge ? 'top-11' : 'top-3'} ${language === 'ar' ? 'right-3' : 'left-3'} bg-black text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-sm shadow-md`}
              >
                {t('featured')}
              </motion.div>
            )}

            {isOutOfStock && (
              <>
                <div className="absolute inset-0 bg-white/55 backdrop-grayscale pointer-events-none" />
                <motion.div
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className={`absolute top-4 ${language === 'ar' ? 'right-4' : 'left-4'} bg-[#850935] text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 shadow-lg`}
                  data-testid={`badge-out-of-stock-${product.id}`}
                >
                  {language === 'ar' ? 'نفذ' : 'Sold Out'}
                </motion.div>
              </>
            )}
          </div>

          <CardContent className="p-2.5 sm:p-3 text-center">
            <h3 className="font-black uppercase tracking-tighter text-sm mb-1 group-hover:text-primary transition-colors">
              {product.name}
            </h3>
            {(() => {
              const variants = (product as any).variants as Array<{price?: number | string}> | undefined;
              const variantPrices = (variants || [])
                .map(v => Number(v?.price))
                .filter(p => Number.isFinite(p) && p > 0);
              const uniquePrices = Array.from(new Set(variantPrices));
              const basePrice = Number(product.price) || 0;
              if (uniquePrices.length > 1) {
                const minPrice = Math.min(...uniquePrices);
                return (
                  <p className="text-xs text-muted-foreground font-bold" data-testid={`text-price-${product.id}`}>
                    <span className="text-[10px] font-normal text-gray-500">{t('startingFrom')} </span>
                    {minPrice.toLocaleString()} <RiyalSign />
                  </p>
                );
              }
              const displayPrice = uniquePrices.length === 1 ? uniquePrices[0] : basePrice;
              return (
                <p className="text-xs text-muted-foreground font-bold" data-testid={`text-price-${product.id}`}>
                  {displayPrice.toLocaleString()} <RiyalSign />
                </p>
              );
            })()}
            {(() => {
              const variants = (product as any).variants as Array<{color?:string; size?:string}> | undefined;
              if (!variants || variants.length === 0) return null;
              const colors = Array.from(new Set(variants.map(v => v.color).filter(Boolean))) as string[];
              const sizes = Array.from(new Set(variants.map(v => v.size).filter(Boolean))) as string[];
              const colorSwatch = (c: string) => {
                const map: Record<string,string> = {
                  'ذهبي':'#DFB369','أسود':'#1a1a1a','أبيض':'#ffffff','أحمر':'#b91c1c','أزرق':'#2B2B60',
                  'وردي':'#ec4899','بني':'#78350f','فضي':'#c0c0c0','أخضر':'#15803d','بنفسجي':'#7c3aed',
                  'gold':'#DFB369','black':'#1a1a1a','white':'#ffffff','red':'#b91c1c','blue':'#2B2B60',
                  'pink':'#ec4899','brown':'#78350f','silver':'#c0c0c0','green':'#15803d','purple':'#7c3aed',
                };
                return map[c.toLowerCase()] || map[c] || '#DFB369';
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
                        <span key={s} className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border border-[#DFB369]/40 text-[#2B2B60] bg-[#FFFFFF]">
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
            <div className="mt-2 sm:mt-3 flex items-stretch gap-1.5 sm:gap-2">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (isOutOfStock) return;
                  const variants = (product as any).variants as Array<any> | undefined;
                  let variant: any;
                  if (variants && variants.length > 0) {
                    // Pick the first variant that still has stock
                    variant = variants.find((v: any) => Number(v?.stock) > 0) || variants[0];
                  } else {
                    // Synthetic default variant — products without configured variants
                    // would otherwise silently fail to add. Build a sane default from
                    // the product itself so the click is never a dead-end for the user.
                    variant = {
                      sku: `default-${product.id}`,
                      color: '',
                      size: '',
                      price: Number(product.price) || 0,
                      cost: Number((product as any).cost) || 0,
                      image: product.images?.[0] || '',
                      stock: 999,
                    };
                  }
                  addItem(product, variant, 1);
                  setAddedToCart(true);
                  setTimeout(() => setAddedToCart(false), 2000);
                  flyToCart(e.currentTarget, images[0]);
                }}
                disabled={isOutOfStock}
                className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-1.5 sm:py-2.5 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-bold tracking-tight transition-all duration-300 ${
                  isOutOfStock
                    ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                    : addedToCart
                      ? "bg-green-500 text-white"
                      : "bg-[#2B2B60] text-white hover:bg-[#3A3A75] active:scale-95"
                }`}
                data-testid={`button-add-cart-${product.id}`}
              >
                {isOutOfStock ? (
                  <>
                    <AlertCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                    {language === 'ar' ? 'نفذت الكمية' : 'Out of Stock'}
                  </>
                ) : addedToCart ? (
                  <>
                    <Check className="w-3 h-3 sm:w-4 sm:h-4" />
                    {t('added')}
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-3 h-3 sm:w-4 sm:h-4" />
                    {t('addToCart')}
                  </>
                )}
              </button>
              {user && (
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleWishlist.mutate(); }}
                  className={`shrink-0 w-8 sm:w-10 flex items-center justify-center rounded-md sm:rounded-lg border transition-all duration-300 active:scale-95 ${
                    isWishlisted
                      ? "bg-red-500 text-white border-red-500 hover:bg-red-600"
                      : "bg-white text-[#850935] border-[#850935]/30 hover:bg-[#850935]/5 hover:border-[#850935]"
                  }`}
                  title={isWishlisted ? tx("إزالة من المفضلة", "Remove from wishlist") : t('addToWishlist')}
                  aria-label={isWishlisted ? tx("إزالة من المفضلة", "Remove from wishlist") : t('addToWishlist')}
                  data-testid={`button-wishlist-${product.id}`}
                >
                  <Heart className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isWishlisted ? "fill-white" : ""}`} />
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}
