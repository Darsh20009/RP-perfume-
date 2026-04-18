/**
 * Email Service — RF Perfume
 * Powered by SMTP2GO API
 * All templates are Arabic RTL with RF Perfume branding
 */

import { SITE, ASSETS } from "./site-config";

// Use absolute HTTPS URLs for inline images. CID attachments cause many email
// clients (Outlook, several Arabic webmails) to show the assets as separate
// attachments at the bottom instead of inline within the template. Remote URLs
// are universally supported by modern clients and remove that issue entirely.
const ASSET_BASE = SITE.URL;
const LOGO_URL   = ASSETS.LOGO_SQUARE;
const BANNER_URL = ASSETS.EMAIL_BANNER;

const SMTP2GO_API = "https://api.smtp2go.com/v3/email/send";

function getCredentials() {
  const apiKey = process.env.SMTP2GO_API_KEY;
  if (!apiKey) throw new Error("[Email] SMTP2GO_API_KEY env var is not set");
  return {
    apiKey,
    sender: process.env.EMAIL_SENDER || "noreply@rfperfume.sa",
    senderName: process.env.EMAIL_SENDER_NAME || "رفيف العود",
  };
}

// ─── Core Send Function ────────────────────────────────────────────────────────

async function sendEmail(params: {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { apiKey, sender, senderName } = getCredentials();

  // Images are referenced via absolute HTTPS URLs in the HTML (see ASSET_BASE)
  // — no attachments are sent, so nothing appears as a "file attachment" below
  // the email body in Gmail/Outlook/Apple Mail.
  try {
    const res = await fetch(SMTP2GO_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        to: [`${params.toName || ""} <${params.to}>`],
        sender: `${senderName} <${sender}>`,
        subject: params.subject,
        html_body: params.html,
        text_body: params.text || "",
      }),
    });

    const data = await res.json();

    if (!res.ok || data.data?.error) {
      const errMsg = data.data?.error || `HTTP ${res.status}`;
      console.error("[Email] SMTP2GO error:", errMsg);
      return { success: false, error: errMsg };
    }

    console.log(`[Email] ✅ Sent to ${params.to} — Subject: ${params.subject}`);
    return { success: true };
  } catch (err: any) {
    console.error("[Email] Network error:", err.message);
    return { success: false, error: err.message };
  }
}

// ─── Base Template ─────────────────────────────────────────────────────────────

function baseTemplate(title: string, content: string): string {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${title}</title>
  <style type="text/css">
    body, table, td, p, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; font-family: 'Segoe UI', Tahoma, Arial, sans-serif; }
    body { margin: 0 !important; padding: 0 !important; background-color: #f5f5f0; direction: rtl; }
    table { border-collapse: collapse !important; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; display: block; }
    a { color: inherit; text-decoration: none; }
    .status-badge { display: inline-block; padding: 6px 16px; font-size: 11px; font-weight: 900; border-radius: 4px; }
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; }
      .px-content { padding-left: 24px !important; padding-right: 24px !important; }
      .py-content { padding-top: 32px !important; padding-bottom: 32px !important; }
      .title-mobile { font-size: 22px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f0;direction:rtl;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">
  <table role="presentation" border="0" cellspacing="0" cellpadding="0" width="100%" style="background-color:#f5f5f0;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" border="0" cellspacing="0" cellpadding="0" width="600" class="container" style="max-width:600px;background-color:#ffffff;border-radius:4px;overflow:hidden;">
          <!-- Animated Banner (GIF) — wrapped in a styled <td> so that, if the image
               is blocked by the client (Gmail/Outlook default-disable images), the
               branded gold-on-navy background + alt text still appear beautifully. -->
          <tr>
            <td align="center" bgcolor="#0f1a2e" style="background:#0f1a2e;background-image:linear-gradient(135deg,#0f1a2e 0%,#1a2744 35%,#243154 65%,#1a2744 100%);padding:28px 20px;line-height:1;font-size:0;border-bottom:1px solid rgba(201,169,110,0.25);">
              <!--[if mso]><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" align="center"><tr><td align="center"><![endif]-->
              <img src="${BANNER_URL}" alt="رفيف العود — RF Perfume Luxury Fragrances" width="560" style="display:block;width:100%;max-width:560px;height:auto;border:0;outline:none;margin:0 auto;" />
              <!-- CSS-only fallback that always shows (becomes visible if image fails / is blocked) -->
              <div style="color:#c9a96e;font-size:11px;font-weight:900;letter-spacing:0.4em;text-transform:uppercase;margin-top:14px;font-family:'Segoe UI',Tahoma,Arial,sans-serif;line-height:1.2;">RF Perfume · Luxury Fragrances</div>
              <!--[if mso]></td></tr></table><![endif]-->
            </td>
          </tr>
          <!-- Header -->
          <tr>
            <td align="center" style="background:#1a2744;background-image:linear-gradient(135deg,#1a2744 0%,#243154 50%,#1a2744 100%);padding:28px 40px 24px;border-bottom:3px solid #c9a96e;">
              <!-- Logo with bullet-proof bgcolor fallback — Gmail-blocked image still shows
                   a styled gold "RF" monogram inside a white circle. -->
              <table role="presentation" border="0" cellspacing="0" cellpadding="0" align="center" style="margin:0 auto 10px;">
                <tr>
                  <td align="center" valign="middle" width="56" height="56" bgcolor="#ffffff" style="background-color:#ffffff;border-radius:50%;width:56px;height:56px;text-align:center;vertical-align:middle;">
                    <img src="${LOGO_URL}" alt="RF" width="40" height="40" style="display:inline-block;width:40px;height:40px;border:0;outline:none;vertical-align:middle;" />
                    <!--[if !mso]><!--><span style="display:none;max-height:0;overflow:hidden;color:#1a2744;font-size:18px;font-weight:900;letter-spacing:0.05em;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">RF</span><!--<![endif]-->
                  </td>
                </tr>
              </table>
              <div style="color:#ffffff;font-size:22px;font-weight:900;letter-spacing:0.15em;line-height:1.2;margin-top:10px;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">رفيف العود</div>
              <div style="color:#c9a96e;font-size:10px;font-weight:700;letter-spacing:0.4em;text-transform:uppercase;margin-top:6px;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">RF Perfume &middot; ${SITE.DOMAIN}</div>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td class="px-content py-content" style="padding:48px 40px;color:#1a1a1a;font-family:'Segoe UI',Tahoma,Arial,sans-serif;direction:rtl;text-align:right;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="background-color:#0f1a2e;padding:32px 40px;">
              <p style="margin:0 0 12px;color:rgba(255,255,255,0.5);font-size:11px;font-weight:600;line-height:1.8;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">
                &copy; ${new Date().getFullYear()} رفيف العود &mdash; جميع الحقوق محفوظة
              </p>
              <p style="margin:0 0 16px;font-size:11px;line-height:1.6;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">
                <a href="${SITE.URL}" style="color:#c9a96e;text-decoration:none;font-weight:700;">${SITE.DOMAIN}</a>
              </p>
              <table role="presentation" border="0" cellspacing="0" cellpadding="0" align="center">
                <tr>
                  <td style="padding:0 10px;"><a href="${SITE.URL}" style="color:rgba(255,255,255,0.6);font-size:11px;font-weight:700;letter-spacing:0.15em;text-decoration:none;">المتجر</a></td>
                  <td style="padding:0 10px;color:rgba(255,255,255,0.2);">|</td>
                  <td style="padding:0 10px;"><a href="${SITE.URL}/orders" style="color:rgba(255,255,255,0.6);font-size:11px;font-weight:700;letter-spacing:0.15em;text-decoration:none;">طلباتي</a></td>
                  <td style="padding:0 10px;color:rgba(255,255,255,0.2);">|</td>
                  <td style="padding:0 10px;"><a href="mailto:rf-purfume@outlook.com" style="color:rgba(255,255,255,0.6);font-size:11px;font-weight:700;letter-spacing:0.15em;text-decoration:none;">الدعم</a></td>
                </tr>
              </table>
              <p style="margin:16px 0 0;color:rgba(255,255,255,0.3);font-size:10px;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">
                هذا البريد مُرسل تلقائياً &mdash; لا تحتاج إلى الرد
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Bilingual helpers ─────────────────────────────────────────────────────────

/** Detects the customer's preferred language from any text (name, address, etc.) */
export function detectLangFromText(text: string): "ar" | "en" {
  if (!text) return "ar";
  const s = String(text).replace(/\s+/g, "");
  if (!s) return "ar";
  let ar = 0, en = 0;
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    if (c >= 0x0600 && c <= 0x06ff) ar++;
    else if ((c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a)) en++;
  }
  return ar >= en ? "ar" : "en";
}

