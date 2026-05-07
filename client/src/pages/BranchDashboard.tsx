import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  ScanLine, Package, Printer, AlertTriangle, CheckCircle,
  Loader2, Search, RefreshCw, ShoppingBag, MapPin, Save,
  Clock, TrendingUp, AlertCircle, FileText, FileSpreadsheet,
  CheckSquare, Square, Filter, X,
} from "lucide-react";
import { RiyalSign } from "@/components/RiyalSign";
import riyalIconUrl from "@assets/dummy_1777292322734.png";

const RIYAL_IMG = `<img src="${typeof window !== "undefined" ? window.location.origin : ""}${riyalIconUrl}" alt="ر.س" style="height:0.85em;width:auto;display:inline-block;vertical-align:-0.08em;margin:0 0.18em 0 0.05em;object-fit:contain;" />`;

function ShiftSummaryButton() {
  const handleDownload = async () => {
    const res = await fetch("/api/branch/shift-summary");
    if (!res.ok) return;
    const data = await res.json();
    const html = `
<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>تقرير اليوم — ${data.branchName}</title>
<style>
body{font-family:system-ui,sans-serif;padding:30px;color:#2B2B60;max-width:800px;margin:0 auto}
h1{font-size:24px;margin:0 0 4px}
h2{font-size:16px;margin:24px 0 8px;border-bottom:2px solid #DFB369;padding-bottom:6px}
.meta{color:#888;font-size:12px;margin-bottom:24px}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:16px 0}
.kpi{border:1px solid #eee;border-radius:12px;padding:16px;text-align:center}
.kpi .v{font-size:28px;font-weight:900;color:#2B2B60}
.kpi .l{font-size:11px;color:#666;font-weight:700;margin-top:4px}
table{width:100%;border-collapse:collapse;margin-top:8px;font-size:13px}
th,td{padding:8px;text-align:right;border-bottom:1px solid #eee}
th{background:#f8f8f8;font-weight:800}
.total{background:linear-gradient(135deg,#DFB369,#a08a52);color:white;border-radius:12px;padding:18px;text-align:center;margin-top:20px}
.total .v{font-size:36px;font-weight:900}
@media print{button{display:none}}
</style></head><body>
<h1>تقرير اليوم — ${data.branchName || "الفرع"}</h1>
<div class="meta">${new Date(data.date).toLocaleDateString("ar-SA",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</div>
<div class="grid">
  <div class="kpi"><div class="v">${data.deliveredToday}</div><div class="l">مسلَّم اليوم</div></div>
  <div class="kpi"><div class="v">${data.ordersToday}</div><div class="l">طلبات جديدة</div></div>
  <div class="kpi"><div class="v">${data.pendingPickups}</div><div class="l">بانتظار الاستلام</div></div>
  <div class="kpi"><div class="v">${data.lowStockCount}</div><div class="l">مخزون منخفض</div></div>
</div>
<h2>الطلبات المسلَّمة (${data.deliveredOrders.length})</h2>
<table><thead><tr><th>المرجع</th><th>العميل</th><th>المبلغ</th><th>وقت التسليم</th></tr></thead><tbody>
${data.deliveredOrders.map((o:any)=>`<tr><td>#${o.ref}</td><td>${o.customerName||"-"}</td><td>${o.total} ${RIYAL_IMG}</td><td>${new Date(o.verifiedAt).toLocaleTimeString("ar-SA",{hour:"2-digit",minute:"2-digit"})}</td></tr>`).join("") || '<tr><td colspan="4" style="text-align:center;color:#888">لا توجد عمليات تسليم اليوم</td></tr>'}
</tbody></table>
<div class="total"><div class="l" style="font-size:11px;opacity:.85;font-weight:700">إجمالي إيرادات اليوم</div><div class="v">${Number(data.revenueToday).toLocaleString()} ${RIYAL_IMG}</div></div>
<div style="text-align:center;margin-top:30px"><button onclick="window.print()" style="background:#2B2B60;color:white;border:0;padding:10px 24px;border-radius:10px;font-weight:800;cursor:pointer">🖨️ طباعة</button></div>
</body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
  };
  return (
    <Button variant="outline" size="sm" onClick={handleDownload} data-testid="button-shift-summary">
      <FileText className="h-4 w-4 ml-1" />
      تقرير اليوم
    </Button>
  );
}

