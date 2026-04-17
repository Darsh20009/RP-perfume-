import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Store, Star, Package, Search, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/Layout";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";

export default function VendorsList() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [search, setSearch] = useState("");

  const { data: vendors = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/vendors"],
  });

  const filtered = vendors.filter((v: any) =>
    v.storeName.toLowerCase().includes(search.toLowerCase()) ||
    (v.storeNameEn || "").toLowerCase().includes(search.toLowerCase()) ||
    (v.description || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout>
      <div className="min-h-screen">
        {/* Hero */}
        <div className="bg-foreground text-background py-16 px-6 text-center">
          <h1 className="text-4xl font-black mb-3">متاجر البائعين</h1>
          <p className="text-background/60 text-sm mb-8 max-w-md mx-auto">
            اكتشف مئات المتاجر المتخصصة من أفضل البائعين في المملكة
          </p>
          <div className="max-w-md mx-auto relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
            <Input
              placeholder="ابحث عن متجر..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search-vendors"
              className="rounded-none pr-10 bg-background text-foreground border-0 h-12"
            />
          </div>
        </div>

        {/* CTA for vendors */}
        {!user || (user as any).role === "customer" ? (
          <div className="bg-primary/10 border-b border-primary/20 py-3 px-6 text-center">
            <p className="text-sm font-bold">
              هل تريد بيع منتجاتك هنا؟{" "}
              <button
                onClick={() => navigate("/vendor/apply")}
                className="text-primary underline font-black"
                data-testid="link-become-vendor"
              >
                سجّل كبائع الآن
              </button>
            </p>
          </div>
        ) : (user as any).role === "vendor" && (
          <div className="bg-green-50 dark:bg-green-950/20 border-b border-green-200 py-3 px-6 text-center">
            <p className="text-sm font-bold text-green-700 dark:text-green-400">
              أنت بائع مسجّل —{" "}
              <button
                onClick={() => navigate("/vendor/dashboard")}
                className="underline font-black"
                data-testid="link-vendor-dashboard"
              >
                اذهب للوحة التحكم
              </button>
            </p>
          </div>
        )}

        {/* Vendors Grid */}
        <div className="max-w-6xl mx-auto px-6 py-12">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <Store className="h-16 w-16 mx-auto mb-4 opacity-20" />
              {search ? (
                <>
                  <p className="font-bold text-lg">لا نتائج لـ "{search}"</p>
                  <button onClick={() => setSearch("")} className="text-primary text-sm underline mt-2">مسح البحث</button>
                </>
              ) : (
                <>
                  <p className="font-bold text-lg">لا يوجد متاجر بعد</p>
                  <p className="text-sm">كن أول البائعين على رفيف العود!</p>
                  <Button onClick={() => navigate("/vendor/apply")} className="rounded-none mt-4">افتح متجرك</Button>
                </>
              )}
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground font-bold mb-6">{filtered.length} متجر</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.map((vendor: any) => (
                  <Card
                    key={vendor.id}
                    className="rounded-none border-2 hover:border-foreground transition-all cursor-pointer group overflow-hidden"
                    data-testid={`card-vendor-${vendor.id}`}
                    onClick={() => navigate(`/stores/${vendor.id}`)}
                  >
                    <CardContent className="p-5">
                      <div className="mb-3">
                        <h3 className="font-black text-lg leading-tight">{vendor.storeName}</h3>
                        {vendor.storeNameEn && <p className="text-xs text-muted-foreground mt-1">{vendor.storeNameEn}</p>}
                      </div>

                      {vendor.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{vendor.description}</p>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {vendor.rating > 0 && (
                            <span className="flex items-center gap-1 text-xs font-bold">
                              <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                              {vendor.rating.toFixed(1)}
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Package className="h-3.5 w-3.5" />
                            منتجات
                          </span>
                        </div>
                        <span className="text-xs font-black text-primary group-hover:gap-2 flex items-center gap-1 transition-all">
                          تصفح المتجر ←
                        </span>
                      </div>

                      {vendor.tags?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-3">
                          {vendor.tags.slice(0, 3).map((tag: string) => (
                            <Badge key={tag} variant="outline" className="rounded-none text-[10px] font-bold">{tag}</Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
