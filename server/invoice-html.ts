/**
 * Tax-invoice HTML generator (ZATCA Phase-1 compliant).
 *
 * Produces a print-ready, A4-sized, RTL Arabic + LTR English bilingual tax
 * invoice that:
 *   - Renders perfectly in any browser (no PDF dependency)
 *   - Includes the signed ZATCA TLV QR code as a base64 PNG
 *   - Can be opened standalone (used as an email attachment) OR served from an
 *     /api/orders/:id/invoice endpoint for in-app viewing/printing-to-PDF.
 *
 * Returned string is a complete <!DOCTYPE html> document with embedded styles
 * and the QR data-URL inline — zero external requests required.
 */
import { buildZatcaQrDataUrl } from "./zatca";
import { storage } from "./storage";

export interface InvoiceData {
  order: any;
  customer?: { name?: string; email?: string; phone?: string };
}

const PAYMENT_LABELS: Record<string, string> = {
  wallet: "محفظة آر اف",
  bank_transfer: "تحويل بنكي",
  tap: "بطاقة بنكية (Tap)",
  stc_pay: "STC Pay",
  apple_pay: "Apple Pay",
  tamara: "تمارا — تقسيط",
  tabby: "تابي — تقسيط",
  paymob: "بطاقة (Paymob)",
  cash: "الدفع عند الاستلام",
};

/**
 * HTML-escape any user/DB-provided string before injecting into the invoice
 * template. Prevents XSS via maliciously-crafted product titles, customer
 * names, addresses, etc. The invoice is served from an authenticated endpoint
 * AND emailed as an .html attachment, so a stored-XSS payload could otherwise
 * fire in either context.
 */
