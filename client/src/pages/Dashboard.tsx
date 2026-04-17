import { useAuth } from "@/hooks/use-auth";
import { useMyOrders } from "@/hooks/use-orders";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, ShoppingBag, Wallet, LogOut, MapPin, Package,
  Plus, Trash2, Home, BarChart3, Bell, Settings, Users,
  TrendingUp, ArrowUpRight, ArrowDownRight, Star, Zap,
  CheckCircle2, Clock, Truck, ChevronRight, DollarSign,
  Box, Eye, Tag, Activity, Shield, Globe, Menu, X
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
const logoImg = "/images/logos/logo-light.png";
const logoDarkImg = "/images/logos/logo-dark.png";

const statusColors: Record<string, string> = {
  pending:     "bg-amber-400/10 text-amber-400 border-amber-400/20",
  processing:  "bg-blue-400/10 text-blue-400 border-blue-400/20",
  shipped:     "bg-violet-400/10 text-violet-400 border-violet-400/20",
  delivered:   "bg-emerald-400/10 text-emerald-400 border-emerald-400/20",
  cancelled:   "bg-red-400/10 text-red-400 border-red-400/20",
};
const statusLabel: Record<string, string> = {
  pending:    "جديد",
  processing: "قيد التجهيز",
  shipped:    "تم الشحن",
  delivered:  "مُسلَّم",
  cancelled:  "ملغي",
};

function SparkLine({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${100 - (v / max) * 100}`).join(" ");
  return (
    <svg viewBox="0 0 100 100" className="w-20 h-10 opacity-70" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PulseRing({ color }: { color: string }) {
  return (
    <span className="relative flex h-3 w-3">
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${color} opacity-50`} />
      <span className={`relative inline-flex rounded-full h-3 w-3 ${color}`} />
    </span>
  );
}