const LOW_STOCK_THRESHOLD = 5;

// Order status → Arabic label + color
const STATUS_AR: Record<string, { label: string; cls: string }> = {
  new:               { label: "جديد",            cls: "bg-blue-100 text-blue-800 border-blue-200" },
  pending_payment:   { label: "بانتظار الدفع",   cls: "bg-amber-100 text-amber-800 border-amber-200" },
  processing:        { label: "قيد التجهيز",     cls: "bg-purple-100 text-purple-800 border-purple-200" },
  ready_for_pickup:  { label: "جاهز للاستلام",   cls: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  out_for_delivery:  { label: "خرج للتوصيل",     cls: "bg-cyan-100 text-cyan-800 border-cyan-200" },
  shipped:           { label: "تم الشحن",        cls: "bg-cyan-100 text-cyan-800 border-cyan-200" },
  completed:         { label: "مكتمل",           cls: "bg-green-100 text-green-800 border-green-200" },
  cancelled:         { label: "ملغي",            cls: "bg-gray-100 text-gray-800 border-gray-200" },
  returned:          { label: "مُرتجع",          cls: "bg-rose-100 text-rose-800 border-rose-200" },
};
function StatusBadge({ status }: { status: string }) {
  const s = STATUS_AR[status] || { label: status, cls: "" };
  return <Badge className={s.cls} data-testid={`badge-status-${status}`}>{s.label}</Badge>;
}

// Shared AudioContext — created once after first user gesture and reused.
// Safari/iOS requires explicit .resume() before scheduling nodes.
let _sharedAudioCtx: AudioContext | null = null;
function getAudioCtx(): AudioContext | null {
  try {
    if (!_sharedAudioCtx || _sharedAudioCtx.state === "closed") {
      _sharedAudioCtx = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
    }
    return _sharedAudioCtx;
  } catch { return null; }
}

// Short, attention-grabbing beep for new-order alerts (~0.5s, 3-tone)
// Returns a promise that resolves when the sound has been initiated.
async function playBeep(): Promise<void> {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    // Resume the context if it was suspended (required on Safari/iOS)
    if (ctx.state === "suspended") await ctx.resume();
    const beepOnce = (when: number, freq: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + when);
      gain.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + when + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + when + 0.20);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + when);
      osc.stop(ctx.currentTime + when + 0.22);
    };
    beepOnce(0,    880);
    beepOnce(0.25, 1175);
    beepOnce(0.50, 880);
  } catch { /* ignore — never crash the UI */ }
}

function PrintInvoiceButton({ orderId }: { orderId: string }) {
  return (
    <Button
      variant="outline" size="sm"
      data-testid={`button-print-${orderId}`}
      onClick={() => window.open(`/invoice/${orderId}?print=1`, "_blank")}
    >
      <Printer className="h-4 w-4 ml-1" />
      فاتورة
    </Button>
  );
}

function bulkPrintInvoices(orderIds: string[]) {
  if (orderIds.length === 0) return;
  // Open all windows SYNCHRONOUSLY inside the user gesture so popup blockers
  // (Chrome/Safari) don't reject everything but the first. setTimeout breaks
  // the gesture chain and causes blocked popups.
  let blocked = 0;
  for (const id of orderIds) {
    const w = window.open(`/invoice/${id}?print=1`, `_print_${id}`, "noopener,noreferrer");
    if (!w) blocked++;
  }
  if (blocked > 0) {
    alert(`تم حظر ${blocked} نافذة بواسطة المتصفح. الرجاء السماح بالنوافذ المنبثقة لهذا الموقع وإعادة المحاولة.`);
  }
}