function esc(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtSAR(n: number): string {
  return Number(n || 0).toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: Date): string {
  return new Date(d).toLocaleString("ar-SA", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

export async function buildInvoiceHtml({ order, customer }: InvoiceData): Promise<string> {
  const settings: any = (await storage.getStoreSettings?.().catch(() => null)) || {};
  // Raw values used for ZATCA TLV (must NOT be HTML-escaped — that would
  // corrupt the signed payload). Display variants are escaped below.
  const sellerName = settings.storeNameAr || "عطور آر اف";
  const sellerNameEn = settings.storeNameEn || "RF Perfume";
  const vatNumber = settings.vatNumber || "";
  const crNumber = settings.crNumber || "0000203202";
  const sellerAddress = settings.companyAddress || settings.address || "المملكة العربية السعودية";

  const issueDate = new Date(order.paidAt || order.createdAt || Date.now());
  const orderRef = String(order._id || order.id).slice(-8).toUpperCase();
  const invoiceNumber = `INV-${orderRef}-${issueDate.getFullYear()}`;
  const total = Number(order.total) || 0;
  const subtotal = Number(order.subtotal) || 0;
  const vatAmount = Number(order.vatAmount) || 0;
  const shipping = Number(order.shippingCost) || 0;
  const discount = Number(order.discountAmount) || 0;

  // ── ZATCA Phase-1 QR ──
  let qrDataUrl = "";
  try {
    const qr = await buildZatcaQrDataUrl({
      sellerName,
      vatNumber,
      timestamp: issueDate,
      total,
      vatAmount,
    });
    qrDataUrl = qr.dataUrl;
  } catch (e: any) {
    console.warn("[invoice-html] QR generation failed:", e?.message);
  }

  const customerName = customer?.name || order.customerName || "عميل";
  const customerPhone = customer?.phone || order.customerPhone || "";
  const customerEmail = customer?.email || "";
  const deliveryAddress = order.deliveryAddress || "";

  const itemRows = (order.items || []).map((item: any, idx: number) => {
    const lineSubtotal = Number(item.price) * Number(item.quantity);
    const lineVat = lineSubtotal * 0.15;
    const lineTotal = lineSubtotal + lineVat;
    const titleParts =
      esc(item.title || "") +
      (item.color ? ` — ${esc(item.color)}` : "") +
      (item.size ? ` / ${esc(item.size)}` : "");
    return `
      <tr>
        <td class="cell c">${idx + 1}</td>
        <td class="cell r">${titleParts}</td>
        <td class="cell c">${esc(item.quantity)}</td>
        <td class="cell l">${fmtSAR(item.price)}</td>
        <td class="cell l">${fmtSAR(lineSubtotal)}</td>
        <td class="cell l">${fmtSAR(lineVat)}</td>
        <td class="cell l strong">${fmtSAR(lineTotal)}</td>
      </tr>
    `;
  }).join("");

  const paymentLabel = PAYMENT_LABELS[order.paymentMethod] || esc(order.paymentMethod || "غير محدد");
  const paymentStatusLabel = order.paymentStatus === "paid" ? "مدفوعة ✓" : "غير مدفوعة";

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8" />
<title>فاتورة ضريبية #${orderRef} — ${esc(sellerName)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background:#f0f0f0; color:#1a1a1a; padding:20px 12px; }
  .page { max-width: 820px; margin: 0 auto; background:#fff; padding: 36px 40px; border-radius: 6px; box-shadow: 0 4px 24px rgba(0,0,0,0.06); }
  .hdr { display:flex; justify-content:space-between; align-items:flex-start; gap:24px; padding-bottom:24px; border-bottom: 3px solid #1a2744; margin-bottom: 28px; }
  .hdr-left { flex:1; }
  .hdr-right { text-align:left; min-width: 180px; }
  h1 { font-size: 26px; font-weight: 900; color:#1a2744; letter-spacing:-0.01em; margin-bottom:4px; }
  .subtitle { font-size: 12px; color:#666; font-weight: 700; letter-spacing:0.05em; }
  .badge { display:inline-block; padding: 6px 14px; font-size:11px; font-weight:900; border-radius:4px; letter-spacing:0.08em; margin-top:8px; }
  .badge-paid { background:#dcfce7; color:#166534; }
  .badge-unpaid { background:#fef3c7; color:#92400e; }
  .meta { display:grid; grid-template-columns: 1fr 1fr; gap: 28px 36px; margin-bottom: 28px; }
  .meta-block h3 { font-size: 11px; font-weight:900; color:#1a2744; letter-spacing:0.12em; padding-bottom:8px; border-bottom:1px solid #e5e7eb; margin-bottom:10px; }
  .meta-row { display:flex; justify-content:space-between; gap:8px; font-size:12.5px; padding: 5px 0; }
  .meta-row .lbl { color:#666; font-weight:700; }
  .meta-row .val { color:#1a1a1a; font-weight:700; text-align:left; }
  table.items { width:100%; border-collapse:collapse; margin: 8px 0 16px; font-size:12.5px; }
  table.items thead th { background:#1a2744; color:#fff; padding:10px 8px; font-size:10.5px; font-weight:900; letter-spacing:0.05em; }
  table.items thead th.r { text-align:right; }
  table.items thead th.c { text-align:center; }
  table.items thead th.l { text-align:left; }
  .cell { padding: 10px 8px; border-bottom: 1px solid #eee; font-weight:600; }
  .cell.r { text-align:right; }
  .cell.c { text-align:center; }
  .cell.l { text-align:left; }
  .cell.strong { font-weight: 900; color:#1a2744; }
  .totals { display:flex; justify-content:flex-start; margin-top: 8px; }
  .totals-table { min-width: 320px; font-size: 13px; }
  .totals-table .row { display:flex; justify-content:space-between; padding: 8px 0; border-bottom:1px solid #f0f0f0; }
  .totals-table .row .lbl { color:#666; font-weight:700; }
  .totals-table .row .val { font-weight: 800; color:#1a1a1a; }
  .totals-table .grand { padding-top:14px; margin-top:8px; border-top: 2px solid #1a2744; border-bottom:none; font-size: 16px; }
  .totals-table .grand .lbl, .totals-table .grand .val { color:#1a2744; font-weight: 900; }
  .qr-block { display:flex; justify-content:space-between; align-items:flex-end; gap:24px; margin-top:32px; padding-top:24px; border-top:1px solid #e5e7eb; }
  .qr-img { width: 130px; height:130px; border:1px solid #e5e7eb; border-radius:6px; padding:6px; background:#fff; }
  .qr-caption { font-size:10px; color:#666; font-weight:700; text-align:center; margin-top:6px; letter-spacing:0.06em; }
  .footer-note { flex:1; font-size:11px; color:#888; line-height:1.7; }
  .footer-note strong { color:#1a2744; }
  .stamp { font-size:10px; color:#999; text-align:center; margin-top: 24px; padding-top:16px; border-top: 1px dashed #ddd; }
  .print-btn { position:fixed; top:16px; left:16px; padding:10px 20px; background:#DFB369; color:#1a2744; border:none; border-radius:4px; font-weight:900; font-size:13px; cursor:pointer; box-shadow:0 4px 12px rgba(0,0,0,0.1); }
  .print-btn:hover { background:#c99e57; }
  @media print {
    body { background:#fff; padding:0; }
    .page { box-shadow:none; max-width:none; padding: 24px; }
    .print-btn { display:none; }
  }
</style>
</head>
<body>
  <button class="print-btn" onclick="window.print()" data-testid="button-print-invoice">طباعة / حفظ PDF</button>
  <div class="page">
    <div class="hdr">
      <div class="hdr-left">
        <h1>فاتورة ضريبية مبسطة</h1>
        <div class="subtitle">Simplified Tax Invoice</div>
        <div class="badge ${order.paymentStatus === "paid" ? "badge-paid" : "badge-unpaid"}">${paymentStatusLabel}</div>
      </div>
      <div class="hdr-right">
        <div style="font-size:18px;font-weight:900;color:#1a2744;">${esc(sellerName)}</div>
        <div style="font-size:11px;color:#666;font-weight:700;margin-top:2px;">${esc(sellerNameEn)}</div>
        <div style="font-size:11px;color:#666;font-weight:600;margin-top:8px;line-height:1.6;">${esc(sellerAddress)}</div>
        ${vatNumber ? `<div style="font-size:11px;color:#1a2744;font-weight:800;margin-top:6px;">الرقم الضريبي: ${esc(vatNumber)}</div>` : ""}
        ${crNumber ? `<div style="font-size:11px;color:#666;font-weight:700;">السجل التجاري: ${esc(crNumber)}</div>` : ""}
      </div>
    </div>

    <div class="meta">
      <div class="meta-block">
        <h3>تفاصيل الفاتورة</h3>
        <div class="meta-row"><span class="lbl">رقم الفاتورة</span><span class="val">${esc(invoiceNumber)}</span></div>
        <div class="meta-row"><span class="lbl">رقم الطلب</span><span class="val">#${esc(orderRef)}</span></div>
        <div class="meta-row"><span class="lbl">تاريخ الإصدار</span><span class="val">${esc(fmtDate(issueDate))}</span></div>
        <div class="meta-row"><span class="lbl">طريقة الدفع</span><span class="val">${paymentLabel}</span></div>
      </div>
      <div class="meta-block">
        <h3>بيانات العميل</h3>
        <div class="meta-row"><span class="lbl">الاسم</span><span class="val">${esc(customerName)}</span></div>
        ${customerPhone ? `<div class="meta-row"><span class="lbl">الجوال</span><span class="val" dir="ltr">${esc(customerPhone)}</span></div>` : ""}
        ${customerEmail ? `<div class="meta-row"><span class="lbl">البريد</span><span class="val" dir="ltr">${esc(customerEmail)}</span></div>` : ""}
        ${deliveryAddress ? `<div class="meta-row"><span class="lbl">العنوان</span><span class="val">${esc(deliveryAddress)}</span></div>` : ""}
      </div>
    </div>

    <table class="items">
      <thead>
        <tr>
          <th class="c">#</th>
          <th class="r">المنتج / Description</th>
          <th class="c">الكمية</th>
          <th class="l">السعر</th>
          <th class="l">الإجمالي قبل الضريبة</th>
          <th class="l">الضريبة (15%)</th>
          <th class="l">الإجمالي شامل الضريبة</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>

    <div class="totals">
      <div class="totals-table">
        <div class="row"><span class="lbl">المجموع قبل الضريبة</span><span class="val">${fmtSAR(subtotal)} ر.س</span></div>
        ${shipping > 0 ? `<div class="row"><span class="lbl">رسوم الشحن</span><span class="val">${fmtSAR(shipping)} ر.س</span></div>` : ""}
        ${discount > 0 ? `<div class="row"><span class="lbl">الخصم</span><span class="val" style="color:#16a34a">- ${fmtSAR(discount)} ر.س</span></div>` : ""}
        <div class="row"><span class="lbl">ضريبة القيمة المضافة (15%)</span><span class="val">${fmtSAR(vatAmount)} ر.س</span></div>
        <div class="row grand"><span class="lbl">الإجمالي شامل الضريبة</span><span class="val">${fmtSAR(total)} ر.س</span></div>
      </div>
    </div>

    <div class="qr-block">
      <div class="footer-note">
        <strong>${esc(sellerName)}</strong> — هذه فاتورة ضريبية مبسطة صادرة إلكترونياً ومتوافقة مع متطلبات هيئة الزكاة والضريبة والجمارك (ZATCA — المرحلة الأولى).<br/>
        QR code يحتوي على بيانات البائع، رقم الضريبة، التاريخ، الإجمالي، وقيمة الضريبة وفق الترميز TLV المعتمد.<br/>
        <strong>This is a simplified tax invoice issued electronically and compliant with ZATCA Phase-1 e-invoicing requirements.</strong>
      </div>
      ${qrDataUrl ? `
        <div style="text-align:center;">
          <img src="${qrDataUrl}" alt="ZATCA QR" class="qr-img" />
          <div class="qr-caption">امسح للتحقق · ZATCA QR</div>
        </div>` : ""}
    </div>

    <div class="stamp">شكراً لاختياركم ${esc(sellerName)} — Thank you for choosing ${esc(sellerNameEn)}</div>
  </div>
</body>
</html>`;
}
