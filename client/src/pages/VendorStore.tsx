import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Store, Star, Phone, Mail, Package, ArrowRight, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Layout } from "@/components/Layout";
import { useCart } from "@/hooks/use-cart";
import { useToast } from "@/hooks/use-toast";
import { RiyalSign } from "@/components/RiyalSign";

export default function VendorStore() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { addItem } = useCart();
  const { toast } = useToast();

  const { data: vendor, isLoading: loadingVendor, error } = useQuery<any>({
    queryKey: ["/api/vendors", id],
    queryFn: () => fetch(`/api/vendors/${id}`).then(r => { if (!r.ok) throw new Error("not found"); return r.json(); }),
  });

  const { data: products = [], isLoading: loadingProducts } = useQuery<any[]>({
    queryKey: ["/api/vendors", id, "products"],
    queryFn: () => fetch(`/api/vendors/${id}/products`).then(r => r.json()),
    enabled: !!vendor,
  });

  if (loadingVendor) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </Layout>
    );
  }

  if (error || !vendor) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center text-center p-6">
          <div>
            <Store className="h-16 w-16 mx-auto mb-4 opacity-20" />
            <h2 className="text-xl font-black mb-2">المتجر غير موجود</h2>
            <Button onClick={() => navigate("/stores")} className="rounded-none mt-4">تصفح المتاجر</Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Store Header */}
      <div className="max-w-6xl mx-auto px-6 pt-10 mb-8">
        <h1 className="text-3xl md:text-4xl font-black">{vendor.storeName}</h1>
        {vendor.storeNameEn && <p className="text-muted-foreground text-sm mt-1">{vendor.storeNameEn}</p>}
      </div>

      {/* Store Info */}
      <div className="max-w-6xl mx-auto px-6 mb-8">
        <div className="flex flex-wrap items-center gap-4 mb-4">
          {vendor.rating > 0 && (
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map(s => (
                <Star key={s} className={`h-4 w-4 ${s <= Math.round(vendor.rating) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
              ))}
              <span className="text-sm font-bold mr-1">{vendor.rating.toFixed(1)}</span>
              {vendor.reviewCount > 0 && <span className="text-xs text-muted-foreground">({vendor.reviewCount} تقييم)</span>}
            </div>
          )}
          {vendor.tags?.length > 0 && vendor.tags.map((tag: string) => (
            <Badge key={tag} variant="outline" className="rounded-none text-xs font-bold">{tag}</Badge>
          ))}
        </div>

        {vendor.description && (
          <p className="text-muted-foreground text-sm leading-relaxed mb-4 max-w-2xl">{vendor.description}</p>
        )}

        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          {vendor.phone && (
            <span className="flex items-center gap-1.5">
              <Phone className="h-4 w-4" />
              <span dir="ltr">{vendor.phone}</span>
            </span>
          )}
          {vendor.email && (
            <span className="flex items-center gap-1.5">
              <Mail className="h-4 w-4" />
              {vendor.email}
            </span>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t max-w-6xl mx-auto px-6 mb-8" />

      {/* Products */}
      <div className="max-w-6xl mx-auto px-6 pb-16">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black">منتجات المتجر</h2>
          <span className="text-sm text-muted-foreground font-bold">
            {loadingProducts ? "..." : `${products.length} منتج`}
          </span>
        </div>

        {loadingProducts ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="font-bold">لا يوجد منتجات في هذا المتجر بعد</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((product: any) => (
              <Card
                key={product.id}
                className="rounded-none border hover:border-foreground transition-all cursor-pointer group"
                data-testid={`card-store-product-${product.id}`}
                onClick={() => navigate(`/products/${product.id}`)}
              >
                <CardContent className="p-0">
                  <div className="relative overflow-hidden aspect-square bg-muted">
                    {product.images?.[0] ? (
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        className="w-full h-full object-cover  transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-10 w-10 opacity-20" />
                      </div>
                    )}
                    {product.isFeatured && (
                      <Badge className="absolute top-2 right-2 rounded-none text-[10px] font-black bg-foreground text-background">مميز</Badge>
                    )}
                  </div>
                  <div className="p-3">
                    <h3 className="font-bold text-sm line-clamp-1 mb-1">{product.name}</h3>
                    <div className="flex items-center justify-between">
                      <span className="font-black text-sm text-primary">{product.price} <RiyalSign /></span>
                      <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