/** Render the same string in both languages, primary first */
function bi(ar: string, en: string, lang: "ar" | "en" = "ar"): string {
  return lang === "ar"
    ? `${ar}<span style="display:inline-block;margin:0 6px;color:rgba(0,0,0,0.25);">|</span><span style="font-family:'Segoe UI',Tahoma,Arial,sans-serif;font-weight:700;direction:ltr;unicode-bidi:isolate;">${en}</span>`
    : `<span style="font-family:'Segoe UI',Tahoma,Arial,sans-serif;font-weight:700;direction:ltr;unicode-bidi:isolate;">${en}</span><span style="display:inline-block;margin:0 6px;color:rgba(0,0,0,0.25);">|</span>${ar}`;
}

/** Render a paragraph that mirrors the message in both languages */
function biPara(ar: string, en: string): string {
  return `
    <table role="presentation" border="0" cellspacing="0" cellpadding="0" width="100%" style="margin:8px 0;">
      <tr>
        <td dir="rtl" style="text-align:right;font-size:14px;color:rgba(0,0,0,0.7);line-height:1.8;font-family:'Segoe UI',Tahoma,Arial,sans-serif;padding:6px 0;">${ar}</td>
      </tr>
      <tr>
        <td dir="ltr" style="text-align:left;font-size:13px;color:rgba(0,0,0,0.55);line-height:1.7;font-family:'Segoe UI',Tahoma,Arial,sans-serif;padding:6px 0;border-top:1px dashed rgba(0,0,0,0.08);">${en}</td>
      </tr>
    </table>`;
}

/** Wrap an English mirror block to display below the primary content */
function englishMirror(content: string): string {
  return `
    <div dir="ltr" style="text-align:left;margin:32px 0 0;padding:24px 0 0;border-top:2px solid rgba(0,0,0,0.08);font-family:'Segoe UI',Tahoma,Arial,sans-serif;">
      <p style="margin:0 0 8px;font-size:10px;font-weight:700;letter-spacing:0.2em;color:rgba(0,0,0,0.4);text-transform:uppercase;">English Version</p>
      ${content}
    </div>`;
}

// ─── Email-safe HTML helpers (use tables, not flex/grid) ───────────────────────

/** Renders an info row as a table — works in Gmail, Outlook, all clients */
function infoRow(label: string, value: string, isLast: boolean = false): string {
  const border = isLast ? "" : "border-bottom:1px solid rgba(0,0,0,0.08);";
  return `<tr>
    <td style="padding:12px 0;${border}font-size:12px;font-weight:700;color:rgba(0,0,0,0.55);letter-spacing:0.05em;text-align:right;width:40%;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">${label}</td>
    <td style="padding:12px 0;${border}font-size:13px;font-weight:800;color:#000000;text-align:left;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">${value}</td>
  </tr>`;
}

