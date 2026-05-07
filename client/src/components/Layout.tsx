const logoImg = "/images/logos/logo-light.png";
const logoDarkImg = "/images/logos/logo-dark.png";
import { ReactNode, useEffect, useState, lazy, Suspense } from "react";
import { Link, useLocation } from "wouter";
import { ShoppingBag, User, Menu, LogOut, Phone, Mail, Instagram, Download, Globe, Wallet, Home, Package, LayoutDashboard, ChevronRight, X, Shield, Tag, Heart, Store } from "lucide-react";
import { SiTiktok, SiSnapchat, SiWhatsapp, SiX } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useCart } from "@/hooks/use-cart";
import { useTheme } from "@/components/theme-provider";
import { useLanguage } from "@/hooks/use-language";
import { NotificationBell } from "@/components/notification-bell";
import { useQuery } from "@tanstack/react-query";
const UnifiedChat = lazy(() => import("@/components/ai/UnifiedChat").then(m => ({ default: m.UnifiedChat })));
import { AuthModal } from "@/components/AuthModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { RiyalSign } from "@/components/RiyalSign";

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const cartItems = useCart((state) => state.items);
  const [location, setLocation] = useLocation();
  const { theme, setTheme } = useTheme();
  const { language, setLanguage, t, tx } = useLanguage();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<"login" | "register">("login");

  const { data: storeSettings } = useQuery<any>({
    queryKey: ["/api/store/settings"],
    queryFn: async () => { const r = await fetch("/api/store/settings"); return r.ok ? r.json() : {}; },
    staleTime: 5 * 60 * 1000,
  });

  const { data: allOrders } = useQuery<any[]>({
    queryKey: ["/api/orders"],
    queryFn: async () => { const r = await fetch("/api/orders"); return r.ok ? r.json() : []; },
    enabled: !!user && user.role === "admin",
    refetchInterval: 30000,
  });
  const pendingAdminCount = (allOrders || []).filter((o: any) => o.status === "pending_payment").length;

  // ── Dynamic nav: admin-managed CustomPages flagged as showInNav ──────────
  const { data: navPages = [] } = useQuery<any[]>({
    queryKey: ["/api/pages", "nav"],
    queryFn: async () => { const r = await fetch("/api/pages?nav=true"); return r.ok ? r.json() : []; },
    staleTime: 5 * 60_000,
  });

  // ── Categories appear as top-level menu items ───────────────────────────
  const { data: navCategories = [] } = useQuery<any[]>({
    queryKey: ["/api/categories"],
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (user?.role === "admin" && pendingAdminCount > 0) {
      document.title = `(${pendingAdminCount}) لوحة التحكم | عطور آر اف`;
    } else {
      document.title = "عطور آر اف | RF Perfume";
    }
  }, [pendingAdminCount, user]);

  useEffect(() => {
    const handleInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    // Set initial direction
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
    return () => window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
  }, [language]);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    }
  };

  const isDashboard = location.startsWith('/dashboard') || location.startsWith('/admin');

  if (isDashboard) {
    return <main className="min-h-screen bg-[#f8fafc]">{children}</main>;
  }

  const closeSidebar = () => setIsSidebarOpen(false);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Navbar */}
      <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md safe-top h-16 md:h-20">
        <div className="container relative flex h-full items-center justify-between gap-2 px-4 md:gap-4">
          {/* Centered logo on mobile only (independent of side flex children) */}
          <Link
            href="/"
            className="md:hidden absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center hover:opacity-80 active:scale-95 transition-all"
          >
            <img src={logoImg} alt="عطور آر اف" className="h-10 w-auto object-contain" />
          </Link>

          <div className="flex items-center gap-2 md:gap-4">
            <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden no-default-hover-elevate h-10 w-10">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side={language === 'ar' ? "right" : "left"} className="w-full flex flex-col p-0 border-none bg-background overflow-y-auto">
                <div className="flex flex-col h-full" dir={language === 'ar' ? 'rtl' : 'ltr'}>

                  {/* ── Header ─────────────────────────────────── */}
                  <div className="flex items-center justify-between px-5 pt-5 pb-4">
                    <img src={logoImg} alt="عطور آر اف" className="h-9 w-auto object-contain" />
                    <button
                      onClick={closeSidebar}
                      className="w-9 h-9 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors active:scale-95"
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>

                  {/* ── User Card ──────────────────────────────── */}
                  {user ? (
                    <div className="mx-4 mb-4 rounded-2xl bg-foreground text-background p-4 flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-background/10 flex items-center justify-center text-xl font-black shrink-0">
                        {(user.name || user.username || "?").charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-sm truncate">{user.name || user.username}</p>
                        <p className="text-[11px] opacity-50 truncate">{user.phone || user.email || ""}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[9px] uppercase tracking-widest opacity-50 font-bold">{t('wallet')}</p>
                        <p className="font-black text-sm text-primary">{(user as any)?.walletBalance?.toLocaleString() || '0'} <span className="text-[10px] opacity-70"><RiyalSign /></span></p>
                      </div>
                    </div>
                  ) : (
                    <div className="mx-4 mb-4 rounded-2xl border-2 border-dashed border-border p-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-black text-sm">{t('welcome')}</p>
                        <p className="text-[11px] text-muted-foreground">{tx('سجّل دخولك لتجربة أفضل', 'Sign in for a better experience')}</p>
                      </div>
                      <button
                        onClick={() => { closeSidebar(); setTimeout(() => { setAuthModalTab("login"); setAuthModalOpen(true); }, 200); }}
                        className="h-9 px-4 rounded-xl bg-foreground text-background text-[11px] font-black active:scale-95 transition-transform whitespace-nowrap"
                      >
                        {t('signIn')}
                      </button>
                    </div>
                  )}

                  {/* ── Cart Quick Info ─────────────────────────── */}
                  {cartItems.length > 0 && (
                    <Link href="/cart" onClick={closeSidebar}>
                      <div className="mx-4 mb-4 rounded-2xl bg-primary/5 border border-primary/10 p-3 flex items-center justify-between gap-3 active:scale-98 transition-transform cursor-pointer">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-xl bg-primary/10 flex items-center justify-center">
                            <ShoppingBag className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-[11px] font-black text-foreground">{t('cart')}</p>
                            <p className="text-[10px] text-muted-foreground">{cartItems.reduce((a, i) => a + i.quantity, 0)} {t('items')}</p>
                          </div>
                        </div>
                        <ChevronRight className={`h-4 w-4 text-muted-foreground ${language === 'ar' ? 'rotate-180' : ''}`} />
                      </div>
                    </Link>
                  )}

                  {/* ── Main Navigation ─────────────────────────── */}
                  <div className="px-4 mb-2">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground px-1 mb-2">{t('navigation')}</p>
                    <div className="space-y-1">
                      {[
                        { href: "/", icon: Home, label: t('home') },
                        { href: "/products", icon: Tag, label: t('shop') },
                        ...navCategories.map((c: any) => ({
                          href: `/products?category=${c.slug}`,
                          icon: Tag,
                          label: language === 'ar' ? (c.nameAr || c.name) : c.name,
                        })),
                        ...navPages.map((p: any) => ({
                          href: `/pages/${p.slug}`,
                          icon: Tag,
                          label: language === 'ar' ? (p.titleAr || p.titleEn || p.slug) : (p.titleEn || p.titleAr || p.slug),
                        })),
                        ...(user ? [{ href: "/orders", icon: Package, label: t('myOrders') }] : []),
                        ...(user?.role === 'admin' ? [{ href: "/admin", icon: LayoutDashboard, label: t('adminPanel'), accent: true, badge: pendingAdminCount }] : []),
                        ...(user?.role === 'admin' || user?.role === 'assistant_manager'
                          ? [{ href: "/admin/branch-analytics", icon: LayoutDashboard, label: language === 'ar' ? 'تحليلات الفروع' : 'Branch Analytics' }]
                          : []),
                        ...((user?.role === 'admin' || (user?.permissions || []).some((p: string) => p.startsWith('branch.'))) && user?.branchId
                          ? [{ href: "/branch-dashboard", icon: Package, label: language === 'ar' ? 'لوحة الفرع' : 'Branch Dashboard', accent: true }]
                          : []),
                      ].map(({ href, icon: Icon, label, accent, badge }: any) => {
                        const isActive = location === href || (href !== '/' && location.startsWith(href));
                        return (
                          <Link key={href} href={href} onClick={closeSidebar}>
                            <div className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all active:scale-95 cursor-pointer ${
                              isActive
                                ? 'bg-foreground text-background'
                                : 'hover:bg-muted text-foreground'
                            }`}>
                              <div className={`relative w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                isActive ? 'bg-background/10' : accent ? 'bg-primary/10' : 'bg-muted'
                              }`}>
                                <Icon className={`h-4 w-4 ${accent && !isActive ? 'text-primary' : ''}`} />
                                {badge > 0 && (
                                  <span className="absolute -top-1 -left-1 w-4 h-4 bg-red-500 text-white text-[8px] font-black rounded-full flex items-center justify-center animate-pulse">
                                    {badge > 9 ? "9+" : badge}
                                  </span>
                                )}
                              </div>
                              <span className={`font-bold text-[13px] flex-1 ${accent && !isActive ? 'text-primary' : ''}`}>{label}</span>
                              {badge > 0 && !isActive && (
                                <span className="px-1.5 py-0.5 bg-red-500 text-white text-[9px] font-black rounded-full animate-pulse">
                                  {badge}
                                </span>
                              )}
                              {isActive && <div className="w-1.5 h-1.5 rounded-full bg-background/50" />}
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>

                  {/* ── Settings ───────────────────────────────── */}
                  <div className="px-4 mb-2">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground px-1 mb-2">{t('settings')}</p>
                    <div className="space-y-1">
                      <button
                        onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
                        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-muted transition-all active:scale-95"
                      >
                        <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <Globe className="h-4 w-4" />
                        </div>
                        <span className="font-bold text-[13px] text-foreground flex-1 text-right">{language === 'ar' ? 'English' : 'العربية'}</span>
                        <span className="text-[10px] font-black px-2 py-1 rounded-full bg-muted text-muted-foreground">{language === 'ar' ? 'EN' : 'AR'}</span>
                      </button>
                    </div>
                  </div>

                  {/* ── More Links ─────────────────────────────── */}
                  <div className="px-4 mb-2">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground px-1 mb-2">{t('more')}</p>
                    <div className="space-y-1">
                      <Link href="/terms" onClick={closeSidebar}>
                        <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-muted transition-all active:scale-95 cursor-pointer">
                          <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0"><Shield className="h-4 w-4" /></div>
                          <span className="font-bold text-[13px] text-foreground flex-1">{t('terms')}</span>
                          <ChevronRight className={`h-4 w-4 text-muted-foreground ${language === 'ar' ? 'rotate-180' : ''}`} />
                        </div>
                      </Link>
                      <a href="https://api.whatsapp.com/send?phone=966551329821" target="_blank" rel="noreferrer" onClick={closeSidebar}>
                        <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-muted transition-all active:scale-95 cursor-pointer">
                          <div className="w-7 h-7 rounded-lg bg-[#25D366]/10 flex items-center justify-center shrink-0"><SiWhatsapp className="h-4 w-4 text-[#25D366]" /></div>
                          <span className="font-bold text-[13px] text-foreground flex-1">{t('contactUs')}</span>
                          <ChevronRight className={`h-4 w-4 text-muted-foreground ${language === 'ar' ? 'rotate-180' : ''}`} />
                        </div>
                      </a>
                      {deferredPrompt && (
                        <button onClick={() => { handleInstall(); closeSidebar(); }} className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-muted transition-all active:scale-95">
                          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><Download className="h-4 w-4 text-primary" /></div>
                          <span className="font-bold text-[13px] text-foreground flex-1 text-right">{t('installApp')}</span>
                          <span className="text-[9px] font-black px-2 py-1 rounded-full bg-primary text-primary-foreground">{t('new')}</span>
                        </button>
                      )}
                      {user && (
                        <button onClick={() => { logout(); closeSidebar(); }} className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-red-50 transition-all active:scale-95">
                          <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center shrink-0"><LogOut className="h-4 w-4 text-red-500" /></div>
                          <span className="font-bold text-[13px] text-red-500 flex-1 text-right">{t('signOut')}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* ── Social ─────────────────────────────────── */}
                  <div className="px-4 mt-auto pt-4">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground px-1 mb-3">{t('connectWithUs')}</p>
                    <div className="grid grid-cols-4 gap-2 mb-4">
                      {[
                        { href: "https://www.instagram.com/rfperfume.sa", icon: Instagram, bg: "bg-gradient-to-br from-[#f09433] via-[#dc2743] to-[#bc1888]", label: "IG" },
                        { href: "https://x.com/rfperfume", icon: SiX, bg: "bg-black", labelColor: "text-white", label: "X" },
                        { href: "https://www.tiktok.com/@rfperfume.sa", icon: SiTiktok, bg: "bg-black", labelColor: "text-white", label: "TK" },
                        { href: "https://www.snapchat.com/add/rfperfume", icon: SiSnapchat, bg: "bg-[#FFFC00]", labelColor: "text-black", label: "SC" },
                      ].map(({ href, icon: Icon, bg, labelColor, label }) => (
                        <a key={label} href={href} target="_blank" rel="noreferrer"
                          className={`flex flex-col items-center gap-1.5 py-3 rounded-xl ${bg} text-white  active:scale-95 transition-transform shadow-sm`}
                        >
                          <Icon className={`h-5 w-5 ${labelColor || 'text-white'}`} />
                          <span className={`text-[9px] font-black ${labelColor || 'text-white'}`}>{label}</span>
                        </a>
                      ))}
                    </div>

                    {/* Contact row */}
                    <div className="flex gap-2 mb-5">
                      <a href="tel:+966551329821" className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-muted hover:bg-muted/80 transition-colors active:scale-95">
                        <Phone className="h-4 w-4 text-primary shrink-0" />
                        <div>
                          <p className="text-[9px] text-muted-foreground font-bold">{t('call')}</p>
                          <p className="text-[10px] font-black" dir="ltr">966 55 132 9821</p>
                        </div>
                      </a>
                      <a href="mailto:support@rfperfume.sa" className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-muted hover:bg-muted/80 transition-colors active:scale-95">
                        <Mail className="h-4 w-4 text-primary shrink-0" />
                        <div>
                          <p className="text-[9px] text-muted-foreground font-bold">{t('email')}</p>
                          <p className="text-[10px] font-black truncate">rf-purfume</p>
                        </div>
                      </a>
                    </div>

                    {/* Footer */}
                    <div className="border-t border-border pt-4 pb-8 text-center">
                      <p className="text-[10px] text-muted-foreground font-bold">© 2026 عطور آر اف | RF Perfume</p>
                      <p className="text-[9px] text-muted-foreground/50 mt-0.5">rfperfume.sa</p>
                    </div>
                  </div>

                </div>
              </SheetContent>
            </Sheet>

            <Link href="/" className="hidden md:flex items-center py-1 hover:opacity-80 transition-opacity active:scale-95 transition-transform">
              <img src={logoImg} alt="عطور آر اف" className="h-11 md:h-14 w-auto object-contain rounded-sm" />
            </Link>
          </div>

          <div className={`hidden md:flex items-center gap-8 text-[11px] font-black uppercase ${language === 'en' ? 'tracking-widest' : ''}`}>
            <Link href="/" className={`transition-colors hover:text-primary ${location === '/' ? 'text-foreground' : 'text-muted-foreground'}`}>{t('home')}</Link>
            <Link href="/products" className={`transition-colors hover:text-primary ${location === '/products' ? 'text-foreground' : 'text-muted-foreground'}`}>{t('shop')}</Link>
            {(Array.isArray(navCategories) ? navCategories : []).map((c: any) => {
              const href = `/products?category=${c.slug}`;
              const label = language === 'ar' ? (c.nameAr || c.name) : c.name;
              const activeCat = typeof window !== 'undefined' && window.location.pathname === '/products' && new URLSearchParams(window.location.search).get('category') === c.slug;
              return (
                <Link
                  key={c.id || c._id || c.slug}
                  href={href}
                  className={`transition-colors hover:text-primary ${activeCat ? 'text-foreground' : 'text-muted-foreground'}`}
                  data-testid={`link-nav-cat-${c.slug}`}
                >
                  {label}
                </Link>
              );
            })}
            {navPages.map((p: any) => {
              const href = `/pages/${p.slug}`;
              const label = language === 'ar' ? (p.titleAr || p.titleEn || p.slug) : (p.titleEn || p.titleAr || p.slug);
              return (
                <Link
                  key={p._id || p.id || p.slug}
                  href={href}
                  className={`transition-colors hover:text-primary ${location === href ? 'text-foreground' : 'text-muted-foreground'}`}
                  data-testid={`link-nav-page-${p.slug}`}
                >
                  {label}
                </Link>
              );
            })}
            {deferredPrompt && (
              <Button 
                onClick={handleInstall}
                variant="ghost"
                size="sm"
                className="gap-2 font-black uppercase text-[10px] h-9"
              >
                <Download className="h-4 w-4" />
                {t('installApp')}
              </Button>
            )}
          </div>

          <div className="flex items-center gap-1 md:gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
              className="hidden md:inline-flex no-default-hover-elevate hover:text-primary h-11 w-11 active:scale-95 transition-transform"
              data-testid="button-language-toggle"
            >
              <Globe className="h-6 w-6" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              data-cart-target="true"
              data-testid="button-cart"
              onClick={() => {
                if (!user) {
                  setAuthModalTab("login");
                  setAuthModalOpen(true);
                } else {
                  setLocation("/cart");
                }
              }}
              className="relative no-default-hover-elevate hover:text-primary h-9 w-9 md:h-11 md:w-11 active:scale-95 transition-transform"
            >
              <ShoppingBag className="h-5 w-5 md:h-6 md:w-6" />
              {cartItems.reduce((acc, item) => acc + item.quantity, 0) > 0 && (
                <span className={`absolute -top-0.5 md:-top-1 ${language === 'ar' ? '-right-0.5 md:-right-1' : '-left-0.5 md:-left-1'} h-4 w-4 md:h-5 md:w-5 rounded-full bg-foreground text-[9px] md:text-[10px] font-black text-background flex items-center justify-center shadow-md`}>
                  {cartItems.reduce((acc, item) => acc + item.quantity, 0)}
                </span>
              )}
            </Button>

            {user && <NotificationBell />}

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-9 w-9 md:h-11 md:w-auto p-0 md:px-4 flex items-center justify-center md:gap-3 border border-transparent md:border-border md:hover:border-foreground/20 transition-all rounded-full md:rounded-none group no-default-hover-elevate active:scale-95">
                    <div className="hidden md:flex flex-col items-end">
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">{t('myAccount') || 'حسابي'}</span>
                      <span className="text-[11px] font-bold text-foreground/60 truncate max-w-[100px]">{user?.name || user?.username}</span>
                    </div>
                    <div className="w-9 h-9 md:w-9 md:h-9 rounded-full bg-muted flex items-center justify-center group-hover:bg-foreground group-hover:text-background transition-all duration-500 shadow-inner">
                      <User className="h-4 w-4 md:h-5 md:w-5" />
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align={language === 'ar' ? "end" : "start"} className="w-64 p-2 rounded-none border-border shadow-2xl bg-background animate-in fade-in zoom-in-95 duration-200">
                  <div className="px-3 py-4 mb-2 bg-muted flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-foreground text-background flex items-center justify-center font-black text-xl">
                      {(user?.name || user?.username || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t('welcome')}</span>
                      <span className="text-sm font-bold text-foreground truncate max-w-[140px]">{user?.name || user?.username}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <Link href="/profile">
                      <DropdownMenuItem className={`cursor-pointer gap-3 p-3 text-[10px] font-black uppercase tracking-widest hover:bg-foreground hover:text-background transition-all rounded-none ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
                        <User className="h-4 w-4 opacity-40" />
                        {t('myAccount')}
                      </DropdownMenuItem>
                    </Link>
                    
                    <div className={`flex items-center justify-between p-3 mb-2 bg-primary/5 border border-primary/10 rounded-none ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
                      <div className={`flex items-center gap-2 ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
                        <Wallet className="h-4 w-4 text-primary" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t('wallet')}</span>
                      </div>
                      <span dir="ltr" className="text-sm font-black text-primary">{(user as any)?.walletBalance?.toLocaleString() || '0'} <RiyalSign /></span>
                    </div>

                    <Link href="/orders">
                      <DropdownMenuItem className={`cursor-pointer gap-3 p-3 text-[10px] font-black uppercase tracking-widest hover:bg-foreground hover:text-background transition-all rounded-none ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
                        <ShoppingBag className="h-4 w-4 opacity-40" />
                        {t('myOrders')}
                      </DropdownMenuItem>
                    </Link>

                    <Link href="/profile/wishlist">
                      <DropdownMenuItem className={`cursor-pointer gap-3 p-3 text-[10px] font-black uppercase tracking-widest hover:bg-foreground hover:text-background transition-all rounded-none ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
                        <Heart className="h-4 w-4 opacity-40" />
                        {t('wishlist')}
                      </DropdownMenuItem>
                    </Link>
                    
                    {(user as any)?.role === 'vendor' && (
                      <Link href="/vendor/dashboard">
                        <DropdownMenuItem className={`cursor-pointer gap-3 p-3 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-foreground hover:text-background transition-all rounded-none ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
                          <Store className="h-4 w-4 opacity-40" />
                          {t('vendorDashboard')}
                        </DropdownMenuItem>
                      </Link>
                    )}

                    {user?.role === 'admin' && (
                      <Link href="/admin">
                        <DropdownMenuItem className={`cursor-pointer gap-3 p-3 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-foreground hover:text-background transition-all rounded-none ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
                          <LayoutDashboard className="h-4 w-4" />
                          <span className="flex-1">{t('adminPanel')}</span>
                          {pendingAdminCount > 0 && (
                            <span className="px-1.5 py-0.5 bg-red-500 text-white text-[9px] font-black rounded-full animate-pulse">
                              {pendingAdminCount}
                            </span>
                          )}
                        </DropdownMenuItem>
                      </Link>
                    )}
                    
                    <DropdownMenuSeparator className="my-2 bg-border" />
                    
                    <DropdownMenuItem onClick={() => logout()} className={`cursor-pointer gap-3 p-3 text-[10px] font-black uppercase tracking-widest text-destructive hover:bg-destructive hover:text-white transition-all rounded-none ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
                      <User className="h-4 w-4 opacity-40" />
                      {t('signOut')}
                    </DropdownMenuItem>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t('signIn')}
                  className="md:hidden no-default-hover-elevate hover:text-primary h-10 w-10 active:scale-95 transition-transform"
                  onClick={() => { setAuthModalTab("login"); setAuthModalOpen(true); }}
                  data-testid="button-signin-mobile"
                >
                  <User className="h-6 w-6" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`hidden md:inline-flex font-black uppercase text-[10px] ${language === 'en' ? 'tracking-widest' : ''} h-9 px-4`}
                  onClick={() => { setAuthModalTab("login"); setAuthModalOpen(true); }}
                  data-testid="button-signin-desktop"
                >
                  {t('signIn')}
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      <main className="flex-1">{children}</main>

      {/* Unified luxury floating widget (AI + Support + WhatsApp) — lazy-loaded after first paint */}
      <Suspense fallback={null}>
        <UnifiedChat />
      </Suspense>

      {/* Auth Modal */}
      {!user && <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} defaultTab={authModalTab} />}

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-8 sm:py-12 md:py-16 mt-12 sm:mt-16 md:mt-24">
        <div className="container grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 md:gap-12 px-4">
          <div className="col-span-2 md:col-span-1 space-y-3 sm:space-y-4">
            <Link href="/" className="flex items-center">
              <img src={logoImg} alt="عطور آر اف" className="h-10 sm:h-12 md:h-14 w-auto object-contain" />
            </Link>
            <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
              {t('footerTagline')}
            </p>
          </div>

          {/* الدعم والمساعدة */}
          <div>
            <h3 className="font-bold text-sm sm:text-base md:text-lg mb-3 sm:mb-4 md:mb-6 text-[#DFB369]">
              {language === 'ar' ? 'الدعم والمساعدة' : 'Help & Support'}
            </h3>
            <ul className="space-y-2 sm:space-y-3 text-xs sm:text-sm text-gray-800">
              <li><Link href="/pages/about" className="hover:text-[#DFB369] transition-colors">{language === 'ar' ? 'من نحن' : 'About Us'}</Link></li>
              <li><Link href="/terms" className="hover:text-[#DFB369] transition-colors">{language === 'ar' ? 'الشروط والأحكام' : 'Terms & Conditions'}</Link></li>
              <li><Link href="/privacy" className="hover:text-[#DFB369] transition-colors">{language === 'ar' ? 'سياسة الخصوصية' : 'Privacy Policy'}</Link></li>
              <li><Link href="/pages/loyalty" className="hover:text-[#DFB369] transition-colors">{language === 'ar' ? 'برنامج ولاء العملاء' : 'Loyalty Program'}</Link></li>
              <li><Link href="/shipping-policy" className="hover:text-[#DFB369] transition-colors">{language === 'ar' ? 'سياسة الشحن والتوصيل' : 'Shipping Policy'}</Link></li>
              <li><Link href="/return-policy" className="hover:text-[#DFB369] transition-colors">{language === 'ar' ? 'سياسة الاسترجاع والاستبدال' : 'Return Policy'}</Link></li>
            </ul>
          </div>

          {/* تواصل معنا */}
          <div>
            <h3 className="font-bold text-sm sm:text-base md:text-lg mb-3 sm:mb-4 md:mb-6 text-[#DFB369]">
              {language === 'ar' ? 'تواصل معنا' : 'Contact Us'}
            </h3>
            <ul className="space-y-2 sm:space-y-3 text-xs sm:text-sm text-gray-800">
              <li>
                <Link href="/branches" data-testid="link-footer-branches" className="hover:text-[#DFB369] transition-colors">
                  {language === 'ar' ? 'فروعنا' : 'Our Branches'}
                </Link>
              </li>
              <li>
                <a href="https://api.whatsapp.com/send?phone=966551329821" target="_blank" rel="noreferrer" className="hover:text-[#DFB369] transition-colors">
                  {language === 'ar' ? 'خدمة العملاء' : 'Customer Service'}
                </a>
              </li>
              <li>
                <a href="mailto:complaints@rfperfume.sa" className="hover:text-[#DFB369] transition-colors">
                  {language === 'ar' ? 'للشكاوى أو المقترحات' : 'Complaints & Suggestions'}
                </a>
              </li>
              <li>
                <a href="mailto:sales@rfperfume.sa" className="hover:text-[#DFB369] transition-colors">
                  {language === 'ar' ? 'مبيعات الشركات والجملة' : 'Corporate & Wholesale Sales'}
                </a>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div className="col-span-2 md:col-span-1">
            <h3 className="font-bold text-sm sm:text-base md:text-lg mb-3 sm:mb-4 md:mb-6 text-[#DFB369]">{language === 'ar' ? 'معلومات التواصل' : 'Get in Touch'}</h3>
            <div className="space-y-4 text-sm text-gray-800">
              <a 
                href="tel:+966551329821" 
                target="_blank" 
                rel="noreferrer" 
                className="flex items-center gap-3 p-2 rounded-xl hover:bg-[#DFB369]/5 hover:text-[#DFB369] transition-all group"
              >
                <span className="bg-[#DFB369]/10 p-2.5 rounded-lg text-[#DFB369] group-hover:bg-[#DFB369] group-hover:text-white transition-colors"><Phone className="h-4 w-4" /></span>
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-700 font-medium">{t('callUs')}</span>
                  <span dir="ltr" className="font-bold text-gray-600">966 55 132 9821</span>
                </div>
              </a>
              <a 
                href="mailto:support@rfperfume.sa" 
                target="_blank" 
                rel="noreferrer" 
                className="flex items-center gap-3 p-2 rounded-xl hover:bg-[#DFB369]/5 hover:text-[#DFB369] transition-all group"
              >
                <span className="bg-[#DFB369]/10 p-2.5 rounded-lg text-[#DFB369] group-hover:bg-[#DFB369] group-hover:text-white transition-colors"><Mail className="h-4 w-4" /></span>
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-700 font-medium">{t('email')}</span>
                  <span dir="ltr" className="font-bold text-gray-600">support@rfperfume.sa</span>
                </div>
              </a>
              <div className="flex items-center gap-3 p-2">
                <span className="bg-[#DFB369]/10 p-2.5 rounded-lg text-[#DFB369]"><SiWhatsapp className="h-4 w-4" /></span>
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-700 font-medium">{t('whatsapp')}</span>
                  <a href="https://api.whatsapp.com/send?phone=966551329821" target="_blank" rel="noreferrer" dir="ltr" className="font-bold text-gray-600 hover:text-[#DFB369] transition-colors">966 55 132 9821</a>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="container mt-8 sm:mt-12 md:mt-16 pt-6 sm:pt-8 border-t border-gray-200 text-center text-xs sm:text-sm text-gray-700 px-4">
          <div className="flex justify-center flex-wrap gap-2 sm:gap-4 mt-4 sm:mt-8">
            {(() => {
              const fallback = [
                { platform: 'instagram', url: 'https://www.instagram.com/rfperfume.sa', isActive: true },
                { platform: 'twitter',   url: 'https://x.com/rfperfume', isActive: true },
                { platform: 'snapchat',  url: 'https://www.snapchat.com/add/rfperfume', isActive: true },
                { platform: 'tiktok',    url: 'https://www.tiktok.com/@rfperfume.sa', isActive: true },
              ];
              const list: any[] = (storeSettings?.socialAccounts && storeSettings.socialAccounts.length > 0)
                ? storeSettings.socialAccounts
                : fallback;
              const active = list.filter((s: any) => s.isActive !== false && s.url).sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0));
              const styles: Record<string, { cls: string; Icon: any; label: string }> = {
                instagram: { cls: 'bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] text-white', Icon: Instagram, label: 'Instagram' },
                twitter:   { cls: 'bg-[#2B2B60] text-white', Icon: SiX, label: 'X' },
                snapchat:  { cls: 'bg-[#FFFC00] text-black', Icon: SiSnapchat, label: 'Snapchat' },
                tiktok:    { cls: 'bg-[#2B2B60] text-white', Icon: SiTiktok, label: 'TikTok' },
                whatsapp:  { cls: 'bg-[#25D366] text-white', Icon: SiWhatsapp, label: 'WhatsApp' },
                facebook:  { cls: 'bg-[#1877F2] text-white', Icon: Globe, label: 'Facebook' },
                youtube:   { cls: 'bg-[#FF0000] text-white', Icon: Globe, label: 'YouTube' },
                telegram:  { cls: 'bg-[#26A5E4] text-white', Icon: Globe, label: 'Telegram' },
                linkedin:  { cls: 'bg-[#0A66C2] text-white', Icon: Globe, label: 'LinkedIn' },
                website:   { cls: 'bg-[#DFB369] text-white', Icon: Globe, label: 'Website' },
              };
              return active.map((s: any, i: number) => {
                const meta = styles[s.platform] || styles.website;
                const Icon = meta.Icon;
                return (
                  <a
                    key={`${s.platform}-${i}`}
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    title={s.handle || meta.label}
                    data-testid={`link-social-${s.platform}-${i}`}
                    className={`flex items-center justify-center w-10 h-10 rounded-full transition-transform hover:scale-110 shadow-lg ${meta.cls}`}
                  >
                    <Icon className="h-5 w-5" />
                  </a>
                );
              });
            })()}
          </div>

          {/* Payment Methods */}
          <div className="mt-6 sm:mt-10 md:mt-12 pt-5 sm:pt-7 md:pt-8 border-t border-gray-200">
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-700 mb-3 sm:mb-5">{t('availablePayments')}</p>
            <div className="flex flex-wrap justify-center items-center gap-2 sm:gap-3">
              <div className="h-10 px-2 rounded-xl bg-gray-50 border border-gray-200 flex items-center  transition-transform shadow-sm cursor-default" title="Mada / Visa / Mastercard / Amex">
                <img src="/uploads/card-brands-logo.png" alt="Card Brands" className="h-7 w-auto object-contain" />
              </div>
              <div className="h-10 px-4 rounded-xl bg-gray-900 flex items-center gap-1.5  transition-transform shadow-sm cursor-default" title="Apple Pay">
                <svg viewBox="0 0 20 24" className="h-4 w-auto fill-white flex-shrink-0">
                  <path d="M13.23 3.02C14.28 1.71 14.94 0 14.94 0s-1.71.28-2.76 1.59c-.96 1.21-1.57 2.86-1.47 3.64.97.07 2.53-.3 3.52-2.21zM16.44 8.74c-1.77-.07-3.28 1-4.13 1-.85 0-2.14-.94-3.55-.91-1.82.03-3.5 1.06-4.43 2.71-1.9 3.28-.49 8.15 1.35 10.82.9 1.31 1.97 2.77 3.38 2.72 1.35-.05 1.86-.87 3.49-.87 1.62 0 2.09.87 3.51.84 1.46-.03 2.39-1.32 3.29-2.63.97-1.47 1.37-2.9 1.4-2.97-.03-.01-2.71-1.04-2.74-4.13-.03-2.59 2.11-3.83 2.21-3.9-1.2-1.78-3.08-1.68-3.78-1.68z"/>
                </svg>
                <span className="text-white font-semibold text-sm">Pay</span>
              </div>
              <div className="h-10 px-2 rounded-xl bg-gray-50 border border-gray-200 flex items-center  transition-transform shadow-sm cursor-default" title="STC Pay">
                <img src="/uploads/stcpay-logo.png" alt="STC Pay" className="h-7 w-auto object-contain" />
              </div>
              <div className="h-10 px-2 rounded-xl bg-gray-50 border border-gray-200 flex items-center  transition-transform shadow-sm cursor-default" title="Tabby">
                <img src="/uploads/tabby-logo.png" alt="Tabby" className="h-7 w-auto object-contain" />
              </div>
              <div className="h-10 px-1 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center overflow-hidden transition-transform shadow-sm cursor-default" title="Tamara">
                <img src="/uploads/tamara-logo.png" alt="Tamara" className="h-20 w-auto object-contain" />
              </div>
            </div>
          </div>

          {/* Commercial Registration & Tax */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex flex-wrap justify-center items-center gap-4 sm:gap-8">
              {/* Commercial Registration */}
              <a
                href="https://qr.saudibusiness.gov.sa/viewcr?nCrNumber=et1BNw5nU2a6R1GygbnoPA=="
                target="_blank"
                rel="noreferrer"
                className="flex flex-row items-center gap-3 group transition-transform"
              >
                <img 
                  src="/images/sijil-tijari-logo.png"
                  loading="lazy" 
                  alt="السجل التجاري" 
                  className="h-10 sm:h-12 w-auto object-contain flex-shrink-0" 
                />
                <div className="text-right">
                  <div className="text-[9px] sm:text-[10px] text-gray-700 font-bold uppercase tracking-widest">
                    {t('commercialReg')}
                  </div>
                  <div className="text-[11px] sm:text-xs text-[#DFB369] font-black group-hover:underline">1010978041</div>
                </div>
              </a>
              {/* VAT */}
              <div className="flex flex-row items-center gap-3">
                <img
                  src="/images/vat-logo.png"
                  alt="ضريبة القيمة المضافة VAT"
                  loading="lazy"
                  className="h-10 sm:h-12 w-auto object-contain flex-shrink-0"
                />
                <div className="text-right">
                  <div className="text-[9px] sm:text-[10px] text-gray-700 font-bold uppercase tracking-widest">
                    {t('taxNumber')}
                  </div>
                  <div className="text-[11px] sm:text-xs text-[#DFB369] font-black">312037024200003</div>
                </div>
              </div>
              {/* Business Center Accreditation */}
              <a
                href="https://businesscenter.moc.gov.sa"
                target="_blank"
                rel="noreferrer"
                className="flex flex-row items-center gap-2 group transition-transform"
              >
                <img 
                  src="https://assets.zid.store/themes/f9f0914d-3c58-493b-bd83-260ed3cb4e82/business_center.png"
                  loading="lazy" 
                  alt="مركز الأعمال" 
                  className="h-5 sm:h-6 w-auto object-contain flex-shrink-0" 
                />
                <div className="text-right">
                  <div className="text-[8px] sm:text-[9px] text-gray-700 font-bold uppercase tracking-widest">
                    معتمد من
                  </div>
                  <div className="text-[9px] sm:text-[10px] text-[#DFB369] font-black group-hover:underline">مركز الأعمال</div>
                </div>
              </a>
            </div>
          </div>

          {/* Copyright */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-xs sm:text-sm text-gray-700">© 2026 عطور آر اف | RF Perfume. {t('allRightsReserved')}.</p>
            <p className="mt-2 text-[10px] sm:text-xs text-gray-700">
              rfperfume.sa
            </p>
            <p className="mt-3 sm:mt-4 text-[10px] sm:text-xs text-gray-600 flex items-center justify-center gap-1.5 flex-wrap">
              <span>صُنع بـ</span>
              <span className="text-[#850935] text-base leading-none animate-pulse" aria-label="حب">♥</span>
              <span>عبر</span>
              <a
                href="https://qiroxstudio.online"
                target="_blank"
                rel="noreferrer"
                data-testid="link-qirox-studio"
                className="font-black text-[#DFB369] hover:text-[#850935] transition-colors underline-offset-4 hover:underline"
              >
                Qirox Studio
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
