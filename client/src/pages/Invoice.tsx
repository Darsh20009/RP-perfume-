import { useEffect, useMemo } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Printer } from "lucide-react";
import { RiyalSign } from "@/components/RiyalSign";
const logoDark = "/images/logos/logo-dark.png";
const logoWhite = "/images/logos/logo-light-nobg.png";

interface ZatcaPayload {
  qr: string;
  base64: string;
  sellerName: string;
  vatNumber: string;
  total: number;
  vatAmount: number;
  issuedAt: string;
}

interface OrderItem {
  productName?: string;
  name?: string;
  productImage?: string;
  quantity: number;
  price: number;
  total?: number;
  variantSku?: string;
  size?: string;
}

interface OrderData {
  id: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  deliveryAddress?: string;
  items: OrderItem[];
  subtotal?: number;
  shippingCost?: number;
  discount?: number;
  vatAmount?: number;
  total: number;
  paymentMethod?: string;
  shippingMethod?: string;
  status?: string;
  createdAt?: string;
  pickupBranch?: string;
  pickupCode?: string;
  notes?: string;
}

const paymentLabels: Record<string, string> = {
  wallet: "محفظة إلكترونية",
  tap: "بطاقة بنكية",
  stc_pay: "STC Pay",
  apple_pay: "Apple Pay",
  bank_transfer: "تحويل بنكي",
  cash: "نقداً",
  cod: "الدفع عند الاستلام",
  tabby: "Tabby — أقساط",
  tamara: "Tamara — أقساط",
};

function formatDate(d?: string) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("ar-SA", {
      year: "numeric", month: "long", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return "—"; }
}