/** Renders an info-box (group of rows) as a styled table */
function infoBox(rows: string): string {
  return `<table role="presentation" border="0" cellspacing="0" cellpadding="0" width="100%" style="background-color:#f8f8f6;border:1px solid rgba(0,0,0,0.08);border-radius:6px;margin:24px 0;">
    <tr><td style="padding:8px 24px;">
      <table role="presentation" border="0" cellspacing="0" cellpadding="0" width="100%">${rows}</table>
    </td></tr>
  </table>`;
}

/** Renders a totals row */
function totalRow(label: string, value: string, opts: { final?: boolean; color?: string } = {}): string {
  const border = opts.final ? "border-top:2px solid #000000;padding-top:14px;" : "";
  const fontSize = opts.final ? "16px" : "13px";
  const fontWeight = opts.final ? "900" : "700";
  const labelColor = opts.color || (opts.final ? "#000000" : "rgba(0,0,0,0.55)");
  const valueColor = opts.color || (opts.final ? "#000000" : "#1a1a1a");
  return `<tr>
    <td style="${border}padding:8px 0;font-size:${fontSize};font-weight:${fontWeight};color:${valueColor};text-align:left;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">${value}</td>
    <td style="${border}padding:8px 0;font-size:${fontSize};font-weight:${fontWeight};color:${labelColor};text-align:right;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">${label}</td>
  </tr>`;
}

/** Renders a CTA button — bulletproof for all email clients */
function ctaButton(href: string, text: string): string {
  return `<table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin:28px auto;">
    <tr><td align="center" style="background-color:#1a2744;border-radius:6px;">
      <a href="${href}" target="_blank" style="display:inline-block;background-color:#1a2744;color:#ffffff;font-size:13px;font-weight:900;padding:16px 36px;text-decoration:none;letter-spacing:0.15em;border-radius:6px;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">${text}</a>
    </td></tr>
  </table>`;
}

// ─── Email Templates ───────────────────────────────────────────────────────────

/** Order confirmation email */
export async function sendOrderConfirmationEmail(params: {
  to: string;
  customerName: string;
  orderId: string;
  orderRef: string;
  items: Array<{ title: string; quantity: number; price: number; color?: string; size?: string }>;
  subtotal: number;
  vatAmount: number;
  shippingCost: number;
  discountAmount?: number;
  total: number;
  paymentMethod: string;
  deliveryAddress: string;
  shippingCompany?: string;
}) {
  const paymentLabels: Record<string, string> = {
    wallet: "محفظة رفيف",
    bank_transfer: "تحويل بنكي",
    tap: "بطاقة بنكية",
    stc_pay: "STC Pay",
    apple_pay: "Apple Pay",
    tamara: "تمارة — تقسيط",
    tabby: "تابي — تقسيط",
  };

  const TD = `padding:14px 12px;font-size:13px;font-weight:600;color:#1a1a1a;border-bottom:1px solid rgba(0,0,0,0.06);font-family:'Segoe UI',Tahoma,Arial,sans-serif;`;
  const itemsRows = params.items.map(item => `
    <tr>
      <td style="${TD}text-align:right;">${item.title}${item.color ? ` &mdash; ${item.color}` : ""}${item.size ? ` / ${item.size}` : ""}</td>
      <td style="${TD}text-align:center;">${item.quantity}</td>
      <td style="${TD}text-align:left;font-weight:800;">${(item.price * item.quantity).toLocaleString("ar-SA")} ر.س</td>
    </tr>
  `).join("");

  const statusBadge = `<span style="display:inline-block;padding:6px 14px;font-size:11px;font-weight:900;background-color:#eff6ff;color:#1d4ed8;border-radius:4px;letter-spacing:0.05em;">جديد</span>`;

  const content = `
    <h1 class="title-mobile" style="margin:0 0 8px;font-size:26px;font-weight:900;color:#000000;letter-spacing:-0.01em;line-height:1.3;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">تم استلام طلبك! ✅</h1>
    <p style="margin:0 0 32px;font-size:14px;color:rgba(0,0,0,0.55);font-weight:600;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">شكراً ${params.customerName}، طلبك في أيدٍ أمينة</p>

    ${infoBox(
      infoRow("رقم الطلب", `#${params.orderRef}`) +
      infoRow("طريقة الدفع", paymentLabels[params.paymentMethod] || params.paymentMethod) +
      infoRow("عنوان التوصيل", params.deliveryAddress) +
      (params.shippingCompany ? infoRow("شركة الشحن", params.shippingCompany) : "") +
      infoRow("حالة الطلب", statusBadge, true)
    )}

    <p style="margin:32px 0 12px;font-size:13px;font-weight:900;letter-spacing:0.1em;color:#000000;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">المنتجات المطلوبة</p>

    <table role="presentation" border="0" cellspacing="0" cellpadding="0" width="100%" style="border-collapse:collapse;margin:0 0 16px;">
      <thead>
        <tr style="background-color:#1a2744;">
          <th style="padding:12px;font-size:11px;font-weight:900;color:#ffffff;text-align:right;letter-spacing:0.1em;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">المنتج</th>
          <th style="padding:12px;font-size:11px;font-weight:900;color:#ffffff;text-align:center;letter-spacing:0.1em;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">الكمية</th>
          <th style="padding:12px;font-size:11px;font-weight:900;color:#ffffff;text-align:left;letter-spacing:0.1em;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">السعر</th>
        </tr>
      </thead>
      <tbody>${itemsRows}</tbody>
    </table>

    <table role="presentation" border="0" cellspacing="0" cellpadding="0" width="100%" style="margin:16px 0 8px;">
      ${totalRow("المجموع الفرعي", `${params.subtotal.toLocaleString("ar-SA")} ر.س`)}
      ${totalRow("ضريبة القيمة المضافة (١٥٪)", `${params.vatAmount.toLocaleString("ar-SA")} ر.س`)}
      ${totalRow("رسوم الشحن", `${params.shippingCost.toLocaleString("ar-SA")} ر.س`)}
      ${params.discountAmount && params.discountAmount > 0 ? totalRow("الخصم", `-${params.discountAmount.toLocaleString("ar-SA")} ر.س`, { color: "#16a34a" }) : ""}
      ${totalRow("الإجمالي", `${params.total.toLocaleString("ar-SA")} ر.س`, { final: true })}
    </table>

    <p style="margin:32px 0 8px;font-size:14px;color:rgba(0,0,0,0.7);line-height:1.8;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">
      سيتم تجهيز طلبك والتواصل معك قريباً. يمكنك متابعة حالة طلبك من خلال حسابك في المتجر.
    </p>

    ${ctaButton(`${SITE.URL}/orders`, "متابعة طلبي")}

    <p style="margin:24px 0 0;padding-top:24px;border-top:1px solid rgba(0,0,0,0.06);font-size:12px;color:rgba(0,0,0,0.55);line-height:1.7;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">
      هل لديك استفسار؟ تواصل معنا على <a href="mailto:rf-purfume@outlook.com" style="color:#1a2744;font-weight:800;text-decoration:none;">rf-purfume@outlook.com</a>
    </p>
  `;

  const enMirror = englishMirror(`
    <h2 style="margin:0 0 6px;font-size:20px;font-weight:900;color:#000000;">Order Received ✅</h2>
    <p style="margin:0 0 16px;font-size:13px;color:rgba(0,0,0,0.55);font-weight:600;">Thank you ${params.customerName}, your order is in safe hands</p>
    <p style="margin:0 0 4px;font-size:12px;color:rgba(0,0,0,0.7);"><b>Order Number:</b> #${params.orderRef}</p>
    <p style="margin:0 0 4px;font-size:12px;color:rgba(0,0,0,0.7);"><b>Total:</b> ${params.total.toLocaleString("en-US")} SAR</p>
    <p style="margin:0 0 4px;font-size:12px;color:rgba(0,0,0,0.7);"><b>Payment Method:</b> ${params.paymentMethod}</p>
    <p style="margin:0 0 4px;font-size:12px;color:rgba(0,0,0,0.7);"><b>Delivery Address:</b> ${params.deliveryAddress}</p>
    <p style="margin:16px 0 0;font-size:12px;color:rgba(0,0,0,0.6);line-height:1.7;">Your order is being prepared and we'll be in touch shortly. Track it anytime from your account at <a href="${SITE.URL}/orders" style="color:#1a2744;font-weight:800;text-decoration:none;">${SITE.DOMAIN}/orders</a></p>
  `);

  return sendEmail({
    to: params.to,
    toName: params.customerName,
    subject: `✅ تم استلام طلبك #${params.orderRef} | Order #${params.orderRef} Received — RF Perfume`,
    html: baseTemplate(`تأكيد الطلب #${params.orderRef} / Order Confirmation`, content + enMirror),
    text: `تم استلام طلبك #${params.orderRef} بقيمة ${params.total} ر.س. شكراً لتسوقك مع رفيف العود.\n\nYour order #${params.orderRef} (${params.total} SAR) has been received. Thank you for shopping with RF Perfume.`,
  });
}

