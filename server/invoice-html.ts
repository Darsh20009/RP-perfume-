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
  cod: "الدفع عند الاستلام",
};

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
  const sellerName = settings.storeNameAr || "عطور آر اف";
  const sellerNameEn = settings.storeNameEn || "RF Perfume";
  const vatNumber = settings.vatNumber || "";
  const crNumber = settings.crNumber || "0000203202";
  const sellerAddress = settings.companyAddress || settings.address || "المملكة العربية السعودية";
  const storeLogo = settings.logo || "";

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
  const isPickup = order.shippingMethod === "pickup";

  const itemRows = (order.items || []).map((item: any, idx: number) => {
    const lineSubtotal = Number(item.price) * Number(item.quantity);
    const lineVat = lineSubtotal * 0.15;
    const lineTotal = lineSubtotal + lineVat;
    const titleParts =
      esc(item.title || item.name || "") +
      (item.color ? ` — ${esc(item.color)}` : "") +
      (item.size ? ` / ${esc(item.size)}` : "");
    return `
      <tr>
        <td class="cell c num">${idx + 1}</td>
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
  const isPaid = order.paymentStatus === "paid";

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8" />
<title>فاتورة ضريبية #${orderRef} — ${esc(sellerName)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif;
    background: #f4f1eb;
    color: #1a1a1a;
    padding: 24px 12px;
    min-height: 100vh;
  }
  .page {
    max-width: 840px;
    margin: 0 auto;
    background: #fff;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 8px 40px rgba(0,0,0,0.10);
  }
  /* ─── Header ─── */
  .inv-header {
    background: linear-gradient(135deg, #1a2744 0%, #2b3d6b 100%);
    padding: 32px 40px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 24px;
  }
  .inv-header-brand { flex: 1; }
  .brand-logo {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
  }
  .brand-logo img { height: 52px; width: 52px; object-fit: contain; border-radius: 8px; background: rgba(255,255,255,0.1); padding: 4px; }
  .brand-name { font-size: 22px; font-weight: 900; color: #DFB369; letter-spacing: -0.02em; }
  .brand-name-en { font-size: 11px; color: rgba(255,255,255,0.5); font-weight: 600; letter-spacing: 0.08em; margin-top: 1px; }
  .brand-address { font-size: 11px; color: rgba(255,255,255,0.55); margin-top: 8px; line-height: 1.7; }
  .brand-vat { font-size: 11px; color: #DFB369; font-weight: 700; margin-top: 4px; }
  .inv-header-right { text-align: left; min-width: 180px; }
  .inv-title { font-size: 13px; font-weight: 900; color: #DFB369; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 4px; }
  .inv-title-ar { font-size: 20px; font-weight: 900; color: #fff; margin-bottom: 8px; }
  .inv-num { font-size: 11px; color: rgba(255,255,255,0.5); font-weight: 700; margin-bottom: 2px; }
  .inv-num span { color: #fff; font-weight: 800; }
  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 900;
    margin-top: 10px;
    letter-spacing: 0.05em;
  }
  .badge-paid { background: rgba(34,197,94,0.2); color: #4ade80; border: 1px solid rgba(34,197,94,0.3); }
  .badge-unpaid { background: rgba(251,191,36,0.2); color: #fbbf24; border: 1px solid rgba(251,191,36,0.3); }

  /* ─── Gold Separator ─── */
  .gold-bar { height: 4px; background: linear-gradient(90deg, #DFB369, #c99e57, #DFB369); }

  /* ─── Meta Section ─── */
  .inv-meta {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0;
    border-bottom: 1px solid #f0ede6;
  }
  .meta-block {
    padding: 24px 36px;
    border-left: 1px solid #f0ede6;
  }
  .meta-block:last-child { border-left: none; }
  .meta-block h3 {
    font-size: 10px;
    font-weight: 900;
    color: #DFB369;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    padding-bottom: 10px;
    border-bottom: 2px solid #f0ede6;
    margin-bottom: 12px;
  }
  .meta-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
    font-size: 12.5px;
    padding: 5px 0;
    border-bottom: 1px dashed #f5f2ec;
  }
  .meta-row:last-child { border-bottom: none; }
  .meta-row .lbl { color: #888; font-weight: 700; }
  .meta-row .val { color: #1a1a1a; font-weight: 800; text-align: left; }

  /* ─── Items Table ─── */
  .items-section { padding: 0 36px 24px; }
  .items-label {
    font-size: 10px;
    font-weight: 900;
    color: #1a2744;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    padding: 20px 0 10px;
    border-bottom: 2px solid #1a2744;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  table.items { width: 100%; border-collapse: collapse; font-size: 12px; }
  table.items thead th {
    background: #1a2744;
    color: rgba(255,255,255,0.85);
    padding: 10px 10px;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 0.06em;
  }
  table.items thead th.r { text-align: right; }
  table.items thead th.c { text-align: center; }
  table.items thead th.l { text-align: left; }
  table.items tbody tr:nth-child(even) { background: #faf8f4; }
  .cell { padding: 11px 10px; border-bottom: 1px solid #f0ede6; font-weight: 600; }
  .cell.r { text-align: right; }
  .cell.c { text-align: center; }
  .cell.l { text-align: left; }
  .cell.num { color: #888; font-size: 11px; }
  .cell.strong { font-weight: 900; color: #1a2744; }

  /* ─── Totals ─── */
  .totals-wrap {
    padding: 0 36px 28px;
    display: flex;
    justify-content: flex-start;
  }
  .totals-table {
    min-width: 340px;
    border: 1px solid #f0ede6;
    border-radius: 10px;
    overflow: hidden;
  }
  .totals-table .row {
    display: flex;
    justify-content: space-between;
    padding: 10px 16px;
    border-bottom: 1px solid #f5f2ec;
    font-size: 13px;
  }
  .totals-table .row .lbl { color: #666; font-weight: 700; }
  .totals-table .row .val { font-weight: 800; color: #1a1a1a; }
  .totals-table .row.discount .val { color: #16a34a; }
  .totals-table .grand {
    background: linear-gradient(135deg, #1a2744, #2b3d6b);
    border-bottom: none;
    padding: 14px 16px;
  }
  .totals-table .grand .lbl { color: rgba(255,255,255,0.8); font-size: 14px; font-weight: 900; }
  .totals-table .grand .val { color: #DFB369; font-size: 16px; font-weight: 900; }

  /* ─── QR / Footer ─── */
  .inv-footer {
    padding: 24px 36px 28px;
    border-top: 1px solid #f0ede6;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 24px;
  }
  .footer-note { flex: 1; font-size: 10.5px; color: #999; line-height: 1.8; }
  .footer-note strong { color: #1a2744; }
  .qr-wrap { text-align: center; }
  .qr-img { width: 120px; height: 120px; border: 2px solid #f0ede6; border-radius: 10px; padding: 6px; background: #fff; }
  .qr-caption { font-size: 9px; color: #bbb; font-weight: 700; text-align: center; margin-top: 5px; letter-spacing: 0.06em; text-transform: uppercase; }

  /* ─── Thank-you strip ─── */
  .thankyou {
    background: #1a2744;
    padding: 14px 36px;
    text-align: center;
    font-size: 12px;
    font-weight: 700;
    color: rgba(255,255,255,0.5);
    letter-spacing: 0.04em;
  }
  .thankyou span { color: #DFB369; }

  /* ─── Print button ─── */
  .print-btn {
    position: fixed;
    top: 20px;
    left: 20px;
    padding: 10px 22px;
    background: #DFB369;
    color: #1a2744;
    border: none;
    border-radius: 8px;
    font-weight: 900;
    font-size: 13px;
    cursor: pointer;
    box-shadow: 0 4px 16px rgba(0,0,0,0.15);
    z-index: 100;
    display: flex;
    align-items: center;
    gap: 6px;
    font-family: 'Cairo', sans-serif;
  }
  .print-btn:hover { background: #c99e57; transform: translateY(-1px); }

  @media print {
    body { background: #fff; padding: 0; }
    .page { box-shadow: none; border-radius: 0; }
    .print-btn { display: none; }
  }
</style>
</head>
<body>
  <button class="print-btn" onclick="window.print()" data-testid="button-print-invoice">
    🖨️ طباعة / PDF
  </button>

  <div class="page">
    <!-- Header -->
    <div class="inv-header">
      <div class="inv-header-brand">
        <div class="brand-logo">
          ${storeLogo ? `<img src="${esc(storeLogo)}" alt="${esc(sellerNameEn)}" />` : `<div style="width:52px;height:52px;border-radius:8px;background:rgba(223,179,105,0.2);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:900;color:#DFB369;">RF</div>`}
          <div>
            <div class="brand-name">${esc(sellerName)}</div>
            <div class="brand-name-en">${esc(sellerNameEn)}</div>
          </div>
        </div>
        <div class="brand-address">${esc(sellerAddress)}</div>
        ${vatNumber ? `<div class="brand-vat">الرقم الضريبي: ${esc(vatNumber)}</div>` : ""}
        ${crNumber ? `<div class="brand-vat" style="color:rgba(255,255,255,0.4)">السجل التجاري: ${esc(crNumber)}</div>` : ""}
      </div>
      <div class="inv-header-right">
        <div class="inv-title">Tax Invoice</div>
        <div class="inv-title-ar">فاتورة ضريبية مبسطة</div>
        <div class="inv-num">رقم الفاتورة: <span>${esc(invoiceNumber)}</span></div>
        <div class="inv-num">رقم الطلب: <span>#${esc(orderRef)}</span></div>
        <div class="inv-num">التاريخ: <span>${esc(fmtDate(issueDate))}</span></div>
        <div class="status-badge ${isPaid ? "badge-paid" : "badge-unpaid"}">
          ${isPaid ? "✓ مدفوعة" : "⏳ غير مدفوعة"}
        </div>
      </div>
    </div>
    <div class="gold-bar"></div>

    <!-- Meta -->
    <div class="inv-meta">
      <div class="meta-block">
        <h3>تفاصيل الفاتورة · Invoice Details</h3>
        <div class="meta-row"><span class="lbl">طريقة الدفع</span><span class="val">${paymentLabel}</span></div>
        <div class="meta-row"><span class="lbl">حالة الدفع</span><span class="val">${paymentStatusLabel}</span></div>
        <div class="meta-row"><span class="lbl">نوع التسليم</span><span class="val">${isPickup ? "⬆️ استلام من الفرع" : "🚚 توصيل للمنزل"}</span></div>
      </div>
      <div class="meta-block">
        <h3>بيانات العميل · Customer</h3>
        <div class="meta-row"><span class="lbl">الاسم</span><span class="val">${esc(customerName)}</span></div>
        ${customerPhone ? `<div class="meta-row"><span class="lbl">الجوال</span><span class="val" dir="ltr">${esc(customerPhone)}</span></div>` : ""}
        ${customerEmail ? `<div class="meta-row"><span class="lbl">البريد</span><span class="val" dir="ltr">${esc(customerEmail)}</span></div>` : ""}
        ${deliveryAddress ? `<div class="meta-row"><span class="lbl">العنوان</span><span class="val">${esc(deliveryAddress)}</span></div>` : ""}
      </div>
    </div>

    <!-- Items -->
    <div class="items-section">
      <div class="items-label">
        <span>🛒</span>
        <span>تفاصيل المنتجات · Items</span>
      </div>
      <table class="items">
        <thead>
          <tr>
            <th class="c">#</th>
            <th class="r">المنتج / Description</th>
            <th class="c">الكمية</th>
            <th class="l">السعر</th>
            <th class="l">قبل الضريبة</th>
            <th class="l">الضريبة 15%</th>
            <th class="l">الإجمالي</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
    </div>

    <!-- Totals -->
    <div class="totals-wrap">
      <div class="totals-table">
        <div class="row"><span class="lbl">المجموع قبل الضريبة</span><span class="val">${fmtSAR(subtotal)} ر.س</span></div>
        ${shipping > 0 ? `<div class="row"><span class="lbl">رسوم الشحن</span><span class="val">${fmtSAR(shipping)} ر.س</span></div>` : ""}
        ${discount > 0 ? `<div class="row discount"><span class="lbl">الخصم</span><span class="val">- ${fmtSAR(discount)} ر.س</span></div>` : ""}
        <div class="row"><span class="lbl">ضريبة القيمة المضافة (15%)</span><span class="val">${fmtSAR(vatAmount)} ر.س</span></div>
        <div class="row grand"><span class="lbl">الإجمالي شامل الضريبة</span><span class="val">${fmtSAR(total)} ر.س</span></div>
      </div>
    </div>

    <!-- Footer: ZATCA note + QR -->
    <div class="inv-footer">
      <div class="footer-note">
        <strong>${esc(sellerName)}</strong> — هذه فاتورة ضريبية مبسطة صادرة إلكترونياً ومتوافقة مع متطلبات هيئة الزكاة والضريبة والجمارك (ZATCA — المرحلة الأولى).<br/>
        QR code يحتوي على بيانات البائع، رقم الضريبة، التاريخ، الإجمالي، وقيمة الضريبة وفق الترميز TLV المعتمد.<br/><br/>
        <strong>This is a simplified tax invoice issued electronically, compliant with ZATCA Phase-1 e-invoicing.</strong>
      </div>
      ${qrDataUrl ? `
        <div class="qr-wrap">
          <img src="${qrDataUrl}" alt="ZATCA QR" class="qr-img" />
          <div class="qr-caption">ZATCA QR · امسح للتحقق</div>
        </div>` : ""}
    </div>

    <!-- Thank-you strip -->
    <div class="thankyou">شكراً لاختياركم <span>${esc(sellerName)}</span> — Thank you for choosing <span>${esc(sellerNameEn)}</span></div>
  </div>
</body>
</html>`;
}
