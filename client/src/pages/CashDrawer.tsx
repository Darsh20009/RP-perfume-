import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import {
  Loader2, Lock, Unlock, TrendingUp, TrendingDown,
  Clock, Wallet, CheckCircle, AlertTriangle, Minus as MinusIcon,
  History, Calendar
} from "lucide-react";
import type { CashShift } from "@shared/schema";
import { RiyalSign } from "@/components/RiyalSign";

export default function CashDrawer() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [openingBalance, setOpeningBalance] = useState("");
  const [actualCash, setActualCash] = useState("");
  const [isOpenDialogOpen, setIsOpenDialogOpen] = useState(false);
  const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false);

  const { data: shifts, isLoading } = useQuery({
    queryKey: ["/api/cash-shifts"],
    queryFn: async () => {
      const response = await fetch("/api/cash-shifts");
      if (!response.ok) throw new Error("Failed to fetch shifts");
      return response.json() as Promise<CashShift[]>;
    },
  });

  const activeShift = shifts?.find(s => s.status === "open");
  const closedShifts = shifts?.filter(s => s.status === "closed")
    .sort((a, b) => new Date(b.closedAt || 0).getTime() - new Date(a.closedAt || 0).getTime()) ?? [];

  const openShiftMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/cash-shifts/open", {
        openingBalance: Number(openingBalance) || 0,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cash-shifts"] });
      toast({ title: "تم فتح الوردية", description: "تم فتح وردية جديدة بنجاح" });
      setOpeningBalance("");
      setIsOpenDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "خطأ", description: error.message });
    },
  });

  const closeShiftMutation = useMutation({
    mutationFn: async () => {
      if (!activeShift?.id) throw new Error("لا توجد وردية مفتوحة");
      const res = await apiRequest("PATCH", `/api/cash-shifts/${activeShift.id}/close`, {
        actualCash: Number(actualCash) || 0,
        expectedCash: activeShift.openingBalance || 0,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cash-shifts"] });
      toast({ title: "تم إغلاق الوردية", description: "تم إغلاق الوردية بنجاح" });
      setActualCash("");
      setIsCloseDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "خطأ", description: error.message });
    },
  });

  const diff = actualCash ? Number(actualCash) - (activeShift?.openingBalance || 0) : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-[#DFB369]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 md:p-8 space-y-6" dir="rtl">
      {/* Header */}
      <div>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[#2B2B60]">صندوق النقد</h1>
        <p className="text-sm text-gray-600 font-bold mt-1">إدارة وردية النقد اليومية للفرع</p>
      </div>

      {/* Status Banner */}
      <div className={`rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg ${
        activeShift
          ? "bg-gradient-to-l from-emerald-600 to-emerald-700 text-white"
          : "bg-gradient-to-l from-[#2B2B60] to-[#1c1c45] text-white"
      }`}>
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg ${
            activeShift ? "bg-white/20" : "bg-white/10"
          }`}>
            {activeShift
              ? <Unlock className="h-7 w-7 text-white" />
              : <Lock className="h-7 w-7 text-white" />
            }
          </div>
          <div>
            <p className="font-black text-xl">
              {activeShift ? "وردية مفتوحة" : "لا توجد وردية مفتوحة"}
            </p>
            <p className="text-sm opacity-80 font-bold">
              {activeShift
                ? `فُتحت الساعة ${new Date(activeShift.openedAt || new Date()).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}`
                : "قم بفتح وردية جديدة لبدء العمل"
              }
            </p>
          </div>
        </div>

        {activeShift ? (
          <Dialog open={isCloseDialogOpen} onOpenChange={setIsCloseDialogOpen}>
            <DialogTrigger asChild>
              <Button
                className="bg-white/20 hover:bg-white/30 text-white border border-white/30 font-black h-12 px-6 gap-2"
                variant="outline"
                data-testid="button-close-shift"
              >
                <Lock className="h-4 w-4" />
                إغلاق الوردية
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[440px]" dir="rtl">
              <DialogHeader>
                <DialogTitle className="text-right text-xl font-black text-[#2B2B60]">تأكيد إغلاق الوردية</DialogTitle>
              </DialogHeader>
              <div className="space-y-5 pt-2">
                <div className="bg-[#FAF8F4] rounded-xl p-4 space-y-2 border border-[#DFB369]/20">
                  <p className="text-xs font-black text-gray-500 uppercase tracking-wider">معلومات الوردية</p>
                  <div className="flex justify-between text-sm font-bold">
                    <span className="text-gray-600">وقت الفتح:</span>
                    <span>{new Date(activeShift?.openedAt || new Date()).toLocaleTimeString("ar-SA")}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold">
                    <span className="text-gray-600">الرصيد الافتتاحي:</span>
                    <span className="text-[#2B2B60]">{(activeShift?.openingBalance || 0).toFixed(2)} <RiyalSign /></span>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-black text-[#2B2B60] mb-2 block">الرصيد الفعلي في الصندوق</label>
                  <div className="relative">
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={actualCash}
                      onChange={(e) => setActualCash(e.target.value)}
                      step="0.5"
                      min="0"
                      className="h-12 text-lg font-black pr-4"
                      data-testid="input-actual-cash"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-500"><RiyalSign /></span>
                  </div>
                </div>

                {actualCash && diff !== null && (
                  <div className={`rounded-xl p-4 border ${
                    diff === 0 ? "bg-emerald-50 border-emerald-200" :
                    diff > 0 ? "bg-blue-50 border-blue-200" : "bg-red-50 border-red-200"
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {diff === 0
                          ? <CheckCircle className="h-5 w-5 text-emerald-600" />
                          : diff > 0
                          ? <TrendingUp className="h-5 w-5 text-blue-600" />
                          : <AlertTriangle className="h-5 w-5 text-red-600" />
                        }
                        <span className="font-black text-sm">
                          {diff === 0 ? "الصندوق متطابق تمامًا" : diff > 0 ? "يوجد فائض" : "يوجد عجز"}
                        </span>
                      </div>
                      <span className={`text-lg font-black ${diff === 0 ? "text-emerald-700" : diff > 0 ? "text-blue-700" : "text-red-700"}`}>
                        {diff > 0 ? "+" : ""}{diff.toFixed(2)} <RiyalSign />
                      </span>
                    </div>
                  </div>
                )}

                <Button
                  onClick={() => closeShiftMutation.mutate()}
                  disabled={!actualCash || closeShiftMutation.isPending}
                  className="w-full h-12 bg-[#2B2B60] hover:bg-[#1c1c45] font-black text-white"
                >
                  {closeShiftMutation.isPending
                    ? <Loader2 className="animate-spin h-4 w-4" />
                    : "تأكيد إغلاق الوردية"
                  }
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        ) : (
          <Dialog open={isOpenDialogOpen} onOpenChange={setIsOpenDialogOpen}>
            <DialogTrigger asChild>
              <Button
                className="bg-[#DFB369] hover:bg-[#c89853] text-[#0F0F0F] font-black h-12 px-6 gap-2 shadow-lg shadow-[#DFB369]/30"
                data-testid="button-open-shift"
              >
                <Unlock className="h-4 w-4" />
                فتح وردية جديدة
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[400px]" dir="rtl">
              <DialogHeader>
                <DialogTitle className="text-right text-xl font-black text-[#2B2B60]">فتح وردية جديدة</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-sm font-black text-[#2B2B60] mb-2 block">الرصيد الافتتاحي</label>
                  <div className="relative">
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={openingBalance}
                      onChange={(e) => setOpeningBalance(e.target.value)}
                      step="0.5"
                      min="0"
                      className="h-12 text-lg font-black pr-4"
                      data-testid="input-opening-balance"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-500"><RiyalSign /></span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 font-bold">أدخل المبلغ النقدي الموجود في الصندوق عند بداية الوردية</p>
                </div>
                <Button
                  onClick={() => openShiftMutation.mutate()}
                  disabled={openShiftMutation.isPending}
                  className="w-full h-12 bg-[#DFB369] hover:bg-[#c89853] text-[#0F0F0F] font-black"
                >
                  {openShiftMutation.isPending
                    ? <Loader2 className="animate-spin h-4 w-4" />
                    : "فتح الوردية"
                  }
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Active Shift Details */}
      {activeShift && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border border-[#DFB369]/20 bg-gradient-to-br from-white to-[#FAF8F4]">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">الرصيد الافتتاحي</span>
                <Wallet className="h-4 w-4 text-[#DFB369]" />
              </div>
              <p className="text-3xl font-black text-[#2B2B60]">
                {(activeShift.openingBalance || 0).toFixed(2)} <span className="text-xl"><RiyalSign /></span>
              </p>
            </CardContent>
          </Card>
          <Card className="border border-[#DFB369]/20 bg-gradient-to-br from-white to-[#FAF8F4]">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">وقت الفتح</span>
                <Clock className="h-4 w-4 text-[#DFB369]" />
              </div>
              <p className="text-3xl font-black text-[#2B2B60]">
                {new Date(activeShift.openedAt || new Date()).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </CardContent>
          </Card>
          <Card className="border border-emerald-200 bg-gradient-to-br from-white to-emerald-50">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">الحالة</span>
                <CheckCircle className="h-4 w-4 text-emerald-500" />
              </div>
              <p className="text-3xl font-black text-emerald-600">مفتوحة</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Closed Shifts Log */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <History className="h-5 w-5 text-[#DFB369]" />
          <h2 className="text-xl font-black text-[#2B2B60]">سجل الورديات المغلقة</h2>
          <Badge variant="outline" className="border-[#DFB369]/40 text-[#2B2B60] font-black">
            {closedShifts.length} وردية
          </Badge>
        </div>

        {closedShifts.length === 0 ? (
          <Card className="border-dashed border-2 border-[#DFB369]/20">
            <CardContent className="py-16 text-center">
              <History className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="font-black text-gray-500">لم تغلق أي وردية بعد</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {closedShifts.map((shift) => {
              const d = shift.difference || 0;
              return (
                <Card
                  key={shift.id}
                  className="border border-[#DFB369]/15 hover:border-[#DFB369]/40 hover:shadow-md transition-all"
                  data-testid={`card-shift-${shift.id}`}
                >
                  <CardContent className="p-4">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 items-center">
                      <div className="flex items-center gap-3 col-span-2 md:col-span-1">
                        <div className="w-9 h-9 rounded-xl bg-[#FAF8F4] flex items-center justify-center border border-[#DFB369]/20">
                          <Calendar className="h-4 w-4 text-[#DFB369]" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-gray-500 uppercase">التاريخ</p>
                          <p className="text-sm font-bold text-[#2B2B60]">
                            {new Date(shift.closedAt || new Date()).toLocaleString("ar-SA", { dateStyle: "short", timeStyle: "short" })}
                          </p>
                        </div>
                      </div>

                      <div>
                        <p className="text-[10px] font-black text-gray-500 uppercase mb-1">الافتتاحي</p>
                        <p className="text-sm font-black text-[#2B2B60]">{(shift.openingBalance || 0).toFixed(2)} <RiyalSign /></p>
                      </div>

                      <div>
                        <p className="text-[10px] font-black text-gray-500 uppercase mb-1">الفعلي</p>
                        <p className="text-sm font-black text-[#2B2B60]">{(shift.actualCash || 0).toFixed(2)} <RiyalSign /></p>
                      </div>

                      <div>
                        <p className="text-[10px] font-black text-gray-500 uppercase mb-1">الفرق</p>
                        <p className={`text-sm font-black flex items-center gap-1 ${
                          d === 0 ? "text-emerald-600" : d > 0 ? "text-blue-600" : "text-red-600"
                        }`}>
                          {d > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : d < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : <MinusIcon className="h-3.5 w-3.5" />}
                          {d > 0 ? "+" : ""}{d.toFixed(2)} <RiyalSign />
                        </p>
                      </div>

                      <div className="flex justify-end">
                        <Badge
                          className={`font-black text-xs px-3 py-1 ${
                            d === 0
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : d > 0
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : "bg-red-50 text-red-700 border border-red-200"
                          }`}
                          variant="outline"
                        >
                          {d === 0 ? "✓ متطابق" : d > 0 ? "فائض" : "عجز"}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