/** Order status update email */
export async function sendOrderStatusEmail(params: {
  to: string;
  customerName: string;
  orderRef: string;
  status: "processing" | "shipped" | "completed" | "cancelled";
  trackingNumber?: string;
  shippingProvider?: string;
  reason?: string;
}) {
  const statusConfigs = {
    processing: {
      emoji: "⚙️",
      title: "طلبك قيد التجهيز",
      subtitle: "فريقنا يعمل على تحضير طلبك بعناية",
      color: "#854d0e",
      bgColor: "#fefce8",
      badgeClass: "status-processing",
      badgeText: "جاري التجهيز",
      message: `<p>يسعدنا إعلامك أن طلبك <span style="color:#1a2744;font-weight:900;">#${params.orderRef}</span> يتم تجهيزه الآن من قِبل فريقنا. سنُرسل لك إشعاراً فور شحنه.</p>`,
      cta: "متابعة الطلب",
    },
    shipped: {
      emoji: "🚚",
      title: "طلبك في الطريق إليك!",
      subtitle: "تم تسليم طلبك لشركة الشحن",
      color: "#15803d",
      bgColor: "#f0fdf4",
      badgeClass: "status-shipped",
      badgeText: "تم الشحن",
      message: `
        <p>رائع! تم شحن طلبك <span style="color:#1a2744;font-weight:900;">#${params.orderRef}</span> وهو في طريقه إليك.</p>
        ${params.trackingNumber ? `
        <div class="tracking-box">
          <div class="tracking-label">${params.shippingProvider || "شركة الشحن"} — رقم التتبع</div>
          <div class="tracking-num">${params.trackingNumber}</div>
        </div>
        <p style="font-size:12px">استخدم رقم التتبع أعلاه لمعرفة مكان طلبك بدقة.</p>
        ` : "<p>ستصلك رسالة تحتوي على رقم التتبع قريباً.</p>"}
      `,
      cta: "تتبع الشحنة",
    },
    completed: {
      emoji: "✅",
      title: "تم تسليم طلبك بنجاح!",
      subtitle: "نأمل أن تكون تجربتك مميزة",
      color: "#15803d",
      bgColor: "#f0fdf4",
      badgeClass: "status-completed",
      badgeText: "مُسلَّم",
      message: `
        <p>يسعدنا إعلامك بأن طلبك <span style="color:#1a2744;font-weight:900;">#${params.orderRef}</span> تم تسليمه بنجاح. نتمنى أن تعجبك المنتجات!</p>
        <p>رأيك يهمنا — لا تتردد في مشاركتنا تجربتك. وإذا واجهتك أي مشكلة نحن هنا لمساعدتك.</p>
      `,
      cta: "تسوق مجدداً",
    },
    cancelled: {
      emoji: "❌",
      title: "تم إلغاء طلبك",
      subtitle: "نأسف لهذا، يمكنك التواصل معنا لأي استفسار",
      color: "#b91c1c",
      bgColor: "#fef2f2",
      badgeClass: "status-cancelled",
      badgeText: "ملغي",
      message: `
        <p>تم إلغاء طلبك <span style="color:#1a2744;font-weight:900;">#${params.orderRef}</span>.${params.reason ? ` السبب: ${params.reason}.` : ""}</p>
        <p>إذا كنت قد دفعت ولم تتلقَّ استرداداً، يرجى التواصل معنا فوراً على <a href="mailto:rf-purfume@outlook.com" style="color:#000;font-weight:800">rf-purfume@outlook.com</a></p>
      `,
      cta: "تواصل معنا",
    },
  };

  const cfg = statusConfigs[params.status];

  const badgeColors: Record<string, { bg: string; fg: string }> = {
    "status-processing": { bg: "#fefce8", fg: "#854d0e" },
    "status-shipped":    { bg: "#f0fdf4", fg: "#15803d" },
    "status-completed":  { bg: "#f0fdf4", fg: "#15803d" },
    "status-cancelled":  { bg: "#fef2f2", fg: "#b91c1c" },
  };
  const bc = badgeColors[cfg.badgeClass] || { bg: "#eff6ff", fg: "#1d4ed8" };
  const statusBadge = `<span style="display:inline-block;padding:6px 14px;font-size:11px;font-weight:900;background-color:${bc.bg};color:${bc.fg};border-radius:4px;letter-spacing:0.05em;">${cfg.badgeText}</span>`;

  // Wrap cfg.message paragraphs/tracking-box in inline styles for email-safety
  const safeMessage = cfg.message
    .replace(/<p>/g, '<p style="margin:0 0 12px;font-size:14px;color:rgba(0,0,0,0.7);line-height:1.8;font-family:\'Segoe UI\',Tahoma,Arial,sans-serif;">')
    .replace(/<p style="font-size:12px">/g, '<p style="margin:0 0 12px;font-size:12px;color:rgba(0,0,0,0.6);line-height:1.7;font-family:\'Segoe UI\',Tahoma,Arial,sans-serif;">')
    .replace(/<div class="tracking-box">/g, '<div style="background-color:#1a2744;color:#ffffff;padding:24px;margin:20px 0;border-radius:8px;text-align:center;">')
    .replace(/<div class="tracking-label">/g, '<div style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.55);letter-spacing:0.2em;margin-bottom:8px;font-family:\'Segoe UI\',Tahoma,Arial,sans-serif;">')
    .replace(/<div class="tracking-num">/g, '<div style="font-size:22px;font-weight:900;letter-spacing:0.1em;font-family:monospace;color:#ffffff;">');

  const content = `
    <div style="text-align:center;margin-bottom:32px;">
      <div style="font-size:48px;margin-bottom:12px;line-height:1;">${cfg.emoji}</div>
      <h1 class="title-mobile" style="margin:0 0 8px;font-size:26px;font-weight:900;color:#000000;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">${cfg.title}</h1>
      <p style="margin:0;font-size:14px;color:rgba(0,0,0,0.55);font-weight:600;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">${cfg.subtitle}</p>
    </div>

    ${infoBox(
      infoRow("رقم الطلب", `#${params.orderRef}`) +
      infoRow("الحالة الجديدة", statusBadge, true)
    )}

    ${safeMessage}

    ${ctaButton(`${SITE.URL}/orders`, cfg.cta)}
  `;

  const enLabels: Record<string, { title: string; subtitle: string; cta: string }> = {
    processing: { title: "Your order is being prepared", subtitle: "Our team is carefully assembling your order", cta: "Track Order" },
    shipped:    { title: "Your order is on its way!",     subtitle: "Handed off to the shipping carrier",       cta: "Track Shipment" },
    completed:  { title: "Your order has been delivered!", subtitle: "We hope you love it",                      cta: "Shop Again" },
    cancelled:  { title: "Your order has been cancelled", subtitle: "We're sorry — contact us with any questions", cta: "Contact Us" },
  };
  const enInfo = enLabels[params.status];
  const enMirror = englishMirror(`
    <h2 style="margin:0 0 6px;font-size:20px;font-weight:900;color:#000000;">${cfg.emoji} ${enInfo.title}</h2>
    <p style="margin:0 0 12px;font-size:13px;color:rgba(0,0,0,0.55);font-weight:600;">${enInfo.subtitle}</p>
    <p style="margin:0 0 4px;font-size:12px;color:rgba(0,0,0,0.7);"><b>Order Number:</b> #${params.orderRef}</p>
    ${params.trackingNumber ? `<p style="margin:0 0 4px;font-size:12px;color:rgba(0,0,0,0.7);"><b>Tracking:</b> ${params.trackingNumber}${params.shippingProvider ? ` (${params.shippingProvider})` : ""}</p>` : ""}
    ${params.reason ? `<p style="margin:0 0 4px;font-size:12px;color:rgba(0,0,0,0.7);"><b>Reason:</b> ${params.reason}</p>` : ""}
    <p style="margin:12px 0 0;font-size:12px;color:rgba(0,0,0,0.6);"><a href="${SITE.URL}/orders" style="color:#1a2744;font-weight:800;text-decoration:none;">${enInfo.cta} →</a></p>
  `);

  return sendEmail({
    to: params.to,
    toName: params.customerName,
    subject: `${cfg.emoji} طلبك #${params.orderRef} — ${cfg.badgeText} | Order #${params.orderRef} — ${enInfo.title}`,
    html: baseTemplate(`تحديث الطلب #${params.orderRef} / Order Update`, content + enMirror),
    text: `تحديث طلبك #${params.orderRef}: ${cfg.badgeText}\nOrder #${params.orderRef} status: ${enInfo.title}`,
  });
}

