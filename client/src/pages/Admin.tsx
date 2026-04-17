import { useAuth } from "@/hooks/use-auth";
import { useProducts, useCreateProduct } from "@/hooks/use-products";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import React, { useState, useMemo, memo, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import { insertProductSchema, type InsertProduct, orderStatuses, employeePermissions, insertUserSchema, type InsertUser } from "@shared/schema";
import { api } from "@shared/routes";
import { Loader2, Plus, DollarSign, ShoppingCart, TrendingUp, BarChart3, ArrowUpRight, ArrowDownRight, Trash2, Search, Filter, ChevronDown, CheckCircle2, XCircle, Truck, PackageCheck, AlertCircle, LayoutGrid, Tag, Edit, ArrowRight, LogOut, Package, Building, User as UserIcon, History, Monitor, Clock, Settings2, Landmark, Save, CreditCard, ToggleLeft, ToggleRight, Megaphone, Send, Bike, Phone, Users, Bell, Globe, Menu, X, Star, Zap, Activity, Shield, ChevronRight, Home, RefreshCw, Eye, Wallet, MoreVertical, ImageIcon, Pencil, Store, RotateCcw, CalendarClock, Award, TrendingDown, Timer, MapPin } from "lucide-react";
import { Link } from "wouter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { DescriptionGenerator } from "@/components/ai/DescriptionGenerator";
import AdminEmail from "@/pages/admin/AdminEmail";
const logoImg = "/images/logos/logo-light.png";
const logoDarkImg = "/images/logos/logo-dark.png";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart,
  PieChart as RePieChart,
  Pie,
} from "recharts";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";

// Components extracted to prevent hook issues

function AdminSparkLine({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${100 - (v / max) * 100}`).join(" ");
  return (
    <svg viewBox="0 0 100 100" className="w-20 h-8 opacity-60" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PulseRing({ color }: { color: string }) {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${color} opacity-50`} />
      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${color}`} />
    </span>
  );
}

const PIE_COLORS = ['#f39c12', '#00a878', '#ef4444', '#6366f1', '#8b5cf6', '#ec4899'];

const OverviewPanel = memo(() => {
  const { data: stats, isLoading } = useQuery({ 
    queryKey: ["/api/admin/stats"],
    queryFn: async () => {
       const res = await fetch("/api/admin/stats");
       if (!res.ok) throw new Error("Failed to fetch stats");
       return res.json();
    }
  });

  // Must be before any early return to follow Rules of Hooks
  const weekData = useMemo(() => {
    const daily30 = stats?.dailyRevenue30 || [];
    if (daily30.length >= 7) {
      return daily30.slice(-14).map((d: any) => ({ name: d.date, revenue: d.revenue, orders: d.orders }));
    }
    return (stats?.chartData || []).map((d: any) => ({ name: d.month, revenue: d.sales, orders: d.orders }));
  }, [stats]);

  if (isLoading) return (
    <div className="space-y-6">
      <div className="h-48 rounded-[2.5rem] animate-pulse bg-slate-100" />
      <div className="grid grid-cols-3 gap-4">
        {[1,2,3].map(i => <div key={i} className="h-40 rounded-2xl animate-pulse bg-slate-100" />)}
      </div>
    </div>
  );

  const displayStats = {
    allTime: { totalRevenue: stats?.allTime?.totalRevenue || stats?.totalRevenue || stats?.totalSales || 0 },
    today: { totalRevenue: stats?.today?.totalRevenue || stats?.todayRevenue || stats?.dailySales || 0 },
    thisMonth: { totalRevenue: stats?.thisMonth?.totalRevenue || stats?.monthRevenue || stats?.monthlySales || 0 },
    totalOrders: stats?.totalOrders || 0,
    dailyOrders: stats?.dailyOrders || 0,
    netProfit: stats?.netProfit || 0,
    totalCustomers: stats?.totalUsers || stats?.totalCustomers || 0,
    completedOrdersCount: stats?.orderStatusCounts?.completed || stats?.completedOrders || 0,
    processingOrdersCount: (stats?.orderStatusCounts?.processing || 0) + (stats?.orderStatusCounts?.new || 0),
    cancelledOrdersCount: stats?.orderStatusCounts?.cancelled || stats?.cancelledOrders || 0,
    totalOrdersCount: stats?.totalOrders || 0,
    recentOrders: stats?.recentOrders || [],
    topProducts: stats?.topProducts || [],
    pendingReturns: stats?.pendingReturns || 0,
    activeVendors: stats?.activeVendors || 0,
    pendingVendors: stats?.pendingVendors || 0,
    newCustomers30: stats?.newCustomers30 || 0,
    revenueGrowth: stats?.revenueGrowth || "0",
  };

  const statusData = [
    { name: 'مكتمل', value: displayStats.completedOrdersCount },
    { name: 'معالجة', value: displayStats.processingOrdersCount },
    { name: 'ملغي', value: displayStats.cancelledOrdersCount }
  ];

  const hasStatusData = displayStats.totalOrdersCount > 0;

  return (
    <div className="space-y-6" dir="rtl">
      {/* Main Revenue Card */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="border-none shadow-xl bg-gradient-to-br from-[#1a2744] to-[#243556] text-white relative overflow-hidden group rounded-[2rem]">
          <div className="absolute -right-10 -bottom-10 opacity-5 group-hover:scale-110 transition-transform duration-700">
            <DollarSign className="w-64 h-64 text-[#c9a96e]" />
          </div>
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#c9a96e] to-transparent" />
          <CardContent className="relative z-10 flex flex-col items-center text-center space-y-4 py-8">
            <div className="flex items-center gap-3 bg-[#c9a96e]/10 px-4 py-2 rounded-full border border-[#c9a96e]/20">
              <Wallet className="w-4 h-4 text-[#c9a96e]" />
              <span className="text-xs font-bold tracking-wide text-[#c9a96e]">إجمالي مبيعات المتجر</span>
            </div>
            <div className="space-y-1">
              <div className="text-5xl font-black tracking-tighter">
                {Number(displayStats.allTime.totalRevenue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[#c9a96e] font-bold text-sm">ريال سعودي</div>
            </div>
            <div className="grid grid-cols-3 gap-4 w-full max-w-lg mt-2">
              <div className="bg-white/10 backdrop-blur-xl p-4 rounded-2xl border border-white/10 text-center">
                <p className="text-[10px] uppercase tracking-widest text-white/50 font-bold mb-1">اليوم</p>
                <p className="text-lg font-black">{Number(displayStats.today.totalRevenue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-medium text-white/50">ر.س</span></p>
              </div>
              <div className="bg-white/10 backdrop-blur-xl p-4 rounded-2xl border border-white/10 text-center">
                <p className="text-[10px] uppercase tracking-widest text-white/50 font-bold mb-1">الشهر</p>
                <p className="text-lg font-black">{Number(displayStats.thisMonth.totalRevenue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-medium text-white/50">ر.س</span></p>
              </div>
              <div className="bg-white/10 backdrop-blur-xl p-4 rounded-2xl border border-white/10 text-center">
                <p className="text-[10px] uppercase tracking-widest text-white/50 font-bold mb-1">الطلبات</p>
                <p className="text-lg font-black">{displayStats.totalOrders} <span className="text-xs font-medium text-white/50">طلب</span></p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border border-slate-200 shadow-sm bg-white flex flex-col items-center text-center space-y-3 p-6">
          <div className="p-3 bg-[#c9a96e]/10 text-[#c9a96e] rounded-2xl">
            <ShoppingCart className="w-6 h-6" />
          </div>
          <p className="text-slate-500 text-xs font-bold">إجمالي الطلبات</p>
          <div className="text-4xl font-black text-[#1a2744]">{displayStats.totalOrders}</div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400">اليوم:</span>
            <Badge className="bg-[#c9a96e]/10 text-[#c9a96e] hover:bg-[#c9a96e]/10 rounded-lg font-black text-[10px]">{displayStats.dailyOrders}</Badge>
          </div>
        </Card>

        <Card className="border border-slate-200 shadow-sm bg-white flex flex-col items-center text-center space-y-3 p-6">
          <div className="p-3 bg-[#c9a96e]/10 text-[#c9a96e] rounded-2xl">
            <TrendingUp className="w-6 h-6" />
          </div>
          <p className="text-slate-500 text-xs font-bold">صافي الأرباح</p>
          <div className="text-3xl font-black text-[#c9a96e]">
            {Number(displayStats.netProfit).toLocaleString()}
            <span className="text-xs font-medium mr-1">ر.س</span>
          </div>
          <div className="w-full space-y-1">
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-[#c9a96e] w-[67%]" />
            </div>
            <p className="text-[10px] font-bold text-slate-400">67% من إجمالي المبيعات</p>
          </div>
        </Card>

        <Card className="border border-slate-200 shadow-sm bg-white flex flex-col items-center text-center space-y-3 p-6">
          <div className="p-3 bg-[#c9a96e]/10 text-[#c9a96e] rounded-2xl">
            <Users className="w-6 h-6" />
          </div>
          <p className="text-slate-500 text-xs font-bold">قاعدة العملاء</p>
          <div className="text-4xl font-black text-[#1a2744]">{displayStats.totalCustomers}</div>
          <div className="flex -space-x-2 space-x-reverse">
            {[1, 2, 3].map(i => (
              <div key={i} className="w-7 h-7 rounded-full border-2 border-white bg-slate-200" />
            ))}
            <div className="w-7 h-7 rounded-full border-2 border-white bg-primary flex items-center justify-center text-[10px] text-white font-bold">+</div>
          </div>
        </Card>
      </div>

      {/* Quick Action Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border border-slate-200 shadow-sm bg-white p-4 flex items-center gap-3">
          <div className="p-2.5 bg-[#c9a96e]/10 text-[#c9a96e] rounded-xl shrink-0">
            <RotateCcw className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-500 font-bold uppercase">مرتجعات معلقة</p>
            <p className="text-2xl font-black text-[#c9a96e]">{displayStats.pendingReturns}</p>
          </div>
        </Card>
        <Card className="border border-slate-200 shadow-sm bg-white p-4 flex items-center gap-3">
          <div className="p-2.5 bg-[#c9a96e]/10 text-[#c9a96e] rounded-xl shrink-0">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-500 font-bold uppercase">بائعون نشطون</p>
            <p className="text-2xl font-black text-white">{displayStats.activeVendors}</p>
          </div>
        </Card>
        <Card className="border border-slate-200 shadow-sm bg-white p-4 flex items-center gap-3">
          <div className="p-2.5 bg-[#c9a96e]/10 text-[#c9a96e] rounded-xl shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-500 font-bold uppercase">عملاء جدد (30 يوم)</p>
            <p className="text-2xl font-black text-[#1a2744]">{displayStats.newCustomers30}</p>
          </div>
        </Card>
        <Card className={`border border-slate-200 shadow-sm p-4 flex items-center gap-3 bg-white`}>
          <div className={`p-2.5 rounded-xl shrink-0 ${Number(displayStats.revenueGrowth) >= 0 ? "bg-[#c9a96e]/10 text-[#c9a96e]" : "bg-red-500/10 text-red-400"}`}>
            {Number(displayStats.revenueGrowth) >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
          </div>
          <div>
            <p className="text-[10px] text-slate-500 font-bold uppercase">نمو الإيرادات</p>
            <p className={`text-2xl font-black ${Number(displayStats.revenueGrowth) >= 0 ? "text-[#c9a96e]" : "text-red-400"}`}>
              {Number(displayStats.revenueGrowth) >= 0 ? "+" : ""}{displayStats.revenueGrowth}%
            </p>
          </div>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Revenue Chart */}
        <Card className="border border-slate-200 shadow-sm bg-white p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-black text-[#1a2744]">نمو المبيعات</h3>
              <p className="text-slate-500 text-xs font-bold">أداء الإيرادات خلال الأسبوع</p>
            </div>
          </div>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weekData}>
                <defs>
                  <linearGradient id="colorRevAdmin" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#c9a96e" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#c9a96e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 700 }} />
                <YAxis hide />
                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid rgba(201,169,110,0.2)', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.3)', fontSize: 12, background: '#1e1d1a', color: '#fff' }} />
                <Area type="monotone" dataKey="revenue" stroke="#c9a96e" strokeWidth={3} fillOpacity={1} fill="url(#colorRevAdmin)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Status Pie Chart */}
        <Card className="border border-slate-200 shadow-sm bg-white p-6">
          <h3 className="text-base font-black text-[#1a2744] text-center mb-1">توزيع الحالات</h3>
          <p className="text-slate-500 text-xs font-bold text-center mb-4">نظرة عامة على الطلبات</p>
          <div className="flex flex-col items-center">
            <div className="h-[180px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                  <Pie
                    data={hasStatusData ? statusData : [{ name: 'لا يوجد', value: 1 }]}
                    cx="50%" cy="50%" innerRadius={55} outerRadius={75} paddingAngle={5} dataKey="value"
                  >
                    {hasStatusData ? (
                      statusData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))
                    ) : (
                      <Cell fill="#e2e8f0" />
                    )}
                  </Pie>
                  <Tooltip />
                </RePieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-black text-[#1a2744]">{displayStats.totalOrdersCount}</span>
                <span className="text-[10px] font-bold text-slate-500">إجمالي</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-6 mt-4 w-full max-w-xs">
              <div className={`text-center ${displayStats.completedOrdersCount === 0 ? 'opacity-30' : ''}`}>
                <div className="text-xl font-black text-[#f39c12]">{displayStats.completedOrdersCount}</div>
                <div className="text-[10px] font-bold text-muted-foreground">مكتمل</div>
              </div>
              <div className={`text-center ${displayStats.processingOrdersCount === 0 ? 'opacity-30' : ''}`}>
                <div className="text-xl font-black text-[#00a878]">{displayStats.processingOrdersCount}</div>
                <div className="text-[10px] font-bold text-muted-foreground">معالجة</div>
              </div>
              <div className={`text-center ${displayStats.cancelledOrdersCount === 0 ? 'opacity-30' : ''}`}>
                <div className="text-xl font-black text-[#ef4444]">{displayStats.cancelledOrdersCount}</div>
                <div className="text-[10px] font-bold text-muted-foreground">ملغي</div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Orders & Top Products */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="rounded-[2rem] border border-slate-200 shadow-sm bg-white overflow-hidden">
          <div className="p-5 flex items-center justify-between border-b border-slate-100">
            <h3 className="text-base font-black text-[#1a2744]">آخر الطلبات</h3>
          </div>
          <div className="p-4 space-y-2">
            {displayStats.recentOrders.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm font-bold">لا توجد طلبات بعد</div>
            ) : displayStats.recentOrders.map((order: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-2xl transition-colors cursor-pointer group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center">
                    <ShoppingCart className="w-4 h-4 text-[#c9a96e]" />
                  </div>
                  <div>
                    <p className="font-black text-xs text-[#c9a96e]">#{order.id}</p>
                    <p className="text-[10px] font-bold text-slate-400">{new Date(order.createdAt).toLocaleDateString('ar-SA')}</p>
                  </div>
                </div>
                <div className="text-left">
                  <p className="font-black text-sm text-[#1a2744]">{order.total} ر.س</p>
                  <Badge className="bg-[#c9a96e]/10 text-[#c9a96e] border-none rounded-lg text-[9px] font-black h-4 px-1.5">مكتمل</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="rounded-[2rem] border border-slate-200 shadow-sm bg-white p-5">
          <h3 className="text-base font-black text-[#1a2744] mb-5 flex items-center gap-2">
            <div className="p-2 bg-[#c9a96e]/10 rounded-xl">
              <CheckCircle2 className="w-4 h-4 text-[#c9a96e]" />
            </div>
            الأكثر مبيعاً
          </h3>
          {displayStats.topProducts.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm font-bold">لا توجد بيانات بعد</div>
          ) : (
            <div className="space-y-4">
              {displayStats.topProducts.map((product: any, idx: number) => (
                <div key={idx} className="flex items-center gap-3 group">
                  <div className="relative shrink-0">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-14 h-14 rounded-2xl object-cover shadow-sm"
                    />
                    <div className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-[#c9a96e] text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white">
                      {idx + 1}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-[#1a2744] text-sm truncate">{product.name}</p>
                    <p className="text-[10px] font-bold text-slate-400">{product.quantity} عملية بيع</p>
                  </div>
                  <div className="text-left shrink-0">
                    <p className="font-black text-[#c9a96e] text-sm">{Number(product.revenue).toLocaleString()}</p>
                    <p className="text-[9px] font-bold text-slate-400">ر.س</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Low Stock Alert */}
      <LowStockWidget />
    </div>
  );
});

const LowStockWidget = () => {
  const { data: lowStock = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/low-stock"],
    queryFn: async () => {
      const res = await fetch("/api/admin/low-stock?threshold=5");
      return res.ok ? res.json() : [];
    },
  });

  if (isLoading || lowStock.length === 0) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="rounded-[2rem] border border-[#c9a96e]/10 shadow-sm bg-white overflow-hidden">
        <div className="flex items-center gap-3 px-5 pt-5 pb-3">
          <div className="p-2 bg-[#c9a96e]/10 rounded-xl">
            <AlertCircle className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900">تنبيه: مخزون منخفض</h3>
            <p className="text-[10px] text-slate-400">{lowStock.length} منتج بمخزون أقل من 5 وحدات</p>
          </div>
        </div>
        <div className="px-5 pb-5 space-y-2">
          {lowStock.slice(0, 5).map((p: any) => {
            const totalStock = (p.variants || []).reduce((s: number, v: any) => s + (v.stock || 0), 0);
            return (
              <div key={p.id} className="flex items-center gap-3 p-2 rounded-xl bg-amber-50/60" data-testid={`low-stock-${p.id}`}>
                {p.images?.[0] && (
                  <img src={p.images[0]} alt={p.name} className="w-9 h-9 rounded-lg object-cover shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-black text-xs text-slate-900 truncate">{p.name}</p>
                </div>
                <Badge className={`rounded-lg text-[10px] font-bold shrink-0 ${totalStock === 0 ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700"}`}>
                  {totalStock === 0 ? "نفذ" : `${totalStock} وحدة`}
                </Badge>
              </div>
            );
          })}
          {lowStock.length > 5 && (
            <p className="text-[10px] text-slate-400 text-center pt-1">و {lowStock.length - 5} منتج آخر</p>
          )}
        </div>
      </Card>
    </motion.div>
  );
};