export default function Dashboard() {
  const { user, isLoading: authLoading, logout } = useAuth();
  const { data: orders, isLoading: ordersLoading } = useMyOrders();
  const { data: transactions } = useQuery({ queryKey: ["/api/wallet/transactions"], enabled: !!user });
  const { data: adminStats } = useQuery<any>({ queryKey: ["/api/admin/stats"], enabled: !!user && user.role === "admin" });
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [newAddress, setNewAddress] = useState({ name: "", city: "", street: "" });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const iv = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  const addressMutation = useMutation({
    mutationFn: async (addresses: any[]) => {
      const res = await apiRequest("PATCH", "/api/user/addresses", { addresses });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: "✅ تم تحديث العناوين بنجاح" });
      setIsAddingAddress(false);
      setNewAddress({ name: "", city: "", street: "" });
    },
  });

  useEffect(() => {
    if (!authLoading && !user) {
      setLocation("/login");
    }
  }, [authLoading, user, setLocation]);

  if (authLoading) return (
    <div className="flex h-screen items-center justify-center bg-[#080c14]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 border-2 border-white/10 border-t-white/60 rounded-full animate-spin" />
        <p className="text-white/40 text-xs tracking-widest uppercase">جاري التحميل</p>
      </div>
    </div>
  );

  if (!user) return (
    <div className="flex h-screen items-center justify-center bg-[#080c14]">
      <div className="w-16 h-16 border-2 border-white/10 border-t-white/60 rounded-full animate-spin" />
    </div>
  );

  const isAdmin = user.role === "admin";
  const sparkData = [30, 45, 28, 60, 40, 70, 55, 80, 65, 90];

  const navItems = [
    { id: "overview", icon: Home, label: "نظرة عامة" },
    { id: "orders", icon: ShoppingBag, label: "الطلبات" },
    { id: "wallet", icon: Wallet, label: "المحفظة" },
    { id: "addresses", icon: MapPin, label: "العناوين" },
    ...(isAdmin ? [
      { id: "divider" },
      { id: "admin-products", icon: Box, label: "المنتجات", href: "/admin" },
      { id: "admin-staff", icon: Users, label: "الموظفون", href: "/admin/staff" },
      { id: "admin-reports", icon: BarChart3, label: "التقارير", href: "/admin" },
    ] : []),
  ];

  const stats = [
    {
      title: "إجمالي الطلبات",
      value: isAdmin ? (adminStats?.totalOrders ?? orders?.length ?? 0) : (orders?.length ?? 0),
      sub: "كل الوقت",
      icon: ShoppingBag,
      trend: +12,
      color: "from-blue-500 to-blue-600",
      glow: "shadow-blue-500/20",
      spark: [20, 35, 28, 50, 40, 60, 45, 70, 55, 80],
      sparkColor: "#60a5fa",
    },
    {
      title: "إجمالي الإيرادات",
      value: isAdmin ? (adminStats?.totalRevenue ?? "0") : (orders?.reduce((s: number, o: any) => s + parseFloat(o.total || "0"), 0).toFixed(0) ?? "0"),
      sub: "ر.س",
      icon: DollarSign,
      trend: +8,
      color: "from-emerald-500 to-teal-600",
      glow: "shadow-emerald-500/20",
      spark: [30, 45, 35, 55, 48, 68, 58, 75, 62, 88],
      sparkColor: "#34d399",
    },
    {
      title: "العملاء",
      value: isAdmin ? (adminStats?.totalUsers ?? 0) : "—",
      sub: "مسجل",
      icon: Users,
      trend: +5,
      color: "from-violet-500 to-purple-600",
      glow: "shadow-violet-500/20",
      spark: [15, 28, 22, 40, 32, 50, 38, 58, 45, 65],
      sparkColor: "#a78bfa",
    },
    {
      title: "رصيد المحفظة",
      value: parseFloat(user.walletBalance || "0").toFixed(0),
      sub: "ر.س متاح",
      icon: Wallet,
      trend: 0,
      color: "from-amber-500 to-orange-500",
      glow: "shadow-amber-500/20",
      spark: [50, 60, 55, 70, 65, 75, 68, 80, 72, 85],
      sparkColor: "#fbbf24",
    },
  ];

  return (
    <div className="flex h-screen bg-[#080c14] text-white overflow-hidden" dir="rtl">

      {/* ── Sidebar ─────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {sidebarOpen && (
          <motion.aside
            initial={{ x: 280 }}
            animate={{ x: 0 }}
            exit={{ x: 280 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="relative z-30 flex flex-col w-72 bg-[#0d1220] border-l border-white/5 shadow-2xl"
          >
            {/* Decorative gradient */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-violet-500/5 rounded-full blur-3xl" />
            </div>

            {/* Logo */}
            <div className="relative z-10 flex items-center gap-3 p-6 border-b border-white/5">
              <img src={logoImg} alt="رفيف العود" className="h-9 w-9 rounded-xl object-cover" />
              <div>
                <p className="font-black text-sm tracking-tight text-white">رفيف العود</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <PulseRing color="bg-emerald-400" />
                  <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-widest">متجر نشط</span>
                </div>
              </div>
            </div>

            {/* User Card */}
            <div className="relative z-10 mx-4 mt-4 mb-2 p-4 rounded-2xl bg-gradient-to-br from-white/5 to-white/0 border border-white/8">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-lg font-black shadow-lg shadow-blue-500/20">
                  {(user.name || user.username || "?").charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-sm text-white leading-tight">{user.name || user.username || "مستخدم"}</p>
                  <p className="text-[10px] text-white/40 mt-0.5">{isAdmin ? "مدير المتجر" : "حساب العميل"}</p>
                  <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/20">
                    <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                    <span className="text-[9px] font-bold text-amber-400 uppercase">{user.loyaltyTier || "bronze"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Nav */}
            <nav className="relative z-10 flex-1 px-3 py-2 space-y-1 overflow-y-auto">
              {navItems.map((item: any, i: number) => {
                if (item.id === "divider") return (
                  <div key={i} className="my-3 border-t border-white/5 pt-3">
                    <p className="text-[9px] text-white/20 font-bold uppercase tracking-widest px-3 mb-2">لوحة الإدارة</p>
                  </div>
                );
                const Icon = item.icon;
                const isActive = activeTab === item.id && !item.href;
                return item.href ? (
                  <Link key={item.id} href={item.href}>
                    <div className="flex items-center gap-3 px-3 py-3 rounded-xl text-white/40 hover:text-white hover:bg-white/5 transition-all cursor-pointer group">
                      <Icon className="w-4 h-4 group-hover:text-blue-400 transition-colors" />
                      <span className="text-xs font-bold">{item.label}</span>
                      <ChevronRight className="w-3 h-3 mr-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </Link>
                ) : (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all group relative ${isActive ? "bg-blue-500/15 text-blue-400" : "text-white/40 hover:text-white hover:bg-white/5"}`}
                  >
                    {isActive && <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-400 rounded-l-full" />}
                    <Icon className={`w-4 h-4 ${isActive ? "text-blue-400" : "group-hover:text-white"}`} />
                    <span className="text-xs font-bold">{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Bottom */}
            <div className="relative z-10 p-4 border-t border-white/5 space-y-2">
              {isAdmin && (
                <Link href="/admin">
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-all cursor-pointer">
                    <Shield className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-bold text-blue-400">لوحة الإدارة الكاملة</span>
                    <ArrowUpRight className="w-3 h-3 text-blue-400 mr-auto" />
                  </div>
                </Link>
              )}
              <button
                onClick={() => { logout(); setLocation("/"); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-400/70 hover:text-red-400 hover:bg-red-400/10 transition-all"
              >
                <LogOut className="w-4 h-4" />
                <span className="text-xs font-bold">تسجيل الخروج</span>
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ── Main Content ─────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <header className="h-16 bg-[#0d1220]/80 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(s => !s)}
              className="p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/5 transition-all"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div>
              <p className="text-xs text-white/30 font-bold uppercase tracking-widest">
                {time.toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </p>
              <p className="text-[10px] text-white/20 tabular-nums">
                {time.toLocaleTimeString("ar-SA")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-400/10 border border-emerald-400/20">
              <PulseRing color="bg-emerald-400" />
              <span className="text-[10px] font-bold text-emerald-400">المتجر يعمل</span>
            </div>
            <button className="relative p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/5 transition-all">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-400 rounded-full border-2 border-[#0d1220]" />
            </button>
            <Link href="/">
              <div className="p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/5 transition-all cursor-pointer">
                <Globe className="w-5 h-5" />
              </div>
            </Link>
          </div>
        </header>

        {/* Page Body */}
        <main className="flex-1 overflow-y-auto">
          <div className="relative min-h-full">

            {/* Background decorative */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
              <div className="absolute top-20 right-40 w-96 h-96 bg-blue-500/3 rounded-full blur-3xl" />
              <div className="absolute bottom-20 left-40 w-96 h-96 bg-violet-500/3 rounded-full blur-3xl" />
            </div>

            <div className="relative z-10 p-6 sm:p-8 space-y-8">

              {/* Welcome */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div>
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                    مرحباً، <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">{(user.name || user.username || "مستخدم").split(" ")[0]}</span> 👋
                  </h1>
                  <p className="text-white/30 text-sm mt-1">هذا ما يحدث في حسابك الآن</p>
                </div>
                {isAdmin && (
                  <Link href="/admin">
                    <motion.div
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-violet-600 text-white text-sm font-bold shadow-xl shadow-blue-500/25 cursor-pointer"
                    >
                      <Zap className="w-4 h-4" />
                      لوحة الإدارة الكاملة
                      <ArrowUpRight className="w-4 h-4" />
                    </motion.div>
                  </Link>
                )}
              </motion.div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className="group relative rounded-2xl bg-[#0d1220] border border-white/5 p-5 overflow-hidden hover:border-white/10 transition-all"
                  >
                    {/* Gradient top */}
                    <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${stat.color}`} />
                    {/* Glow */}
                    <div className={`absolute -top-4 -right-4 w-20 h-20 bg-gradient-to-br ${stat.color} opacity-10 rounded-full blur-xl group-hover:opacity-20 transition-opacity`} />

                    <div className="relative z-10">
                      <div className="flex items-start justify-between mb-4">
                        <div className={`p-2 rounded-xl bg-gradient-to-br ${stat.color} shadow-lg ${stat.glow}`}>
                          <stat.icon className="w-4 h-4 text-white" />
                        </div>
                        {stat.trend !== 0 && (
                          <div className={`flex items-center gap-0.5 text-[10px] font-bold ${stat.trend > 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {stat.trend > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                            {Math.abs(stat.trend)}%
                          </div>
                        )}
                      </div>
                      <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-1">{stat.title}</p>
                      <div className="flex items-baseline gap-1">
                        <p className="text-2xl font-black text-white tabular-nums">{stat.value}</p>
                        <p className="text-white/30 text-[10px]">{stat.sub}</p>
                      </div>
                      <div className="mt-3 flex justify-end">
                        <SparkLine values={stat.spark} color={stat.sparkColor} />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Orders + Wallet Row */}
              <div className="grid lg:grid-cols-3 gap-6">

                {/* Recent Orders */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="lg:col-span-2 rounded-2xl bg-[#0d1220] border border-white/5 overflow-hidden"
                >
                  <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-5 bg-blue-400 rounded-full" />
                      <h2 className="font-black text-sm text-white">آخر الطلبات</h2>
                    </div>
                    <Link href="/orders">
                      <span className="text-[10px] text-blue-400 font-bold hover:underline cursor-pointer flex items-center gap-1">
                        عرض الكل <ChevronRight className="w-3 h-3" />
                      </span>
                    </Link>
                  </div>

                  {ordersLoading ? (
                    <div className="p-12 text-center">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-white/20" />
                    </div>
                  ) : !orders?.length ? (
                    <div className="p-12 text-center space-y-3">
                      <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto">
                        <ShoppingBag className="w-7 h-7 text-white/20" />
                      </div>
                      <p className="text-white/30 text-sm font-medium">لا توجد طلبات بعد</p>
                      <Link href="/products">
                        <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-500/15 text-blue-400 text-xs font-bold cursor-pointer hover:bg-blue-500/25 transition-colors">
                          <ShoppingBag className="w-3.5 h-3.5" /> ابدأ التسوق
                        </span>
                      </Link>
                    </div>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {orders.slice(0, 5).map((order: any, i: number) => (
                        <motion.div
                          key={order.id}
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.4 + i * 0.05 }}
                          className="flex items-center justify-between px-6 py-4 hover:bg-white/3 transition-colors group"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-white/10 flex items-center justify-center">
                              <Package className="w-4 h-4 text-white/50" />
                            </div>
                            <div>
                              <p className="font-black text-xs text-white">#{order.id.slice(-6).toUpperCase()}</p>
                              <p className="text-[9px] text-white/30">{new Date(order.createdAt).toLocaleDateString("ar-SA")}</p>
                            </div>
                          </div>
                          <span className={`text-[9px] font-bold px-2.5 py-1 rounded-full border ${statusColors[order.status] || "bg-white/5 text-white/40 border-white/10"}`}>
                            {statusLabel[order.status] || order.status}
                          </span>
                          <p className="font-black text-sm text-white tabular-nums">{order.total} <span className="text-white/30 text-[10px] font-bold">ر.س</span></p>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </motion.div>

                {/* Wallet Card */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="rounded-2xl bg-[#0d1220] border border-white/5 overflow-hidden"
                >
                  <div className="flex items-center gap-2 px-6 py-4 border-b border-white/5">
                    <div className="w-1 h-5 bg-amber-400 rounded-full" />
                    <h2 className="font-black text-sm text-white">المحفظة</h2>
                  </div>
                  <div className="p-5">
                    {/* Wallet Visual */}
                    <div className="relative rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-6 overflow-hidden shadow-2xl shadow-amber-500/20 mb-5">
                      <div className="absolute inset-0 overflow-hidden">
                        <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
                        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-black/20 rounded-full blur-2xl" />
                        {/* Card pattern */}
                        <svg className="absolute inset-0 w-full h-full opacity-10" viewBox="0 0 200 120">
                          <circle cx="150" cy="60" r="50" fill="none" stroke="white" strokeWidth="1" />
                          <circle cx="170" cy="60" r="50" fill="none" stroke="white" strokeWidth="1" />
                        </svg>
                      </div>
                      <div className="relative z-10">
                        <p className="text-[9px] text-white/60 font-bold uppercase tracking-widest mb-1">الرصيد المتاح</p>
                        <p className="text-3xl font-black text-white tabular-nums">
                          {parseFloat(user.walletBalance || "0").toFixed(0)}
                          <span className="text-base font-light text-white/60 mr-1">ر.س</span>
                        </p>
                        <div className="mt-4 flex items-center justify-between">
                          <div>
                            <p className="text-[8px] text-white/50">العضوية</p>
                            <p className="text-[10px] font-black text-white capitalize">{user.loyaltyTier || "Bronze"}</p>
                          </div>
                          <div className="text-left">
                            <p className="text-[8px] text-white/50">النقاط</p>
                            <p className="text-[10px] font-black text-white">{user.loyaltyPoints ?? 0}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Transactions */}
                    <p className="text-[9px] text-white/20 font-bold uppercase tracking-widest mb-3">آخر العمليات</p>
                    {Array.isArray(transactions) && transactions.length > 0 ? (
                      <div className="space-y-2.5">
                        {transactions.slice(0, 3).map((t: any) => (
                          <div key={t.id} className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
                            <div className="flex items-center gap-2.5">
                              <div className={`p-1.5 rounded-lg ${parseFloat(t.amount) > 0 ? "bg-emerald-400/10" : "bg-red-400/10"}`}>
                                <Wallet className={`w-3 h-3 ${parseFloat(t.amount) > 0 ? "text-emerald-400" : "text-red-400"}`} />
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-white/70">{t.description}</p>
                                <p className="text-[8px] text-white/25">{new Date(t.createdAt).toLocaleDateString("ar-SA")}</p>
                              </div>
                            </div>
                            <span className={`text-xs font-black tabular-nums ${parseFloat(t.amount) > 0 ? "text-emerald-400" : "text-red-400"}`}>
                              {parseFloat(t.amount) > 0 ? "+" : ""}{t.amount}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-[10px] text-white/20 py-6 italic">لا توجد عمليات بعد</p>
                    )}
                  </div>
                </motion.div>
              </div>

              {/* Addresses Section */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="rounded-2xl bg-[#0d1220] border border-white/5 overflow-hidden"
              >
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-5 bg-emerald-400 rounded-full" />
                    <h2 className="font-black text-sm text-white">عناوين التوصيل</h2>
                  </div>
                  <button
                    onClick={() => setIsAddingAddress(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold hover:bg-emerald-500/20 transition-all"
                  >
                    <Plus className="w-3 h-3" /> إضافة عنوان
                  </button>
                </div>
                <div className="p-5">
                  {isAddingAddress && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mb-4 p-4 rounded-xl bg-white/3 border border-white/10 space-y-3"
                    >
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-[10px] text-white/40 mb-1 block">اسم العنوان</Label>
                          <Input
                            className="bg-white/5 border-white/10 text-white text-xs h-9 rounded-lg"
                            value={newAddress.name}
                            onChange={e => setNewAddress(a => ({ ...a, name: e.target.value }))}
                            placeholder="المنزل / العمل..."
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] text-white/40 mb-1 block">المدينة</Label>
                          <Input
                            className="bg-white/5 border-white/10 text-white text-xs h-9 rounded-lg"
                            value={newAddress.city}
                            onChange={e => setNewAddress(a => ({ ...a, city: e.target.value }))}
                            placeholder="الرياض"
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-[10px] text-white/40 mb-1 block">الشارع / التفاصيل</Label>
                        <Input
                          className="bg-white/5 border-white/10 text-white text-xs h-9 rounded-lg"
                          value={newAddress.street}
                          onChange={e => setNewAddress(a => ({ ...a, street: e.target.value }))}
                          placeholder="اسم الشارع، رقم المبنى..."
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            const addresses = [...(user.addresses || []), { ...newAddress, id: Math.random().toString(36).substr(2, 9), isDefault: !(user.addresses?.length) }];
                            addressMutation.mutate(addresses);
                          }}
                          disabled={addressMutation.isPending}
                          className="flex-1 py-2 rounded-xl bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-400 transition-colors disabled:opacity-50"
                        >
                          {addressMutation.isPending ? "جاري الحفظ..." : "حفظ العنوان"}
                        </button>
                        <button
                          onClick={() => setIsAddingAddress(false)}
                          className="px-4 py-2 rounded-xl bg-white/5 text-white/40 text-xs font-bold hover:bg-white/10 transition-colors"
                        >
                          إلغاء
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {!user.addresses?.length && !isAddingAddress ? (
                    <div className="text-center py-8 space-y-2">
                      <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mx-auto">
                        <MapPin className="w-5 h-5 text-white/20" />
                      </div>
                      <p className="text-white/30 text-xs">لا توجد عناوين مضافة</p>
                    </div>
                  ) : (
                    <div className="grid sm:grid-cols-2 gap-3">
                      {user.addresses?.map((addr: any) => (
                        <div key={addr.id} className="flex items-start gap-3 p-4 rounded-xl bg-white/3 border border-white/5 group hover:border-white/10 transition-all">
                          <div className="p-2 rounded-lg bg-blue-500/10 shrink-0">
                            <MapPin className="w-4 h-4 text-blue-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-white/80 truncate">{addr.name}</p>
                            <p className="text-[10px] text-white/30 truncate">{addr.city} — {addr.street}</p>
                            {addr.isDefault && (
                              <span className="text-[8px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full mt-1 inline-block">افتراضي</span>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              const addresses = (user.addresses || []).filter((a: any) => a.id !== addr.id);
                              addressMutation.mutate(addresses);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-red-400/50 hover:text-red-400 hover:bg-red-400/10 transition-all"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Quick Actions */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="grid grid-cols-2 sm:grid-cols-4 gap-4"
              >
                {[
                  { label: "تسوق الآن", icon: ShoppingBag, href: "/products", color: "from-blue-500 to-blue-600", glow: "shadow-blue-500/20" },
                  { label: "طلباتي", icon: Package, href: "/orders", color: "from-violet-500 to-purple-600", glow: "shadow-violet-500/20" },
                  { label: "فواتيري", icon: Tag, href: "/profile/invoices", color: "from-emerald-500 to-teal-600", glow: "shadow-emerald-500/20" },
                  { label: "الرئيسية", icon: Globe, href: "/", color: "from-amber-500 to-orange-500", glow: "shadow-amber-500/20" },
                ].map((action, i) => (
                  <Link key={i} href={action.href}>
                    <motion.div
                      whileHover={{ scale: 1.04, y: -2 }}
                      whileTap={{ scale: 0.97 }}
                      className={`relative rounded-2xl bg-gradient-to-br ${action.color} p-5 flex flex-col items-center gap-3 cursor-pointer shadow-xl ${action.glow} overflow-hidden group`}
                    >
                      <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors" />
                      <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                        <action.icon className="w-5 h-5 text-white" />
                      </div>
                      <p className="text-xs font-black text-white">{action.label}</p>
                    </motion.div>
                  </Link>
                ))}
              </motion.div>

            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