/** Welcome email for new customers */
export async function sendWelcomeEmail(params: {
  to: string;
  customerName: string;
}) {
  const content = `
    <div style="text-align:center;margin-bottom:32px;">
      <div style="font-size:48px;margin-bottom:12px;line-height:1;">👋</div>
      <h1 class="title-mobile" style="margin:0 0 8px;font-size:26px;font-weight:900;color:#000000;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">أهلاً وسهلاً ${params.customerName}!</h1>
      <p style="margin:0;font-size:14px;color:rgba(0,0,0,0.55);font-weight:600;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">انضممت إلى عائلة رفيف العود</p>
    </div>

    <p style="margin:0 0 24px;font-size:14px;color:rgba(0,0,0,0.7);line-height:1.8;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">
      يسعدنا انضمامك إلى مجتمعنا. حسابك جاهز الآن وبإمكانك التسوق من مئات المنتجات الفاخرة بكل سهولة وأمان.
    </p>

    ${infoBox(
      infoRow("✅ حساب آمن", "بياناتك محمية بأعلى معايير التشفير") +
      infoRow("🚚 شحن سريع", "توصيل خلال ٢-٤ أيام عمل") +
      infoRow("💳 دفع متعدد", "مدى، فيزا، STC Pay، Apple Pay، تمارة، تابي") +
      infoRow("🔔 إشعارات فورية", "تتبع طلبك لحظة بلحظة", true)
    )}

    ${ctaButton(`${SITE.URL}/products`, "ابدأ التسوق الآن")}

    <p style="margin:24px 0 0;padding-top:24px;border-top:1px solid rgba(0,0,0,0.06);font-size:11px;color:rgba(0,0,0,0.45);line-height:1.7;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">
      إذا لم تكن أنت من أنشأ هذا الحساب، يُرجى التواصل معنا فوراً.
    </p>
  `;

  const enMirror = englishMirror(`
    <h2 style="margin:0 0 6px;font-size:20px;font-weight:900;color:#000000;">👋 Welcome ${params.customerName}!</h2>
    <p style="margin:0 0 12px;font-size:13px;color:rgba(0,0,0,0.55);font-weight:600;">You've joined the RF Perfume family</p>
    <p style="margin:0 0 12px;font-size:13px;color:rgba(0,0,0,0.7);line-height:1.7;">We're delighted to have you. Your account is ready and you can now shop hundreds of luxury fragrances safely and easily.</p>
    <ul style="margin:0;padding:0 0 0 20px;font-size:12px;color:rgba(0,0,0,0.7);line-height:1.8;">
      <li>✅ <b>Secure account</b> — your data is protected with the highest encryption standards</li>
      <li>🚚 <b>Fast shipping</b> — delivery within 2–4 business days</li>
      <li>💳 <b>Multiple payment options</b> — Mada, Visa, STC Pay, Apple Pay, Tamara, Tabby</li>
      <li>🔔 <b>Real-time notifications</b> — track your orders moment by moment</li>
    </ul>
    <p style="margin:16px 0 0;font-size:12px;"><a href="${SITE.URL}/products" style="color:#1a2744;font-weight:800;text-decoration:none;">Start Shopping →</a></p>
  `);

  return sendEmail({
    to: params.to,
    toName: params.customerName,
    subject: `👋 أهلاً ${params.customerName}! مرحباً بك في رفيف العود | Welcome to RF Perfume`,
    html: baseTemplate("مرحباً بك في رفيف العود / Welcome to RF Perfume", content + enMirror),
    text: `أهلاً ${params.customerName}! مرحباً بك في رفيف العود.\nWelcome ${params.customerName}! Your RF Perfume account is ready.`,
  });
}

