import { Layout } from "@/components/Layout";
import { ProductCard } from "@/components/ProductCard";
import { useProducts } from "@/hooks/use-products";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Search, X, SlidersHorizontal, ChevronDown, ChevronRight,
  ArrowUpDown, Sparkles, TrendingUp, Clock, Tag, Check
} from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { useLanguage } from "@/hooks/use-language";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";

const SPECIAL_CATEGORIES = [
  { slug: "all",         label_ar: "الكل",         label_en: "All",          img: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=200&h=200&fit=crop", special: null },
  { slug: "sale",        label_ar: "العروض",        label_en: "Sale",         img: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=200&h=200&fit=crop", special: "sale" },
  { slug: "best-sellers",label_ar: "الأكثر مبيعاً",label_en: "Best Sellers", img: "https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=200&h=200&fit=crop", special: "featured" },
  { slug: "new-arrivals",label_ar: "وصل حديثاً",   label_en: "New Arrivals", img: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=200&h=200&fit=crop", special: "new" },
];

const SORT_OPTIONS = [
  { id: "default",   label_ar: "الافتراضي",        label_en: "Default",      icon: ArrowUpDown },
  { id: "newest",    label_ar: "الأحدث",            label_en: "Newest",       icon: Clock },
  { id: "price_asc", label_ar: "السعر: الأقل أولاً",label_en: "Price: Low–High",icon: TrendingUp },
  { id: "price_desc",label_ar: "السعر: الأعلى أولاً",label_en: "Price: High–Low",icon: TrendingUp },
  { id: "featured",  label_ar: "الأكثر مبيعاً",    label_en: "Best Sellers", icon: Sparkles },
];

export default function Products() {
  const { data: products, isLoading } = useProducts();
  const { data: dbCategories } = useQuery<any[]>({ queryKey: ["/api/categories"] });
  const { t, language } = useLanguage();
  const isRtl = language === "ar";
  const [location] = useLocation();
  const scrollRef = useRef<HTMLDivElement>(null);

  // ── State ─────────────────────────────────────────────────────────────────
  const params = new URLSearchParams(window.location.search);
  const [activeCategory, setActiveCategory] = useState(params.get("category") || "all");
  const [activeSubCategory, setActiveSubCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("default");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  // ── Hierarchical categories ───────────────────────────────────────────────
  const parentCategories = useMemo(() =>
    (dbCategories || []).filter((c: any) => !c.parentId),
    [dbCategories]
  );
  const subCategoriesMap = useMemo(() => {
    const map: Record<string, any[]> = {};
    (dbCategories || []).forEach((c: any) => {
      if (c.parentId) {
        if (!map[c.parentId]) map[c.parentId] = [];
        map[c.parentId].push(c);
      }
    });
    return map;
  }, [dbCategories]);

  const CATEGORIES = [
    SPECIAL_CATEGORIES[0],
    ...parentCategories.map((c: any) => ({
      slug: c.slug, label_ar: c.nameAr || c.name, label_en: c.name,
      img: c.image || "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=200&h=200&fit=crop",
      categoryId: c.id, special: null,
    })),
    ...SPECIAL_CATEGORIES.slice(1),
  ];

  const activeCatData = CATEGORIES.find(c => c.slug === activeCategory);
  const activeParentId = (activeCatData as any)?.categoryId;
  const subCategories = activeParentId ? (subCategoriesMap[activeParentId] || []) : [];

  // ── Price bounds from products ────────────────────────────────────────────
  const priceBounds = useMemo(() => {
    if (!products?.length) return [0, 10000] as [number, number];
    const prices = products.map(p => Number(p.price));
    return [Math.floor(Math.min(...prices)), Math.ceil(Math.max(...prices))] as [number, number];
  }, [products]);

  useEffect(() => { setPriceRange(priceBounds); }, [priceBounds[0], priceBounds[1]]);

  // ── Color & size options from products ────────────────────────────────────
  const { allColors, allSizes } = useMemo(() => {
    const colors = new Set<string>();
    const sizes = new Set<string>();
    (products || []).forEach(p => {
      (p.variants || []).forEach((v: any) => {
        if (v.color) colors.add(v.color);
        if (v.size) sizes.add(v.size);
      });
    });
    return { allColors: Array.from(colors), allSizes: Array.from(sizes) };
  }, [products]);

  // ── URL sync ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const cat = p.get("category") || "all";
    setActiveCategory(cat);
    setActiveSubCategory(null);
  }, [location]);

  useEffect(() => {
    const el = scrollRef.current?.querySelector(`[data-slug="${activeCategory}"]`) as HTMLElement | null;
    if (el) el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeCategory]);

  // ── Filtering & sorting ───────────────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    let list = [...products];

    // Category filter
    if (activeCategory !== "all") {
      if ((activeCatData as any)?.special === "featured") {
        list = list.filter(p => p.isFeatured);
        if (!list.length) list = products.slice(0, 8);
      } else if ((activeCatData as any)?.special === "new") {
        list = [...list].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()).slice(0, 20);
      } else if ((activeCatData as any)?.special === "sale") {
        list = list.filter(p => p.isFeatured);
        if (!list.length) list = products.slice().reverse().slice(0, 8);
      } else if (activeParentId) {
        if (activeSubCategory) {
          const sub = (dbCategories || []).find((c: any) => c.slug === activeSubCategory);
          list = sub ? list.filter(p => {
            const ids: string[] = (p as any).categoryIds?.length ? (p as any).categoryIds : (p as any).categoryId ? [(p as any).categoryId] : [];
            return ids.includes(sub.id);
          }) : list;
        } else {
          const childIds = new Set([activeParentId, ...(subCategoriesMap[activeParentId] || []).map((c: any) => c.id)]);
          list = list.filter(p => {
            const ids: string[] = (p as any).categoryIds?.length ? (p as any).categoryIds : (p as any).categoryId ? [(p as any).categoryId] : [];
            return ids.some(id => childIds.has(id));
          });
        }
      }
    }

    // Sub-category filter (special case: within "all")
    if (activeSubCategory && activeCategory === "all") {
      const sub = (dbCategories || []).find((c: any) => c.slug === activeSubCategory);
      if (sub) list = list.filter(p => {
        const ids: string[] = (p as any).categoryIds?.length ? (p as any).categoryIds : (p as any).categoryId ? [(p as any).categoryId] : [];
        return ids.includes(sub.id);
      });
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q));
    }

    // Price range
    list = list.filter(p => {
      const price = Number(p.price);
      return price >= priceRange[0] && price <= priceRange[1];
    });

    // Colors
    if (selectedColors.length > 0) {
      list = list.filter(p =>
        (p.variants || []).some((v: any) => selectedColors.includes(v.color))
      );
    }

    // Sizes
    if (selectedSizes.length > 0) {
      list = list.filter(p =>
        (p.variants || []).some((v: any) => selectedSizes.includes(v.size))
      );
    }

    // Sort
    switch (sortBy) {
      case "newest":
        list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        break;
      case "price_asc":
        list.sort((a, b) => Number(a.price) - Number(b.price));
        break;
      case "price_desc":
        list.sort((a, b) => Number(b.price) - Number(a.price));
        break;
      case "featured":
        list.sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0));
        break;
    }

    return list;
  }, [products, activeCategory, activeSubCategory, search, priceRange, selectedColors, selectedSizes, sortBy, activeCatData, activeParentId, subCategoriesMap, dbCategories]);

  // ── Active filter count ───────────────────────────────────────────────────
  const activeFilterCount = [
    sortBy !== "default" ? 1 : 0,
    priceRange[0] > priceBounds[0] || priceRange[1] < priceBounds[1] ? 1 : 0,
    selectedColors.length,
    selectedSizes.length,
  ].reduce((a, b) => a + b, 0);

  const clearAllFilters = () => {
    setSortBy("default");
    setPriceRange(priceBounds);
    setSelectedColors([]);
    setSelectedSizes([]);
    setSearch("");
    setActiveSubCategory(null);
  };

  const toggleColor = (c: string) => setSelectedColors(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  const toggleSize = (s: string) => setSelectedSizes(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const COLOR_MAP: Record<string, string> = {
    black: "#111", white: "#f5f5f5", red: "#ef4444", blue: "#3b82f6",
    green: "#22c55e", yellow: "#eab308", purple: "#a855f7", pink: "#ec4899",
    orange: "#f97316", grey: "#9ca3af", gray: "#9ca3af", brown: "#92400e",
    navy: "#1e3a5f", teal: "#14b8a6", burgundy: "#7f1d1d", beige: "#d4c5a9",
  };

  const getColorHex = (name: string) => COLOR_MAP[name.toLowerCase()] || "#e5e7eb";

  return (
    <Layout>
      <div className="min-h-screen bg-background">

        {/* ── TOP BAR ─────────────────────────────────────────────────── */}
        <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border/50">
          <div className="container px-4 py-3 flex items-center gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className={`absolute ${isRtl ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground`} />
              <Input
                placeholder={isRtl ? "ابحث عن منتج..." : "Search products..."}
                className={`${isRtl ? "pr-9" : "pl-9"} h-9 rounded-full bg-muted/50 border-0 text-sm focus-visible:ring-1`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button onClick={() => setSearch("")} className={`absolute ${isRtl ? "left-3" : "right-3"} top-1/2 -translate-y-1/2`}>
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )}
            </div>

            {/* Sort Button */}
            <div className="relative">
              <button
                onClick={() => { setSortOpen(o => !o); setFilterOpen(false); }}
                className={`flex items-center gap-1.5 h-9 px-3 rounded-full text-xs font-bold border transition-all ${sortBy !== "default" ? "bg-foreground text-background border-foreground" : "bg-muted/50 border-border/50 hover:bg-muted"}`}
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
                {isRtl ? "ترتيب" : "Sort"}
              </button>
              <AnimatePresence>
                {sortOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -8 }}
                    transition={{ duration: 0.15 }}
                    className={`absolute top-11 ${isRtl ? "left-0" : "right-0"} w-52 bg-background border border-border rounded-2xl shadow-xl overflow-hidden z-50`}
                  >
                    {SORT_OPTIONS.map(opt => {
                      const Icon = opt.icon;
                      return (
                        <button
                          key={opt.id}
                          onClick={() => { setSortBy(opt.id); setSortOpen(false); }}
                          className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${isRtl ? "flex-row-reverse text-right" : "text-left"} ${sortBy === opt.id ? "bg-foreground text-background font-bold" : "hover:bg-muted/60"}`}
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          {isRtl ? opt.label_ar : opt.label_en}
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Filter Button */}
            <button
              onClick={() => { setFilterOpen(o => !o); setSortOpen(false); }}
              className={`relative flex items-center gap-1.5 h-9 px-3 rounded-full text-xs font-bold border transition-all ${activeFilterCount > 0 ? "bg-foreground text-background border-foreground" : "bg-muted/50 border-border/50 hover:bg-muted"}`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {isRtl ? "فلتر" : "Filter"}
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* ── PARENT CATEGORIES ─── */}
          <div
            ref={scrollRef}
            className="flex gap-2 overflow-x-auto px-4 pb-3 scrollbar-hide"
            style={{ scrollbarWidth: "none" }}
            dir={isRtl ? "rtl" : "ltr"}
          >
            {CATEGORIES.map((cat) => {
              const isActive = activeCategory === cat.slug;
              return (
                <button
                  key={cat.slug}
                  data-slug={cat.slug}
                  onClick={() => {
                    setActiveCategory(cat.slug);
                    setActiveSubCategory(null);
                    const url = cat.slug === "all" ? "/products" : `/products?category=${cat.slug}`;
                    window.history.pushState({}, "", url);
                  }}
                  className={`flex-shrink-0 flex flex-col items-center gap-1.5 transition-all duration-200 ${isActive ? "opacity-100" : "opacity-50 hover:opacity-80"}`}
                >
                  <div className={`relative w-14 h-14 rounded-2xl overflow-hidden transition-all duration-300 ${isActive ? "ring-2 ring-foreground ring-offset-2 scale-110" : "hover:scale-105"}`}>
                    <img src={cat.img} alt={isRtl ? cat.label_ar : cat.label_en} className="w-full h-full object-cover" />
                    {isActive && <div className="absolute inset-0 bg-foreground/20" />}
                  </div>
                  <span className={`text-[9px] font-bold uppercase tracking-wide whitespace-nowrap ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                    {isRtl ? cat.label_ar : cat.label_en}
                  </span>
                </button>
              );
            })}
          </div>

          {/* ── SUB-CATEGORIES (animated) ─── */}
          <AnimatePresence>
            {subCategories.length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="overflow-hidden border-t border-border/30"
              >
                <div
                  className="flex gap-2 px-4 py-2.5 overflow-x-auto scrollbar-hide"
                  style={{ scrollbarWidth: "none" }}
                  dir={isRtl ? "rtl" : "ltr"}
                >
                  <button
                    onClick={() => setActiveSubCategory(null)}
                    className={`flex-shrink-0 px-3 py-1 rounded-full text-[11px] font-bold border transition-all ${activeSubCategory === null ? "bg-foreground text-background border-foreground" : "border-border/50 text-muted-foreground hover:border-foreground/30"}`}
                  >
                    {isRtl ? "الكل" : "All"}
                  </button>
                  {subCategories.map((sub: any) => (
                    <button
                      key={sub.id}
                      onClick={() => setActiveSubCategory(sub.slug === activeSubCategory ? null : sub.slug)}
                      className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border transition-all ${activeSubCategory === sub.slug ? "bg-foreground text-background border-foreground" : "border-border/50 text-muted-foreground hover:border-foreground/30 hover:text-foreground"}`}
                    >
                      {sub.image && <img src={sub.image} alt="" className="w-4 h-4 rounded-full object-cover" />}
                      {isRtl ? (sub.nameAr || sub.name) : sub.name}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── FILTER PANEL ─────────────────────────────────────────────── */}
        <AnimatePresence>
          {filterOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/40 z-40"
                onClick={() => setFilterOpen(false)}
              />
              <motion.div
                initial={{ x: isRtl ? "-100%" : "100%" }}
                animate={{ x: 0 }}
                exit={{ x: isRtl ? "-100%" : "100%" }}
                transition={{ type: "spring", damping: 28, stiffness: 300 }}
                className={`fixed top-0 ${isRtl ? "left-0" : "right-0"} h-full w-[320px] max-w-[90vw] bg-background z-50 shadow-2xl flex flex-col`}
                dir={isRtl ? "rtl" : "ltr"}
              >
                {/* Filter Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="h-4 w-4" />
                    <span className="font-black text-sm uppercase tracking-widest">{isRtl ? "الفلاتر" : "Filters"}</span>
                    {activeFilterCount > 0 && (
                      <Badge variant="secondary" className="text-[9px] h-4 px-1.5 font-black">{activeFilterCount}</Badge>
                    )}
                  </div>
                  <button onClick={() => setFilterOpen(false)} className="p-1 hover:bg-muted rounded-full">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-7">

                  {/* ── SORT ── */}
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">{isRtl ? "الترتيب" : "Sort By"}</p>
                    <div className="space-y-1">
                      {SORT_OPTIONS.map(opt => {
                        const Icon = opt.icon;
                        return (
                          <button
                            key={opt.id}
                            onClick={() => setSortBy(opt.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${sortBy === opt.id ? "bg-foreground text-background" : "hover:bg-muted/60"}`}
                          >
                            <Icon className="h-3.5 w-3.5 shrink-0" />
                            <span className="flex-1 text-right">{isRtl ? opt.label_ar : opt.label_en}</span>
                            {sortBy === opt.id && <Check className="h-3.5 w-3.5" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* ── PRICE RANGE ── */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{isRtl ? "السعر" : "Price"}</p>
                      <span className="text-xs font-bold text-foreground">
                        {priceRange[0]} – {priceRange[1]} {isRtl ? "ر.س" : "SAR"}
                      </span>
                    </div>
                    <Slider
                      min={priceBounds[0]}
                      max={priceBounds[1]}
                      step={1}
                      value={priceRange}
                      onValueChange={(v) => setPriceRange(v as [number, number])}
                      className="mt-2"
                    />
                    <div className="flex justify-between mt-1.5">
                      <span className="text-[10px] text-muted-foreground">{priceBounds[0]} {isRtl ? "ر.س" : "SAR"}</span>
                      <span className="text-[10px] text-muted-foreground">{priceBounds[1]} {isRtl ? "ر.س" : "SAR"}</span>
                    </div>
                  </div>

                  {/* ── COLORS ── */}
                  {allColors.length > 0 && (
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">{isRtl ? "اللون" : "Color"}</p>
                      <div className="flex flex-wrap gap-2">
                        {allColors.map(color => {
                          const hex = getColorHex(color);
                          const active = selectedColors.includes(color);
                          return (
                            <button
                              key={color}
                              onClick={() => toggleColor(color)}
                              title={color}
                              className={`relative w-8 h-8 rounded-full border-2 transition-all ${active ? "border-foreground scale-110" : "border-border/30 hover:border-foreground/40 hover:scale-105"}`}
                              style={{ backgroundColor: hex }}
                            >
                              {active && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <Check className="h-3 w-3" style={{ color: hex === "#f5f5f5" || hex === "#d4c5a9" ? "#000" : "#fff" }} />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ── SIZES ── */}
                  {allSizes.length > 0 && (
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">{isRtl ? "المقاس" : "Size"}</p>
                      <div className="flex flex-wrap gap-2">
                        {allSizes.map(size => {
                          const active = selectedSizes.includes(size);
                          return (
                            <button
                              key={size}
                              onClick={() => toggleSize(size)}
                              className={`min-w-[40px] h-9 px-3 rounded-xl text-xs font-black border-2 transition-all ${active ? "bg-foreground text-background border-foreground" : "border-border/40 hover:border-foreground/40"}`}
                            >
                              {size}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Filter Footer */}
                <div className="border-t border-border/50 p-4 flex gap-2">
                  <button
                    onClick={clearAllFilters}
                    className="flex-1 h-10 rounded-xl border border-border/50 text-sm font-bold hover:bg-muted transition-colors"
                  >
                    {isRtl ? "مسح الكل" : "Clear All"}
                  </button>
                  <button
                    onClick={() => setFilterOpen(false)}
                    className="flex-1 h-10 rounded-xl bg-foreground text-background text-sm font-bold hover:opacity-90 transition-opacity"
                  >
                    {isRtl ? `عرض ${filteredProducts.length} منتج` : `Show ${filteredProducts.length}`}
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* ── MAIN CONTENT ─────────────────────────────────────────────── */}
        <div className="container px-4 py-6">

          {/* Active filters chips */}
          {(activeFilterCount > 0 || activeSubCategory || search) && (
            <div className={`flex flex-wrap gap-2 mb-5 ${isRtl ? "flex-row-reverse" : ""}`}>
              {sortBy !== "default" && (
                <Badge variant="secondary" className="flex items-center gap-1 pr-1 font-bold text-xs cursor-pointer" onClick={() => setSortBy("default")}>
                  {isRtl ? SORT_OPTIONS.find(o => o.id === sortBy)?.label_ar : SORT_OPTIONS.find(o => o.id === sortBy)?.label_en}
                  <X className="h-3 w-3" />
                </Badge>
              )}
              {(priceRange[0] > priceBounds[0] || priceRange[1] < priceBounds[1]) && (
                <Badge variant="secondary" className="flex items-center gap-1 pr-1 font-bold text-xs cursor-pointer" onClick={() => setPriceRange(priceBounds)}>
                  {priceRange[0]}–{priceRange[1]} {isRtl ? "ر.س" : "SAR"}
                  <X className="h-3 w-3" />
                </Badge>
              )}
              {selectedColors.map(c => (
                <Badge key={c} variant="secondary" className="flex items-center gap-1.5 pr-1 font-bold text-xs cursor-pointer" onClick={() => toggleColor(c)}>
                  <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: getColorHex(c) }} />
                  {c} <X className="h-3 w-3" />
                </Badge>
              ))}
              {selectedSizes.map(s => (
                <Badge key={s} variant="secondary" className="flex items-center gap-1 pr-1 font-bold text-xs cursor-pointer" onClick={() => toggleSize(s)}>
                  {s} <X className="h-3 w-3" />
                </Badge>
              ))}
              {(activeFilterCount > 1) && (
                <button onClick={clearAllFilters} className="text-[10px] font-bold text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors">
                  {isRtl ? "مسح الكل" : "Clear all"}
                </button>
              )}
            </div>
          )}

          {/* Title & Count */}
          <div className={`flex items-baseline justify-between mb-6 ${isRtl ? "flex-row-reverse" : ""}`}>
            <h1 className="font-display text-2xl sm:text-3xl font-black uppercase tracking-tighter">
              {activeCategory === "all"
                ? (isRtl ? "الكولكشن الكامل" : "Full Collection")
                : (isRtl ? activeCatData?.label_ar : activeCatData?.label_en)}
              {activeSubCategory && (
                <span className="text-muted-foreground font-light text-lg mx-2">
                  {isRtl ? <ChevronRight className="inline h-5 w-5" /> : <ChevronDown className="inline h-5 w-5" />}
                  {(() => { const s = (dbCategories || []).find((c: any) => c.slug === activeSubCategory); return isRtl ? (s?.nameAr || s?.name) : s?.name; })()}
                </span>
              )}
            </h1>
            <span className="text-muted-foreground text-sm font-light">
              {filteredProducts.length} {isRtl ? "منتج" : "items"}
            </span>
          </div>

          {/* Products Grid */}
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-[3/4] bg-muted animate-pulse rounded-2xl" />
              ))}
            </div>
          ) : filteredProducts.length > 0 ? (
            <motion.div
              key={activeCategory + activeSubCategory + sortBy}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4"
            >
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </motion.div>
          ) : (
            <div className="text-center py-24">
              <div className="text-6xl mb-4">🔍</div>
              <p className="text-xl font-light text-muted-foreground italic">{t("noResults")}</p>
              <button
                onClick={clearAllFilters}
                className="mt-4 text-sm font-bold underline underline-offset-4 text-muted-foreground hover:text-foreground"
              >
                {isRtl ? "مسح الفلاتر" : "Clear filters"}
              </button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