const EditProductDialog = memo(({ product, categories, open, onOpenChange }: any) => {
  const { toast } = useToast();
  const [variants, setVariants] = useState<any[]>([]);
  const lastProductIdRef = React.useRef<string | null>(null);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);

  useEffect(() => {
    if (open && product && product.id !== lastProductIdRef.current) {
      setVariants(product.variants || []);
      lastProductIdRef.current = product.id;
      // Load existing categoryIds or fall back to single categoryId
      const ids = (product as any).categoryIds?.length
        ? (product as any).categoryIds
        : (product as any).categoryId ? [(product as any).categoryId] : [];
      setSelectedCategoryIds(ids);
    } else if (!open) {
      lastProductIdRef.current = null;
    }
  }, [open, product]);
  
  const form = useForm<InsertProduct>({
    resolver: zodResolver(insertProductSchema),
    defaultValues: {
      name: product?.name || "",
      description: product?.description || "",
      price: product?.price || "0",
      cost: product?.cost || "0",
      images: product?.images || [],
      categoryIds: [],
      variants: (product as any)?.variants || [],
      isFeatured: product?.isFeatured || false,
    } as any
  });

  const toggleCategoryId = (id: string) => {
    setSelectedCategoryIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const parentCats = (categories || []).filter((c: any) => !c.parentId);
  const subCatsMap: Record<string, any[]> = {};
  (categories || []).forEach((c: any) => {
    if (c.parentId) {
      if (!subCatsMap[c.parentId]) subCatsMap[c.parentId] = [];
      subCatsMap[c.parentId].push(c);
    }
  });

  const updateVariant = (index: number, field: string, value: any) => {
    const newVariants = [...variants];
    newVariants[index] = { ...newVariants[index], [field]: value };
    setVariants(newVariants);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, index: number | null = null) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({ 
        title: "الملف كبير جداً", 
        description: "يرجى اختيار صورة أقل من 5 ميجابايت", 
        variant: "destructive" 
      });
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Upload failed");
      }
      
      const { url } = await res.json();
      
      if (typeof index === "number" && index >= 0) {
        // Variant image
        updateVariant(index, "image", url);
      } else {
        // Product images - append to array
        const currentImages = form.getValues("images") || [];
        form.setValue("images", [...currentImages, url]);
      }
      
      toast({ title: "تم رفع الصورة بنجاح" });
    } catch (error: any) {
      toast({ 
        title: "خطأ في الرفع", 
        description: error.message || "تعذر رفع الصورة. حاول مرة أخرى.", 
        variant: "destructive" 
      });
    }
  };

  const removeProductImage = (index: number) => {
    const currentImages = form.getValues("images") || [];
    form.setValue("images", currentImages.filter((_: any, i: number) => i !== index));
  };

  const addVariant = () => {
    setVariants([...variants, { color: "", size: "", sku: `SKU-${Date.now()}`, stock: 0, image: "" }]);
  };

  const removeVariant = (index: number) => {
    setVariants(variants.filter((_, i) => i !== index));
  };

  const onSubmit = async (data: InsertProduct) => {
    try {
      const payload = {
        ...data,
        categoryIds: selectedCategoryIds,
        categoryId: selectedCategoryIds[0] || "",
        variants: variants.map(v => ({
          ...v,
          stock: Number(v.stock),
          cost: Number(v.cost || 0)
        })),
        price: data.price.toString(),
        cost: data.cost.toString(),
      };

      await apiRequest("PATCH", `/api/products/${product.id}`, payload);
      toast({ title: "تم تحديث المنتج بنجاح" });
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: [api.products.list.path] });
    } catch (e) {
      toast({ title: "خطأ", description: "فشل تحديث المنتج", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl rounded-none border-none shadow-2xl overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-right font-black uppercase tracking-tight">تعديل المنتج</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-6 mt-8" dir="rtl">
           <div className="grid grid-cols-2 gap-6 text-right">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-black/40">اسم المنتج</Label>
                  <Input {...form.register("name")} className="rounded-none h-12 text-right" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-black/40">السعر الأساسي (ر.س)</Label>
                  <Input type="number" {...form.register("price")} className="rounded-none h-12 text-right" />
                </div>
              </div>

           <div className="grid grid-cols-2 gap-6 text-right">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-black/40">
                    الفئات
                    {selectedCategoryIds.length > 0 && (
                      <span className="mr-2 text-primary">({selectedCategoryIds.length} محدد)</span>
                    )}
                  </Label>
                  <div className="border border-black/10 rounded-none p-2 max-h-48 overflow-y-auto space-y-0.5 bg-white">
                    {parentCats.length === 0 && <p className="text-[10px] text-black/30 py-2 text-center">لا توجد فئات</p>}
                    {parentCats.map((parent: any) => (
                      <div key={parent.id}>
                        <label className="flex items-center gap-2 cursor-pointer hover:bg-black/5 px-2 py-1.5 rounded-sm">
                          <input
                            type="checkbox"
                            checked={selectedCategoryIds.includes(parent.id)}
                            onChange={() => toggleCategoryId(parent.id)}
                            className="rounded-none accent-black"
                          />
                          <span className="text-[11px] font-bold">{parent.nameAr || parent.name}</span>
                          {parent.name !== parent.nameAr && parent.nameAr && <span className="text-[9px] text-black/30">{parent.name}</span>}
                        </label>
                        {(subCatsMap[parent.id] || []).map((sub: any) => (
                          <label key={sub.id} className="flex items-center gap-2 cursor-pointer hover:bg-black/5 px-2 py-1.5 rounded-sm pr-6">
                            <input
                              type="checkbox"
                              checked={selectedCategoryIds.includes(sub.id)}
                              onChange={() => toggleCategoryId(sub.id)}
                              className="rounded-none accent-black"
                            />
                            <span className="text-[10px] text-black/50">└</span>
                            <span className="text-[11px]">{sub.nameAr || sub.name}</span>
                          </label>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-black/40">التكلفة (ر.س)</Label>
                  <Input type="number" {...form.register("cost")} className="rounded-none h-12 text-right" />
                </div>
              </div>

           <div className="space-y-2 text-right">
                <div className="flex justify-between items-center">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-black/40">صور المنتج</Label>
                  <div className="relative">
                    <Button variant="outline" type="button" className="h-8 px-3 rounded-none flex gap-1 overflow-visible text-[9px]">
                      <Plus className="h-3 w-3" />
                      <span className="font-black uppercase">إضافة صورة</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => handleImageUpload(e)} 
                        className="absolute inset-0 opacity-0 cursor-pointer" 
                      />
                    </Button>
                  </div>
                </div>
                
                {/* Image Gallery */}
                <div className="grid grid-cols-6 gap-2 bg-secondary/5 p-3 border border-black/5">
                  {(form.watch("images") || []).map((img: string, idx: number) => (
                    <div key={idx} className="relative group">
                      <div className="aspect-square bg-secondary/20 rounded-none overflow-hidden border border-black/5">
                        <img src={img} alt={`صورة ${idx + 1}`} className="w-full h-full object-cover" />
                      </div>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => removeProductImage(idx)}
                        className="absolute top-0 right-0 h-6 w-6 rounded-none bg-destructive/80 hover:bg-destructive text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  {(!form.watch("images") || form.watch("images").length === 0) && (
                    <div className="col-span-6 text-center py-8 text-black/30">
                      <p className="text-[9px]">لم يتم رفع أي صور بعد</p>
                    </div>
                  )}
                </div>
                <p className="text-[8px] text-black/40 mt-1">يمكنك رفع عدة صور للمنتج. الصورة الأولى ستظهر في قائمة المنتجات</p>
              </div>

           <div className="space-y-2 text-right">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-black/40">الوصف التفصيلي</Label>
                <DescriptionGenerator
                  productName={form.watch("name") || ""}
                  productCategory={categories?.find((c: any) => c.id === selectedCategoryIds[0])?.name || "ملابس"}
                  price={Number(form.watch("price")) || 0}
                  onApply={(desc) => form.setValue("description", desc)}
                />
                <Textarea {...form.register("description")} className="rounded-none min-h-[100px] text-right" />
              </div>

           <div className="space-y-4 pt-4 border-t border-black/5 text-right">
                <div className="flex justify-between items-center">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-black/40">المتغيرات (الألوان والمقاسات والصور)</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addVariant} className="rounded-none text-[10px] font-black uppercase tracking-widest h-8">
                    إضافة متغير <Plus className="mr-1 h-3 w-3" />
                  </Button>
                </div>
                
                <div className="space-y-3">
                  {variants.map((v, i) => (
                    <div key={i} className="grid grid-cols-6 gap-3 items-end bg-secondary/10 p-4 border border-black/5">
                      <div className="space-y-1">
                        <Label className="text-[9px] font-bold">اللون</Label>
                        <Input value={v.color} onChange={(e) => updateVariant(i, "color", e.target.value)} className="h-8 rounded-none text-xs text-right" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[9px] font-bold">المقاس</Label>
                        <Input value={v.size} onChange={(e) => updateVariant(i, "size", e.target.value)} className="h-8 rounded-none text-xs text-right" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[9px] font-bold">المخزون</Label>
                        <Input type="number" value={v.stock} onChange={(e) => updateVariant(i, "stock", parseInt(e.target.value))} className="h-8 rounded-none text-xs text-right" />
                      </div>
                      <div className="col-span-2 space-y-1">
                        <Label className="text-[9px] font-bold">صورة المتغير</Label>
                        <div className="flex gap-2">
                          <Input 
                            type="file" 
                            accept="image/*" 
                            onChange={(e) => handleImageUpload(e, i)} 
                            className="h-8 rounded-none text-[8px] pt-1.5 cursor-pointer" 
                          />
                          {v.image && (
                            <div className="w-8 h-8 border border-black/5 overflow-hidden shrink-0">
                              <img src={v.image} alt="" className="w-full h-full object-cover" />
                            </div>
                          )}
                        </div>
                      </div>
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeVariant(i)} className="h-8 w-8 text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

           <Button type="submit" className="w-full h-14 rounded-none font-black uppercase tracking-widest text-lg">تحديث المنتج</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
});

const ProductsTable = memo(() => {
  const { data: products, isLoading } = useProducts();
  const { data: categories } = useQuery<any[]>({ queryKey: ["/api/categories"] });
  const createProduct = useCreateProduct();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [variants, setVariants] = useState<any[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);

  const parentCats = (categories || []).filter((c: any) => !c.parentId);
  const subCatsMap: Record<string, any[]> = {};
  (categories || []).forEach((c: any) => {
    if (c.parentId) {
      if (!subCatsMap[c.parentId]) subCatsMap[c.parentId] = [];
      subCatsMap[c.parentId].push(c);
    }
  });

  const toggleCategoryId = (id: string) => {
    setSelectedCategoryIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const form = useForm<InsertProduct>({
    resolver: zodResolver(insertProductSchema),
    defaultValues: {
      name: "",
      description: "",
      price: "0",
      cost: "0",
      images: [],
      categoryIds: [],
      variants: [],
      isFeatured: false,
    } as any
  });

  useEffect(() => {
    if (editingProduct) {
      form.reset({
        name: editingProduct.name,
        description: editingProduct.description,
        price: editingProduct.price,
        cost: editingProduct.cost,
        images: editingProduct.images || [],
        categoryIds: [],
        isFeatured: editingProduct.isFeatured,
        variants: (editingProduct as any).variants || [],
      } as any);
      setVariants((editingProduct as any).variants || []);
      // Load existing categoryIds or fall back to single categoryId
      const ids = (editingProduct as any).categoryIds?.length
        ? (editingProduct as any).categoryIds
        : (editingProduct as any).categoryId ? [(editingProduct as any).categoryId] : [];
      setSelectedCategoryIds(ids);
    } else {
      form.reset({
        name: "",
        description: "",
        price: "0",
        cost: "0",
        images: [],
        categoryIds: [],
        variants: [],
        isFeatured: false,
      } as any);
      setVariants([]);
      setSelectedCategoryIds([]);
    }
  }, [editingProduct]); // Removed 'form' from dependencies to avoid infinite loop

  const addVariant = () => {
    setVariants([...variants, { color: "", size: "", sku: `SKU-${Date.now()}`, stock: 0, image: "" }]);
  };

  const removeVariant = (index: number) => {
    setVariants(variants.filter((_, i) => i !== index));
  };

  const updateVariant = (index: number, field: string, value: any) => {
    const newVariants = [...variants];
    newVariants[index] = { ...newVariants[index], [field]: value };
    setVariants(newVariants);
  };

  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.products.list.path] });
      toast({ title: "تم حذف المنتج بنجاح" });
    }
  });

  const onSubmit = async (data: InsertProduct) => {
    try {
      const payload = {
        ...data,
        categoryIds: selectedCategoryIds,
        categoryId: selectedCategoryIds[0] || "",
        variants: variants.map(v => ({
          ...v,
          stock: Number(v.stock),
          cost: Number(v.cost || 0)
        })),
        price: data.price.toString(),
        cost: data.cost.toString(),
      };

      if (editingProduct) {
        await apiRequest("PATCH", `/api/products/${editingProduct.id}`, payload);
        toast({ title: "تم تحديث المنتج بنجاح" });
      } else {
        await createProduct.mutateAsync(payload);
      }
      setOpen(false);
      setEditingProduct(null);
      setSelectedCategoryIds([]);
      queryClient.invalidateQueries({ queryKey: [api.products.list.path] });
    } catch (e) {
      toast({ title: "خطأ", description: "فشل حفظ المنتج", variant: "destructive" });
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, index: number | null = null) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (limit to 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({ 
        title: "الملف كبير جداً", 
        description: "يرجى اختيار صورة أقل من 5 ميجابايت", 
        variant: "destructive" 
      });
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Upload failed");
      }
      
      const { url } = await res.json();
      
      if (typeof index === "number" && index >= 0) {
        // Variant image
        updateVariant(index, "image", url);
      } else {
        // Product images - append to array
        const currentImages = form.getValues("images") || [];
        form.setValue("images", [...currentImages, url]);
      }
      
      toast({ title: "تم رفع الصورة بنجاح" });
    } catch (error: any) {
      toast({ 
        title: "خطأ في الرفع", 
        description: error.message || "تعذر رفع الصورة. حاول مرة أخرى.", 
        variant: "destructive" 
      });
    }
  };

  const removeProductImage = (index: number) => {
    const currentImages = form.getValues("images") || [];
    form.setValue("images", currentImages.filter((_: any, i: number) => i !== index));
  };

  if (isLoading) return <Loader2 className="animate-spin" />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold uppercase tracking-tight text-right w-full">إدارة المخزون</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-none font-bold uppercase tracking-widest text-xs h-10 px-6">
              <Plus className="ml-2 h-4 w-4" /> إضافة منتج جديد
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl rounded-none border-none shadow-2xl overflow-y-auto max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="text-right font-black uppercase tracking-tight">
                {editingProduct ? "تعديل المنتج" : "إضافة منتج جديد"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-6 mt-8" dir="rtl">
              <div className="grid grid-cols-2 gap-6 text-right">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-black/40">اسم المنتج</Label>
                  <Input {...form.register("name")} className="rounded-none h-12 text-right" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-black/40">السعر الأساسي (ر.س)</Label>
                  <Input type="number" {...form.register("price")} className="rounded-none h-12 text-right" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 text-right">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-black/40">
                    الفئات
                    {selectedCategoryIds.length > 0 && (
                      <span className="mr-2 text-primary">({selectedCategoryIds.length} محدد)</span>
                    )}
                  </Label>
                  <div className="border border-black/10 rounded-none p-2 max-h-48 overflow-y-auto space-y-0.5 bg-white">
                    {parentCats.length === 0 && <p className="text-[10px] text-black/30 py-2 text-center">لا توجد فئات</p>}
                    {parentCats.map((parent: any) => (
                      <div key={parent.id}>
                        <label className="flex items-center gap-2 cursor-pointer hover:bg-black/5 px-2 py-1.5 rounded-sm">
                          <input
                            type="checkbox"
                            checked={selectedCategoryIds.includes(parent.id)}
                            onChange={() => toggleCategoryId(parent.id)}
                            className="accent-black"
                          />
                          <span className="text-[11px] font-bold">{parent.nameAr || parent.name}</span>
                          {parent.nameAr && parent.name !== parent.nameAr && <span className="text-[9px] text-black/30">{parent.name}</span>}
                        </label>
                        {(subCatsMap[parent.id] || []).map((sub: any) => (
                          <label key={sub.id} className="flex items-center gap-2 cursor-pointer hover:bg-black/5 px-2 py-1.5 rounded-sm pr-6">
                            <input
                              type="checkbox"
                              checked={selectedCategoryIds.includes(sub.id)}
                              onChange={() => toggleCategoryId(sub.id)}
                              className="accent-black"
                            />
                            <span className="text-[10px] text-black/40">└</span>
                            <span className="text-[11px]">{sub.nameAr || sub.name}</span>
                          </label>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-black/40">التكلفة (ر.س)</Label>
                  <Input type="number" {...form.register("cost")} className="rounded-none h-12 text-right" />
                </div>
              </div>

              <div className="space-y-2 text-right">
                <div className="flex justify-between items-center">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-black/40">صور المنتج</Label>
                  <div className="relative">
                    <Button variant="outline" type="button" className="h-8 px-3 rounded-none flex gap-1 overflow-visible text-[9px]">
                      <Plus className="h-3 w-3" />
                      <span className="font-black uppercase">إضافة صورة</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => handleImageUpload(e)} 
                        className="absolute inset-0 opacity-0 cursor-pointer" 
                      />
                    </Button>
                  </div>
                </div>
                
                {/* Image Gallery */}
                <div className="grid grid-cols-6 gap-2 bg-secondary/5 p-3 border border-black/5">
                  {(form.watch("images") || []).map((img: string, idx: number) => (
                    <div key={idx} className="relative group">
                      <div className="aspect-square bg-secondary/20 rounded-none overflow-hidden border border-black/5">
                        <img src={img} alt={`صورة ${idx + 1}`} className="w-full h-full object-cover" />
                      </div>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => removeProductImage(idx)}
                        className="absolute top-0 right-0 h-6 w-6 rounded-none bg-destructive/80 hover:bg-destructive text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  {(!form.watch("images") || form.watch("images").length === 0) && (
                    <div className="col-span-6 text-center py-8 text-black/30">
                      <p className="text-[9px]">لم يتم رفع أي صور بعد</p>
                    </div>
                  )}
                </div>
                <p className="text-[8px] text-black/40 mt-1">يمكنك رفع عدة صور للمنتج. الصورة الأولى ستظهر في قائمة المنتجات</p>
              </div>

              <div className="space-y-2 text-right">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-black/40">الوصف التفصيلي</Label>
                <DescriptionGenerator
                  productName={form.watch("name") || ""}
                  productCategory={categories?.find((c: any) => c.id === selectedCategoryIds[0])?.name || "ملابس"}
                  price={Number(form.watch("price")) || 0}
                  onApply={(desc) => form.setValue("description", desc)}
                />
                <Textarea {...form.register("description")} className="rounded-none min-h-[100px] text-right" />
              </div>

              <div className="space-y-4 pt-4 border-t border-black/5 text-right">
                <div className="flex justify-between items-center">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-black/40">المتغيرات (الألوان والمقاسات والصور)</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addVariant} className="rounded-none text-[10px] font-black uppercase tracking-widest h-8">
                    إضافة متغير <Plus className="mr-1 h-3 w-3" />
                  </Button>
                </div>
                
                <div className="space-y-3">
                  {variants.map((v, i) => (
                    <div key={i} className="grid grid-cols-6 gap-3 items-end bg-secondary/10 p-4 border border-black/5">
                      <div className="space-y-1">
                        <Label className="text-[9px] font-bold">اللون</Label>
                        <Input value={v.color} onChange={(e) => updateVariant(i, "color", e.target.value)} className="h-8 rounded-none text-xs text-right" placeholder="أسود" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[9px] font-bold">المقاس</Label>
                        <Input value={v.size} onChange={(e) => updateVariant(i, "size", e.target.value)} className="h-8 rounded-none text-xs text-right" placeholder="L" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[9px] font-bold">المخزون</Label>
                        <Input type="number" value={v.stock} onChange={(e) => updateVariant(i, "stock", parseInt(e.target.value))} className="h-8 rounded-none text-xs text-right" />
                      </div>
                      <div className="col-span-2 space-y-1">
                        <Label className="text-[9px] font-bold">صورة المتغير</Label>
                        <div className="flex gap-2">
                          <Input 
                            type="file" 
                            accept="image/*" 
                            onChange={(e) => handleImageUpload(e, i)} 
                            className="h-8 rounded-none text-[8px] pt-1.5 cursor-pointer" 
                          />
                          {v.image && (
                            <div className="w-8 h-8 border border-black/5 overflow-hidden shrink-0">
                              <img src={v.image} alt="" className="w-full h-full object-cover" />
                            </div>
                          )}
                        </div>
                      </div>
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeVariant(i)} className="h-8 w-8 text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center space-x-2 space-x-reverse pt-4 border-t border-black/5">
                <Switch 
                  id="isFeatured" 
                  checked={form.watch("isFeatured")} 
                  onCheckedChange={(checked) => form.setValue("isFeatured", checked)}
                />
                <Label htmlFor="isFeatured" className="text-[10px] font-black uppercase tracking-widest cursor-pointer">تمييز المنتج في الصفحة الرئيسية</Label>
              </div>

              <Button type="submit" disabled={createProduct.isPending} className="w-full h-14 rounded-none font-black uppercase tracking-widest text-lg">
                {createProduct.isPending ? <Loader2 className="animate-spin" /> : editingProduct ? "تحديث المنتج" : "نشر المنتج"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-none border border-black/5 overflow-hidden bg-white shadow-sm">
        <div className="p-6 grid grid-cols-6 font-black uppercase tracking-widest text-[10px] bg-secondary/10 text-black/40 border-b border-black/5">
          <div className="text-right">المنتج</div>
          <div className="text-right">الفئة</div>
          <div className="text-right">السعر</div>
          <div className="text-right">المخزون</div>
          <div className="text-right">الحالة</div>
          <div className="text-right">الإجراءات</div>
        </div>
        <div className="divide-y divide-black/5">
          {products?.map(product => {
            const totalStock = (product as any).variants?.reduce((sum: number, v: any) => sum + (v.stock || 0), 0) || 0;
            const productCatIds: string[] = (product as any).categoryIds?.length
              ? (product as any).categoryIds
              : (product as any).categoryId ? [(product as any).categoryId] : [];
            const productCatNames = productCatIds
              .map((id: string) => categories?.find(c => c.id === id))
              .filter(Boolean)
              .map((c: any) => c.nameAr || c.name);
            return (
              <div key={product.id} className="p-6 grid grid-cols-6 items-center hover:bg-secondary/5 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-secondary/20 rounded-none overflow-hidden border border-black/5">
                    {product.images?.[0] ? (
                      <img src={product.images[0]} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <PackageCheck className="w-4 h-4 m-4 opacity-20" />
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-xs">{product.name}</div>
                    <div className="text-[8px] font-black uppercase opacity-40">{(product as any).variants?.length || 0} خيارات متاحة</div>
                  </div>
                </div>
                <div className="text-[10px] font-black uppercase opacity-60">
                  {productCatNames.length > 0 ? productCatNames.join("، ") : "بدون فئة"}
                </div>
                <div className="font-black tracking-tighter text-xs">{Number(product.price).toLocaleString()} ر.س</div>
                <div className="font-bold text-xs">
                  <span className={totalStock === 0 ? "text-destructive" : totalStock < 5 ? "text-orange-500" : "text-green-600"}>
                    {totalStock}
                  </span>
                </div>
                <div className="flex gap-2">
                  {product.isFeatured && (
                    <Badge className="bg-black rounded-none text-[7px] font-black uppercase tracking-tighter">مميز</Badge>
                  )}
                  <Badge variant={totalStock > 0 ? "outline" : "destructive"} className="rounded-none text-[7px] font-black uppercase tracking-tighter">
                    {totalStock > 0 ? "متوفر" : "نفذ"}
                  </Badge>
                </div>
                <div className="flex gap-2 justify-start">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 hover:bg-black hover:text-white rounded-none transition-all"
                    onClick={() => {
                      setEditingProduct(product);
                    }}
                  >
                    <ArrowUpRight className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive rounded-none transition-all"
                    onClick={() => {
                      if (confirm("هل أنت متأكد من حذف هذا المنتج؟")) {
                        deleteProductMutation.mutate(product.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {editingProduct && (
        <EditProductDialog 
          product={editingProduct} 
          categories={categories} 
          open={!!editingProduct} 
          onOpenChange={(open: boolean) => { if (!open) setEditingProduct(null); }} 
        />
      )}
    </div>
  );
});

const CategoriesTable = memo(() => {
  const { data: categories, isLoading } = useQuery<any[]>({ queryKey: ["/api/categories"] });
  const { toast } = useToast();
  const [newCat, setNewCat] = useState<any>({ name: "", nameAr: "", slug: "", image: "", description: "", parentId: null });
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>({});

  const handleCategoryImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, catId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingId(catId);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/upload", { method: "POST", body: fd, credentials: "include" });
      if (!r.ok) throw new Error("Upload failed");
      const data = await r.json();
      await apiRequest("PATCH", `/api/categories/${catId}`, { image: data.url });
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({ title: "تم تحديث صورة الفئة بنجاح" });
    } catch {
      toast({ title: "فشل رفع الصورة", variant: "destructive" });
    } finally {
      setUploadingId(null);
    }
  };

  const handleNewCatImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingId("new");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/upload", { method: "POST", body: fd, credentials: "include" });
      if (!r.ok) throw new Error("Upload failed");
      const data = await r.json();
      setNewCat((prev: any) => ({ ...prev, image: data.url }));
    } catch {
      toast({ title: "فشل رفع الصورة", variant: "destructive" });
    } finally {
      setUploadingId(null);
    }
  };

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/categories", data);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "فشل إنشاء الفئة" }));
        throw new Error(err.message || "فشل إنشاء الفئة");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setNewCat({ name: "", nameAr: "", slug: "", image: "", description: "", parentId: null });
      toast({ title: "تمت إضافة الفئة بنجاح" });
    },
    onError: (err: any) => {
      toast({ title: err.message || "فشل إنشاء الفئة", variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PATCH", `/api/categories/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setEditingId(null);
      toast({ title: "تم تحديث الفئة بنجاح" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({ title: "تم حذف الفئة" });
    }
  });

  if (isLoading) return <Loader2 className="animate-spin mx-auto mt-10" />;

  const parentCats = (categories || []).filter((c: any) => !c.parentId);
  const subCatsMap: Record<string, any[]> = {};
  (categories || []).forEach((c: any) => {
    if (c.parentId) {
      if (!subCatsMap[c.parentId]) subCatsMap[c.parentId] = [];
      subCatsMap[c.parentId].push(c);
    }
  });

  const CategoryCard = ({ cat, isSubCat = false }: { cat: any; isSubCat?: boolean }) => (
    <div className={`rounded-2xl border overflow-hidden bg-white shadow-sm hover:shadow-md transition-all group ${isSubCat ? "border-indigo-100 ring-1 ring-indigo-100" : "border-slate-200"}`}>
      <div className={`relative bg-slate-100 overflow-hidden ${isSubCat ? "aspect-square" : "aspect-[4/3]"}`}>
        {cat.image ? (
          <img src={cat.image} alt={cat.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Tag className={`text-slate-300 ${isSubCat ? "w-5 h-5" : "w-8 h-8"}`} />
          </div>
        )}
        {isSubCat && (
          <div className="absolute top-1.5 right-1.5 bg-indigo-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wide">
            فرعي
          </div>
        )}
        <label className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all cursor-pointer flex items-center justify-center opacity-0 group-hover:opacity-100">
          {uploadingId === cat.id ? (
            <Loader2 className="w-5 h-5 text-white animate-spin" />
          ) : (
            <div className="flex flex-col items-center gap-1 text-white">
              <ImageIcon className="w-5 h-5" />
              <span className="text-[9px] font-bold">تغيير الصورة</span>
            </div>
          )}
          <input type="file" accept="image/*" className="hidden" onChange={e => handleCategoryImageUpload(e, cat.id)} />
        </label>
      </div>
      <div className="p-3">
        {editingId === cat.id ? (
          <div className="space-y-1.5">
            <Input value={editData.name ?? cat.name} onChange={e => setEditData({ ...editData, name: e.target.value })} placeholder="EN" className="h-7 text-xs" />
            <Input value={editData.nameAr ?? cat.nameAr ?? ""} onChange={e => setEditData({ ...editData, nameAr: e.target.value })} placeholder="AR" className="h-7 text-xs" />
            <div className="flex gap-1 mt-1">
              <Button size="sm" className="flex-1 h-7 text-[10px] font-black" onClick={() => updateMutation.mutate({ id: cat.id, data: editData })}>
                {updateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "حفظ"}
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => setEditingId(null)}>إلغاء</Button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-1">
            <div className="min-w-0">
              <p className={`font-black truncate ${isSubCat ? "text-xs" : "text-sm"}`}>{cat.nameAr || cat.name}</p>
              <p className="text-[9px] text-slate-400 font-bold truncate">{cat.name}</p>
              {!isSubCat && subCatsMap[cat.id]?.length > 0 && (
                <p className="text-[9px] text-indigo-400 font-bold mt-0.5">{subCatsMap[cat.id].length} قسم فرعي</p>
              )}
            </div>
            <div className="flex gap-0.5 shrink-0">
              <Button variant="ghost" size="icon" className="h-6 w-6 rounded-lg hover:bg-slate-100" onClick={() => { setEditingId(cat.id); setEditData({ name: cat.name, nameAr: cat.nameAr || "" }); }}>
                <Pencil className="w-2.5 h-2.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6 rounded-lg hover:bg-red-50 hover:text-red-500" onClick={() => deleteMutation.mutate(cat.id)}>
                <Trash2 className="w-2.5 h-2.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold uppercase tracking-tight">إدارة الفئات</h2>
        <div className="flex items-center gap-2 text-xs text-slate-400 font-bold">
          <span>{parentCats.length} رئيسي</span>
          <span>·</span>
          <span>{(categories?.length || 0) - parentCats.length} فرعي</span>
        </div>
      </div>

      {/* ── Add New Category ── */}
      <Card className="border-slate-200 shadow-sm p-5 bg-slate-50">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">إضافة فئة جديدة</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
          {/* Image */}
          <div className="space-y-1 col-span-2 md:col-span-1">
            <Label className="text-[10px] font-bold uppercase opacity-50">الصورة</Label>
            <label className="relative flex items-center gap-3 cursor-pointer group">
              <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-dashed border-slate-300 hover:border-slate-500 shrink-0 transition-all">
                {newCat.image ? (
                  <img src={newCat.image} className="w-full h-full object-cover" alt="" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-100">
                    {uploadingId === "new" ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> : <ImageIcon className="w-5 h-5 text-slate-300" />}
                  </div>
                )}
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={handleNewCatImageUpload} />
            </label>
          </div>
          {/* Name EN */}
          <div className="space-y-1">
            <Label className="text-[10px] font-bold uppercase opacity-50">الاسم (EN)</Label>
            <Input placeholder="Clothing" value={newCat.name} onChange={e => setNewCat({ ...newCat, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '') })} className="h-9" />
          </div>
          {/* Name AR */}
          <div className="space-y-1">
            <Label className="text-[10px] font-bold uppercase opacity-50">الاسم (AR)</Label>
            <Input placeholder="ملابس" value={newCat.nameAr} onChange={e => setNewCat({ ...newCat, nameAr: e.target.value })} className="h-9" />
          </div>
          {/* Parent Category */}
          <div className="space-y-1">
            <Label className="text-[10px] font-bold uppercase opacity-50">القسم الرئيسي (اختياري)</Label>
            <Select value={(newCat as any).parentId || "__none__"} onValueChange={v => setNewCat({ ...newCat, ...(v === "__none__" ? { parentId: null } : { parentId: v }) } as any)}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="بدون (قسم رئيسي)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">بدون — قسم رئيسي</SelectItem>
                {parentCats.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.nameAr || c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 md:col-span-4 flex items-center gap-3">
            <div className="flex-1 text-[10px] text-slate-400 font-mono">slug: {newCat.slug || "—"}</div>
            <Button
              onClick={() => {
                const slug = newCat.slug || newCat.name.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "");
                if (!newCat.name || !slug) { toast({ title: "الاسم مطلوب", variant: "destructive" }); return; }
                createMutation.mutate({ ...newCat, slug } as any);
              }}
              disabled={!newCat.name || createMutation.isPending}
              className="h-9 font-bold px-6"
            >
              {createMutation.isPending ? <Loader2 className="animate-spin w-4 h-4" /> : <><Plus className="w-4 h-4 ml-1" /> إضافة</>}
            </Button>
          </div>
        </div>
      </Card>

      {/* ── Hierarchical Categories ── */}
      <div className="space-y-8">
        {parentCats.map((parent: any) => (
          <div key={parent.id}>
            {/* Parent Category */}
            <div className="flex items-center gap-2 mb-3">
              <div className="h-px flex-1 bg-slate-100" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2">
                {parent.nameAr || parent.name}
              </span>
              <div className="h-px flex-1 bg-slate-100" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {/* Parent Card */}
              <CategoryCard cat={parent} />
              {/* Sub-category Cards */}
              {(subCatsMap[parent.id] || []).map((sub: any) => (
                <CategoryCard key={sub.id} cat={sub} isSubCat />
              ))}
              {/* Add Subcategory Quick Button */}
              <button
                onClick={() => setNewCat({ name: "", nameAr: "", slug: "", image: "", description: "", ...(({ parentId: parent.id } as any)) })}
                className="rounded-2xl border-2 border-dashed border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 flex flex-col items-center justify-center gap-2 aspect-square transition-all group"
              >
                <Plus className="w-5 h-5 text-slate-300 group-hover:text-indigo-400 transition-colors" />
                <span className="text-[9px] font-bold text-slate-300 group-hover:text-indigo-400 transition-colors">قسم فرعي</span>
              </button>
            </div>
          </div>
        ))}

        {/* ── Uncategorized (no parent) if any ── */}
        {(categories || []).filter((c: any) => !c.parentId && !parentCats.find((p: any) => p.id === c.id)).length === 0 && parentCats.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <Tag className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-bold">لا توجد فئات بعد</p>
          </div>
        )}
      </div>
    </div>
  );
});

const OrdersTable = memo(() => {
  const { toast } = useToast();
  const [filter, setFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const { data: orders, isLoading } = useQuery({
    queryKey: ["/api/orders"],
    queryFn: async () => {
      const res = await fetch("/api/orders");
      if (!res.ok) throw new Error("Failed to fetch orders");
      return res.json();
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, shippingProvider, trackingNumber }: any) => {
      const res = await apiRequest("PATCH", `/api/orders/${id}/status`, { status, shippingProvider, trackingNumber });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({ title: "تم تحديث حالة الطلب" });
    }
  });

  const confirmPaymentMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "confirm" | "reject" }) => {
      const res = await apiRequest("PATCH", `/api/orders/${id}/confirm-payment`, { action });
      if (!res.ok) throw new Error("فشل التحديث");
      return res.json();
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: vars.action === "confirm" ? "✅ تم تأكيد الدفع وبدأ التجهيز" : "❌ تم رفض الدفع وإلغاء الطلب",
        variant: vars.action === "confirm" ? "default" : "destructive",
      });
    },
    onError: () => toast({ title: "خطأ في معالجة الطلب", variant: "destructive" }),
  });

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    return orders.filter((order: any) => {
      const matchesStatus = filter === "all" || order.status === filter;
      const matchesSearch = order.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (order.shippingAddress?.street?.toLowerCase() || "").includes(searchTerm.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [orders, filter, searchTerm]);

  if (isLoading) return <Loader2 className="animate-spin mx-auto" />;

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'new': return <Badge className="bg-primary rounded-none">جديد</Badge>;
      case 'pending_payment': return <Badge className="bg-amber-500 rounded-none animate-pulse">⏳ انتظار تأكيد الدفع</Badge>;
      case 'processing': return <Badge className="bg-blue-500 rounded-none">تجهيز</Badge>;
      case 'shipped': return <Badge className="bg-orange-500 rounded-none">تم الشحن</Badge>;
      case 'completed': return <Badge className="bg-green-600 rounded-none">مكتمل</Badge>;
      case 'cancelled': return <Badge variant="destructive" className="rounded-none">ملغي</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const exportReport = (format: 'pdf' | 'excel') => {
    toast({ title: `جاري تصدير التقرير بصيغة ${format.toUpperCase()}...` });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <h2 className="text-2xl font-bold uppercase tracking-tight">إدارة الطلبات</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportReport('excel')} className="rounded-none text-xs font-bold border-black/10">
            تصدير تقرير Excel
          </Button>
          <Button variant="outline" onClick={() => exportReport('pdf')} className="rounded-none text-xs font-bold border-black/10">
            تصدير PDF
          </Button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2 items-center">
        {[
          { key: "all", label: "الكل" },
          { key: "pending_payment", label: "⏳ انتظار تأكيد الدفع", alert: true },
          { key: "new", label: "جديد" },
          { key: "processing", label: "تجهيز" },
          { key: "shipped", label: "شحن" },
          { key: "completed", label: "مكتمل" },
          { key: "cancelled", label: "ملغي" },
        ].map(({ key, label, alert }) => {
          const count = key === "all" ? (orders?.length || 0) : (orders?.filter((o: any) => o.status === key).length || 0);
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest border transition-all ${
                filter === key
                  ? alert ? "bg-amber-500 text-white border-amber-500" : "bg-black text-white border-black"
                  : alert && count > 0 ? "border-amber-400 text-amber-700 bg-amber-50 animate-pulse" : "border-black/10 text-black/50 bg-white hover:border-black/30"
              }`}
            >
              {label} {count > 0 && <span className="mr-1 opacity-70">({count})</span>}
            </button>
          );
        })}
      </div>

      <div className="rounded-none border border-black/5 overflow-hidden">
        <div className="p-6 grid grid-cols-7 font-black uppercase tracking-widest text-[10px] bg-secondary/20 text-black/40 border-b border-black/5">
          <div className="text-right">رقم الطلب</div>
          <div className="text-right">العميل</div>
          <div className="text-right">المبلغ</div>
          <div className="text-right">الربح</div>
          <div className="text-right">الحالة</div>
          <div className="text-right">التاريخ</div>
          <div className="text-center">إجراءات</div>
        </div>
        <div className="divide-y divide-black/5">
          {filteredOrders.map((order: any) => (
            <div key={order.id} className="p-6 grid grid-cols-7 items-center hover:bg-secondary/10 transition-colors">
              <div className="font-black">#{order.id.slice(-6).toUpperCase()}</div>
              <div className="font-bold truncate">عميل</div>
              <div className="font-black tracking-tighter">{Number(order.total).toLocaleString()} ر.س</div>
              <div className="font-black text-green-600 text-[10px]">+{Number(order.netProfit || 0).toLocaleString()} ر.س</div>
              <div>{getStatusBadge(order.status)}</div>
              <div className="text-xs text-black/40">{new Date(order.createdAt).toLocaleDateString("ar-SA")}</div>
              <div className="flex justify-center gap-2">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-black/5 rounded-none">
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent dir="rtl" className="rounded-none max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="text-right font-black">
                        تفاصيل الطلب #{order.id.slice(-6).toUpperCase()}
                        <span className="mr-2">{getStatusBadge(order.status)}</span>
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6 pt-4">

                      {/* ── Bank Transfer Receipt Review ── */}
                      {order.status === "pending_payment" && order.paymentMethod === "bank_transfer" && (
                        <div className="border-2 border-amber-400 bg-amber-50 rounded-none p-4 space-y-3">
                          <p className="text-xs font-black text-amber-800 uppercase tracking-widest">⏳ انتظار مراجعة إيصال التحويل البنكي</p>
                          <p className="text-[10px] text-amber-700 font-bold">يجب مراجعة الإيصال أدناه وتأكيد أو رفض الدفع قبل بدء التجهيز</p>
                          {order.bankTransferReceipt ? (
                            <div className="space-y-3">
                              <a href={order.bankTransferReceipt} target="_blank" rel="noopener noreferrer">
                                <img 
                                  src={order.bankTransferReceipt} 
                                  alt="إيصال التحويل" 
                                  className="w-full max-h-64 object-contain border border-amber-300 bg-white cursor-zoom-in hover:opacity-90 transition"
                                />
                              </a>
                              <p className="text-[9px] text-amber-600 font-bold text-center">انقر على الصورة لعرضها بالحجم الكامل</p>
                            </div>
                          ) : (
                            <div className="bg-white border border-amber-300 p-4 text-center">
                              <p className="text-xs text-amber-700 font-bold">لم يتم رفع إيصال بعد</p>
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-3 pt-2">
                            <Button
                              className="rounded-none bg-green-600 hover:bg-green-700 text-white font-black text-xs h-11"
                              disabled={confirmPaymentMutation.isPending}
                              onClick={() => confirmPaymentMutation.mutate({ id: order.id, action: "confirm" })}
                            >
                              ✅ تأكيد الدفع — بدء التجهيز
                            </Button>
                            <Button
                              variant="destructive"
                              className="rounded-none font-black text-xs h-11"
                              disabled={confirmPaymentMutation.isPending}
                              onClick={() => confirmPaymentMutation.mutate({ id: order.id, action: "reject" })}
                            >
                              ❌ رفض الدفع — إلغاء الطلب
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* ── Receipt display (already confirmed orders) ── */}
                      {order.bankTransferReceipt && order.status !== "pending_payment" && (
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest opacity-40">إيصال التحويل البنكي</Label>
                          <a href={order.bankTransferReceipt} target="_blank" rel="noopener noreferrer">
                            <img src={order.bankTransferReceipt} alt="إيصال" className="w-full max-h-40 object-contain border border-black/10 bg-gray-50 hover:opacity-90 transition" />
                          </a>
                        </div>
                      )}

                      {/* ── Status Buttons (blocked for pending_payment) ── */}
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest opacity-40">تغيير الحالة</Label>
                        {order.status === "pending_payment" ? (
                          <p className="text-[10px] text-amber-700 font-bold bg-amber-50 border border-amber-200 p-3">
                            ⚠ لا يمكن تغيير الحالة يدوياً — يجب تأكيد أو رفض الدفع أولاً
                          </p>
                        ) : (
                          <div className="grid grid-cols-3 gap-2">
                            {(["new", "processing", "shipped", "completed", "cancelled"] as const).map(s => (
                              <Button 
                                key={s} 
                                variant={order.status === s ? 'default' : 'outline'}
                                className="rounded-none text-[10px] h-10 font-bold"
                                onClick={() => updateStatusMutation.mutate({ id: order.id, status: s })}
                              >
                                {s === 'new' ? 'جديد' : s === 'processing' ? 'تجهيز' : s === 'shipped' ? 'شحن' : s === 'completed' ? 'مكتمل' : 'إلغاء'}
                              </Button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="pt-4 border-t border-black/5 space-y-4">
                        <Label className="text-[10px] font-black uppercase tracking-widest opacity-40">تفاصيل الشحن</Label>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold">شركة الشحن</Label>
                            <Input 
                              placeholder="Storage Station" 
                              defaultValue={order.shippingProvider} 
                              className="rounded-none"
                              id={`provider-${order.id}`}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold">رقم التتبع</Label>
                            <Input 
                              placeholder="TRK123..." 
                              defaultValue={order.trackingNumber} 
                              className="rounded-none"
                              id={`tracking-${order.id}`}
                            />
                          </div>
                        </div>
                        <Button 
                          className="w-full rounded-none font-bold"
                          disabled={order.status === "pending_payment"}
                          onClick={() => {
                            const p = (document.getElementById(`provider-${order.id}`) as HTMLInputElement).value;
                            const t = (document.getElementById(`tracking-${order.id}`) as HTMLInputElement).value;
                            updateStatusMutation.mutate({ id: order.id, status: order.status, shippingProvider: p, trackingNumber: t });
                          }}
                        >
                          تحديث معلومات الشحن
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

// ─── Admin Returns Panel ───────────────────────────────────────────────────
const AdminReturnsPanel = memo(() => {
  const { toast } = useToast();
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected" | "completed">("all");
  const [selected, setSelected] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const { data: returns = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["/api/admin/returns", filter],
    queryFn: async () => {
      const url = filter === "all" ? "/api/admin/returns" : `/api/admin/returns?status=${filter}`;
      const res = await fetch(url);
      return res.json();
    },
  });

  const handleAction = async (id: string, status: string, adminNote: string, refundAmount: number) => {
    setActionLoading(true);
    try {
      await apiRequest("PATCH", `/api/admin/returns/${id}`, { status, adminNote, refundAmount });
      toast({ title: status === "approved" ? "✅ تم قبول طلب الإرجاع" : "❌ تم رفض الطلب" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/returns"] });
      setSelected(null);
      refetch();
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const statusConfig: Record<string, { label: string; color: string }> = {
    pending:   { label: "قيد الانتظار", color: "bg-amber-100 text-amber-700" },
    approved:  { label: "مقبول",        color: "bg-green-100 text-green-700" },
    rejected:  { label: "مرفوض",        color: "bg-red-100 text-red-700" },
    completed: { label: "مكتمل",        color: "bg-slate-100 text-slate-600" },
  };

  const [noteText, setNoteText] = useState("");
  const [refundAmt, setRefundAmt] = useState(0);

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900">المرتجعات والاسترداد</h2>
          <p className="text-xs text-slate-500 mt-0.5">إدارة طلبات إرجاع العملاء</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["all", "pending", "approved", "rejected", "completed"] as const).map(s => (
            <Button key={s} size="sm" variant={filter === s ? "default" : "outline"}
              className="text-xs rounded-xl" onClick={() => setFilter(s)}>
              {s === "all" ? "الكل" : statusConfig[s]?.label || s}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-20 rounded-2xl bg-slate-100 animate-pulse" />)}
        </div>
      ) : returns.length === 0 ? (
        <Card className="border-none shadow-sm">
          <CardContent className="p-16 text-center">
            <RotateCcw className="w-12 h-12 mx-auto text-slate-200 mb-4" />
            <p className="text-slate-400 font-bold text-sm">لا توجد طلبات مرتجعات</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {returns.map((ret: any) => (
            <Card key={ret.id || ret._id} className="border-none shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm text-slate-900">#{(ret.orderId || "").slice(-6).toUpperCase()}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusConfig[ret.status]?.color || "bg-slate-100 text-slate-600"}`}>
                        {statusConfig[ret.status]?.label || ret.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium">
                      العميل: {ret.customer?.name || ret.userId?.slice(-8) || "—"}
                      {ret.customer?.phone && <span className="mr-2 text-primary">{ret.customer.phone}</span>}
                    </p>
                    <p className="text-xs text-slate-600">السبب: <span className="font-semibold">{ret.reason}</span></p>
                    {ret.reasonDetail && <p className="text-xs text-slate-400 italic">{ret.reasonDetail}</p>}
                    <div className="flex gap-3 text-xs text-slate-400">
                      <span>{ret.items?.length || 0} منتج</span>
                      <span>•</span>
                      <span>المبلغ المقترح: {ret.refundAmount?.toLocaleString() || "0"} ر.س</span>
                      <span>•</span>
                      <span>{ret.createdAt ? new Date(ret.createdAt).toLocaleDateString("ar-SA") : ""}</span>
                    </div>
                  </div>
                  {ret.status === "pending" && (
                    <Button size="sm" variant="outline" className="text-xs rounded-xl shrink-0"
                      onClick={() => { setSelected(ret); setNoteText(""); setRefundAmt(ret.refundAmount || 0); }}>
                      إدارة الطلب
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Action Dialog */}
      {selected && (
        <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
          <DialogContent dir="rtl" className="max-w-md">
            <DialogHeader>
              <DialogTitle className="font-black text-right">إدارة طلب الإرجاع</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="p-3 rounded-xl bg-slate-50 space-y-1">
                <p className="text-xs font-bold text-slate-700">طلب رقم: #{(selected.orderId || "").slice(-6).toUpperCase()}</p>
                <p className="text-xs text-slate-500">السبب: {selected.reason}</p>
                {selected.reasonDetail && <p className="text-xs text-slate-400 italic">{selected.reasonDetail}</p>}
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold">مبلغ الاسترداد (ر.س)</Label>
                <Input type="number" value={refundAmt} onChange={e => setRefundAmt(Number(e.target.value))}
                  className="text-right" placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold">ملاحظة للعميل</Label>
                <Textarea value={noteText} onChange={e => setNoteText(e.target.value)}
                  className="text-right text-sm resize-none" rows={3} placeholder="اختياري..." />
              </div>
              <div className="flex gap-2">
                <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm"
                  disabled={actionLoading}
                  onClick={() => handleAction(selected.id || selected._id, "approved", noteText, refundAmt)}>
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "✅ قبول الإرجاع"}
                </Button>
                <Button variant="destructive" className="flex-1 rounded-xl text-sm"
                  disabled={actionLoading}
                  onClick={() => handleAction(selected.id || selected._id, "rejected", noteText, 0)}>
                  رفض الطلب
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
});

// ─── Flash Deals Panel ───────────────────────────────────────────────────────
const FlashDealsPanel = memo(() => {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [editDeal, setEditDeal] = useState<any>(null);

  const { data: deals = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["/api/admin/flash-deals"],
    queryFn: async () => {
      const res = await fetch("/api/admin/flash-deals");
      return res.json();
    },
  });

  const { data: allProducts = [] } = useQuery<any[]>({
    queryKey: ["/api/products"],
  });

  const defaultDeal = {
    productId: "",
    title: "",
    titleEn: "",
    discountPercent: 20,
    discountAmount: 0,
    startTime: new Date().toISOString().slice(0, 16),
    endTime: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
    maxQuantity: 50,
    isActive: true,
    badgeColor: "#ef4444",
  };

  const [form, setForm] = useState(defaultDeal);

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/admin/flash-deals", data),
    onSuccess: () => {
      toast({ title: "✅ تم إنشاء عرض الفلاش" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/flash-deals"] });
      setShowCreate(false);
      setForm(defaultDeal);
      refetch();
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PATCH", `/api/admin/flash-deals/${id}`, data),
    onSuccess: () => {
      toast({ title: "✅ تم تحديث العرض" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/flash-deals"] });
      setEditDeal(null);
      refetch();
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/flash-deals/${id}`),
    onSuccess: () => {
      toast({ title: "تم حذف العرض" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/flash-deals"] });
      refetch();
    },
  });

  const handleSubmit = () => {
    if (!form.productId) return toast({ title: "اختر منتجاً", variant: "destructive" });
    createMutation.mutate({ ...form, startTime: new Date(form.startTime).toISOString(), endTime: new Date(form.endTime).toISOString() });
  };

  const handleUpdate = () => {
    if (!editDeal) return;
    updateMutation.mutate({ id: editDeal.id || editDeal._id, data: { ...editDeal, startTime: new Date(editDeal.startTime).toISOString(), endTime: new Date(editDeal.endTime).toISOString() } });
  };

  const DealForm = ({ data, onChange }: { data: any; onChange: (d: any) => void }) => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-xs font-bold">المنتج</Label>
        <Select value={data.productId} onValueChange={v => onChange({ ...data, productId: v })}>
          <SelectTrigger className="text-right text-sm">
            <SelectValue placeholder="اختر منتجاً..." />
          </SelectTrigger>
          <SelectContent>
            {(allProducts as any[]).map((p: any) => (
              <SelectItem key={p.id || p._id} value={p.id || p._id}>
                {p.name || p.nameAr || p.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-xs font-bold">العنوان (عربي)</Label>
          <Input value={data.title} onChange={e => onChange({ ...data, title: e.target.value })} placeholder="عرض خاص..." className="text-right" />
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-bold">العنوان (إنجليزي)</Label>
          <Input value={data.titleEn} onChange={e => onChange({ ...data, titleEn: e.target.value })} placeholder="Flash Sale..." />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-xs font-bold">نسبة الخصم %</Label>
          <Input type="number" min={1} max={99} value={data.discountPercent}
            onChange={e => onChange({ ...data, discountPercent: Number(e.target.value) })} className="text-right" />
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-bold">الحد الأقصى للكمية</Label>
          <Input type="number" min={0} value={data.maxQuantity}
            onChange={e => onChange({ ...data, maxQuantity: Number(e.target.value) })} className="text-right" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-xs font-bold">وقت البدء</Label>
          <Input type="datetime-local" value={data.startTime?.slice(0, 16)}
            onChange={e => onChange({ ...data, startTime: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-bold">وقت الانتهاء</Label>
          <Input type="datetime-local" value={data.endTime?.slice(0, 16)}
            onChange={e => onChange({ ...data, endTime: e.target.value })} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={data.isActive} onCheckedChange={v => onChange({ ...data, isActive: v })} />
        <Label className="text-xs font-bold">{data.isActive ? "نشط" : "معطل"}</Label>
      </div>
    </div>
  );

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            عروض الفلاش
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">عروض محدودة الوقت مع عداد تنازلي</p>
        </div>
        <Button className="rounded-xl text-sm gap-2" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" />
          عرض جديد
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1,2].map(i => <div key={i} className="h-40 rounded-2xl bg-slate-100 animate-pulse" />)}
        </div>
      ) : deals.length === 0 ? (
        <Card className="border-none shadow-sm">
          <CardContent className="p-16 text-center">
            <Zap className="w-12 h-12 mx-auto text-slate-200 mb-4" />
            <p className="text-slate-400 font-bold text-sm">لا توجد عروض فلاش</p>
            <p className="text-slate-300 text-xs mt-1">ابدأ بإنشاء أول عرض فلاش لزيادة المبيعات</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {deals.map((deal: any) => {
            const now = Date.now();
            const end = new Date(deal.endTime).getTime();
            const start = new Date(deal.startTime).getTime();
            const isActive = deal.isActive && now >= start && now <= end;
            const isExpired = now > end;
            const progress = deal.maxQuantity > 0 ? Math.min(100, Math.round((deal.soldCount / deal.maxQuantity) * 100)) : 0;
            return (
              <Card key={deal.id || deal._id} className={`border-none shadow-sm overflow-hidden ${isExpired ? "opacity-60" : ""}`}>
                <div className={`h-1.5 ${isActive ? "bg-gradient-to-r from-red-500 to-amber-500" : "bg-slate-200"}`} />
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isActive ? "bg-red-100 text-red-600" : isExpired ? "bg-slate-100 text-slate-400" : "bg-amber-100 text-amber-700"}`}>
                          {isActive ? "🔥 نشط" : isExpired ? "انتهى" : "قادم"}
                        </span>
                        <span className="text-xs font-black text-red-600">{deal.discountPercent}% خصم</span>
                      </div>
                      <p className="font-black text-sm text-slate-900 mt-1">{deal.title || deal.product?.name || deal.productId}</p>
                      <p className="text-xs text-slate-400">{deal.product?.nameAr || deal.product?.name || ""}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="w-8 h-8 rounded-lg"
                        onClick={() => setEditDeal({ ...deal, startTime: deal.startTime?.slice(0, 16), endTime: deal.endTime?.slice(0, 16) })}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="w-8 h-8 rounded-lg text-red-500 hover:text-red-600"
                        onClick={() => deleteMutation.mutate(deal.id || deal._id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-400 space-y-0.5">
                    <div className="flex items-center gap-1">
                      <CalendarClock className="w-3 h-3" />
                      <span>{new Date(deal.startTime).toLocaleString("ar-SA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                      <span>→</span>
                      <span>{new Date(deal.endTime).toLocaleString("ar-SA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  </div>
                  {deal.maxQuantity > 0 && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                        <span>المباع: {deal.soldCount || 0}</span>
                        <span>الحد: {deal.maxQuantity}</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all" style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-black text-right flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" /> إنشاء عرض فلاش جديد
            </DialogTitle>
          </DialogHeader>
          <DealForm data={form} onChange={setForm} />
          <div className="flex gap-2 pt-2">
            <Button className="flex-1 rounded-xl" onClick={handleSubmit} disabled={createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "إنشاء العرض"}
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={() => setShowCreate(false)}>إلغاء</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      {editDeal && (
        <Dialog open={!!editDeal} onOpenChange={() => setEditDeal(null)}>
          <DialogContent dir="rtl" className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-black text-right">تعديل عرض الفلاش</DialogTitle>
            </DialogHeader>
            <DealForm data={editDeal} onChange={setEditDeal} />
            <div className="flex gap-2 pt-2">
              <Button className="flex-1 rounded-xl" onClick={handleUpdate} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "حفظ التغييرات"}
              </Button>
              <Button variant="outline" className="rounded-xl" onClick={() => setEditDeal(null)}>إلغاء</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
});

const statusColors: Record<string, string> = {
  new: "bg-blue-400/10 text-blue-400 border-blue-400/30",
  pending_payment: "bg-amber-400/10 text-amber-400 border-amber-400/30",
  processing: "bg-violet-400/10 text-violet-400 border-violet-400/30",
  out_for_delivery: "bg-orange-400/10 text-orange-400 border-orange-400/30",
  shipped: "bg-cyan-400/10 text-cyan-400 border-cyan-400/30",
  completed: "bg-emerald-400/10 text-emerald-400 border-emerald-400/30",
  cancelled: "bg-red-400/10 text-red-400 border-red-400/30",
  returned: "bg-yellow-400/10 text-yellow-400 border-yellow-400/30",
};

const statusLabels: Record<string, string> = {
  new: "جديد",
  pending_payment: "⏳ انتظار تأكيد الدفع",
  processing: "قيد التجهيز",
  out_for_delivery: "🛵 خرج للتوصيل",
  shipped: "تم الشحن",
  completed: "مكتمل",
  cancelled: "ملغى",
  returned: "مُرتجع",
};

const OrdersManagement = memo(() => {
  const { data: orders, isLoading } = useQuery({
    queryKey: ["/api/orders"],
    queryFn: async () => {
      const res = await fetch("/api/orders");
      return res.json();
    }
  });

  const { toast } = useToast();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [driverDialog, setDriverDialog] = useState<{ orderId: string } | null>(null);
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, deliveryDriverName, deliveryDriverPhone }: { id: string; status: string; deliveryDriverName?: string; deliveryDriverPhone?: string }) => {
      await apiRequest("PATCH", `/api/orders/${id}/status`, { status, deliveryDriverName, deliveryDriverPhone });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({ title: "تم تحديث حالة الطلب بنجاح" });
    }
  });

  const handleStatusChange = (orderId: string, status: string) => {
    if (status === "out_for_delivery") {
      setDriverDialog({ orderId });
      setDriverName("");
      setDriverPhone("");
    } else {
      updateStatusMutation.mutate({ id: orderId, status });
    }
  };

  const confirmDelivery = () => {
    if (!driverDialog) return;
    updateStatusMutation.mutate({
      id: driverDialog.orderId,
      status: "out_for_delivery",
      deliveryDriverName: driverName,
      deliveryDriverPhone: driverPhone,
    });
    setDriverDialog(null);
  };

  const confirmPaymentMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "confirm" | "reject" }) => {
      const res = await apiRequest("PATCH", `/api/orders/${id}/confirm-payment`, { action });
      if (!res.ok) throw new Error("فشل");
      return res.json();
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: vars.action === "confirm" ? "✅ تم تأكيد الدفع وبدأ التجهيز" : "❌ تم رفض الدفع وإلغاء الطلب",
        variant: vars.action === "confirm" ? "default" : "destructive",
      });
    },
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin w-8 h-8 text-slate-300" />
    </div>
  );

  const allOrders = orders || [];
  const filteredOrders = statusFilter === "all" ? allOrders : allOrders.filter((o: any) => o.status === statusFilter);

  const counts: Record<string, number> = allOrders.reduce((acc: any, o: any) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-5" dir="rtl">
      {/* ── Delivery Driver Dialog ── */}
      <Dialog open={!!driverDialog} onOpenChange={(o) => !o && setDriverDialog(null)}>
        <DialogContent className="rounded-2xl max-w-sm bg-white border border-slate-200 text-[#1a2744]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="font-black text-right flex items-center gap-2 text-[#1a2744]">
              <div className="p-1.5 rounded-lg bg-violet-500/10">
                <Bike className="h-4 w-4 text-violet-500" />
              </div>
              تعيين سائق التوصيل
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="text-xs font-black text-slate-500 uppercase tracking-wider">اسم السائق *</Label>
              <Input
                placeholder="مثال: محمد العمري"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                className="border-slate-200 rounded-xl font-bold"
                dir="rtl"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-black text-slate-500 uppercase tracking-wider">رقم هاتف السائق</Label>
              <Input
                placeholder="05xxxxxxxx"
                value={driverPhone}
                onChange={(e) => setDriverPhone(e.target.value)}
                className="border-slate-200 rounded-xl font-bold"
                dir="rtl"
              />
            </div>
            <div className="p-3 rounded-xl bg-violet-500/10 border border-violet-500/20 text-xs font-bold text-violet-300">
              سيتلقى العميل إشعاراً فورياً باسم السائق ورقم هاتفه
            </div>
            <Button
              className="w-full rounded-xl bg-violet-600 hover:bg-violet-700 font-black gap-2"
              disabled={!driverName.trim() || updateStatusMutation.isPending}
              onClick={confirmDelivery}
            >
              <Bike className="h-4 w-4" />
              تأكيد خروج الطلب للتوصيل
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="flex flex-wrap gap-3 justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-1 h-6 bg-blue-400 rounded-full" />
          <div>
            <h2 className="text-lg font-black text-white">إدارة الطلبات</h2>
            <p className="text-[10px] text-white/30">{allOrders.length} طلب إجمالاً</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {counts["pending_payment"] > 0 && (
            <span className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-400 text-[10px] font-black animate-pulse">
              ⏳ {counts["pending_payment"]} بانتظار تأكيد الدفع
            </span>
          )}
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/orders"] })}
            className="p-2 rounded-xl text-white/30 hover:text-white hover:bg-white/5 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1.5 flex-wrap">
        <button
          onClick={() => setStatusFilter("all")}
          className={`px-3 py-1.5 rounded-xl text-[10px] font-black transition-all border ${
            statusFilter === "all"
              ? "bg-white/15 text-white border-white/20"
              : "text-white/40 border-white/5 hover:border-white/10 hover:text-white/60"
          }`}
        >
          الكل ({allOrders.length})
        </button>
        {Object.entries(statusLabels).map(([key, label]) => (counts[key] || 0) > 0 && (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-black transition-all border ${
              statusFilter === key
                ? `${statusColors[key]} font-black`
                : "text-white/40 border-white/5 hover:border-white/10 hover:text-white/60"
            } ${key === "pending_payment" && (counts[key] || 0) > 0 ? "animate-pulse" : ""}`}
          >
            {label} ({counts[key] || 0})
          </button>
        ))}
      </div>

      {filteredOrders.length === 0 && (
        <div className="text-center py-16 rounded-2xl bg-slate-50 border border-slate-200">
          <ShoppingCart className="w-10 h-10 text-white/10 mx-auto mb-3" />
          <p className="text-white/30 text-sm">لا توجد طلبات في هذا الفلتر</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3">
        {filteredOrders.map((order: any) => {
          const isExpanded = expandedId === order.id;
          const items = Array.isArray(order.items) ? order.items : [];
          return (
            <div key={order.id} className="rounded-2xl border border-slate-200 overflow-hidden bg-white hover:border-slate-300 transition-all">
                <div
                  className="flex justify-between items-center p-5 cursor-pointer hover:bg-white/3 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : order.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-white/10 flex items-center justify-center text-[10px] font-black text-white/70">
                      #{order.id.slice(-4).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-black text-sm text-white">{order.customerName || "عميل زائر"}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {order.customerPhone && (
                          <p className="text-[10px] font-bold text-white/40">{order.customerPhone}</p>
                        )}
                        <p className="text-[10px] font-bold text-white/30">
                          {new Date(order.createdAt).toLocaleDateString("ar-SA")}
                        </p>
                        {order.paymentMethod === "bank_transfer" && (
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full border ${
                            order.status === "pending_payment"
                              ? "bg-amber-400/20 text-amber-400 border-amber-400/30 animate-pulse"
                              : "bg-emerald-400/10 text-emerald-400 border-emerald-400/20"
                          }`}>
                            🏦 {order.status === "pending_payment" ? "تحويل — بانتظار المراجعة" : "تحويل بنكي ✓"}
                          </span>
                        )}
                        {order.paymentMethod && order.paymentMethod !== "bank_transfer" && (
                          <span className="text-[9px] font-bold text-white/25 px-1.5 py-0.5 rounded-full border border-white/10">
                            {order.paymentMethod === "cod" ? "دفع عند الاستلام" :
                             order.paymentMethod === "wallet" ? "محفظة" :
                             order.paymentMethod === "tabby" ? "Tabby" :
                             order.paymentMethod === "tamara" ? "Tamara" :
                             order.paymentMethod === "stc_pay" ? "STC Pay" :
                             order.paymentMethod === "cash" ? "نقد" :
                             order.paymentMethod}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-black text-base text-white">{Number(order.total).toFixed(2)} <span className="text-[10px] text-white/40">ر.س</span></p>
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${statusColors[order.status] || "bg-white/5 text-white/40 border-white/10"}`}>
                        {statusLabels[order.status] || order.status}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl border border-white/10 text-white/50 hover:text-white hover:bg-white/5" onClick={(e) => e.stopPropagation()}>
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl font-bold text-xs min-w-[180px] bg-[#1a2235] border-white/10 text-white">
                          {order.status === "pending_payment" ? (
                            <DropdownMenuItem disabled className="text-right text-amber-400 text-[10px]">
                              ⚠ أكد أو ارفض الدفع أولاً
                            </DropdownMenuItem>
                          ) : (
                            <>
                              {(["new", "processing"] as const).map((status) => (
                                <DropdownMenuItem
                                  key={status}
                                  onClick={(e) => { e.stopPropagation(); handleStatusChange(order.id, status); }}
                                  className="text-right gap-2 text-white/70 hover:text-white"
                                >
                                  <span className={`w-2 h-2 rounded-full inline-block ${statusColors[status]?.split(" ")[0]}`}></span>
                                  {statusLabels[status] || status}
                                </DropdownMenuItem>
                              ))}
                              <DropdownMenuItem
                                onClick={(e) => { e.stopPropagation(); handleStatusChange(order.id, "out_for_delivery"); }}
                                className="text-right gap-2 text-violet-400"
                              >
                                <Bike className="w-3 h-3" />
                                🛵 خرج للتوصيل (داخلي)
                              </DropdownMenuItem>
                              {(["shipped", "completed", "cancelled"] as const).map((status) => (
                                <DropdownMenuItem
                                  key={status}
                                  onClick={(e) => { e.stopPropagation(); handleStatusChange(order.id, status); }}
                                  className="text-right gap-2 text-white/70 hover:text-white"
                                >
                                  <span className={`w-2 h-2 rounded-full inline-block ${statusColors[status]?.split(" ")[0]}`}></span>
                                  {statusLabels[status] || status}
                                </DropdownMenuItem>
                              ))}
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl border border-white/10 text-white/50 hover:text-white hover:bg-white/5">
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div className="border-t border-white/5 p-5 bg-white/2 space-y-4" dir="rtl">

                    {/* ── Bank Transfer Receipt Review ── */}
                    {order.status === "pending_payment" && order.paymentMethod === "bank_transfer" && (
                      <div className="rounded-xl border-2 border-amber-400/50 bg-amber-400/10 p-4 space-y-3">
                        <p className="text-xs font-black text-amber-400 uppercase tracking-widest">⏳ انتظار مراجعة إيصال التحويل البنكي</p>
                        {order.bankTransferReceipt ? (
                          <a href={order.bankTransferReceipt} target="_blank" rel="noopener noreferrer">
                            <img src={order.bankTransferReceipt} alt="إيصال" className="w-full max-h-60 object-contain rounded-xl border border-amber-400/20 hover:opacity-90 transition cursor-zoom-in" />
                          </a>
                        ) : (
                          <p className="text-xs text-amber-400/70 font-bold bg-amber-400/5 border border-amber-400/20 p-3 text-center rounded-lg">لم يرفع العميل الإيصال بعد</p>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs h-10"
                            disabled={confirmPaymentMutation.isPending}
                            onClick={(e) => { e.stopPropagation(); confirmPaymentMutation.mutate({ id: order.id, action: "confirm" }); }}
                          >
                            ✅ تأكيد الدفع
                          </Button>
                          <Button
                            variant="destructive"
                            className="rounded-xl font-black text-xs h-10"
                            disabled={confirmPaymentMutation.isPending}
                            onClick={(e) => { e.stopPropagation(); confirmPaymentMutation.mutate({ id: order.id, action: "reject" }); }}
                          >
                            ❌ رفض الدفع
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* ── Receipt view (for already confirmed orders) ── */}
                    {order.bankTransferReceipt && order.status !== "pending_payment" && (
                      <div className="space-y-1">
                        <p className="text-[9px] font-black uppercase text-white/30 tracking-widest">إيصال التحويل البنكي (مؤكد)</p>
                        <a href={order.bankTransferReceipt} target="_blank" rel="noopener noreferrer">
                          <img src={order.bankTransferReceipt} alt="إيصال" className="w-full max-h-36 object-contain rounded-xl border border-white/10 hover:opacity-90 transition" />
                        </a>
                      </div>
                    )}

                    {/* Customer Info */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {order.customerPhone && (
                        <div className="space-y-1">
                          <p className="text-[9px] font-black uppercase text-white/30 tracking-widest">الهاتف</p>
                          <p className="text-xs font-bold text-white/70">{order.customerPhone}</p>
                        </div>
                      )}
                      {order.shippingAddress && (
                        <div className="space-y-1 col-span-2">
                          <p className="text-[9px] font-black uppercase text-white/30 tracking-widest">عنوان الشحن</p>
                          <p className="text-xs font-bold text-white/70">{
                            typeof order.shippingAddress === "object"
                              ? `${order.shippingAddress.city || ""} ${order.shippingAddress.district || ""} ${order.shippingAddress.street || ""}`.trim()
                              : order.shippingAddress
                          }</p>
                        </div>
                      )}
                      {order.paymentMethod && (
                        <div className="space-y-1">
                          <p className="text-[9px] font-black uppercase text-white/30 tracking-widest">طريقة الدفع</p>
                          <p className="text-xs font-bold text-white/70">
                            {order.paymentMethod === "bank_transfer" ? "🏦 تحويل بنكي" :
                             order.paymentMethod === "cod" ? "💵 دفع عند الاستلام" :
                             order.paymentMethod === "wallet" ? "👛 محفظة" :
                             order.paymentMethod === "tabby" ? "Tabby" :
                             order.paymentMethod === "tamara" ? "Tamara" :
                             order.paymentMethod === "stc_pay" ? "STC Pay" :
                             order.paymentMethod === "cash" ? "💵 نقد" :
                             order.paymentMethod}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Order Items */}
                    {items.length > 0 && (
                      <div>
                        <p className="text-[9px] font-black uppercase text-white/30 tracking-widest mb-2">عناصر الطلب ({items.length})</p>
                        <div className="space-y-2">
                          {items.map((item: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center p-3 rounded-xl bg-white/3 border border-white/5">
                              <div className="flex items-center gap-3">
                                {item.image && (
                                  <img src={item.image} alt={item.name} className="w-10 h-10 object-cover rounded-lg" />
                                )}
                                <div>
                                  <p className="text-xs font-black text-white">{item.name || item.productName}</p>
                                  {(item.color || item.size) && (
                                    <p className="text-[10px] text-white/40 font-bold">
                                      {item.color && `اللون: ${item.color}`}{item.color && item.size && " · "}{item.size && `المقاس: ${item.size}`}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-xs font-black text-white">{Number(item.price).toFixed(2)} ر.س</p>
                                <p className="text-[10px] text-white/40 font-bold">× {item.quantity}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Totals */}
                    <div className="flex justify-end">
                      <div className="space-y-1 text-right min-w-[160px] p-3 rounded-xl bg-white/3 border border-white/5">
                        {order.subtotal && (
                          <div className="flex justify-between gap-8 text-xs">
                            <span className="text-white/40 font-bold">المجموع الفرعي</span>
                            <span className="font-black text-white">{Number(order.subtotal).toFixed(2)} ر.س</span>
                          </div>
                        )}
                        {order.shippingCost != null && (
                          <div className="flex justify-between gap-8 text-xs">
                            <span className="text-white/40 font-bold">الشحن</span>
                            <span className="font-black text-white">{Number(order.shippingCost).toFixed(2)} ر.س</span>
                          </div>
                        )}
                        {order.discount != null && Number(order.discount) > 0 && (
                          <div className="flex justify-between gap-8 text-xs">
                            <span className="text-emerald-400 font-bold">الخصم</span>
                            <span className="font-black text-emerald-400">-{Number(order.discount).toFixed(2)} ر.س</span>
                          </div>
                        )}
                        <div className="flex justify-between gap-8 text-sm border-t border-white/10 pt-1 mt-1">
                          <span className="font-black text-white">الإجمالي</span>
                          <span className="font-black text-white">{Number(order.total).toFixed(2)} ر.س</span>
                        </div>
                      </div>
                    </div>

                    {/* Notes */}
                    {order.notes && (
                      <div className="p-3 rounded-xl bg-yellow-400/10 border border-yellow-400/20">
                        <p className="text-[9px] font-black uppercase text-yellow-400 tracking-widest mb-1">ملاحظات العميل</p>
                        <p className="text-xs font-bold text-yellow-300/80">{order.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
          );
        })}
      </div>
    </div>
  );
});

const CustomersTable = memo(() => {
  const { data: users, isLoading } = useQuery({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    }
  });

  const { toast } = useToast();
  const [walletAmount, setWalletAmount] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);

  const updateWalletMutation = useMutation({
    mutationFn: async ({ id, amount, type }: { id: string, amount: string, type: 'deposit' | 'set' }) => {
      const endpoint = type === 'deposit' ? `/api/admin/users/${id}/deposit` : `/api/admin/users/${id}`;
      const payload = type === 'deposit' ? { amount: Number(amount) } : { walletBalance: amount };
      await apiRequest(type === 'deposit' ? "POST" : "PATCH", endpoint, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "تم تحديث المحفظة بنجاح" });
      setSelectedUser(null);
      setWalletAmount("");
    }
  });

  if (isLoading) return <Loader2 className="animate-spin mx-auto" />;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-black uppercase tracking-tight">إدارة العملاء</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {users?.filter((u: any) => u.role === 'customer').map((u: any) => (
          <Card key={u.id} className="border-black/5 hover-elevate overflow-hidden">
            <CardContent className="p-6 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-black text-lg">{u.name}</p>
                  <p className="text-xs font-bold text-black/40">{u.phone || "-"}</p>
                </div>
                <div className="p-2 bg-green-50 rounded-lg">
                  <Wallet className="h-4 w-4 text-green-600" />
                </div>
              </div>
              <div className="flex justify-between items-center p-3 bg-secondary/10 border border-black/5">
                <span className="text-[10px] font-black uppercase tracking-widest text-black/40">رصيد المحفظة</span>
                <span className="font-black text-green-600">{u.walletBalance} ر.س</span>
              </div>
              <div className="flex gap-2">
                <Dialog open={selectedUser?.id === u.id && selectedUser?.action === 'deposit'} onOpenChange={(open) => { if (!open) setSelectedUser(null); }}>
                  <DialogTrigger asChild>
                    <Button variant="outline" onClick={() => setSelectedUser({ ...u, action: 'deposit' })} className="flex-1 rounded-none font-black text-[10px] uppercase h-8">
                      إيداع رصيد
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-none max-w-sm" dir="rtl">
                    <DialogHeader>
                      <DialogTitle>إيداع رصيد لـ {u.name}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase">المبلغ المراد إيداعه</Label>
                        <Input 
                          type="number" 
                          value={walletAmount} 
                          onChange={(e) => setWalletAmount(e.target.value)} 
                          placeholder="0"
                          className="rounded-none"
                        />
                      </div>
                      <Button 
                        className="w-full rounded-none font-black"
                        onClick={() => updateWalletMutation.mutate({ id: u.id, amount: walletAmount, type: 'deposit' })}
                        disabled={!walletAmount || updateWalletMutation.isPending}
                      >
                        {updateWalletMutation.isPending ? <Loader2 className="animate-spin" /> : "إيداع الآن"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                
                <Dialog open={selectedUser?.id === u.id && selectedUser?.action === 'set'} onOpenChange={(open) => { if (!open) setSelectedUser(null); }}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" onClick={() => setSelectedUser({ ...u, action: 'set' })} className="flex-1 rounded-none font-black text-[10px] uppercase h-8 border border-black/5">
                      تعديل الرصيد
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-none max-w-sm" dir="rtl">
                    <DialogHeader>
                      <DialogTitle>تعديل رصيد {u.name}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase">الرصيد الكلي الجديد</Label>
                        <Input 
                          type="number" 
                          value={walletAmount} 
                          onChange={(e) => setWalletAmount(e.target.value)} 
                          placeholder="0"
                          className="rounded-none"
                        />
                      </div>
                      <Button 
                        className="w-full rounded-none font-black"
                        onClick={() => updateWalletMutation.mutate({ id: u.id, amount: walletAmount, type: 'set' })}
                        disabled={!walletAmount || updateWalletMutation.isPending}
                      >
                        {updateWalletMutation.isPending ? <Loader2 className="animate-spin" /> : "تحديث الرصيد"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
});

const CouponsTable = memo(() => {
  const { data: coupons, isLoading } = useQuery<any[]>({ queryKey: ["/api/coupons"] });
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  
  const form = useForm({
    defaultValues: {
      code: "",
      type: "percentage" as const,
      value: "0",
      usageLimit: "",
      minOrderAmount: "",
      isActive: true,
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const parsed = {
        ...data,
        value: Number(data.value),
        usageLimit: data.usageLimit ? Number(data.usageLimit) : undefined,
        minOrderAmount: data.minOrderAmount ? Number(data.minOrderAmount) : undefined,
      };
      const res = await apiRequest("POST", "/api/coupons", parsed);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coupons"] });
      form.reset();
      setOpen(false);
      toast({ title: "تمت إضافة كود الخصم بنجاح" });
    },
    onError: (err: any) => {
      toast({ title: "خطأ", description: err.message || "فشلت إضافة الكود", variant: "destructive" });
    }
  });

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold uppercase tracking-tight">أكواد الخصم</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-none font-bold uppercase tracking-widest text-xs h-10 px-6">
              <Plus className="ml-2 h-4 w-4" /> إضافة كود
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-none max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle>إضافة كود خصم جديد</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase">الكود</Label>
                <Input
                  {...form.register("code", { required: true })}
                  placeholder="مثال: SUMMER2026"
                  className="rounded-none uppercase"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase">النوع</Label>
                  <Select value={form.watch("type")} onValueChange={(val) => form.setValue("type", val as any)}>
                    <SelectTrigger className="rounded-none">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">نسبة مئوية</SelectItem>
                      <SelectItem value="fixed">مبلغ ثابت</SelectItem>
                      <SelectItem value="cashback">كاش باك</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase">القيمة</Label>
                  <Input
                    type="number"
                    {...form.register("value", { required: true })}
                    placeholder="0"
                    className="rounded-none"
                  />
                </div>
              </div>
              
              {form.watch("type") === ("cashback" as any) && (
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase">أقصى كاش باك (اختياري)</Label>
                  <Input
                    type="number"
                    {...form.register("maxCashback" as any)}
                    placeholder="مثال: 500"
                    className="rounded-none"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase">الوصف (اختياري)</Label>
                <Input
                  {...form.register("description" as any)}
                  placeholder="مثال: احصل على 10% كاش باك"
                  className="rounded-none text-right"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase">حد الاستخدام (اختياري)</Label>
                  <Input
                    type="number"
                    {...form.register("usageLimit")}
                    placeholder="غير محدود"
                    className="rounded-none"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase">الحد الأدنى للطلب (اختياري)</Label>
                  <Input
                    type="number"
                    {...form.register("minOrderAmount")}
                    placeholder="0 ر.س"
                    className="rounded-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-secondary/10 rounded-none">
                <Label className="text-xs font-bold uppercase">نشط</Label>
                <Switch
                  checked={form.watch("isActive")}
                  onCheckedChange={(checked) => form.setValue("isActive", checked)}
                />
              </div>

              <Button 
                type="submit" 
                disabled={createMutation.isPending}
                className="w-full rounded-none font-bold uppercase tracking-widest"
              >
                {createMutation.isPending ? <Loader2 className="animate-spin ml-2" /> : "إضافة الكود"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <div className="rounded-none border border-black/5 overflow-hidden bg-white">
        <div className="p-6 grid grid-cols-6 font-black uppercase tracking-widest text-[10px] bg-secondary/10 text-black/40 border-b border-black/5">
          <div className="text-right">الكود</div>
          <div className="text-right">النوع</div>
          <div className="text-right">القيمة</div>
          <div className="text-right">الحد</div>
          <div className="text-right">الاستخدام</div>
          <div className="text-right">الحالة</div>
        </div>
        <div className="divide-y divide-black/5">
          {coupons?.map(c => (
            <div key={c.id} className="p-6 grid grid-cols-6 items-center hover:bg-secondary/5 transition-colors">
              <div className="font-black text-xs tracking-widest">{c.code}</div>
              <div className="text-[8px] font-bold uppercase opacity-60">
                {c.type === 'percentage' ? 'نسبة' : c.type === 'cashback' ? 'كاش باك' : 'مبلغ ثابت'}
              </div>
              <div className="font-black text-xs">{c.value} {c.type === 'percentage' || c.type === 'cashback' ? '%' : 'ر.س'}</div>
              <div className="text-[8px] font-bold">{c.perUserLimit}x لكل مستخدم</div>
              <div className="text-[10px] font-bold">{c.usageCount} / {c.usageLimit || '∞'}</div>
              <div>
                <Badge className={c.isActive ? "bg-green-600" : "bg-destructive"}>
                  {c.isActive ? "نشط" : "معطل"}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

const LogsTable = memo(() => {
  const { data: logs, isLoading } = useQuery<any[]>({ queryKey: ["/api/admin/logs"] });

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold uppercase tracking-tight">سجل العمليات</h2>
      <div className="rounded-none border border-black/5 overflow-hidden">
        <div className="p-6 grid grid-cols-4 font-black uppercase tracking-widest text-[10px] bg-secondary/20 text-black/40 border-b border-black/5">
          <div className="text-right">الموظف</div>
          <div className="text-right">الإجراء</div>
          <div className="text-right">الهدف</div>
          <div className="text-right">التاريخ</div>
        </div>
        <div className="divide-y divide-black/5">
          {logs?.map((l: any) => (
            <div key={l.id} className="p-6 grid grid-cols-4 items-center hover:bg-secondary/10 transition-colors">
              <div className="font-bold">{l.employeeId}</div>
              <div className="text-sm">{l.action}</div>
              <div className="text-xs opacity-60">{l.targetType} {l.targetId && `(#${l.targetId.slice(-6)})`}</div>
              <div className="text-xs">{new Date(l.createdAt).toLocaleString('ar-SA')}</div>
            </div>
          ))}
          {logs?.length === 0 && (
            <div className="p-12 text-center text-black/20 font-bold uppercase tracking-widest text-[10px]">
              لا توجد سجلات حالياً
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

const EmployeesManagement = () => {
  const { toast } = useToast();
  const { data: users, isLoading } = useQuery<any[]>({ queryKey: ["/api/admin/users"] });
  const { data: branches } = useQuery<any[]>({ queryKey: ["/api/branches"] });
  const [open, setOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    password: "",
    role: "employee",
    branchId: "main",
    loginType: "dashboard" as const,
    permissions: [] as string[]
  });

  const defaultRolePermissions: Record<string, string[]> = {
    admin: ["orders.view", "orders.edit", "orders.refund", "products.view", "products.edit", "customers.view", "wallet.adjust", "reports.view", "staff.manage", "pos.access", "settings.manage"],
    employee: ["orders.view", "products.view", "customers.view", "pos.access"],
    support: ["orders.view", "customers.view"],
    cashier: ["pos.access", "orders.view"],
    accountant: ["reports.view", "orders.view"]
  };

  const lastEditingUserIdRef = React.useRef<string | null>(null);

  useEffect(() => {
    if (editingUser && editingUser.id !== lastEditingUserIdRef.current) {
      setFormData({
        name: editingUser.name || "",
        phone: editingUser.phone || "",
        email: editingUser.email || "",
        password: "",
        role: editingUser.role || "employee",
        branchId: editingUser.branchId || "main",
        loginType: editingUser.loginType || "dashboard",
        permissions: editingUser.permissions || []
      });
      lastEditingUserIdRef.current = editingUser.id;
    } else if (!editingUser) {
      lastEditingUserIdRef.current = null;
    }
  }, [editingUser]);

  useEffect(() => {
    if (!open) {
      setEditingUser(null);
      setFormData({
        name: "",
        phone: "",
        email: "",
        password: "",
        role: "employee",
        branchId: "main",
        loginType: "dashboard",
        permissions: defaultRolePermissions.employee
      });
    }
  }, [open]);

  useEffect(() => {
    if (open && !editingUser && formData.role && defaultRolePermissions[formData.role]) {
      const newPermissions = defaultRolePermissions[formData.role];
      const currentPermissionsStr = JSON.stringify(formData.permissions || []);
      const newPermissionsStr = JSON.stringify(newPermissions);
      
      if (currentPermissionsStr !== newPermissionsStr) {
        setFormData(prev => ({ ...prev, permissions: newPermissions }));
      }
    }
  }, [formData.role, editingUser, open, formData.permissions]);

  const employees = useMemo(() => 
    users?.filter(u => ["admin", "employee", "support", "cashier", "accountant"].includes(u.role)) || []
  , [users]);

  const createEmployeeMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/admin/users", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "تم إضافة الموظف بنجاح" });
      setOpen(false);
      setFormData({
        name: "",
        phone: "",
        email: "",
        password: "",
        role: "employee",
        branchId: "main",
        loginType: "dashboard",
        permissions: defaultRolePermissions.employee
      });
    },
    onError: (err: any) => {
      toast({ title: "خطأ", description: err.message || "فشلت الإضافة", variant: "destructive" });
    }
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string, isActive: boolean }) => {
      await apiRequest("PATCH", `/api/admin/users/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "تم تحديث حالة الموظف" });
    }
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ id, password }: any) => {
      await apiRequest("PATCH", `/api/admin/users/${id}/reset-password`, { password });
    },
    onSuccess: () => {
      toast({ title: "تم إعادة تعيين كلمة المرور بنجاح" });
      setResetDialogOpen(false);
      setNewPassword("");
    }
  });

  if (isLoading) return <Loader2 className="animate-spin" />;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black uppercase tracking-tight">إدارة الموظفين</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditingUser(null); setOpen(true); }} className="rounded-none font-bold text-xs h-10 px-6">
              <Plus className="ml-2 h-4 w-4" /> إضافة موظف جديد
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl rounded-none overflow-y-auto max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="text-right">إضافة موظف جديد</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4" dir="rtl">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-right block">الاسم</Label>
                  <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="text-right" />
                </div>
                <div className="space-y-2">
                  <Label className="text-right block">رقم الهاتف</Label>
                  <Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="text-right" placeholder="5XXXXXXXX" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-right block">البريد الإلكتروني</Label>
                  <Input value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="text-right" />
                </div>
                <div className="space-y-2">
                  <Label className="text-right block">كلمة المرور</Label>
                  <Input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="text-right" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-right block">الدور الوظيفي</Label>
                  <Select value={formData.role} onValueChange={v => setFormData({...formData, role: v})}>
                    <SelectTrigger className="text-right"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">مدير (Admin)</SelectItem>
                      <SelectItem value="employee">موظف (Employee)</SelectItem>
                      <SelectItem value="support">دعم فني (Support)</SelectItem>
                      <SelectItem value="cashier">كاشير (Cashier)</SelectItem>
                      <SelectItem value="accountant">محاسب (Accountant)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-right block">نوع الدخول</Label>
                  <Select value={formData.loginType} onValueChange={(v: any) => setFormData({...formData, loginType: v})}>
                    <SelectTrigger className="text-right"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dashboard">لوحة التحكم</SelectItem>
                      <SelectItem value="pos">POS فقط</SelectItem>
                      <SelectItem value="both">الاثنين</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-right block">الفرع المرتبط</Label>
                <Select value={formData.branchId} onValueChange={v => setFormData({...formData, branchId: v})}>
                  <SelectTrigger className="text-right"><SelectValue placeholder="اختر الفرع" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="main">المركز الرئيسي</SelectItem>
                    {branches?.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3 pt-4 border-t border-black/5 text-right">
                <Label className="text-[10px] font-black uppercase tracking-widest text-black/40">الصلاحيات الممنوحة</Label>
                <div className="grid grid-cols-3 gap-2">
                  {employeePermissions.map(perm => (
                    <div key={perm} className="flex items-center gap-2 bg-secondary/10 p-2 border border-black/5">
                      <Switch 
                        checked={formData.permissions.includes(perm)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFormData(prev => ({ ...prev, permissions: [...prev.permissions, perm] }));
                          } else {
                            setFormData(prev => ({ ...prev, permissions: prev.permissions.filter(p => p !== perm) }));
                          }
                        }}
                      />
                      <span className="text-[9px] font-bold">
                        {perm === 'orders.view' ? 'عرض الطلبات' :
                         perm === 'orders.edit' ? 'تعديل الطلبات' :
                         perm === 'orders.refund' ? 'استرجاع الأموال' :
                         perm === 'products.view' ? 'عرض المنتجات' :
                         perm === 'products.edit' ? 'تعديل المنتجات' :
                         perm === 'customers.view' ? 'عرض العملاء' :
                         perm === 'wallet.adjust' ? 'تعديل المحفظة' :
                         perm === 'reports.view' ? 'عرض التقارير' :
                         perm === 'staff.manage' ? 'إدارة الموظفين' :
                         perm === 'pos.access' ? 'دخول POS' :
                         perm === 'settings.manage' ? 'إدارة الإعدادات' : perm}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <Button 
                className="w-full h-12 rounded-none font-black" 
                onClick={() => createEmployeeMutation.mutate(formData)}
                disabled={createEmployeeMutation.isPending}
              >
                {createEmployeeMutation.isPending ? <Loader2 className="animate-spin" /> : "إضافة الموظف للأنظمة"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {employees.map((emp: any) => (
          <Card key={emp.id} className="border-black/5 hover-elevate overflow-hidden">
            <CardHeader className="bg-secondary/20 pb-4">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg font-black">{emp.name}</CardTitle>
                  <p className="text-xs text-muted-foreground font-bold">{emp.role.toUpperCase()}</p>
                </div>
                <Badge variant={emp.isActive ? "default" : "destructive"}>
                  {emp.isActive ? "نشط" : "معطل"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-muted-foreground font-bold uppercase tracking-widest text-[10px]">الهاتف</p>
                  <p className="font-bold">{emp.phone}</p>
                </div>
                <div>
                  <p className="text-muted-foreground font-bold uppercase tracking-widest text-[10px]">الفرع</p>
                  <p className="font-bold">{emp.branchId || "المركز الرئيسي"}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground font-bold uppercase tracking-widest text-[10px]">الصلاحيات</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {emp.permissions?.slice(0, 5).map((p: string) => (
                      <Badge key={p} variant="outline" className="text-[8px] rounded-none px-1 h-4">{p.split('.')[1] || p}</Badge>
                    ))}
                    {emp.permissions?.length > 5 && <span className="text-[8px] font-bold">+{emp.permissions.length - 5}</span>}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t border-black/5">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1 text-[10px] font-black h-8"
                  onClick={() => {
                    toggleActiveMutation.mutate({ id: emp.id, isActive: !emp.isActive });
                  }}
                >
                  {emp.isActive ? "تعطيل" : "تفعيل"}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1 text-[10px] font-black h-8"
                  onClick={() => {
                    setEditingUser(emp);
                    setResetDialogOpen(true);
                  }}
                >
                  كلمة المرور
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="max-w-md rounded-none">
          <DialogHeader>
            <DialogTitle className="text-right">إعادة تعيين كلمة المرور</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4" dir="rtl">
            <div className="space-y-2">
              <Label className="text-right block">كلمة المرور الجديدة</Label>
              <Input 
                type="password" 
                value={newPassword} 
                onChange={(e) => setNewPassword(e.target.value)} 
                className="text-right"
              />
            </div>
            <Button 
              className="w-full h-12 rounded-none font-black"
              onClick={() => resetPasswordMutation.mutate({ id: editingUser.id, password: newPassword })}
              disabled={!newPassword || resetPasswordMutation.isPending}
            >
              {resetPasswordMutation.isPending ? <Loader2 className="animate-spin" /> : "حفظ"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const AdminBranches = () => {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [branchName, setBranchName] = useState("");
  const [branchLocation, setBranchLocation] = useState("");
  const [branchPhone, setBranchPhone] = useState("");

  const { data: branches, isLoading } = useQuery<any[]>({ queryKey: ["/api/branches"] });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; location: string; phone: string; isActive: boolean }) => {
      const res = await apiRequest("POST", "/api/admin/branches", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branches"] });
      toast({ title: "تم النجاح", description: "تم إضافة الفرع بنجاح" });
      setIsOpen(false);
      setBranchName(""); setBranchLocation(""); setBranchPhone("");
    },
    onError: () => toast({ title: "خطأ", description: "فشل إضافة الفرع", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/admin/branches/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/branches"] }); toast({ title: "تم الحذف", description: "تم حذف الفرع" }); },
    onError: () => toast({ title: "خطأ", description: "فشل حذف الفرع", variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/admin/branches/${id}`, { isActive });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/branches"] }),
  });

  if (isLoading) return <Loader2 className="animate-spin mx-auto mt-12" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black uppercase tracking-tight">إدارة الفروع</h2>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-branch" className="gap-2 rounded-none font-black uppercase text-xs">
              <Plus className="h-4 w-4" /> إضافة فرع
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[400px]" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-right font-black uppercase">فرع جديد</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase">اسم الفرع *</label>
                <Input data-testid="input-branch-name" value={branchName} onChange={e => setBranchName(e.target.value)} placeholder="مثلاً: فرع الرياض" className="rounded-none" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase">الموقع</label>
                <Input data-testid="input-branch-location" value={branchLocation} onChange={e => setBranchLocation(e.target.value)} placeholder="مثلاً: حي المروج، الرياض" className="rounded-none" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase">رقم الهاتف</label>
                <Input data-testid="input-branch-phone" value={branchPhone} onChange={e => setBranchPhone(e.target.value)} placeholder="05xxxxxxxx" className="rounded-none" />
              </div>
              <Button
                data-testid="button-submit-branch"
                className="w-full rounded-none font-black uppercase text-xs"
                disabled={!branchName.trim() || createMutation.isPending}
                onClick={() => createMutation.mutate({ name: branchName.trim(), location: branchLocation.trim(), phone: branchPhone.trim(), isActive: true })}
              >
                {createMutation.isPending ? <Loader2 className="animate-spin h-4 w-4" /> : "حفظ الفرع"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {(!branches || branches.length === 0) && (
        <div className="border border-dashed border-black/20 rounded-none p-12 text-center text-muted-foreground text-sm font-bold uppercase">
          لا يوجد فروع بعد — أضف فرعك الأول
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {branches?.map(branch => (
          <Card key={branch.id} className="rounded-none border-black/10">
            <CardHeader className="border-b border-black/5 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-black uppercase">{branch.name}</CardTitle>
                <Button
                  data-testid={`button-delete-branch-${branch.id}`}
                  variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => deleteMutation.mutate(branch.id)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-2">
              <p className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {branch.location || "لا يوجد موقع"}
              </p>
              <p className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
                <Phone className="h-3 w-3" /> {branch.phone || "لا يوجد رقم"}
              </p>
              <div className="pt-2 flex items-center justify-between">
                <span className={`px-2 py-0.5 text-[10px] font-bold uppercase ${branch.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {branch.isActive ? 'نشط' : 'مغلق'}
                </span>
                <Button
                  data-testid={`button-toggle-branch-${branch.id}`}
                  variant="outline" size="sm" className="rounded-none text-[10px] font-black uppercase h-7"
                  onClick={() => toggleMutation.mutate({ id: branch.id, isActive: !branch.isActive })}
                >
                  {branch.isActive ? 'إغلاق' : 'تفعيل'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

const AdminStaff = () => {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);

  const { data: users, isLoading: usersLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/users"],
  });

  const { data: branches } = useQuery<any[]>({
    queryKey: ["/api/branches"],
  });

  const staff = users?.filter((u: any) => u.role !== 'customer') || [];

  const form = useForm<InsertUser>({
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      password: "",
      role: "employee",
      permissions: [],
      branchId: "",
      loginType: "dashboard",
      isActive: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertUser) => {
      const res = await apiRequest("POST", "/api/admin/users", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "تم النجاح", description: "تم إضافة الموظف بنجاح" });
      setIsOpen(false);
      form.reset();
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "تم الحذف", description: "تم حذف حساب الموظف" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  if (usersLoading) return (
    <div className="flex items-center justify-center h-48">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground font-bold text-sm">جاري جلب بيانات الفريق...</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm"
      >
        <div className="space-y-1">
          <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl text-primary">
              <Shield className="w-6 h-6" />
            </div>
            إدارة الفريق
          </h1>
          <p className="text-muted-foreground font-medium pr-11 text-sm">إدارة الموظفين وتوزيع الصلاحيات على مختلف الفروع</p>
        </div>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="h-12 rounded-2xl px-6 gap-2 shadow-lg shadow-primary/20 font-black">
              <Plus className="h-5 w-5" />
              إضافة موظف جديد
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[650px] rounded-[2rem] p-8 border-none shadow-2xl bg-white max-h-[90vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black text-right mb-6">تسجيل موظف جديد</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="text-right">
                        <FormLabel className="font-black text-sm text-slate-500">الاسم الكامل</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="أدخل اسم الموظف" className="rounded-xl h-12 bg-slate-50 border-none px-4 font-bold" />
                        </FormControl>
                        <FormMessage className="font-bold" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem className="text-right">
                        <FormLabel className="font-black text-sm text-slate-500">رقم الهاتف</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="5XXXXXXXX" className="rounded-xl h-12 bg-slate-50 border-none px-4 font-bold text-left" dir="ltr" />
                        </FormControl>
                        <FormMessage className="font-bold" />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem className="text-right">
                        <FormLabel className="font-black text-sm text-slate-500">كلمة المرور</FormLabel>
                        <FormControl>
                          <Input {...field} type="password" placeholder="كلمة مرور قوية" className="rounded-xl h-12 bg-slate-50 border-none px-4 font-bold" />
                        </FormControl>
                        <FormMessage className="font-bold" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem className="text-right">
                        <FormLabel className="font-black text-sm text-slate-500">الدور الوظيفي</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="rounded-xl h-12 bg-slate-50 border-none font-bold">
                              <SelectValue placeholder="اختر الدور" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="rounded-2xl border-none shadow-xl">
                            <SelectItem value="admin">مدير (Admin)</SelectItem>
                            <SelectItem value="employee">موظف (Employee)</SelectItem>
                            <SelectItem value="cashier">كاشير (Cashier)</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="branchId"
                  render={({ field }) => (
                    <FormItem className="text-right">
                      <FormLabel className="font-black text-sm text-slate-500">الفرع</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="rounded-xl h-12 bg-slate-50 border-none font-bold">
                            <SelectValue placeholder="اختر الفرع" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="rounded-2xl border-none shadow-xl">
                          <SelectItem value="main">المركز الرئيسي</SelectItem>
                          {branches?.map((b: any) => (
                            <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary" />
                    <FormLabel className="font-black text-sm uppercase tracking-widest text-slate-700">تحديد الصلاحيات</FormLabel>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 bg-slate-50 p-5 rounded-2xl border border-slate-100">
                    {employeePermissions.map((permission) => (
                      <FormField
                        key={permission}
                        control={form.control}
                        name="permissions"
                        render={({ field }) => (
                          <FormItem key={permission} className="flex flex-row items-center space-x-2 space-y-0 space-x-reverse">
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(permission)}
                                onCheckedChange={(checked) => {
                                  return checked
                                    ? field.onChange([...(field.value || []), permission])
                                    : field.onChange(field.value?.filter((v: string) => v !== permission));
                                }}
                                className="rounded border-slate-300 w-4 h-4"
                              />
                            </FormControl>
                            <FormLabel className="font-black text-[10px] uppercase text-slate-500 cursor-pointer">{permission}</FormLabel>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                </div>

                <Button type="submit" className="w-full h-14 rounded-2xl text-base font-black shadow-lg mt-2" disabled={createMutation.isPending}>
                  {createMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : "إتمام تسجيل الموظف"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </motion.div>

      {/* Staff Cards Grid */}
      {staff.length === 0 ? (
        <div className="bg-white rounded-[2rem] border border-slate-100 p-12 text-center">
          <Users className="h-12 w-12 mx-auto mb-4 text-slate-300" />
          <p className="font-black text-slate-500 text-lg">لا يوجد موظفون بعد</p>
          <p className="text-muted-foreground text-sm mt-1">أضف أول موظف من خلال الزر أعلاه</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <AnimatePresence>
            {staff.map((member: any, idx: number) => (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Card className="border-none shadow-sm bg-white rounded-[2rem] overflow-hidden group hover:shadow-lg transition-all duration-300">
                  <div className="h-2 w-full bg-primary/10 group-hover:bg-primary transition-colors duration-500" />
                  <CardContent className="p-6 space-y-5">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-slate-50 text-primary flex items-center justify-center rounded-2xl font-black text-2xl shadow-inner group-hover:bg-primary group-hover:text-white transition-all duration-500">
                          {member.name?.charAt(0) || "م"}
                        </div>
                        <div className="text-right">
                          <p className="font-black text-lg text-slate-900 line-clamp-1">{member.name}</p>
                          <Badge variant="secondary" className="bg-slate-100 text-slate-500 rounded-lg px-3 py-0.5 text-[10px] font-black uppercase border-none mt-1">
                            {member.role === 'admin' ? 'مدير' : member.role === 'employee' ? 'موظف' : member.role === 'cashier' ? 'كاشير' : member.role}
                          </Badge>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all"
                        onClick={() => deleteMutation.mutate(member.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="space-y-3 bg-slate-50/80 p-4 rounded-2xl border border-slate-100">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-slate-600">
                          <div className="p-1.5 bg-white rounded-lg shadow-sm">
                            <Phone className="w-3.5 h-3.5 text-primary" />
                          </div>
                          <span className="text-sm font-black" dir="ltr">{member.phone || "—"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600">
                          <div className="p-1.5 bg-white rounded-lg shadow-sm">
                            <Building className="w-3.5 h-3.5 text-primary" />
                          </div>
                          <span className="text-sm font-black">{branches?.find((b: any) => b.id === member.branchId)?.name || "المركز الرئيسي"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-xl ${member.isActive !== false ? 'bg-emerald-50' : 'bg-red-50'}`}>
                          <CheckCircle2 className={`w-4 h-4 ${member.isActive !== false ? 'text-emerald-500' : 'text-red-400'}`} />
                        </div>
                        <span className="text-xs font-black text-slate-400">{member.isActive !== false ? 'حساب نشط' : 'موقوف'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-slate-50 rounded-xl">
                          <Shield className="w-4 h-4 text-slate-300" />
                        </div>
                        <span className="text-xs font-black text-slate-500">{member.permissions?.length || 0} صلاحيات</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

const AdminAuditLogs = () => {
  const { data: logs, isLoading } = useQuery<any[]>({ queryKey: ["/api/admin/audit-logs"] });
  if (isLoading) return <Loader2 className="animate-spin mx-auto" />;
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-black uppercase tracking-tight">سجل العمليات</h2>
      <div className="rounded-none border border-black/5 overflow-hidden bg-white shadow-sm">
        <div className="divide-y divide-black/5">
          {logs?.map(log => (
            <div key={log.id} className="p-4 text-xs font-bold">{log.details}</div>
          ))}
        </div>
      </div>
    </div>
  );
};


const AdminBranchInventory = () => {
  return (
    <Card className="border-2 border-dashed border-black/10">
      <CardContent className="p-12 text-center">
        <Building className="h-12 w-12 mx-auto mb-4 opacity-30" />
        <p className="font-bold uppercase tracking-widest text-sm">إدارة مخزون الفروع جاهزة للاستخدام</p>
        <p className="text-xs text-muted-foreground mt-2">يمكن إضافة الميزات المتقدمة لاحقاً</p>
      </CardContent>
    </Card>
  );
};

const StoreSettingsPanel = () => {
  const { toast } = useToast();
  const { data: settings, isLoading } = useQuery({
    queryKey: ["/api/store/settings"],
    queryFn: async () => { const r = await fetch("/api/store/settings"); return r.json(); },
  });

  const [bankName, setBankName] = useState("");
  const [bankAccountHolder, setBankAccountHolder] = useState("");
  const [bankIBAN, setBankIBAN] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankLogo, setBankLogo] = useState("");
  const [bankLogoUploading, setBankLogoUploading] = useState(false);
  const [methods, setMethods] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (settings) {
      setBankName(settings.bankName ?? "مصرف الراجحي");
      setBankAccountHolder(settings.bankAccountHolder ?? "رفيف العود");
      setBankIBAN(settings.bankIBAN ?? "SA6280000501608016226411");
      setBankAccountNumber(settings.bankAccountNumber ?? "");
      setBankLogo(settings.bankLogo ?? "");
      setMethods(settings.paymentMethods ?? {
        wallet: true, tap: true, stc_pay: true, apple_pay: true,
        bank_transfer: true, tamara: true, tabby: true,
      });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/store/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!r.ok) throw new Error("فشل الحفظ");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/store/settings"] });
      toast({ title: "تم الحفظ بنجاح", description: "تم تحديث إعدادات المتجر" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const handleSave = () => {
    saveMutation.mutate({ bankName, bankAccountHolder, bankIBAN, bankAccountNumber, bankLogo, paymentMethods: methods });
  };

  const methodLabels: Record<string, string> = {
    wallet: "رصيد المحفظة", tap: "بطاقة بنكية (Tap)", stc_pay: "STC Pay",
    apple_pay: "Apple Pay", bank_transfer: "تحويل بنكي", tamara: "Tamara تقسيط", tabby: "Tabby تقسيط",
  };

  if (isLoading) return <div className="flex items-center justify-center h-48"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-8 max-w-2xl" dir="rtl">
      {/* Bank Transfer Settings */}
      <Card className="border-black/5">
        <CardHeader className="border-b border-black/5 pb-6">
          <CardTitle className="flex items-center gap-3 text-lg font-black uppercase tracking-tight">
            <Landmark className="h-5 w-5 text-primary" />
            بيانات التحويل البنكي
          </CardTitle>
          <p className="text-xs text-muted-foreground font-bold">تظهر هذه البيانات للعميل عند اختيار التحويل البنكي في الدفع</p>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-black uppercase">اسم البنك</Label>
            <Input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="مصرف الراجحي" className="font-bold" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-black uppercase">اسم صاحب الحساب</Label>
            <Input value={bankAccountHolder} onChange={e => setBankAccountHolder(e.target.value)} placeholder="رفيف العود" className="font-bold" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-black uppercase">رقم الآيبان (IBAN)</Label>
            <Input value={bankIBAN} onChange={e => setBankIBAN(e.target.value)} placeholder="SA628000..." className="font-mono font-bold" dir="ltr" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-black uppercase">رقم الحساب (اختياري)</Label>
            <Input value={bankAccountNumber} onChange={e => setBankAccountNumber(e.target.value)} placeholder="501000..." className="font-mono font-bold" dir="ltr" />
          </div>
          <div className="space-y-2 border-t border-black/5 pt-4">
            <Label className="text-xs font-black uppercase">شعار البنك (Logo)</Label>
            <p className="text-[10px] text-muted-foreground">يظهر في صفحة الدفع بجانب بيانات الحساب البنكي. إذا تركته فارغاً يتم عرض شعار الراجحي تلقائياً</p>
            <div className="flex items-center gap-3">
              {bankLogo && (
                <div className="border border-black/10 rounded p-2 bg-white">
                  <img src={bankLogo} alt="شعار البنك" className="h-12 object-contain" />
                </div>
              )}
              <div className="flex-1">
                <Input
                  type="file"
                  accept="image/*"
                  disabled={bankLogoUploading}
                  className="h-10 text-xs"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setBankLogoUploading(true);
                    try {
                      const fd = new FormData();
                      fd.append("file", file);
                      const r = await fetch("/api/upload", { method: "POST", body: fd, credentials: "include" });
                      const d = await r.json();
                      if (d.url) { setBankLogo(d.url); toast({ title: "تم رفع الشعار" }); }
                    } catch { toast({ title: "فشل الرفع", variant: "destructive" }); }
                    finally { setBankLogoUploading(false); }
                  }}
                />
                {bankLogoUploading && <p className="text-[10px] text-primary font-bold mt-1">جاري الرفع...</p>}
              </div>
              {bankLogo && (
                <button onClick={() => setBankLogo("")} className="text-[10px] text-red-500 font-bold hover:underline">حذف</button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Methods Toggle */}
      <Card className="border-black/5">
        <CardHeader className="border-b border-black/5 pb-6">
          <CardTitle className="flex items-center gap-3 text-lg font-black uppercase tracking-tight">
            <CreditCard className="h-5 w-5 text-primary" />
            طرق الدفع المتاحة
          </CardTitle>
          <p className="text-xs text-muted-foreground font-bold">اختر طرق الدفع التي تريد إظهارها في صفحة الدفع</p>
        </CardHeader>
        <CardContent className="pt-6 space-y-3">
          {Object.entries(methodLabels).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between p-4 border border-black/5 bg-secondary/10 hover:bg-secondary/20 transition-colors">
              <Label className="font-black text-sm cursor-pointer">{label}</Label>
              <Switch
                checked={methods[key] !== false}
                onCheckedChange={v => setMethods(prev => ({ ...prev, [key]: v }))}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saveMutation.isPending} className="w-full h-12 font-black uppercase tracking-widest text-sm">
        {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Save className="h-4 w-4 ml-2" />}
        حفظ الإعدادات
      </Button>
    </div>
  );
};

const AdminSidebar = ({ activeTab, onTabChange, pendingOrders }: { activeTab: string, onTabChange: (tab: string) => void, pendingOrders?: number }) => {
  const { user, logout: handleLogout } = useAuth();
  const [, setLocation] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const iv = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  const logout = () => {
    handleLogout(undefined, { onSuccess: () => setLocation("/") });
  };

  const groups = [
    {
      label: "الرئيسية",
      items: [
        { id: "overview", label: "نظرة عامة", icon: BarChart3 },
        { id: "orders", label: "الطلبات", icon: ShoppingCart, badge: pendingOrders },
      ]
    },
    {
      label: "المخزون",
      items: [
        { id: "products", label: "المنتجات", icon: PackageCheck },
        { id: "categories", label: "الفئات / الأقسام", icon: LayoutGrid },
        { id: "inventory", label: "جرد الفروع", icon: Package },
      ]
    },
    {
      label: "العمليات",
      items: [
        { id: "shifts", label: "إدارة الورديات", icon: Clock },
        { id: "staff", label: "الموظفون", icon: Users },
        { id: "branches", label: "الفروع", icon: Building },
        { id: "shipping", label: "شركات الشحن", icon: Truck },
      ]
    },
    {
      label: "العملاء",
      items: [
        { id: "customers", label: "قاعدة العملاء", icon: UserIcon },
        { id: "vendors", label: "البائعون", icon: Store },
        { id: "coupons", label: "أكواد الخصم", icon: Tag },
        { id: "broadcast", label: "إشعارات جماعية", icon: Megaphone },
      ]
    },
    {
      label: "التسويق",
      items: [
        { id: "marketing", label: "الحملات التسويقية", icon: Activity },
        { id: "flash-deals", label: "عروض فلاش", icon: Zap },
        { id: "returns", label: "المرتجعات", icon: RotateCcw },
      ]
    },
    {
      label: "النظام",
      items: [
        { id: "email", label: "البريد الإلكتروني", icon: Send },
        { id: "logs", label: "سجل العمليات", icon: History },
        { id: "settings", label: "إعدادات المتجر", icon: Settings2 },
      ]
    },
  ];

  const externalLinks = [
    { label: "نقطة البيع", icon: Monitor, url: "/pos" },
    { label: "تقارير النقد", icon: DollarSign, url: "/cash-report" },
    { label: "المتجر", icon: Globe, url: "/" },
  ];

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="relative z-30 flex flex-col h-full bg-white border-l border-slate-200 shadow-sm overflow-hidden shrink-0"
      dir="rtl"
    >
      {/* Header / Logo */}
      <div className="relative z-10 flex items-center gap-3 px-4 py-4 border-b border-slate-200">
        <img src={logoDarkImg} alt="رفيف العود" className="w-9 h-9 rounded-xl object-cover shrink-0" />
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="font-black text-sm text-[#1a2744] tracking-tight whitespace-nowrap">رفيف العود</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <PulseRing color="bg-[#c9a96e]" />
              <span className="text-[9px] text-[#c9a96e] font-bold uppercase tracking-widest">لوحة التحكم</span>
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(c => !c)}
          className={`${collapsed ? "mx-auto" : "mr-auto"} p-1.5 rounded-lg text-slate-400 hover:text-[#c9a96e] hover:bg-slate-50 transition-all`}
        >
          <Menu className="w-4 h-4" />
        </button>
      </div>

      {/* User Info */}
      {!collapsed && (
        <div className="relative z-10 mx-3 mt-3 p-3 rounded-xl bg-[#faf8f5] border border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#c9a96e] to-[#b8944f] flex items-center justify-center text-xs font-black text-white shrink-0">
              {user?.name?.charAt(0) || "A"}
            </div>
            <div className="overflow-hidden">
              <p className="font-bold text-xs text-[#1a2744] truncate">{user?.name || "المدير"}</p>
              <p className="text-[9px] text-slate-400 tabular-nums">{time.toLocaleTimeString("ar-SA")}</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="relative z-10 flex-1 overflow-y-auto py-3 px-2 space-y-0.5 no-scrollbar">
        {groups.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-3 pt-3 pb-1.5">{group.label}</p>
            )}
            {group.items.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  title={collapsed ? item.label : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all relative group
                    ${isActive
                      ? "bg-[#c9a96e]/10 text-[#c9a96e] border border-[#c9a96e]/20"
                      : "text-slate-500 hover:text-[#1a2744] hover:bg-slate-50"
                    }`}
                >
                  {isActive && <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[#c9a96e] rounded-l-full" />}
                  <item.icon className={`w-4 h-4 shrink-0 ${isActive ? "text-[#c9a96e]" : "group-hover:text-slate-600"}`} />
                  {!collapsed && <span className="text-xs font-bold truncate">{item.label}</span>}
                  {!collapsed && (item as any).badge > 0 && (
                    <span className="mr-auto px-1.5 py-0.5 rounded-full bg-amber-400 text-black text-[9px] font-black animate-pulse">
                      {(item as any).badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}

        {/* External links */}
        {!collapsed && (
          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-3 pt-3 pb-1.5">روابط سريعة</p>
          </div>
        )}
        {externalLinks.map((link) => (
          <Link key={link.url} href={link.url}>
            <div
              title={collapsed ? link.label : undefined}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all cursor-pointer group"
            >
              <link.icon className="w-4 h-4 shrink-0 group-hover:text-slate-600" />
              {!collapsed && <span className="text-xs font-bold">{link.label}</span>}
              {!collapsed && <ChevronRight className="w-3 h-3 mr-auto opacity-30 group-hover:opacity-70" />}
            </div>
          </Link>
        ))}
      </nav>

      {/* Logout */}
      <div className="relative z-10 p-3 border-t border-slate-100">
        <button
          onClick={logout}
          title={collapsed ? "تسجيل الخروج" : undefined}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-400 hover:text-red-600 hover:bg-red-50 transition-all"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && <span className="text-xs font-bold">تسجيل الخروج</span>}
        </button>
      </div>
    </motion.aside>
  );
};

const pageTitles: Record<string, string> = {
  overview:     "نظرة عامة",
  products:     "إدارة المنتجات",
  categories:   "الفئات والأقسام",
  inventory:    "جرد الفروع",
  shifts:       "إدارة الورديات",
  orders:       "الطلبات",
  staff:        "إدارة الطاقم",
  branches:     "إدارة الفروع",
  customers:    "قاعدة العملاء",
  vendors:      "البائعون",
  coupons:      "أكواد الخصم",
  broadcast:    "إشعارات جماعية",
  shipping:     "شركات الشحن",
  marketing:    "الحملات التسويقية",
  "flash-deals": "عروض فلاش",
  returns:      "المرتجعات والاسترداد",
  email:        "البريد الإلكتروني",
  logs:         "سجل العمليات",
  settings:     "إعدادات المتجر",
};

export default function Admin() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("overview");
  const [time, setTime] = useState(new Date());

  const { data: allOrders } = useQuery({
    queryKey: ["/api/orders"],
    queryFn: async () => { const r = await fetch("/api/orders"); return r.ok ? r.json() : []; },
    enabled: !!user && ['admin', 'assistant_manager', 'tech_support', 'accountant', 'legal_consultant'].includes(user.role),
    refetchInterval: 30000,
  });

  const pendingCount = (allOrders || []).filter((o: any) => o.status === "pending_payment").length;

  useEffect(() => {
    const iv = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  const adminRoles = ['admin', 'assistant_manager', 'tech_support', 'accountant', 'legal_consultant'];
  const isStaff = user && adminRoles.includes(user.role);

  useEffect(() => {
    if (!authLoading && !isStaff) {
      setLocation("/");
    }
  }, [authLoading, isStaff, setLocation]);

  if (authLoading) return (
    <div className="flex h-screen items-center justify-center bg-[#faf8f5]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-2 border-slate-200 border-t-[#c9a96e] rounded-full animate-spin" />
        <p className="text-slate-400 text-xs tracking-widest uppercase">جاري التحميل</p>
      </div>
    </div>
  );
  if (!isStaff) return (
    <div className="flex h-screen items-center justify-center bg-[#faf8f5]">
      <div className="w-12 h-12 border-2 border-slate-200 border-t-[#c9a96e] rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="flex h-screen w-full bg-[#faf8f5] text-[#1a2744] overflow-hidden" dir="rtl">
      {/* Sidebar */}
      <AdminSidebar activeTab={activeTab} onTabChange={setActiveTab} pendingOrders={pendingCount} />

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <header className="h-14 bg-white/90 backdrop-blur-xl border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-sm font-black text-[#1a2744] tracking-tight">{pageTitles[activeTab] || "لوحة التحكم"}</h1>
              <p className="text-[9px] text-slate-400 tabular-nums">{time.toLocaleDateString("ar-SA", { weekday: "long", month: "long", day: "numeric" })}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {pendingCount > 0 && (
              <button
                onClick={() => setActiveTab("orders")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-black animate-pulse"
              >
                <Bell className="w-3 h-3" />
                {pendingCount} طلب بانتظار مراجعة الدفع
              </button>
            )}
            <button
              onClick={() => queryClient.invalidateQueries()}
              className="p-2 rounded-xl text-slate-400 hover:text-[#c9a96e] hover:bg-slate-50 transition-all"
              title="تحديث البيانات"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <Link href="/">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 hover:text-[#c9a96e] hover:bg-[#c9a96e]/5 transition-all cursor-pointer text-xs font-bold">
                <Globe className="w-3.5 h-3.5" />
                المتجر
              </div>
            </Link>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto no-scrollbar">
          <div className="p-6 space-y-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                {activeTab === "overview"    && <OverviewPanel />}
                {activeTab === "products"   && <ProductsTable />}
                {activeTab === "categories" && <CategoriesTable />}
                {activeTab === "inventory"  && <AdminBranchInventory />}
                {activeTab === "orders"    && <OrdersManagement />}
                {activeTab === "staff"     && <AdminStaff />}
                {activeTab === "branches"  && <AdminBranches />}
                {activeTab === "shipping"  && <ShippingCompaniesPanel />}
                {activeTab === "shifts"    && <ShiftsManagement />}
                {activeTab === "customers" && <CustomersTable />}
                {activeTab === "vendors"   && <VendorsPanel />}
                {activeTab === "coupons"   && <CouponsTable />}
                {activeTab === "marketing" && <MarketingManagement />}
                {activeTab === "broadcast" && <BroadcastPanel />}
                {activeTab === "flash-deals" && <FlashDealsPanel />}
                {activeTab === "returns"   && <AdminReturnsPanel />}
                {activeTab === "email"     && <AdminEmail />}
                {activeTab === "logs"      && <AdminAuditLogs />}
                {activeTab === "settings"  && <StoreSettingsPanel />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}

// ─── Shipping Companies Panel ─────────────────────────────────────────────────
const VendorsPanel = () => {
  const { toast } = useToast();
  const [filter, setFilter] = useState<"all" | "pending" | "active" | "suspended">("all");
  const [commissionEdit, setCommissionEdit] = useState<{ id: string; rate: number } | null>(null);

  const { data: vendors = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/vendors"],
  });

  const updateVendorMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest("PATCH", `/api/admin/vendors/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/vendors"] });
      setCommissionEdit(null);
      toast({ title: "تم تحديث البائع" });
    },
    onError: (err: any) => toast({ title: "خطأ", description: err.message, variant: "destructive" }),
  });

  const deleteVendorMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/vendors/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/vendors"] });
      toast({ title: "تم حذف البائع" });
    },
    onError: (err: any) => toast({ title: "خطأ", description: err.message, variant: "destructive" }),
  });

  const filtered = vendors.filter((v: any) => filter === "all" || v.status === filter);
  const pendingCount = vendors.filter((v: any) => v.status === "pending").length;

  return (
    <div className="p-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-black flex items-center gap-2">
            <Store className="h-5 w-5" /> إدارة البائعين
          </h2>
          <p className="text-sm text-muted-foreground mt-1">{vendors.length} بائع إجمالي</p>
        </div>
        {pendingCount > 0 && (
          <div className="bg-yellow-100 text-yellow-800 font-black text-sm px-4 py-2 rounded-full flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {pendingCount} طلب جديد بانتظار الموافقة
          </div>
        )}
      </div>

      {/* Filter buttons */}
      <div className="flex gap-2 mb-6">
        {[
          { key: "all", label: "الكل" },
          { key: "pending", label: "في الانتظار" },
          { key: "active", label: "مفعّل" },
          { key: "suspended", label: "موقوف" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key as any)}
            className={`px-4 py-1.5 text-xs font-black uppercase tracking-widest border transition-all ${
              filter === f.key ? "bg-foreground text-background border-foreground" : "border-border hover:border-foreground"
            }`}
          >
            {f.label}
            {f.key === "pending" && pendingCount > 0 && (
              <span className="ml-2 bg-yellow-500 text-white rounded-full w-5 h-5 inline-flex items-center justify-center text-[10px]">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Store className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="font-bold">لا يوجد بائعون في هذه الفئة</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((vendor: any) => (
            <div key={vendor.id} className="border-2 border-border hover:border-foreground/30 transition-all p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                    {vendor.logo ? (
                      <img src={vendor.logo} alt={vendor.storeName} className="w-full h-full object-cover" />
                    ) : (
                      <Store className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-black text-base">{vendor.storeName}</h3>
                      {vendor.storeNameEn && <span className="text-muted-foreground text-sm">/ {vendor.storeNameEn}</span>}
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-none ${
                        vendor.status === "active" ? "bg-green-100 text-green-700" :
                        vendor.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                        "bg-red-100 text-red-700"
                      }`}>
                        {vendor.status === "active" ? "مفعّل" : vendor.status === "pending" ? "في الانتظار" : "موقوف"}
                      </span>
                    </div>
                    {vendor.description && <p className="text-sm text-muted-foreground line-clamp-1 mb-2">{vendor.description}</p>}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {vendor.phone && <span>📱 {vendor.phone}</span>}
                      {vendor.email && <span>✉️ {vendor.email}</span>}
                      <span>📅 {new Date(vendor.createdAt).toLocaleDateString("ar-SA")}</span>
                    </div>
                    {/* Commission */}
                    <div className="flex items-center gap-3 mt-3">
                      <span className="text-xs font-bold">العمولة:</span>
                      {commissionEdit?.id === vendor.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            max="50"
                            value={commissionEdit!.rate}
                            onChange={(e) => setCommissionEdit({ id: vendor.id, rate: Number(e.target.value) })}
                            className="w-16 h-7 text-xs border px-2 font-bold"
                          />
                          <span className="text-xs">%</span>
                          <button
                            onClick={() => updateVendorMutation.mutate({ id: vendor.id, data: { commissionRate: commissionEdit!.rate } })}
                            className="text-xs font-black bg-foreground text-background px-2 py-1"
                          >
                            حفظ
                          </button>
                          <button onClick={() => setCommissionEdit(null)} className="text-xs text-muted-foreground">إلغاء</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setCommissionEdit({ id: vendor.id, rate: vendor.commissionRate })}
                          className="flex items-center gap-1 text-xs font-black text-primary hover:underline"
                        >
                          {vendor.commissionRate}% <Edit className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                {/* Actions */}
                <div className="flex flex-col gap-2 flex-shrink-0">
                  {vendor.status === "pending" && (
                    <button
                      onClick={() => updateVendorMutation.mutate({ id: vendor.id, data: { status: "active" } })}
                      disabled={updateVendorMutation.isPending}
                      className="text-xs font-black bg-green-600 text-white px-3 py-1.5 hover:bg-green-700 transition-colors flex items-center gap-1"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> قبول
                    </button>
                  )}
                  {vendor.status === "active" && (
                    <button
                      onClick={() => updateVendorMutation.mutate({ id: vendor.id, data: { status: "suspended" } })}
                      disabled={updateVendorMutation.isPending}
                      className="text-xs font-black bg-orange-500 text-white px-3 py-1.5 hover:bg-orange-600 transition-colors flex items-center gap-1"
                    >
                      <XCircle className="h-3.5 w-3.5" /> تعليق
                    </button>
                  )}
                  {vendor.status === "suspended" && (
                    <button
                      onClick={() => updateVendorMutation.mutate({ id: vendor.id, data: { status: "active" } })}
                      disabled={updateVendorMutation.isPending}
                      className="text-xs font-black bg-green-600 text-white px-3 py-1.5 hover:bg-green-700 transition-colors flex items-center gap-1"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> تفعيل
                    </button>
                  )}
                  {vendor.status === "pending" && (
                    <button
                      onClick={() => updateVendorMutation.mutate({ id: vendor.id, data: { status: "suspended" } })}
                      disabled={updateVendorMutation.isPending}
                      className="text-xs font-black bg-red-500 text-white px-3 py-1.5 hover:bg-red-600 transition-colors flex items-center gap-1"
                    >
                      <XCircle className="h-3.5 w-3.5" /> رفض
                    </button>
                  )}
                  <button
                    onClick={() => { if (confirm(`حذف متجر "${vendor.storeName}"؟`)) deleteVendorMutation.mutate(vendor.id); }}
                    disabled={deleteVendorMutation.isPending}
                    className="text-xs font-black border border-red-300 text-red-600 px-3 py-1.5 hover:bg-red-50 transition-colors flex items-center gap-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> حذف
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ShippingCompaniesPanel = () => {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ name: "", nameEn: "", logo: "", trackingUrl: "", isActive: true });

  const { data: companies = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/shipping-companies"] });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = editing
        ? await apiRequest("PATCH", `/api/shipping-companies/${editing.id}`, data)
        : await apiRequest("POST", "/api/shipping-companies", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shipping-companies"] });
      toast({ title: editing ? "تم التحديث" : "تمت الإضافة" });
      setShowForm(false);
      setEditing(null);
      setForm({ name: "", nameEn: "", logo: "", trackingUrl: "", isActive: true });
    },
    onError: () => toast({ title: "حدث خطأ", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/shipping-companies/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shipping-companies"] });
      toast({ title: "تم الحذف" });
    },
    onError: () => toast({ title: "حدث خطأ", variant: "destructive" }),
  });

  const openEdit = (c: any) => {
    setEditing(c);
    setForm({ name: c.name, nameEn: c.nameEn || "", logo: c.logo || "", trackingUrl: c.trackingUrl || "", isActive: c.isActive !== false });
    setShowForm(true);
  };

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", nameEn: "", logo: "", trackingUrl: "", isActive: true });
    setShowForm(true);
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-900">شركات الشحن</h2>
          <p className="text-xs text-slate-400 mt-0.5">إدارة مزودي خدمة التوصيل</p>
        </div>
        <Button onClick={openNew} className="rounded-none font-black text-xs gap-2" size="sm" data-testid="button-add-shipping">
          <Plus className="w-3.5 h-3.5" />
          إضافة شركة
        </Button>
      </div>

      {showForm && (
        <Card className="border-primary/20 rounded-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-black">{editing ? "تعديل شركة الشحن" : "إضافة شركة جديدة"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">الاسم بالعربي *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="أرامكس"
                  className="w-full border border-slate-200 rounded-none px-3 py-2 text-sm bg-white focus:outline-none focus:border-primary"
                  data-testid="input-shipping-name"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">الاسم بالإنجليزي</label>
                <input
                  value={form.nameEn}
                  onChange={e => setForm(f => ({ ...f, nameEn: e.target.value }))}
                  placeholder="Aramex"
                  className="w-full border border-slate-200 rounded-none px-3 py-2 text-sm bg-white focus:outline-none focus:border-primary"
                  data-testid="input-shipping-name-en"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">رابط الشعار</label>
                <input
                  value={form.logo}
                  onChange={e => setForm(f => ({ ...f, logo: e.target.value }))}
                  placeholder="https://..."
                  className="w-full border border-slate-200 rounded-none px-3 py-2 text-sm bg-white focus:outline-none focus:border-primary"
                  data-testid="input-shipping-logo"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">رابط التتبع</label>
                <input
                  value={form.trackingUrl}
                  onChange={e => setForm(f => ({ ...f, trackingUrl: e.target.value }))}
                  placeholder="https://track.aramex.com/?{tracking}"
                  className="w-full border border-slate-200 rounded-none px-3 py-2 text-sm bg-white focus:outline-none focus:border-primary"
                  data-testid="input-shipping-tracking"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}
                className={`w-9 h-5 rounded-full transition-colors ${form.isActive ? "bg-emerald-500" : "bg-slate-300"}`}
                data-testid="toggle-shipping-active"
              >
                <span className={`block w-4 h-4 bg-white rounded-full shadow transition-transform mx-0.5 ${form.isActive ? "translate-x-4" : "translate-x-0"}`} />
              </button>
              <span className="text-xs text-slate-600">{form.isActive ? "مفعّل" : "معطّل"}</span>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Button
                size="sm"
                className="rounded-none font-black text-xs"
                onClick={() => saveMutation.mutate(form)}
                disabled={!form.name.trim() || saveMutation.isPending}
                data-testid="button-save-shipping"
              >
                {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                حفظ
              </Button>
              <Button size="sm" variant="ghost" className="rounded-none text-xs" onClick={() => setShowForm(false)}>إلغاء</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : companies.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Truck className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-bold">لا توجد شركات شحن بعد</p>
          <p className="text-xs mt-1">أضف أول شركة شحن لتبدأ</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {companies.map((c: any) => (
            <Card key={c.id} className="border-slate-200 rounded-none" data-testid={`card-shipping-${c.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {c.logo ? (
                      <img src={c.logo} alt={c.name} className="w-10 h-10 object-contain rounded-lg border border-slate-100 bg-white p-1 shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                        <Truck className="w-5 h-5 text-slate-400" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-black text-sm text-slate-900 truncate">{c.name}</p>
                      {c.nameEn && <p className="text-xs text-slate-400 truncate">{c.nameEn}</p>}
                      <Badge className={`rounded-none text-[9px] font-bold mt-1 ${c.isActive !== false ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
                        {c.isActive !== false ? "مفعّل" : "معطّل"}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(c)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/5 transition-all"
                      data-testid={`button-edit-shipping-${c.id}`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(c.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                      data-testid={`button-delete-shipping-${c.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {c.trackingUrl && (
                  <p className="text-[10px] text-slate-400 mt-2 truncate font-mono">
                    {c.trackingUrl}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Broadcast Panel ──────────────────────────────────────────────────────────
const BroadcastPanel = () => {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState<"info" | "success" | "warning" | "error">("info");
  const [link, setLink] = useState("/");
  const [targetUserId, setTargetUserId] = useState("");
  const [mode, setMode] = useState<"all" | "user">("all");

  const { data: customers } = useQuery<any[]>({ queryKey: ["/api/admin/users"] });

  const broadcastMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/broadcast", {
        title, body, type, link,
        ...(mode === "user" && targetUserId ? { targetUserId } : {}),
      });
      if (!res.ok) throw new Error("فشل الإرسال");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: `✅ تم الإرسال لـ ${data.sent} مستخدم` });
      setTitle(""); setBody(""); setLink("/"); setTargetUserId("");
    },
    onError: () => toast({ title: "❌ فشل إرسال الإشعار", variant: "destructive" }),
  });

  const typeEmoji: Record<string, string> = {
    info: "ℹ️ معلومات", success: "✅ نجاح", warning: "⚠️ تحذير", error: "❌ خطأ"
  };

  const presets = [
    { label: "🛍 عرض جديد!", t: "🛍 عرض حصري لك!", b: "اكتشف أحدث العروض في متجرنا الآن — لفترة محدودة!" },
    { label: "🎁 هدية مجانية", t: "🎁 هدية مجانية مع كل طلب!", b: "أضف أي منتج لسلتك واحصل على هدية مجانية اليوم فقط." },
    { label: "🚀 شحن مجاني", t: "🚀 شحن مجاني الآن!", b: "جميع الطلبات اليوم تصلك مجاناً — لا رسوم شحن!" },
    { label: "⭐ شكراً لك", t: "⭐ شكراً لثقتك بنا", b: "نقدر تعاملك معنا ونتمنى أن يكون تجربتك رائعة دائماً." },
  ];

  return (
    <div className="space-y-6 max-w-2xl" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shrink-0">
          <Megaphone className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-black uppercase tracking-tight">بث رسائل للعملاء</h2>
          <p className="text-xs text-black/40 font-bold">أرسل إشعارات فورية لجميع عملائك أو لعميل محدد</p>
        </div>
      </div>

      {/* Quick presets */}
      <div className="space-y-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-black/40">رسائل جاهزة</p>
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <Button
              key={p.label}
              variant="outline"
              size="sm"
              className="rounded-none text-xs font-bold h-8 px-3"
              onClick={() => { setTitle(p.t); setBody(p.b); }}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Mode selector */}
      <div className="flex gap-2">
        <Button
          variant={mode === "all" ? "default" : "outline"}
          size="sm"
          className="rounded-none text-xs font-black gap-2"
          onClick={() => setMode("all")}
        >
          <Users className="h-3.5 w-3.5" />
          جميع العملاء
        </Button>
        <Button
          variant={mode === "user" ? "default" : "outline"}
          size="sm"
          className="rounded-none text-xs font-black gap-2"
          onClick={() => setMode("user")}
        >
          <UserIcon className="h-3.5 w-3.5" />
          عميل محدد
        </Button>
      </div>

      {/* Target user (when mode=user) */}
      {mode === "user" && (
        <div className="space-y-1">
          <Label className="text-[10px] font-black uppercase tracking-widest">اختر العميل</Label>
          <Select value={targetUserId} onValueChange={setTargetUserId}>
            <SelectTrigger className="rounded-none font-bold text-xs">
              <SelectValue placeholder="اختر عميلاً..." />
            </SelectTrigger>
            <SelectContent className="rounded-none">
              {(customers || []).filter((c: any) => c.role !== "admin").map((c: any) => (
                <SelectItem key={c.id} value={c.id} className="font-bold text-xs">
                  {c.name || c.email || c.phone}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-4 border border-black/8 p-5">
        <div className="space-y-1">
          <Label className="text-[10px] font-black uppercase tracking-widest">عنوان الإشعار *</Label>
          <Input
            placeholder="مثال: 🎉 عرض خاص لك اليوم!"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded-none font-bold"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] font-black uppercase tracking-widest">نص الرسالة *</Label>
          <Textarea
            placeholder="اكتب رسالتك للعملاء هنا..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="rounded-none font-bold resize-none"
            rows={3}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-[10px] font-black uppercase tracking-widest">نوع الإشعار</Label>
            <Select value={type} onValueChange={(v: any) => setType(v)}>
              <SelectTrigger className="rounded-none font-bold text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-none">
                {Object.entries(typeEmoji).map(([k, v]) => (
                  <SelectItem key={k} value={k} className="font-bold text-xs">{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] font-black uppercase tracking-widest">الرابط (اختياري)</Label>
            <Input
              placeholder="/products"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              className="rounded-none font-bold text-xs"
            />
          </div>
        </div>
      </div>

      {/* Preview */}
      {(title || body) && (
        <div className="border border-black/10 p-4 bg-black/[0.02] space-y-2">
          <p className="text-[9px] font-black uppercase tracking-widest text-black/30">معاينة الإشعار</p>
          <div className="flex items-start gap-3 bg-white p-3 border border-black/8 shadow-sm">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center shrink-0 text-sm">
              {type === "success" ? "✅" : type === "warning" ? "⚠️" : type === "error" ? "❌" : "ℹ️"}
            </div>
            <div>
              <p className="font-black text-sm">{title || "عنوان الإشعار"}</p>
              <p className="text-xs text-black/50 font-bold">{body || "نص الرسالة"}</p>
            </div>
          </div>
        </div>
      )}

      <Button
        className="w-full rounded-none h-12 font-black uppercase tracking-widest text-xs gap-2"
        disabled={!title.trim() || !body.trim() || broadcastMutation.isPending || (mode === "user" && !targetUserId)}
        onClick={() => broadcastMutation.mutate()}
      >
        {broadcastMutation.isPending ? (
          <><Loader2 className="h-4 w-4 animate-spin" />جاري الإرسال...</>
        ) : (
          <><Send className="h-4 w-4" />{mode === "all" ? "إرسال لجميع العملاء" : "إرسال للعميل المحدد"}</>
        )}
      </Button>
    </div>
  );
};

const ShiftsManagement = () => {
  const [, setLocation] = useLocation();
  const { data: shifts, isLoading } = useQuery<any[]>({ 
    queryKey: ["/api/cash-shifts"] 
  });

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>;

  const activeShift = shifts?.find(s => s.status === "open");

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-black uppercase">إدارة الورديات اليومية</h3>
        <Button onClick={() => setLocation("/cash-drawer")} className="gap-2">
          <Clock className="h-4 w-4" />
          فتح صندوق النقد
        </Button>
      </div>
      
      {activeShift && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <p className="text-sm font-bold text-green-700">وردية مفتوحة حالياً: {activeShift.openingBalance?.toFixed(2)} ر.س</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4">
        {shifts?.filter(s => s.status === "closed").map((shift) => (
          <Card key={shift.id} className="rounded-none border-black/5">
            <CardContent className="p-4 flex justify-between items-center">
              <div className="flex items-center gap-4 text-right">
                <div className="w-10 h-10 bg-black/5 flex items-center justify-center">
                  <Clock className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-black text-xs uppercase">وردية #{shift.id.slice(-4).toUpperCase()}</p>
                  <p className="text-[10px] font-bold text-muted-foreground">
                    {new Date(shift.closedAt).toLocaleString('ar-SA')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-8">
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase text-black/40">الرصيد الافتتاحي</p>
                  <p className="text-sm font-bold">{shift.openingBalance?.toFixed(2)} ر.س</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase text-black/40">الفرق</p>
                  <p className={`text-sm font-bold ${(shift.difference || 0) === 0 ? "text-green-600" : (shift.difference || 0) > 0 ? "text-blue-600" : "text-red-600"}`}>
                    {(shift.difference || 0).toFixed(2)} ر.س
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {(!shifts || shifts.filter(s => s.status === "closed").length === 0) && !activeShift && (
          <div className="text-center py-12 text-muted-foreground text-xs font-bold uppercase tracking-widest">
            لا توجد ورديات مسجلة
          </div>
        )}
      </div>
    </div>
  );
};

const MarketingManagement = () => {
  const { toast } = useToast();
  const { data: marketing, isLoading } = useQuery<any[]>({ queryKey: ["/api/admin/marketing"] });
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    image: "",
    link: "",
    type: "banner" as const,
    isActive: true
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formDataToSend = new FormData();
    formDataToSend.append("file", file);
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formDataToSend,
        credentials: "include"
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setFormData(prev => ({ ...prev, image: data.url }));
      toast({ title: "تم رفع الصورة" });
    } catch (err) {
      console.error("Upload error:", err);
      toast({ variant: "destructive", title: "فشل الرفع" });
    }
  };

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!data.title || !data.image) {
        throw new Error("العنوان والصورة مطلوبة");
      }
      await apiRequest("POST", "/api/admin/marketing", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/marketing"] });
      toast({ title: "تمت إضافة العنصر التسويقي بنجاح" });
      setFormData({ title: "", image: "", link: "", type: "banner", isActive: true });
      setOpen(false);
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: err.message || "فشل حفظ العنصر" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/marketing/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/marketing"] });
      toast({ title: "تم حذف العنصر بنجاح" });
    }
  });

  if (isLoading) return <Loader2 className="animate-spin mx-auto" />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black uppercase tracking-tight">إدارة التسويق</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-none font-bold text-xs h-10 px-6">
              <Plus className="ml-2 h-4 w-4" /> إضافة بانر / بوب أب
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md rounded-none">
            <DialogHeader>
              <DialogTitle className="text-right">إضافة عنصر تسويقي</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4" dir="rtl">
              <div className="space-y-2">
                <Label className="text-right block">العنوان</Label>
                <Input value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="text-right" />
              </div>
              <div className="space-y-2">
                <Label className="text-right block">الصورة</Label>
                <div className="flex gap-2">
                  <Input value={formData.image} onChange={e => setFormData({...formData, image: e.target.value})} className="text-right" placeholder="رابط الصورة" />
                  <div className="relative">
                    <Button variant="outline" size="icon" className="h-10 w-10 rounded-none shrink-0" asChild>
                      <label className="cursor-pointer">
                        <Plus className="h-4 w-4" />
                        <input type="file" className="hidden" onChange={handleImageUpload} accept="image/*" />
                      </label>
                    </Button>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-right block">رابط التوجيه (اختياري)</Label>
                <Input value={formData.link} onChange={e => setFormData({...formData, link: e.target.value})} className="text-right" />
              </div>
              <div className="space-y-2">
                <Label className="text-right block">النوع</Label>
                <Select value={formData.type} onValueChange={(v: any) => setFormData({...formData, type: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="banner">بانر</SelectItem>
                    <SelectItem value="popup">بوب أب (نافذة منبثقة)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button 
                className="w-full h-12 rounded-none font-black" 
                onClick={() => createMutation.mutate(formData)}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? <Loader2 className="animate-spin" /> : "حفظ"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {marketing?.map((item: any) => (
          <Card key={item.id} className="border-black/5 hover-elevate overflow-hidden">
            <div className="aspect-video relative overflow-hidden">
              <img src={item.image} alt={item.title} className="object-cover w-full h-full" />
              <div className="absolute top-2 right-2 flex gap-2">
                <Badge variant="default" className="rounded-none font-bold uppercase tracking-widest text-[8px]">
                  {item.type === 'banner' ? 'بانر' : 'بوب أب'}
                </Badge>
                <Button 
                  size="icon" 
                  variant="destructive" 
                  className="h-8 w-8 rounded-none"
                  onClick={() => deleteMutation.mutate(item.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <CardHeader className="p-4">
              <CardTitle className="text-sm font-black">{item.title}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
};