/** Payment confirmation email */
export async function sendPaymentConfirmationEmail(params: {
  to: string;
  customerName: string;
  orderRef: string;
  amount: number;
  paymentMethod: string;
  transactionId?: string;
  authCode?: string;
}) {
  const methodLabels: Record<string, string> = {
    card: "بطاقة بنكية",
    stc_pay: "STC Pay",
    apple_pay: "Apple Pay",
    tamara: "تمارة",
    tabby: "تابي",
    wallet: "محفظة رفيف",
  };

  const greenAmount = `<span style="color:#16a34a;font-weight:900;">${params.amount.toLocaleString("ar-SA")} ر.س</span>`;
  const content = `
    <div style="text-align:center;margin-bottom:32px;">
      <div style="font-size:48px;margin-bottom:12px;line-height:1;">💳</div>
      <h1 class="title-mobile" style="margin:0 0 8px;font-size:26px;font-weight:900;color:#000000;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">تم الدفع بنجاح!</h1>
      <p style="margin:0;font-size:14px;color:rgba(0,0,0,0.55);font-weight:600;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">عملية الدفع اكتملت بأمان تام</p>
    </div>

    ${infoBox(
      infoRow("رقم الطلب", `#${params.orderRef}`) +
      infoRow("المبلغ المدفوع", greenAmount) +
      infoRow("طريقة الدفع", methodLabels[params.paymentMethod] || params.paymentMethod) +
      (params.transactionId ? infoRow("رقم العملية", `<code style="font-family:monospace;font-size:11px;">${params.transactionId.slice(0, 24)}</code>`) : "") +
      (params.authCode ? infoRow("كود الموافقة", `<code style="font-family:monospace;font-weight:900;color:#15803d;">${params.authCode}</code>`) : "") +
      infoRow("التاريخ والوقت", new Date().toLocaleString("ar-SA", { dateStyle: "long", timeStyle: "short" }), true)
    )}

    <p style="margin:24px 0 8px;font-size:14px;color:rgba(0,0,0,0.7);line-height:1.8;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">
      احتفظ بهذا البريد كإيصال دفعك. إذا لم تتعرف على هذه العملية، تواصل معنا فوراً.
    </p>

    ${ctaButton(`${SITE.URL}/orders`, "عرض طلباتي")}
  `;

  const enMirror = englishMirror(`
    <h2 style="margin:0 0 6px;font-size:20px;font-weight:900;color:#000000;">💳 Payment Successful!</h2>
    <p style="margin:0 0 12px;font-size:13px;color:rgba(0,0,0,0.55);font-weight:600;">Your payment was processed securely</p>
    <p style="margin:0 0 4px;font-size:12px;color:rgba(0,0,0,0.7);"><b>Order Number:</b> #${params.orderRef}</p>
    <p style="margin:0 0 4px;font-size:12px;color:rgba(0,0,0,0.7);"><b>Amount Paid:</b> <span style="color:#16a34a;font-weight:900;">${params.amount.toLocaleString("en-US")} SAR</span></p>
    <p style="margin:0 0 4px;font-size:12px;color:rgba(0,0,0,0.7);"><b>Payment Method:</b> ${params.paymentMethod}</p>
    ${params.transactionId ? `<p style="margin:0 0 4px;font-size:12px;color:rgba(0,0,0,0.7);"><b>Transaction ID:</b> <code>${params.transactionId.slice(0, 24)}</code></p>` : ""}
    ${params.authCode ? `<p style="margin:0 0 4px;font-size:12px;color:rgba(0,0,0,0.7);"><b>Authorization Code:</b> <code style="color:#15803d;font-weight:900;">${params.authCode}</code></p>` : ""}
    <p style="margin:0 0 4px;font-size:12px;color:rgba(0,0,0,0.7);"><b>Date & Time:</b> ${new Date().toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })}</p>
    <p style="margin:16px 0 0;font-size:12px;color:rgba(0,0,0,0.6);line-height:1.7;">Keep this email as your payment receipt. If you don't recognize this transaction, contact us immediately.</p>
  `);

  return sendEmail({
    to: params.to,
    toName: params.customerName,
    subject: `💳 تأكيد الدفع — طلب #${params.orderRef} | Payment Confirmed — Order #${params.orderRef}`,
    html: baseTemplate("تأكيد الدفع / Payment Confirmation", content + enMirror),
    text: `تم الدفع بنجاح. طلب #${params.orderRef} — ${params.amount.toLocaleString()} ر.س.\nPayment confirmed. Order #${params.orderRef} — ${params.amount.toLocaleString("en-US")} SAR.`,
  });
}