function exportOrdersCsv(orders: any[], filename = "branch-orders.csv") {
  const headers = [
    "رقم الطلب", "كود الاستلام", "الحالة", "طريقة الاستلام",
    "العميل", "الجوال", "العنوان",
    "عدد المنتجات", "المجموع الفرعي", "الشحن", "الضريبة", "الإجمالي",
    "طريقة الدفع", "تاريخ الإنشاء", "تاريخ التسليم",
  ];
  const rows = orders.map(o => [
    `#${(o.id || "").slice(-6).toUpperCase()}`,
    o.pickupCode || "",
    o.status || "",
    o.shippingMethod === "pickup" ? "استلام" : "توصيل",
    o.customerName || "",
    o.customerPhone || "",
    (o.deliveryAddress || "").replace(/[\r\n]+/g, " "),
    (o.items || []).length,
    Number(o.subtotal || 0).toFixed(2),
    Number(o.shippingCost || 0).toFixed(2),
    Number(o.vatAmount || 0).toFixed(2),
    Number(o.total || 0).toFixed(2),
    o.paymentMethod || "",
    o.createdAt ? new Date(o.createdAt).toLocaleString("ar-SA") : "",
    o.verifiedAt ? new Date(o.verifiedAt).toLocaleString("ar-SA") : "",
  ]);
  const escape = (v: any) => {
    const s = String(v ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  // BOM so Excel opens UTF-8 correctly
  const csv = "\uFEFF" + [headers, ...rows].map(r => r.map(escape).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 200);
}

function PickupScanner() {
  const [code, setCode] = useState("");
  const { toast } = useToast();
  const verifyMut = useMutation({
    mutationFn: async (c: string) => {
      const res = await apiRequest("POST", "/api/branch/orders/verify-pickup", { code: c });
      return res.json();
    },
    onSuccess: (order: any) => {
      toast({
        title: "✅ تم التسليم",
        description: `طلب #${(order.id || "").slice(-6).toUpperCase()} — ${order.total} ر.س`,
      });
      setCode("");
      queryClient.invalidateQueries({ queryKey: ["/api/branch/orders"] });
    },
    onError: (err: any) => {
      toast({
        title: "تعذّر التحقق",
        description: err?.message || "الكود غير صحيح",
        variant: "destructive",
      });
    },
  });

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <ScanLine className="h-6 w-6 text-primary" />
        <div>
          <h3 className="font-black text-lg">مسح كود الاستلام</h3>
          <p className="text-xs text-gray-700 font-bold">امسح الـ QR أو أدخل الكود يدوياً</p>
        </div>
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="●●●●●● أو امسح QR"
          value={code}
          onChange={(e) => {
            const raw = e.target.value;
            // Accept either pure 6-digit code, or QR payload "PICKUP:<orderId>:<code>"
            const m = raw.match(/PICKUP:[^:]+:(\d{6})/i);
            const next = m ? m[1] : raw.replace(/\D/g, "").slice(0, 6);
            setCode(next);
            if (m && next.length === 6) {
              setTimeout(() => verifyMut.mutate(next), 50);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && code.length === 6) verifyMut.mutate(code);
          }}
          className="text-center font-mono text-2xl tracking-[0.5em] h-14"
          data-testid="input-pickup-code"
          autoFocus
        />
        <Button
          onClick={() => verifyMut.mutate(code)}
          disabled={code.length !== 6 || verifyMut.isPending}
          className="h-14 px-6"
          data-testid="button-verify-pickup"
        >
          {verifyMut.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
        </Button>
      </div>
      <p className="text-[11px] text-gray-700 mt-3 text-center">
        💡 يمكنك استخدام ماسح QR أو إدخال الكود يدوياً
      </p>
    </Card>
  );
}

function BranchOrdersTab() {
  const { data: orders = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/branch/orders"],
    refetchInterval: 15_000,
  });
  const { toast } = useToast();

  // ── New-order audio alert ────────────────────────────────────────────────
  const seenIdsRef = useRef<Set<string> | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const audioEnabledRef = useRef(false);

  // Explicit enable: user clicks the bell button → unlock AudioContext + mark enabled
  const enableAudio = async () => {
    try {
      const ctx = getAudioCtx();
      if (ctx && ctx.state === "suspended") await ctx.resume();
    } catch {}
    audioEnabledRef.current = true;
    setAudioEnabled(true);
    // Play a test beep so the user confirms the sound works
    playBeep();
  };

  useEffect(() => {
    if (!Array.isArray(orders)) return;
    const ids = new Set<string>(orders.map((o: any) => String(o.id || o._id)));
    if (seenIdsRef.current === null) {
      // First load — seed baseline, no beep
      seenIdsRef.current = ids;
      return;
    }
    const newOnes: any[] = [];
    for (const o of orders) {
      const id = String(o.id || o._id);
      if (!seenIdsRef.current.has(id)) newOnes.push(o);
    }
    seenIdsRef.current = ids;
    if (newOnes.length > 0) {
      if (audioEnabledRef.current) playBeep();
      const ref = String(newOnes[0].id || "").slice(-6).toUpperCase();
      toast({
        title: `🔔 ${newOnes.length === 1 ? "طلب جديد" : `${newOnes.length} طلبات جديدة`}`,
        description: newOnes.length === 1 ? `طلب #${ref} — ${newOnes[0].total} ر.س` : "افتح القائمة لمراجعتها",
        duration: 8000,
      });
    }
  }, [orders, toast]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "pickup" | "pending" | "completed">("all");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    let list = orders;
    if (filter === "pickup") list = list.filter(o => o.shippingMethod === "pickup");
    if (filter === "pending") list = list.filter(o => !o.pickupVerified && o.status !== "completed" && o.status !== "cancelled");
    if (filter === "completed") list = list.filter(o => o.status === "completed" || o.pickupVerified);
    if (paymentFilter !== "all") list = list.filter(o => (o.paymentMethod || "") === paymentFilter);

    if (dateFrom) {
      const fromTs = new Date(dateFrom + "T00:00:00").getTime();
      list = list.filter(o => new Date(o.createdAt || 0).getTime() >= fromTs);
    }
    if (dateTo) {
      const toTs = new Date(dateTo + "T23:59:59").getTime();
      list = list.filter(o => new Date(o.createdAt || 0).getTime() <= toTs);
    }
    if (minAmount) list = list.filter(o => Number(o.total || 0) >= Number(minAmount));
    if (maxAmount) list = list.filter(o => Number(o.total || 0) <= Number(maxAmount));

    if (search) {
      const s = search.toLowerCase();
      list = list.filter(o =>
        (o.id || "").toLowerCase().includes(s) ||
        (o.pickupCode || "").includes(s) ||
        (o.deliveryAddress || "").toLowerCase().includes(s) ||
        (o.customerName || "").toLowerCase().includes(s) ||
        (o.customerPhone || "").includes(s)
      );
    }
    return [...list].sort((a, b) => {
      const aw = a.customerOnWay && !a.pickupVerified ? 1 : 0;
      const bw = b.customerOnWay && !b.pickupVerified ? 1 : 0;
      if (aw !== bw) return bw - aw;
      const ar = a.status === "ready_for_pickup" ? 1 : 0;
      const br = b.status === "ready_for_pickup" ? 1 : 0;
      if (ar !== br) return br - ar;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }, [orders, filter, search, dateFrom, dateTo, minAmount, maxAmount, paymentFilter]);

  const onTheWay = orders.filter((o: any) => o.customerOnWay && !o.pickupVerified);

  const filteredIds = filtered.map(o => o.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every(id => selected.has(id));
  const someSelected = selected.size > 0 && !allSelected;

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredIds));
    }
  };

  const toggleOne = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearFilters = () => {
    setSearch(""); setDateFrom(""); setDateTo(""); setMinAmount("");
    setMaxAmount(""); setPaymentFilter("all"); setFilter("all");
  };

  const hasActiveAdvanced = !!(dateFrom || dateTo || minAmount || maxAmount || paymentFilter !== "all");

  const selectedOrders = filtered.filter(o => selected.has(o.id));
  const selectedTotal = selectedOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);

  return (
    <div className="space-y-4">
      {/* Live "customers on the way" banner */}
      {onTheWay.length > 0 && (
        <Card className="p-4 bg-gradient-to-l from-blue-500 to-cyan-500 text-white border-0 shadow-lg shadow-blue-500/30 no-print">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center text-xl animate-bounce">🚗</div>
            <div className="flex-1">
              <p className="font-black text-base">{onTheWay.length} عميل في الطريق إلى الفرع</p>
              <p className="text-xs opacity-90 font-bold">جهّز طلباتهم للتسليم السريع</p>
            </div>
          </div>
          <div className="space-y-1.5 mt-3">
            {onTheWay.slice(0, 5).map((o: any) => {
              const minsAgo = Math.floor((Date.now() - new Date(o.customerOnWayAt).getTime()) / 60000);
              const remaining = Math.max(0, (o.customerOnWayEtaMin || 15) - minsAgo);
              return (
                <div key={o.id} className="bg-white/15 rounded-xl px-3 py-2 flex items-center justify-between text-xs font-bold" data-testid={`onway-${o.id}`}>
                  <span className="font-mono">#{(o.id || "").slice(-6).toUpperCase()}</span>
                  <span>{o.total} <RiyalSign /></span>
                  <span className={remaining < 3 ? "bg-amber-300 text-amber-900 px-2 py-0.5 rounded-lg" : ""}>
                    {remaining > 0 ? `يصل خلال ~${remaining} د` : "وصل تقريباً"}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Audio enable banner — shown until staff taps the button */}
      {!audioEnabled && (
        <div className="flex items-center gap-3 bg-amber-50 border-2 border-amber-300 rounded-2xl px-4 py-3 no-print">
          <span className="text-2xl">🔔</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-amber-800">تنبيهات الصوت معطّلة</p>
            <p className="text-xs text-amber-700 font-bold">اضغط على الزر لتفعيل صوت الطلبات الجديدة</p>
          </div>
          <Button
            size="sm"
            onClick={enableAudio}
            className="bg-amber-500 hover:bg-amber-600 text-white font-black shrink-0"
            data-testid="button-enable-audio"
          >
            تفعيل الصوت 🔊
          </Button>
        </div>
      )}
      {audioEnabled && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 no-print">
          <span className="text-lg">🔊</span>
          <p className="text-xs font-black text-emerald-700 flex-1">تنبيهات الصوت مفعّلة — ستسمع صوتاً عند كل طلب جديد</p>
          <button
            onClick={() => { audioEnabledRef.current = false; setAudioEnabled(false); }}
            className="text-xs text-emerald-600 hover:text-emerald-800 font-bold underline"
            data-testid="button-disable-audio"
          >
            إيقاف
          </button>
        </div>
      )}

      {/* Filters bar */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-3 h-4 w-4 text-gray-700" />
            <Input
              placeholder="بحث برقم الطلب، الكود، اسم العميل، أو الجوال…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-10"
              data-testid="input-orders-search"
            />
          </div>
          <Button
            variant={showAdvanced || hasActiveAdvanced ? "default" : "outline"}
            size="default"
            onClick={() => setShowAdvanced(s => !s)}
            data-testid="button-toggle-advanced"
          >
            <Filter className="h-4 w-4 ml-1" />
            فلاتر متقدمة
            {hasActiveAdvanced && <Badge className="mr-2 bg-[#DFB369] text-black">●</Badge>}
          </Button>
          <Button
            variant="outline"
            size="default"
            onClick={() => exportOrdersCsv(selected.size > 0 ? selectedOrders : filtered, `branch-orders-${new Date().toISOString().slice(0, 10)}.csv`)}
            disabled={filtered.length === 0}
            data-testid="button-export-csv"
          >
            <FileSpreadsheet className="h-4 w-4 ml-1" />
            Excel / CSV
          </Button>
        </div>

        <div className="flex gap-2 flex-wrap">
          {[
            { v: "all", l: "الكل" },
            { v: "pickup", l: "استلام" },
            { v: "pending", l: "بانتظار" },
            { v: "completed", l: "مكتملة" },
          ].map(o => (
            <Button
              key={o.v}
              variant={filter === o.v ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(o.v as any)}
              data-testid={`filter-${o.v}`}
            >
              {o.l}
            </Button>
          ))}
          {(hasActiveAdvanced || filter !== "all" || search) && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-red-600">
              <X className="h-4 w-4 ml-1" />
              مسح الفلاتر
            </Button>
          )}
        </div>

        {/* Advanced filters panel */}
        {showAdvanced && (
          <Card className="p-4 bg-[#FAF8F4] border-[#DFB369]/30">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-black mb-1 block">من تاريخ</Label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} data-testid="filter-date-from" />
              </div>
              <div>
                <Label className="text-xs font-black mb-1 block">إلى تاريخ</Label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} data-testid="filter-date-to" />
              </div>
              <div>
                <Label className="text-xs font-black mb-1 block">طريقة الدفع</Label>
                <select
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm font-bold"
                  data-testid="filter-payment"
                >
                  <option value="all">كل الطرق</option>
                  <option value="cash">نقداً</option>
                  <option value="cod">عند الاستلام</option>
                  <option value="wallet">محفظة</option>
                  <option value="tap">بطاقة</option>
                  <option value="stc_pay">STC Pay</option>
                  <option value="apple_pay">Apple Pay</option>
                  <option value="bank_transfer">تحويل بنكي</option>
                  <option value="tabby">Tabby</option>
                  <option value="tamara">Tamara</option>
                </select>
              </div>
              <div>
                <Label className="text-xs font-black mb-1 block">المبلغ من (<RiyalSign />)</Label>
                <Input type="number" min="0" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} placeholder="0" data-testid="filter-min-amount" />
              </div>
              <div>
                <Label className="text-xs font-black mb-1 block">المبلغ إلى (<RiyalSign />)</Label>
                <Input type="number" min="0" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} placeholder="∞" data-testid="filter-max-amount" />
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Bulk actions toolbar */}
      {filtered.length > 0 && (
        <Card className="p-3 bg-[#0F0F0F] text-white border-0 flex items-center justify-between gap-3 flex-wrap no-print">
          <div className="flex items-center gap-3">
            <Checkbox
              checked={allSelected || (someSelected && "indeterminate")}
              onCheckedChange={toggleAll}
              className="border-white data-[state=checked]:bg-[#DFB369] data-[state=checked]:text-black"
              data-testid="checkbox-select-all"
            />
            <span className="text-xs font-bold">
              {selected.size > 0 ? (
                <>محدد <span className="font-mono font-black text-[#DFB369]">{selected.size}</span> من {filtered.length} — إجمالي <span className="font-mono font-black text-[#DFB369]">{selectedTotal.toLocaleString("ar-SA")}</span> <RiyalSign /></>
              ) : (
                <>عرض {filtered.length} طلب</>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="bg-white/10 text-white border-white/30 hover:bg-white/20 hover:text-white"
              disabled={selected.size === 0}
              onClick={() => {
                if (selected.size > 10) {
                  if (!confirm(`سيتم فتح ${selected.size} نافذة طباعة. هل تريد المتابعة؟`)) return;
                }
                bulkPrintInvoices(Array.from(selected));
                toast({ title: "جاري فتح الفواتير", description: `${selected.size} فاتورة` });
              }}
              data-testid="button-bulk-print"
            >
              <Printer className="h-4 w-4 ml-1" />
              طباعة المحدد
            </Button>
            {selected.size > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="text-white hover:bg-white/10"
                onClick={() => setSelected(new Set())}
                data-testid="button-clear-selection"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </Card>
      )}

      {isLoading ? (
        <div className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <ShoppingBag className="h-12 w-12 text-gray-700 mx-auto mb-3" />
          <p className="font-black text-gray-800">لا توجد طلبات مطابقة</p>
          {(hasActiveAdvanced || search) && (
            <Button variant="link" size="sm" onClick={clearFilters} className="mt-2">مسح الفلاتر</Button>
          )}
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((o: any) => {
            const isSelected = selected.has(o.id);
            return (
              <Card
                key={o.id}
                className={`p-4 transition-all ${isSelected ? "border-[#DFB369] bg-[#DFB369]/5 shadow-md" : ""}`}
                data-testid={`row-order-${o.id}`}
              >
                <div className="flex items-start gap-3">
                  <div className="pt-1 shrink-0">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleOne(o.id)}
                      data-testid={`checkbox-order-${o.id}`}
                    />
                  </div>
                  <div className="flex-1 flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-mono font-black text-sm">#{(o.id || "").slice(-6).toUpperCase()}</span>
                        <StatusBadge status={o.status} />
                        {o.paymentStatus && o.paymentStatus !== "paid" && (
                          <Badge className="bg-amber-50 text-amber-800 border-amber-200">
                            {o.paymentStatus === "pending" ? "بانتظار الدفع" : o.paymentStatus}
                          </Badge>
                        )}
                        {o.shippingMethod === "pickup" && (
                          <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                            <MapPin className="h-3 w-3 ml-1" />
                            استلام
                          </Badge>
                        )}
                        {o.pickupVerified && (
                          <Badge className="bg-green-100 text-green-800 border-green-200">
                            ✓ تم الاستلام
                          </Badge>
                        )}
                      </div>
                      {o.customerName && (
                        <p className="text-xs text-gray-800 font-bold">{o.customerName} — <span dir="ltr">{o.customerPhone}</span></p>
                      )}
                      <p className="text-xs text-gray-800 font-bold">{o.deliveryAddress}</p>
                      <p className="text-xs text-gray-700 mt-1">
                        {o.items?.length || 0} منتج — <span className="font-black text-black">{o.total} <RiyalSign /></span>
                        {o.createdAt && <span className="text-gray-500 mr-2">— {new Date(o.createdAt).toLocaleDateString("ar-SA")}</span>}
                      </p>
                      {o.pickupCode && !o.pickupVerified && (
                        <p className="text-xs font-mono font-black text-primary mt-1">
                          الكود: {o.pickupCode}
                        </p>
                      )}
                    </div>
                    <PrintInvoiceButton orderId={o.id} />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BranchInventoryTab() {
  const { data: inventory = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/branch/inventory"],
  });
  const [edits, setEdits] = useState<Record<string, number>>({});
  const { toast } = useToast();

  const updateMut = useMutation({
    mutationFn: async ({ id, stock }: { id: string; stock: number }) => {
      const res = await apiRequest("PATCH", `/api/branch/inventory/${id}`, { stock });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم التحديث" });
      queryClient.invalidateQueries({ queryKey: ["/api/branch/inventory"] });
    },
  });

  const lowStock = inventory.filter((i: any) => Number(i.stock || 0) < LOW_STOCK_THRESHOLD);

  return (
    <div className="space-y-4">
      {lowStock.length > 0 && (
        <Card className="p-4 bg-red-50 border-2 border-red-200">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <h4 className="font-black text-red-800">⚠️ تنبيه: {lowStock.length} منتج بكمية منخفضة</h4>
          </div>
          <p className="text-xs text-red-700 font-bold">
            يرجى تحديث المخزون أو إعادة التزويد فوراً
          </p>
        </Card>
      )}

      {isLoading ? (
        <div className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></div>
      ) : inventory.length === 0 ? (
        <Card className="p-12 text-center">
          <Package className="h-12 w-12 text-gray-700 mx-auto mb-3" />
          <p className="font-black text-gray-800">لا توجد منتجات في مخزون الفرع</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {inventory.map((it: any) => {
            const id = it.id || it._id;
            const current = edits[id] ?? Number(it.stock || 0);
            const isLow = current < LOW_STOCK_THRESHOLD;
            const dirty = edits[id] !== undefined && edits[id] !== Number(it.stock || 0);
            return (
              <Card key={id} className={`p-4 ${isLow ? "border-red-300 bg-red-50/50" : ""}`}>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <p className="font-black text-sm">{it.productName || it.name || "—"}</p>
                    <p className="text-xs text-gray-700 font-bold">
                      {it.variantLabel ? <span className="ml-1">{it.variantLabel} • </span> : null}
                      <span className="font-mono">{it.sku || it.variantSku}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      value={current}
                      onChange={(e) => setEdits(p => ({ ...p, [id]: Math.max(0, Number(e.target.value) || 0) }))}
                      className={`w-24 text-center font-mono font-black ${isLow ? "border-red-300" : ""}`}
                      data-testid={`input-stock-${id}`}
                    />
                    <Button
                      size="sm"
                      disabled={!dirty || updateMut.isPending}
                      onClick={() => updateMut.mutate({ id, stock: current })}
                      data-testid={`button-save-stock-${id}`}
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                    {isLow && <Badge className="bg-red-100 text-red-800 border-red-200">منخفض</Badge>}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function BranchDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: branchInfo, isLoading } = useQuery<any>({
    queryKey: ["/api/branch/me"],
  });
  const { data: stats } = useQuery<any>({
    queryKey: ["/api/branch/stats"],
    refetchInterval: 60_000,
  });

  if (!user) {
    setLocation("/login");
    return null;
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!branchInfo?.branchId) {
    return (
      <Layout>
        <div className="container max-w-2xl mx-auto px-4 py-16 text-center">
          <AlertTriangle className="h-16 w-16 text-amber-500 mx-auto mb-4" />
          <h1 className="font-black text-2xl mb-2">لم يتم إسناد فرع لحسابك</h1>
          <p className="text-gray-700 font-bold mb-6">يرجى التواصل مع الإدارة لإسناد فرع لك</p>
          <Button onClick={() => setLocation("/")}>الرئيسية</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 pb-32" dir="rtl">
        <div className="container max-w-6xl mx-auto px-4 py-8 pb-24 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="font-black text-3xl tracking-tight" data-testid="text-branch-name">
                لوحة الفرع — {branchInfo.branch?.name || branchInfo.branchId}
              </h1>
              <p className="text-sm text-gray-700 font-bold mt-1">
                {branchInfo.branch?.address || ""}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["/api/branch/orders"] });
                queryClient.invalidateQueries({ queryKey: ["/api/branch/inventory"] });
              }}
              data-testid="button-refresh"
            >
              <RefreshCw className="h-4 w-4 ml-1" />
              تحديث
            </Button>
            <ShiftSummaryButton />
          </div>

          {/* Daily reminder banner */}
          {stats?.reminderDue && (
            <Card className="p-4 bg-amber-50 border-2 border-amber-300 no-print">
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-black text-amber-900 text-sm">
                    {stats.hoursSinceUpdate === null
                      ? "تذكير: لم يتم تحديث المخزون بعد"
                      : `تذكير: مرّ ${stats.hoursSinceUpdate} ساعة منذ آخر تحديث للمخزون`}
                  </p>
                  <p className="text-xs text-amber-800 font-bold mt-0.5">
                    يرجى مراجعة المخزون وتحديثه يومياً للحفاظ على الدقة
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Quick stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 no-print">
            <Card className="p-4">
              <div className="flex items-center gap-2 text-gray-700 text-xs font-bold mb-1">
                <CheckCircle className="h-4 w-4 text-green-600" />
                تسليمات اليوم
              </div>
              <p className="text-2xl font-black" data-testid="stat-today-pickups">{stats?.todayPickups ?? 0}</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-gray-700 text-xs font-bold mb-1">
                <ShoppingBag className="h-4 w-4 text-blue-600" />
                بانتظار الاستلام
              </div>
              <p className="text-2xl font-black" data-testid="stat-pending-pickups">{stats?.pendingPickups ?? 0}</p>
            </Card>
            <Card className={`p-4 ${stats?.lowStockCount ? "border-amber-300 bg-amber-50/30" : ""}`}>
              <div className="flex items-center gap-2 text-gray-700 text-xs font-bold mb-1">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                مخزون منخفض
              </div>
              <p className="text-2xl font-black" data-testid="stat-low-stock">{stats?.lowStockCount ?? 0}</p>
            </Card>
            <Card className={`p-4 ${stats?.outOfStockCount ? "border-red-300 bg-red-50/30" : ""}`}>
              <div className="flex items-center gap-2 text-gray-700 text-xs font-bold mb-1">
                <AlertCircle className="h-4 w-4 text-red-600" />
                نفذ المخزون
              </div>
              <p className="text-2xl font-black" data-testid="stat-out-of-stock">{stats?.outOfStockCount ?? 0}</p>
            </Card>
          </div>

          {/* Scanner always on top */}
          <PickupScanner />

          {/* Tabs */}
          <Tabs defaultValue="orders" className="w-full">
            <TabsList className="grid grid-cols-2 max-w-md">
              <TabsTrigger value="orders" data-testid="tab-orders">
                <ShoppingBag className="h-4 w-4 ml-1" />
                طلبات الفرع
              </TabsTrigger>
              <TabsTrigger value="inventory" data-testid="tab-inventory">
                <Package className="h-4 w-4 ml-1" />
                مخزون الفرع
              </TabsTrigger>
            </TabsList>
            <TabsContent value="orders" className="mt-4"><BranchOrdersTab /></TabsContent>
            <TabsContent value="inventory" className="mt-4"><BranchInventoryTab /></TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
}
