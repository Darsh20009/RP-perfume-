import { Layout } from "@/components/Layout";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ShoppingCart, Send, Phone, Mail, Clock, Tag, Trash2, Loader2, Sparkles, User as UserIcon } from "lucide-react";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AbandonedCart {
  id: string;
  userId: string | null;
  sessionId: string | null;
  user: { name?: string; phone?: string; email?: string } | null;
  items: any[];
  total: number;
  itemCount: number;
  reminderSent: boolean;
  reminderSentAt?: string;
  manualReminderCount: number;
  idleMinutes: number;
  updatedAt: string;
  createdAt: string;
}

export default function AdminAbandonedCarts() {
  const { toast } = useToast();
  const { data: carts = [], isLoading } = useQuery<AbandonedCart[]>({
    queryKey: ["/api/admin/abandoned-carts"],
    refetchInterval: 30000,
  });

  const [selected, setSelected] = useState<AbandonedCart | null>(null);
  const [discountPercent, setDiscountPercent] = useState(10);
  const [customMessage, setCustomMessage] = useState("");

  const notifyMutation = useMutation({
    mutationFn: async ({ id, discount, message }: any) =>
      apiRequest("POST", `/api/admin/abandoned-carts/${id}/notify`, {
        discountPercent: discount,
        message,
      }),
    onSuccess: async (res: any) => {
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/abandoned-carts"] });
      toast({
        title: "تم إرسال التنبيه ✨",
        description: data?.discountCode
          ? `كود الخصم: ${data.discountCode} (${data.discountPercent}%)`
          : "وصل التنبيه للعميل",
      });
      setSelected(null);
      setCustomMessage("");
    },
    onError: () => toast({ title: "فشل الإرسال", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/abandoned-carts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/abandoned-carts"] });
      toast({ title: "تم الحذف" });
    },
  });

  const totalValue = carts.reduce((s, c) => s + (c.total || 0), 0);
  const withUsers = carts.filter(c => c.userId).length;

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6" dir="rtl">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-black flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white shadow-lg">
                <ShoppingCart className="w-6 h-6" />
              </div>
              السلال المتروكة
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              عملاء بدأوا الشراء ولم يكملوا — حوّلهم إلى طلبات حقيقية
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50">
            <CardContent className="p-5">
              <p className="text-xs font-bold text-amber-700 uppercase tracking-widest">السلال المتروكة</p>
              <p className="text-3xl font-black text-amber-900 mt-1" data-testid="text-cart-count">{carts.length}</p>
            </CardContent>
          </Card>
          <Card className="border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
            <CardContent className="p-5">
              <p className="text-xs font-bold text-green-700 uppercase tracking-widest">القيمة الإجمالية</p>
              <p className="text-3xl font-black text-green-900 mt-1" data-testid="text-total-value">{totalValue.toFixed(2)} ر.س</p>
            </CardContent>
          </Card>
          <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
            <CardContent className="p-5">
              <p className="text-xs font-bold text-blue-700 uppercase tracking-widest">قابلة للتواصل</p>
              <p className="text-3xl font-black text-blue-900 mt-1">{withUsers}</p>
            </CardContent>
          </Card>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="text-center py-20"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" /></div>
        ) : carts.length === 0 ? (
          <Card><CardContent className="p-12 text-center text-muted-foreground">
            <Sparkles className="w-12 h-12 mx-auto mb-3 text-amber-400" />
            ممتاز! لا توجد سلال متروكة حالياً
          </CardContent></Card>
        ) : (
          <div className="space-y-3">
            {carts.map(cart => (
              <Card key={cart.id} className="hover:shadow-lg transition-all border-black/5">
                <CardContent className="p-5">
                  <div className="flex flex-col lg:flex-row gap-4 items-start">
                    <div className="flex-1 space-y-2 w-full">
                      <div className="flex items-center gap-3 flex-wrap">
                        {cart.user ? (
                          <div className="flex items-center gap-2">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-white text-xs font-black">
                              {(cart.user.name || "?")[0]}
                            </div>
                            <div>
                              <p className="font-black text-sm">{cart.user.name || "بدون اسم"}</p>
                              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                                {cart.user.phone && (<span className="flex items-center gap-1"><Phone className="w-3 h-3" />{cart.user.phone}</span>)}
                                {cart.user.email && (<span className="flex items-center gap-1"><Mail className="w-3 h-3" />{cart.user.email}</span>)}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <UserIcon className="w-4 h-4" />
                            <span className="text-sm font-bold">زائر مجهول</span>
                          </div>
                        )}
                        <Badge variant="outline" className="gap-1">
                          <Clock className="w-3 h-3" />
                          {cart.idleMinutes < 60 ? `${cart.idleMinutes} د` : `${Math.floor(cart.idleMinutes/60)} س`}
                        </Badge>
                        {cart.reminderSent && (
                          <Badge className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100">
                            تنبيه أُرسل {cart.manualReminderCount > 0 && `(يدوي ×${cart.manualReminderCount})`}
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {cart.items.slice(0, 4).map((item, i) => (
                          <div key={i} className="bg-muted/50 px-3 py-1.5 rounded-lg text-xs">
                            <span className="font-bold">{item.quantity}×</span> {item.title}
                          </div>
                        ))}
                        {cart.items.length > 4 && (
                          <div className="bg-muted/50 px-3 py-1.5 rounded-lg text-xs text-muted-foreground">
                            +{cart.items.length - 4} منتج
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <div className="text-left">
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">الإجمالي</p>
                        <p className="text-2xl font-black text-amber-700">{cart.total.toFixed(2)} <span className="text-xs">ر.س</span></p>
                      </div>
                      <div className="flex gap-2">
                        {cart.userId && (
                          <Button
                            size="sm"
                            onClick={() => setSelected(cart)}
                            data-testid={`button-notify-${cart.id}`}
                            className="bg-gradient-to-br from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white gap-1"
                          >
                            <Send className="w-3 h-3" />
                            تنبيه + خصم
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteMutation.mutate(cart.id)}
                          data-testid={`button-delete-cart-${cart.id}`}
                        >
                          <Trash2 className="w-3 h-3 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Notify Dialog */}
        <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
          <DialogContent dir="rtl" className="max-w-md">
            <DialogHeader>
              <DialogTitle className="font-black flex items-center gap-2">
                <Tag className="w-5 h-5 text-amber-500" />
                تنبيه العميل {selected?.user?.name ? `— ${selected.user.name}` : ""}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-3 rounded-xl border border-amber-100">
                <p className="text-xs text-amber-700 font-bold">
                  {selected?.itemCount} منتج بقيمة {selected?.total.toFixed(2)} ر.س
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest">نسبة الخصم (٪) — 0 لتنبيه فقط</Label>
                <Input
                  type="number" min={0} max={50}
                  value={discountPercent}
                  onChange={e => setDiscountPercent(Math.max(0, Math.min(50, parseInt(e.target.value) || 0)))}
                  data-testid="input-discount-percent"
                />
                {discountPercent > 0 && (
                  <p className="text-[11px] text-amber-600">
                    سيُولَّد كود فريد للعميل بصلاحية 7 أيام
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest">رسالة شخصية (اختياري)</Label>
                <Textarea
                  value={customMessage}
                  onChange={e => setCustomMessage(e.target.value)}
                  placeholder="مثلاً: عرض خاص لك من رفيف العود..."
                  rows={3}
                  data-testid="input-custom-message"
                />
              </div>
              <Button
                className="w-full bg-gradient-to-br from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white gap-2"
                onClick={() => selected && notifyMutation.mutate({
                  id: selected.id,
                  discount: discountPercent,
                  message: customMessage,
                })}
                disabled={notifyMutation.isPending}
                data-testid="button-send-notify"
              >
                {notifyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                إرسال التنبيه الآن
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