/** Password reset / OTP email */
export async function sendPasswordResetEmail(params: {
  to: string;
  customerName: string;
  resetLink?: string;
  otp?: string;
}) {
  const content = `
    <div style="text-align:center;margin-bottom:32px;">
      <div style="font-size:48px;margin-bottom:12px;line-height:1;">🔐</div>
      <h1 class="title-mobile" style="margin:0 0 8px;font-size:26px;font-weight:900;color:#000000;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">استعادة كلمة المرور</h1>
      <p style="margin:0;font-size:14px;color:rgba(0,0,0,0.55);font-weight:600;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">تلقينا طلباً لإعادة تعيين كلمة المرور</p>
    </div>

    ${params.otp ? `
    <div style="text-align:center;margin:32px 0;">
      <p style="margin:0 0 12px;font-size:11px;font-weight:700;color:rgba(0,0,0,0.5);letter-spacing:0.2em;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">رمز التحقق</p>
      <div style="display:inline-block;font-size:42px;font-weight:900;letter-spacing:0.3em;font-family:monospace;color:#1a2744;background-color:#f8f8f6;padding:24px 32px;border:2px solid #1a2744;border-radius:8px;">${params.otp}</div>
      <p style="margin:12px 0 0;font-size:11px;color:rgba(0,0,0,0.5);font-family:'Segoe UI',Tahoma,Arial,sans-serif;">الرمز صالح لمدة ١٠ دقائق</p>
    </div>
    ` : ""}

    ${params.resetLink ? `
    <p style="margin:0 0 8px;font-size:14px;color:rgba(0,0,0,0.7);line-height:1.8;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">اضغط على الزر أدناه لإعادة تعيين كلمة مرورك:</p>
    ${ctaButton(params.resetLink, "إعادة تعيين كلمة المرور")}
    ` : ""}

    <p style="margin:24px 0 0;padding-top:24px;border-top:1px solid rgba(0,0,0,0.06);font-size:11px;color:rgba(0,0,0,0.45);line-height:1.7;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">
      إذا لم تطلب إعادة تعيين كلمة المرور، تجاهل هذا البريد. لن يتغير شيء في حسابك.
    </p>
  `;

  const enMirror = englishMirror(`
    <h2 style="margin:0 0 6px;font-size:20px;font-weight:900;color:#000000;">🔐 Password Reset</h2>
    <p style="margin:0 0 12px;font-size:13px;color:rgba(0,0,0,0.55);font-weight:600;">We received a request to reset your password</p>
    ${params.otp ? `<p style="margin:0 0 8px;font-size:13px;color:rgba(0,0,0,0.7);">Your verification code is: <span style="font-family:monospace;font-weight:900;font-size:18px;color:#1a2744;letter-spacing:0.2em;">${params.otp}</span> (valid for 10 minutes)</p>` : ""}
    ${params.resetLink ? `<p style="margin:8px 0;font-size:12px;"><a href="${params.resetLink}" style="color:#1a2744;font-weight:800;text-decoration:none;">Reset Password →</a></p>` : ""}
    <p style="margin:12px 0 0;font-size:11px;color:rgba(0,0,0,0.5);line-height:1.7;">If you didn't request a password reset, ignore this email. Nothing will change in your account.</p>
  `);

  return sendEmail({
    to: params.to,
    toName: params.customerName,
    subject: `🔐 استعادة كلمة المرور | Password Reset — RF Perfume`,
    html: baseTemplate("استعادة كلمة المرور / Password Reset", content + enMirror),
    text: `رمز استعادة كلمة المرور: ${params.otp || ""}\nPassword reset code: ${params.otp || ""}`,
  });
}