function formatMoney(n: number | undefined) {
  return (Number(n) || 0).toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Invoice() {
  const params = useParams<{ id: string }>();
  const orderId = params?.id;

  const { data: order, isLoading } = useQuery<OrderData>({
    queryKey: ["/api/orders", orderId],
    enabled: !!orderId,
  });

  const { data: zatca } = useQuery<ZatcaPayload>({
    queryKey: ["/api/orders", orderId, "zatca-qr"],
    enabled: !!orderId,
  });

  // Auto-print when ?print=1
  useEffect(() => {
    if (!order || !zatca) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("print") === "1") {
      const t = setTimeout(() => window.print(), 500);
      return () => clearTimeout(t);
    }
  }, [order, zatca]);

  const totals = useMemo(() => {
    if (!order) return null;
    const subtotal = Number(order.subtotal) || (order.items || []).reduce((s, i) => s + ((i.total ?? i.price * i.quantity) || 0), 0);
    const shipping = Number(order.shippingCost) || 0;
    const discount = Number(order.discount) || 0;
    const vat = Number(order.vatAmount) || 0;
    // Always trust the server-stored total (matches the ZATCA QR exactly).
    // Only fall back to a computed sum if order.total is missing/undefined.
    const total = order.total != null ? Number(order.total) : subtotal + shipping - discount + vat;
    return { subtotal, shipping, discount, vat, total };
  }, [order]);

  if (isLoading || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-[#DFB369]" />
      </div>
    );
  }

  const refNum = (order.id || "").slice(-8).toUpperCase();
  const sellerName = zatca?.sellerName || "عطور آر اف — RF Perfume";
  const vatNumber = zatca?.vatNumber || "";

  return (
    <div className="bg-white min-h-screen" dir="rtl">
      {/* Print-only styles */}
      <style>{`
        @page { size: A4; margin: 12mm 10mm; }
        @media print {
          body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .invoice-page { box-shadow: none !important; margin: 0 !important; }
        }
        .invoice-page {
          font-family: 'Alexandria', system-ui, sans-serif;
          color: #0F0F0F;
        }
        .gold-line {
          background: linear-gradient(90deg, transparent 0%, #DFB369 20%, #DFB369 80%, transparent 100%);
          height: 2px;
        }
      `}</style>

      {/* Action bar (screen only) */}
      <div className="no-print sticky top-0 z-10 bg-[#0F0F0F] text-white py-3 px-6 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold opacity-70">فاتورة رقم</span>
          <span className="font-mono font-black text-base tracking-wider">#{refNum}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="bg-[#DFB369] hover:bg-[#c89853] text-[#0F0F0F] font-black px-5 py-2 rounded-xl text-sm flex items-center gap-2 transition-colors"
            data-testid="button-print-invoice"
          >
            <Printer className="h-4 w-4" />
            طباعة الفاتورة
          </button>
        </div>
      </div>

      {/* Invoice canvas */}
      <div className="invoice-page max-w-[210mm] mx-auto bg-white shadow-2xl my-6 print:my-0 print:shadow-none overflow-hidden">
        {/* ── Formal Dark Header Band with White Logo ───────────────────────── */}
        <div
          className="relative px-10 py-7 text-white overflow-hidden"
          style={{
            background:
              "linear-gradient(135deg, #0F0F0F 0%, #2B2B60 45%, #1c1c45 100%)",
          }}
        >
          {/* Decorative gold corners */}
          <div className="absolute top-0 right-0 w-24 h-24 border-t-2 border-r-2 border-[#DFB369]/40" />
          <div className="absolute bottom-0 left-0 w-24 h-24 border-b-2 border-l-2 border-[#DFB369]/40" />

          <div className="relative flex items-center justify-between gap-6">
            {/* Right: brand info (RTL primary) */}
            <div className="text-right flex-1 min-w-0">
              <div className="text-[10px] font-black tracking-[0.4em] uppercase text-[#DFB369] mb-2">
                Official Tax Invoice · KSA
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white mb-1 leading-tight">
                {sellerName}
              </h1>
              <p className="text-[11px] text-white/70 font-bold leading-relaxed">
                عطور فاخرة وأصلية — صناعة شرقية بمعايير عالمية
              </p>
              {vatNumber && (
                <div className="mt-3 inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-[#DFB369]/30 rounded-md px-3 py-1.5">
                  <span className="text-[9px] font-black tracking-widest text-[#DFB369] uppercase">VAT</span>
                  <span className="font-mono font-black text-xs text-white" dir="ltr">{vatNumber}</span>
                </div>
              )}
            </div>

            {/* Left: white logo */}
            <div className="shrink-0 flex flex-col items-center gap-2">
              <img
                src={logoWhite}
                alt="RF Perfume"
                className="h-20 w-auto object-contain drop-shadow-[0_2px_8px_rgba(223,179,105,0.3)]"
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = logoDark; }}
              />
              <div className="text-[8px] font-black tracking-[0.3em] uppercase text-[#DFB369]">rfperfume.sa</div>
            </div>
          </div>
        </div>

        {/* Body padding wrapper */}
        <div className="px-10 pt-6 pb-10">
          {/* Title bar */}
          <div className="mb-6 text-center">
            <div className="inline-flex flex-col items-center gap-1 bg-gradient-to-l from-[#850935] via-[#7a0830] to-[#5d0625] text-white px-10 py-3 rounded-md shadow-lg shadow-[#850935]/20 border border-[#DFB369]/30">
              <h2 className="text-lg font-black tracking-wider">فاتورة ضريبية مبسّطة</h2>
              <p className="text-[10px] font-bold tracking-[0.3em] text-[#DFB369]">SIMPLIFIED TAX INVOICE</p>
            </div>
          </div>

        {/* Meta + QR */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          <div className="col-span-2 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-700 font-black mb-1">رقم الفاتورة</p>
              <p className="font-mono font-black text-lg text-[#2B2B60]">#{refNum}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-700 font-black mb-1">تاريخ الإصدار</p>
              <p className="font-bold text-sm">{formatDate(order.createdAt)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-700 font-black mb-1">العميل</p>
              <p className="font-bold text-sm">{order.customerName || "—"}</p>
              {order.customerPhone && (
                <p className="text-xs text-gray-700 font-mono mt-0.5" dir="ltr">{order.customerPhone}</p>
              )}
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-700 font-black mb-1">طريقة الاستلام</p>
              <p className="font-bold text-sm">
                {order.shippingMethod === "pickup" ? "استلام من الفرع" : "توصيل للعنوان"}
              </p>
              {order.pickupCode && order.shippingMethod === "pickup" && (
                <p className="text-xs text-[#DFB369] font-mono font-black mt-0.5">كود: {order.pickupCode}</p>
              )}
            </div>
            {order.deliveryAddress && (
              <div className="col-span-2">
                <p className="text-[10px] uppercase tracking-widest text-gray-700 font-black mb-1">العنوان / الفرع</p>
                <p className="font-bold text-sm leading-relaxed">{order.deliveryAddress}</p>
              </div>
            )}
          </div>

          {/* ZATCA QR */}
          <div className="text-center border-2 border-[#DFB369]/30 rounded-2xl p-3 bg-[#FAF8F4]">
            {zatca?.qr ? (
              <img src={zatca.qr} alt="ZATCA QR" className="w-full h-auto max-w-[180px] mx-auto" />
            ) : (
              <div className="aspect-square bg-gray-100 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            )}
            <p className="text-[10px] font-black text-[#2B2B60] mt-2 tracking-wider">ZATCA QR</p>
            <p className="text-[9px] text-gray-700 font-bold">امسح للتحقق من صحة الفاتورة</p>
          </div>
        </div>

        {/* Items table */}
        <div className="rounded-xl overflow-hidden border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#0F0F0F] text-white">
                <th className="text-right p-3 font-black text-xs uppercase tracking-wider">#</th>
                <th className="text-right p-3 font-black text-xs uppercase tracking-wider">الصنف</th>
                <th className="text-center p-3 font-black text-xs uppercase tracking-wider w-20">الكمية</th>
                <th className="text-center p-3 font-black text-xs uppercase tracking-wider w-28">السعر</th>
                <th className="text-center p-3 font-black text-xs uppercase tracking-wider w-32">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {(order.items || []).map((item, idx) => {
                const lineTotal = item.total ?? (item.price * item.quantity);
                return (
                  <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-[#FAF8F4]/50"}>
                    <td className="p-3 font-mono font-black text-gray-700 text-xs">{String(idx + 1).padStart(2, "0")}</td>
                    <td className="p-3">
                      <p className="font-bold">{item.productName || item.name}</p>
                      {item.size && <p className="text-[11px] text-gray-700 font-bold mt-0.5">حجم: {item.size}</p>}
                      {item.variantSku && <p className="text-[10px] text-gray-700 font-mono mt-0.5" dir="ltr">SKU: {item.variantSku}</p>}
                    </td>
                    <td className="p-3 text-center font-black">{item.quantity}</td>
                    <td className="p-3 text-center font-mono font-bold">{formatMoney(item.price)}</td>
                    <td className="p-3 text-center font-mono font-black text-[#2B2B60]">{formatMoney(lineTotal)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        {totals && (
          <div className="mt-6 grid grid-cols-2 gap-6">
            <div className="text-xs text-gray-700 leading-relaxed font-bold">
              {order.notes && (
                <>
                  <p className="font-black text-[#2B2B60] mb-1">ملاحظات:</p>
                  <p>{order.notes}</p>
                </>
              )}
              <p className="font-black text-[#2B2B60] mt-3 mb-1">طريقة الدفع:</p>
              <p>{paymentLabels[order.paymentMethod || ""] || order.paymentMethod || "—"}</p>
            </div>

            <div className="bg-[#FAF8F4] rounded-2xl p-5 space-y-2 border border-[#DFB369]/30">
              <div className="flex justify-between text-sm">
                <span className="font-bold text-gray-800">المجموع الفرعي</span>
                <span className="font-mono font-bold">{formatMoney(totals.subtotal)} <RiyalSign /></span>
              </div>
              {totals.shipping > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="font-bold text-gray-800">الشحن</span>
                  <span className="font-mono font-bold">{formatMoney(totals.shipping)} <RiyalSign /></span>
                </div>
              )}
              {totals.discount > 0 && (
                <div className="flex justify-between text-sm text-emerald-700">
                  <span className="font-bold">الخصم</span>
                  <span className="font-mono font-bold">−{formatMoney(totals.discount)} <RiyalSign /></span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="font-bold text-gray-800">ضريبة القيمة المضافة (15%)</span>
                <span className="font-mono font-bold">{formatMoney(totals.vat)} <RiyalSign /></span>
              </div>
              <div className="gold-line my-2" />
              <div className="flex justify-between items-baseline">
                <span className="font-black text-base text-[#2B2B60]">الإجمالي النهائي</span>
                <span className="font-mono font-black text-2xl text-[#850935]" data-testid="text-invoice-total">
                  {formatMoney(totals.total)} <span className="text-sm"><RiyalSign /></span>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-10 pt-6 border-t border-gray-200 text-center text-xs text-gray-700 font-bold">
          <div className="gold-line mb-4" />
          <p className="mb-1">شكراً لاختياركم {sellerName}</p>
          <p className="opacity-70">للاستفسار: support@rfperfume.sa</p>
          <p className="opacity-50 mt-2 text-[10px]">
            هذه الفاتورة تم إصدارها إلكترونياً وفقاً لمتطلبات هيئة الزكاة والضريبة والجمارك (ZATCA)
          </p>
        </div>
        </div> {/* /body padding wrapper */}
      </div>
    </div>
  );
}
