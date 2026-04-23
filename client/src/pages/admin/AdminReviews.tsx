import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Star, MessageSquare, Trash2, Loader2, Search, Reply, Sparkles,
  Image as ImageIcon, X, ChevronLeft, ChevronRight, Filter, MessageCircle, ShieldCheck,
} from "lucide-react";

type Review = {
  id: string;
  productId: string;
  productName?: string;
  productImage?: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  comment: string;
  images?: string[];
  adminReply?: { text: string; byName: string; byUserId: string; at?: string };
  isFeatured?: boolean;
  createdAt: string;
};

type ReviewsResponse = { items: Review[]; total: number };

export default function AdminReviews() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [rating, setRating] = useState<string>("all");
  const [hasReply, setHasReply] = useState<string>("all");
  const [page, setPage] = useState(1);
  const limit = 20;
  const [openReply, setOpenReply] = useState<Review | null>(null);
  const [replyText, setReplyText] = useState("");
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Review | null>(null);

  const queryParams = useMemo(() => {
    const sp = new URLSearchParams();
    if (search) sp.set("q", search);
    if (rating !== "all") sp.set("rating", rating);
    if (hasReply !== "all") sp.set("hasReply", hasReply);
    sp.set("page", String(page));
    sp.set("limit", String(limit));
    return sp.toString();
  }, [search, rating, hasReply, page]);

  const { data, isLoading } = useQuery<ReviewsResponse>({
    queryKey: ["/api/admin/reviews", queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/admin/reviews?${queryParams}`, { credentials: "include" });
      if (!res.ok) return { items: [], total: 0 };
      return res.json();
    },
  });

  const reviews = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const stats = useMemo(() => {
    const items = reviews;
    const totalCount = total;
    const avg = items.length ? items.reduce((s, r) => s + r.rating, 0) / items.length : 0;
    const noReply = items.filter(r => !r.adminReply?.text).length;
    const featured = items.filter(r => r.isFeatured).length;
    return { totalCount, avg, noReply, featured };
  }, [reviews, total]);

  const replyMutation = useMutation({
    mutationFn: async ({ id, text }: { id: string; text: string }) => {
      const res = await apiRequest("POST", `/api/admin/reviews/${id}/reply`, { text });
      if (!res.ok) throw new Error((await res.json()).message || "خطأ");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reviews"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reviews/featured"] });
      setOpenReply(null);
      setReplyText("");
      toast({ title: "تم إرسال الرد ✨" });
    },
    onError: (e: any) => toast({ title: e.message || "خطأ", variant: "destructive" }),
  });

  const featuredMutation = useMutation({
    mutationFn: async ({ id, isFeatured }: { id: string; isFeatured: boolean }) => {
      const res = await apiRequest("PATCH", `/api/admin/reviews/${id}/featured`, { isFeatured });
      if (!res.ok) throw new Error("خطأ");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reviews"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reviews/featured"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/reviews/${id}`);
      if (!res.ok) throw new Error("خطأ");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reviews"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reviews/featured"] });
      setConfirmDelete(null);
      toast({ title: "تم حذف التقييم" });
    },
  });

  return (
    <div className="space-y-6" dir="rtl" data-testid="admin-reviews-root">
      {/* Header + stats */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-amber-500" />
            تقييمات العملاء
          </h2>
          <p className="text-sm text-slate-500 mt-1">اقرأ، ردّ، وأبرز أجمل التقييمات في الصفحة الرئيسية</p>
        </div>
        <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-sm px-3 py-1">
          {total} تقييم
        </Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<MessageCircle className="w-5 h-5" />} label="إجمالي" value={total} color="from-blue-500 to-cyan-500" />
        <StatCard icon={<Star className="w-5 h-5" />} label="متوسط" value={stats.avg.toFixed(1)} color="from-amber-400 to-orange-500" />
        <StatCard icon={<Reply className="w-5 h-5" />} label="لم يُرَدّ عليه" value={stats.noReply} color="from-rose-500 to-pink-500" />
        <StatCard icon={<Sparkles className="w-5 h-5" />} label="مُمَيَّز" value={stats.featured} color="from-violet-500 to-purple-500" />
      </div>

      {/* Filters */}
      <Card className="p-4 bg-white border border-slate-200">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="ابحث في التعليقات أو المنتجات أو العملاء..."
              className="pe-9"
              data-testid="input-search-reviews"
            />
          </div>
          <Select value={rating} onValueChange={(v) => { setRating(v); setPage(1); }}>
            <SelectTrigger className="w-36" data-testid="select-rating">
              <Filter className="w-3.5 h-3.5 ms-1" />
              <SelectValue placeholder="التقييم" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل التقييمات</SelectItem>
              <SelectItem value="5">⭐ ٥ نجوم</SelectItem>
              <SelectItem value="4">⭐ ٤ نجوم</SelectItem>
              <SelectItem value="3">⭐ ٣ نجوم</SelectItem>
              <SelectItem value="2">⭐ نجمتان</SelectItem>
              <SelectItem value="1">⭐ نجمة واحدة</SelectItem>
            </SelectContent>
          </Select>
          <Select value={hasReply} onValueChange={(v) => { setHasReply(v); setPage(1); }}>
            <SelectTrigger className="w-40" data-testid="select-reply-filter">
              <SelectValue placeholder="حالة الرد" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="no">يحتاج ردّاً</SelectItem>
              <SelectItem value="yes">تم الرد</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Reviews list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        </div>
      ) : reviews.length === 0 ? (
        <Card className="p-12 text-center bg-gradient-to-b from-amber-50/30 to-white border-amber-100">
          <MessageCircle className="w-12 h-12 text-amber-300 mx-auto mb-4" />
          <p className="text-slate-700 font-bold">لا توجد تقييمات تطابق هذا الفلتر</p>
          <p className="text-sm text-slate-500 mt-1">جرب تغيير معايير البحث</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <Card
              key={r.id}
              className={`p-5 transition-all hover:shadow-md ${r.isFeatured ? "border-r-4 border-r-amber-400 bg-gradient-to-l from-amber-50/40 to-white" : "border-slate-200"} ${!r.adminReply?.text ? "ring-1 ring-rose-100" : ""}`}
              data-testid={`review-card-${r.id}`}
            >
              <div className="flex gap-4">
                {/* Avatar */}
                <div className="shrink-0">
                  {r.userAvatar ? (
                    <img src={r.userAvatar} alt="" className="w-12 h-12 rounded-full object-cover ring-2 ring-amber-200" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-black">
                      {(r.userName || "ع").charAt(0)}
                    </div>
                  )}
                </div>

                {/* Body */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-slate-900" data-testid={`text-username-${r.id}`}>{r.userName || "عميل"}</span>
                        <div className="flex">
                          {[1,2,3,4,5].map(s => (
                            <Star key={s} className={`w-3.5 h-3.5 ${s <= r.rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />
                          ))}
                        </div>
                        {r.isFeatured && (
                          <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[10px] px-2 py-0">
                            <Sparkles className="w-3 h-3 me-1" />مُمَيَّز
                          </Badge>
                        )}
                        {!r.adminReply?.text && (
                          <Badge className="bg-rose-100 text-rose-700 border-rose-300 text-[10px] px-2 py-0">يحتاج ردّاً</Badge>
                        )}
                      </div>
                      {r.productName && (
                        <div className="flex items-center gap-2 mt-1">
                          {r.productImage && <img src={r.productImage} alt="" className="w-5 h-5 rounded object-cover" />}
                          <a href={`/products/${r.productId}`} target="_blank" rel="noreferrer" className="text-xs text-slate-500 hover:text-amber-600 hover:underline" data-testid={`link-product-${r.id}`}>
                            {r.productName}
                          </a>
                        </div>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400">{new Date(r.createdAt).toLocaleDateString("ar-SA")}</span>
                  </div>

                  {r.comment && (
                    <p className="text-sm text-slate-700 leading-relaxed mt-3">{r.comment}</p>
                  )}

                  {/* Customer images */}
                  {r.images && r.images.length > 0 && (
                    <div className="flex gap-2 mt-3 flex-wrap">
                      {r.images.map((url, i) => (
                        <button
                          key={url + i}
                          type="button"
                          onClick={() => setLightbox(url)}
                          className="w-16 h-16 rounded-md overflow-hidden border border-slate-200 hover:border-amber-400  transition-all"
                          data-testid={`button-img-${r.id}-${i}`}
                        >
                          <img src={url} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Admin reply preview */}
                  {r.adminReply?.text && (
                    <div className="mt-3 ms-4 ps-3 border-s-2 border-amber-400 bg-amber-50/50 py-2 pe-3 rounded-e-md">
                      <div className="flex items-center gap-2 mb-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                        <span className="text-[11px] font-black text-amber-900">{r.adminReply.byName}</span>
                        {r.adminReply.at && <span className="text-[10px] text-amber-700/70">{new Date(r.adminReply.at).toLocaleDateString("ar-SA")}</span>}
                      </div>
                      <p className="text-[13px] text-slate-700 leading-relaxed">{r.adminReply.text}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-4 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs gap-1.5"
                      onClick={() => { setOpenReply(r); setReplyText(r.adminReply?.text || ""); }}
                      data-testid={`button-reply-${r.id}`}
                    >
                      <Reply className="w-3.5 h-3.5" />
                      {r.adminReply?.text ? "تعديل الرد" : "ردّ"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className={`h-8 text-xs gap-1.5 ${r.isFeatured ? "bg-amber-50 border-amber-300 text-amber-900" : ""}`}
                      onClick={() => featuredMutation.mutate({ id: r.id, isFeatured: !r.isFeatured })}
                      disabled={featuredMutation.isPending}
                      data-testid={`button-feature-${r.id}`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {r.isFeatured ? "إلغاء التمييز" : "إبراز في الرئيسية"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs gap-1.5 text-rose-600 hover:bg-rose-50 hover:text-rose-700 border-rose-200"
                      onClick={() => setConfirmDelete(r)}
                      data-testid={`button-delete-${r.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      حذف
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} data-testid="button-prev-page">
            <ChevronRight className="w-4 h-4" />
          </Button>
          <span className="text-sm font-bold text-slate-600">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} data-testid="button-next-page">
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Reply dialog */}
      <Dialog open={!!openReply} onOpenChange={(o) => !o && setOpenReply(null)}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Reply className="w-5 h-5 text-amber-500" />
              {openReply?.adminReply?.text ? "تعديل الرد" : "الرد على التقييم"}
            </DialogTitle>
          </DialogHeader>
          {openReply && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-black text-sm">{openReply.userName}</span>
                  <div className="flex">
                    {[1,2,3,4,5].map(s => (
                      <Star key={s} className={`w-3 h-3 ${s <= openReply.rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />
                    ))}
                  </div>
                </div>
                <p className="text-xs text-slate-600">{openReply.comment || "(بدون تعليق)"}</p>
              </div>
              <Textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={5}
                placeholder="اكتب ردّك بأسلوب راقي يعكس قيم عطور آر اف..."
                className="resize-none"
                data-testid="textarea-reply"
              />
              <p className="text-[11px] text-slate-400">سيظهر هذا الرد للعميل على صفحة المنتج</p>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpenReply(null)}>إلغاء</Button>
            <Button
              className="bg-gradient-to-r from-amber-500 to-amber-600 text-white"
              onClick={() => openReply && replyMutation.mutate({ id: openReply.id, text: replyText })}
              disabled={replyMutation.isPending || !replyText.trim()}
              data-testid="button-send-reply"
            >
              {replyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin me-2" /> : <Reply className="w-4 h-4 me-2" />}
              إرسال الرد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-rose-600">حذف التقييم</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">هل أنت متأكد من حذف تقييم <span className="font-black">{confirmDelete?.userName}</span>؟ لا يمكن التراجع.</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>إلغاء</Button>
            <Button
              className="bg-rose-600 hover:bg-rose-700 text-white"
              onClick={() => confirmDelete && deleteMutation.mutate(confirmDelete.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin me-2" /> : <Trash2 className="w-4 h-4 me-2" />}
              حذف نهائي
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/90 z-[200] flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setLightbox(null)}
          data-testid="admin-review-lightbox"
        >
          <button className="absolute top-4 left-4 w-10 h-10 rounded-full bg-white/10 backdrop-blur flex items-center justify-center text-white hover:bg-white/20" onClick={() => setLightbox(null)}>
            <X className="w-5 h-5" />
          </button>
          <img src={lightbox} alt="" className="max-w-full max-h-full object-contain rounded-lg" />
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  return (
    <Card className="p-4 border-slate-200 hover-elevate active-elevate-2 transition-all">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${color} text-white flex items-center justify-center shadow-sm`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[11px] text-slate-500 font-bold">{label}</p>
          <p className="text-xl font-black text-slate-900">{value}</p>
        </div>
      </div>
    </Card>
  );
}