/** Admin alert email */
export async function sendAdminAlertEmail(params: {
  to: string;
  subject: string;
  title: string;
  message: string;
  data?: Record<string, string>;
}) {
  const dataEntries = params.data ? Object.entries(params.data) : [];
  const dataRows = dataEntries
    .map(([k, v], i) => infoRow(k, v, i === dataEntries.length - 1))
    .join("");

  const content = `
    <h1 class="title-mobile" style="margin:0 0 8px;font-size:26px;font-weight:900;color:#000000;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">${params.title}</h1>
    <p style="margin:0 0 24px;font-size:13px;color:rgba(0,0,0,0.55);font-weight:600;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">تنبيه إداري — رفيف العود</p>

    <p style="margin:0 0 16px;font-size:14px;color:rgba(0,0,0,0.75);line-height:1.8;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">${params.message}</p>

    ${dataRows ? infoBox(dataRows) : ""}

    ${ctaButton(`${SITE.URL}/admin`, "لوحة التحكم")}
  `;

  // Admin alerts can also include an English mirror by passing data with `_en_*` keys; otherwise just the original
  return sendEmail({
    to: params.to,
    subject: params.subject.includes("|") ? params.subject : `${params.subject} | RF Perfume Admin Alert`,
    html: baseTemplate(params.title, content),
    text: `${params.title}\n${params.message}`,
  });
}

/** Account activation email — for newly created employees to set their own password */
export async function sendActivationEmail(params: {
  to: string;
  name: string;
  role: string;
  activationLink: string;
  expiresInHours: number;
}) {
  const roleLabels: Record<string, string> = {
    admin: "مدير",
    assistant_manager: "مساعد مدير",
    tech_support: "دعم فني",
    accountant: "محاسب",
    legal_consultant: "مستشار قانوني",
    employee: "موظف",
    support: "دعم",
    cashier: "كاشير",
  };
  const roleLabel = roleLabels[params.role] || "موظف";

  const content = `
    <div style="text-align:center;margin-bottom:32px;">
      <div style="font-size:48px;margin-bottom:12px;line-height:1;">🎉</div>
      <h1 style="margin:0 0 8px;font-size:26px;font-weight:900;color:#000;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">مرحباً بك في فريق رفيف العود</h1>
      <p style="margin:0;font-size:14px;color:rgba(0,0,0,0.55);font-weight:600;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">تم إنشاء حسابك كـ ${roleLabel}</p>
    </div>

    <p style="margin:0 0 16px;font-size:14px;color:rgba(0,0,0,0.75);line-height:1.8;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">
      مرحباً ${params.name},<br/>
      تم إنشاء حسابك في نظام رفيف العود. لتفعيل حسابك وتعيين كلمة المرور الخاصة بك، اضغط على الزر أدناه:
    </p>

    ${ctaButton(params.activationLink, "تفعيل الحساب وتعيين كلمة المرور")}

    <p style="margin:24px 0 0;padding:14px 16px;background:#fff8ec;border:1px solid #f0c674;border-radius:8px;font-size:13px;color:#5a4400;line-height:1.7;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">
      ⏰ هذا الرابط صالح لمدة <b>${params.expiresInHours} ساعة</b> فقط. بعد انتهاء المدة، اطلب من المدير إعادة إرسال رابط جديد.
    </p>

    <p style="margin:24px 0 0;padding-top:24px;border-top:1px solid rgba(0,0,0,0.06);font-size:11px;color:rgba(0,0,0,0.45);line-height:1.7;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">
      إذا لم تكن تتوقع هذا البريد، تجاهله ولن يتم تفعيل أي حساب.
    </p>
  `;

  const enRoleLabels: Record<string, string> = {
    admin: "Administrator", assistant_manager: "Assistant Manager", tech_support: "Tech Support",
    accountant: "Accountant", legal_consultant: "Legal Consultant", employee: "Employee",
    support: "Support", cashier: "Cashier",
  };
  const enRole = enRoleLabels[params.role] || "Team Member";
  const enMirror = englishMirror(`
    <h2 style="margin:0 0 6px;font-size:20px;font-weight:900;color:#000000;">🎉 Welcome to the RF Perfume Team</h2>
    <p style="margin:0 0 12px;font-size:13px;color:rgba(0,0,0,0.55);font-weight:600;">Your account has been created as ${enRole}</p>
    <p style="margin:0 0 12px;font-size:13px;color:rgba(0,0,0,0.7);line-height:1.7;">Hi ${params.name},<br/>Your RF Perfume staff account has been created. To activate it and set your password, click the link below:</p>
    <p style="margin:8px 0;font-size:12px;"><a href="${params.activationLink}" style="color:#1a2744;font-weight:800;text-decoration:none;">Activate Account & Set Password →</a></p>
    <p style="margin:12px 0;padding:12px 14px;background:#fff8ec;border:1px solid #f0c674;border-radius:8px;font-size:12px;color:#5a4400;line-height:1.6;">⏰ This link is valid for <b>${params.expiresInHours} hours</b> only. After expiry, ask your manager to send a new activation link.</p>
    <p style="margin:12px 0 0;font-size:11px;color:rgba(0,0,0,0.5);line-height:1.6;">If you weren't expecting this email, ignore it and no account will be activated.</p>
  `);

  return sendEmail({
    to: params.to,
    toName: params.name,
    subject: `🎉 تفعيل حسابك في رفيف العود | Activate your RF Perfume account`,
    html: baseTemplate("تفعيل الحساب / Account Activation", content + enMirror),
    text: `مرحباً ${params.name}, لتفعيل حسابك: ${params.activationLink}\nHi ${params.name}, activate your account: ${params.activationLink}`,
  });
}

/** Low-level direct send — for custom use */
export { sendEmail };
