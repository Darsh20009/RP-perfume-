import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/hooks/use-language";
import { Link } from "wouter";
import { Heart, ShoppingBag, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Product } from "@shared/schema";

export default function ProfileWishlist() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["/api/wishlist"],
  });

  const removeMutation = useMutation({
    mutationFn: async (productId: string) => {
      await apiRequest("DELETE", `/api/wishlist/${productId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/wishlist"] });
      qc.invalidateQueries({ queryKey: ["/api/wishlist/ids"] });
      toast({ title: isAr ? "تم الإزالة من المفضلة" : "Removed from wishlist" });
    },
  });

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <div className="w-8 h-8 border-2 border-slate-200 border-t-primary rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  return (
    <div className="space-y-6" dir={isAr ? "rtl" : "ltr"}>
      <div className="flex items-center gap-3">
        <Heart className="w-6 h-6 text-red-500 fill-red-500" />
        <h2 className="text-2xl font-bold font-display">{isAr ? "قائمة الأمنيات" : "My Wishlist"}</h2>
        {products.length > 0 && (
          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
            {products.length}
          </span>
        )}
      </div>

      {products.length === 0 ? (
        <div className="text-center py-20">
          <Heart className="w-16 h-16 mx-auto mb-4 text-slate-200" />
          <p className="font-bold text-slate-400 text-sm mb-6">
            {isAr ? "قائمتك فارغة — ابدأ بإضافة منتجات تعجبك" : "Your wishlist is empty — start adding items you love"}
          </p>
          <Link href="/products">
            <span className="inline-flex items-center gap-2 px-6 py-3 bg-black text-white text-sm font-bold uppercase tracking-widest hover:bg-black/80 transition-colors cursor-pointer">
              <ShoppingBag className="w-4 h-4" />
              {isAr ? "تصفح المنتجات" : "Browse Products"}
            </span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((product: Product) => (
            <div key={product.id} className="group relative bg-white border border-black/5 hover-elevate" data-testid={`card-wishlist-${product.id}`}>
              <Link href={`/products/${product.id}`}>
                <div className="aspect-[3/4] overflow-hidden bg-slate-50 cursor-pointer">
                  {product.images && product.images[0] ? (
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <ShoppingBag className="w-12 h-12" />
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="font-black text-sm text-slate-900 truncate">{product.name}</p>
                  <p className="text-xs font-bold text-slate-500 mt-1">
                    {Number(product.price).toLocaleString()} {isAr ? "ر.س" : "SAR"}
                  </p>
                </div>
              </Link>
              <button
                onClick={() => removeMutation.mutate(product.id)}
                className="absolute top-2 left-2 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-white shadow-sm transition-all opacity-0 group-hover:opacity-100"
                title={isAr ? "إزالة من المفضلة" : "Remove"}
                data-testid={`button-remove-wishlist-${product.id}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
