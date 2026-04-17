import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, DollarSign, Lock, Unlock, TrendingUp, TrendingDown } from "lucide-react";
import type { CashShift } from "@shared/schema";

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
        expectedCash: (activeShift.openingBalance || 0),
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">{activeShift ? "الوردية المفتوحة" : "صندوق النقد"}</h1>
          <p className="text-muted-foreground">إدارة وردية النقد اليومية</p>
        </div>

        {/* Active Shift Card */}
        {activeShift ? (
          <Card className="mb-8 border-green-200 bg-green-50">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2 text-green-700">
                    <Unlock className="h-5 w-5" />
                    وردية مفتوحة
                  </CardTitle>
                  <CardDescription className="text-green-600">
                    من {new Date(activeShift.openedAt || new Date()).toLocaleTimeString("ar-SA")}
                  </CardDescription>
                </div>
                <Badge className="bg-green-600">{activeShift.status === "open" ? "مفتوحة" : "مغلقة"}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-4 rounded border border-green-200">
                  <p className="text-sm text-muted-foreground mb-1">الرصيد الافتتاحي</p>
                  <p className="text-3xl font-black text-green-700">{activeShift.openingBalance?.toFixed(2)} ر.س</p>
                </div>
                <div className="bg-white p-4 rounded border border-green-200">
                  <p className="text-sm text-muted-foreground mb-1">المتوقع</p>
                  <p className="text-3xl font-black text-blue-700">{(activeShift.openingBalance || 0).toFixed(2)} ر.س</p>
                </div>
              </div>

              <Dialog open={isCloseDialogOpen} onOpenChange={setIsCloseDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full h-12 font-black uppercase tracking-widest gap-2" variant="destructive">
                    <Lock className="h-4 w-4" />
                    إغلاق الوردية
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>إغلاق الوردية</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-bold mb-1 block">الرصيد الفعلي في الصندوق (ر.س)</label>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={actualCash}
                        onChange={(e) => setActualCash(e.target.value)}
                        step="0.5"
                        min="0"
                      />
                    </div>
                    {actualCash && (
                      <div className="p-3 bg-muted rounded space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>الرصيد المتوقع:</span>
                          <span className="font-bold">{(activeShift.openingBalance || 0).toFixed(2)} ر.س</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>الرصيد الفعلي:</span>
                          <span className="font-bold">{Number(actualCash).toFixed(2)} ر.س</span>
                        </div>
                        <div className={`flex justify-between text-sm font-black pt-2 border-t ${
                          Number(actualCash) === (activeShift.openingBalance || 0)
                            ? "text-green-600"
                            : Number(actualCash) > (activeShift.openingBalance || 0)
                            ? "text-blue-600"
                            : "text-red-600"
                        }`}>
                          <span>الفرق:</span>
                          <span>{(Number(actualCash) - (activeShift.openingBalance || 0)).toFixed(2)} ر.س</span>
                        </div>
                      </div>
                    )}
                    <Button
                      onClick={() => closeShiftMutation.mutate()}
                      disabled={!actualCash || closeShiftMutation.isPending}
                      className="w-full"
                    >
                      {closeShiftMutation.isPending ? <Loader2 className="animate-spin h-4 w-4" /> : "تأكيد الإغلاق"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        ) : (
          <Card className="mb-8 border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="text-blue-700">لا توجد وردية مفتوحة</CardTitle>
            </CardHeader>
            <CardContent>
              <Dialog open={isOpenDialogOpen} onOpenChange={setIsOpenDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full h-12 font-black uppercase tracking-widest gap-2">
                    <Unlock className="h-4 w-4" />
                    فتح وردية جديدة
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>فتح وردية جديدة</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-bold mb-1 block">الرصيد الافتتاحي (ر.س)</label>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={openingBalance}
                        onChange={(e) => setOpeningBalance(e.target.value)}
                        step="0.5"
                        min="0"
                      />
                    </div>
                    <Button
                      onClick={() => openShiftMutation.mutate()}
                      disabled={openShiftMutation.isPending}
                      className="w-full"
                    >
                      {openShiftMutation.isPending ? <Loader2 className="animate-spin h-4 w-4" /> : "فتح الوردية"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        )}

        {/* Closed Shifts Report */}
        <div>
          <h2 className="text-2xl font-bold mb-4">سجل الورديات المغلقة</h2>
          {shifts?.filter(s => s.status === "closed").length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <p>لم تغلق أي وردية بعد</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {shifts
                ?.filter(s => s.status === "closed")
                .sort((a, b) => new Date(b.closedAt || 0).getTime() - new Date(a.closedAt || 0).getTime())
                .map((shift) => (
                  <Card key={shift.id} data-testid={`card-shift-${shift.id}`}>
                    <CardContent className="p-4">
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">التاريخ والوقت</p>
                          <p className="text-sm font-bold">
                            {new Date(shift.closedAt || new Date()).toLocaleString("ar-SA")}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">الرصيد الافتتاحي</p>
                          <p className="text-sm font-bold">{shift.openingBalance?.toFixed(2)} ر.س</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">الرصيد الفعلي</p>
                          <p className="text-sm font-bold">{shift.actualCash?.toFixed(2)} ر.س</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">الفرق</p>
                          <p className={`text-sm font-bold flex items-center gap-1 ${
                            (shift.difference || 0) === 0
                              ? "text-green-600"
                              : (shift.difference || 0) > 0
                              ? "text-blue-600"
                              : "text-red-600"
                          }`}>
                            {(shift.difference || 0) > 0 ? <TrendingUp className="h-4 w-4" /> : (shift.difference || 0) < 0 ? <TrendingDown className="h-4 w-4" /> : null}
                            {(shift.difference || 0).toFixed(2)} ر.س
                          </p>
                        </div>
                        <div className="flex justify-end">
                          <Badge
                            variant="outline"
                            className={
                              (shift.difference || 0) === 0
                                ? "bg-green-50 text-green-700 border-green-200"
                                : (shift.difference || 0) > 0
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : "bg-red-50 text-red-700 border-red-200"
                            }
                          >
                            {(shift.difference || 0) === 0 ? "متطابق" : (shift.difference || 0) > 0 ? "زيادة" : "عجز"}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
