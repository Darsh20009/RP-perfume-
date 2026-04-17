/**
 * Email Service — RF Perfume
 * Powered by SMTP2GO API
 * All templates are Arabic RTL with RF Perfume branding
 */

const SMTP2GO_API = "https://api.smtp2go.com/v3/email/send";

function getCredentials() {
  const apiKey = process.env.SMTP2GO_API_KEY;
  if (!apiKey) throw new Error("[Email] SMTP2GO_API_KEY env var is not set");
  return {
    apiKey,
    sender: "rf-purfume@outlook.com",
    senderName: "رفيف العود",
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
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #f5f5f0; font-family: 'Segoe UI', Tahoma, sans-serif; direction: rtl; }
    .wrapper { max-width: 600px; margin: 40px auto; background: #ffffff; }
    .header { background: #000000; padding: 32px 40px; display: flex; align-items: center; justify-content: space-between; }
    .logo-text { color: #ffffff; font-size: 22px; font-weight: 900; letter-spacing: 0.05em; }
    .logo-sub { color: rgba(255,255,255,0.4); font-size: 9px; font-weight: 700; letter-spacing: 0.3em; text-transform: uppercase; margin-top: 2px; }
    .badge { background: #ffffff; color: #000000; font-size: 9px; font-weight: 900; padding: 4px 10px; letter-spacing: 0.3em; text-transform: uppercase; }
    .body { padding: 48px 40px; }
    .title { font-size: 28px; font-weight: 900; color: #000000; margin-bottom: 8px; letter-spacing: -0.02em; }
    .subtitle { font-size: 13px; color: rgba(0,0,0,0.4); font-weight: 600; margin-bottom: 32px; }
    .divider { border: none; border-top: 1px solid rgba(0,0,0,0.06); margin: 24px 0; }
    .info-box { background: #f8f8f6; border: 1px solid rgba(0,0,0,0.06); padding: 24px; margin: 24px 0; }
    .info-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid rgba(0,0,0,0.04); }
    .info-row:last-child { border-bottom: none; }
    .info-label { font-size: 11px; font-weight: 700; color: rgba(0,0,0,0.4); text-transform: uppercase; letter-spacing: 0.1em; }
    .info-value { font-size: 13px; font-weight: 800; color: #000000; }
    .info-value.accent { color: #16a34a; }
    .btn { display: inline-block; background: #000000; color: #ffffff; font-size: 11px; font-weight: 900; padding: 16px 32px; text-decoration: none; letter-spacing: 0.3em; text-transform: uppercase; margin: 24px 0; }
    .status-badge { display: inline-block; padding: 6px 16px; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.2em; border-radius: 2px; }
    .status-new { background: #eff6ff; color: #1d4ed8; }
    .status-processing { background: #fefce8; color: #854d0e; }
    .status-shipped { background: #f0fdf4; color: #15803d; }
    .status-completed { background: #f0fdf4; color: #15803d; }
    .status-cancelled { background: #fef2f2; color: #b91c1c; }
    .items-table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    .items-table th { background: #000000; color: #ffffff; font-size: 10px; font-weight: 900; padding: 10px 12px; text-align: right; letter-spacing: 0.2em; text-transform: uppercase; }
    .items-table td { padding: 12px; font-size: 12px; font-weight: 600; border-bottom: 1px solid rgba(0,0,0,0.05); color: #000000; }
    .items-table tr:last-child td { border-bottom: none; }
    .totals { margin-top: 16px; }
    .total-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 12px; font-weight: 700; color: rgba(0,0,0,0.5); }
    .total-row.final { padding-top: 12px; border-top: 2px solid #000000; font-size: 18px; font-weight: 900; color: #000000; }
    .tracking-box { background: #000000; color: #ffffff; padding: 20px 24px; margin: 20px 0; }
    .tracking-label { font-size: 9px; font-weight: 700; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.3em; margin-bottom: 4px; }
    .tracking-num { font-size: 22px; font-weight: 900; letter-spacing: 0.1em; font-family: monospace; }
    .footer { background: #000000; padding: 32px 40px; text-align: center; }
    .footer p { color: rgba(255,255,255,0.3); font-size: 10px; font-weight: 600; letter-spacing: 0.1em; line-height: 1.8; }
    .footer a { color: rgba(255,255,255,0.5); text-decoration: none; }
    .social-row { margin-top: 16px; display: flex; justify-content: center; gap: 16px; }
    .social-link { color: rgba(255,255,255,0.4); font-size: 10px; font-weight: 700; text-decoration: none; letter-spacing: 0.2em; text-transform: uppercase; }
    p { font-size: 13px; color: rgba(0,0,0,0.6); line-height: 1.8; margin-bottom: 12px; }
    .highlight { color: #000000; font-weight: 800; }
    @media (max-width: 600px) {
      .header, .body, .footer { padding: 24px 20px; }
      .title { font-size: 22px; }
    }
  </style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <div>
      <div class="logo-text">RF PERFUME</div>
      <div class="logo-sub">Build Systems. Stay Human.</div>
    </div>
    <div class="badge">قيروكس</div>
  </div>
  <div class="body">
    ${content}
  </div>
  <div class="footer">
    <p>
      © ${new Date().getFullYear()} رفيف العود — جميع الحقوق محفوظة<br/>
      <a href="https://e-commerce.rfperfume.sa">e-commerce.rfperfume.sa</a><br/>
      <span style="color:rgba(255,255,255,0.2)">هذا البريد مُرسل تلقائياً — لا تحتاج إلى الرد</span>
    </p>
    <div class="social-row">
      <a class="social-link" href="https://e-commerce.rfperfume.sa">المتجر</a>
      <a class="social-link" href="https://e-commerce.rfperfume.sa/orders">طلباتي</a>
      <a class="social-link" href="mailto:rf-purfume@outlook.com">الدعم</a>
    </div>
  </div>
</div>
</body>
</html>`;
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

  const itemsRows = params.items.map(item => `
    <tr>
      <td>${item.title}${item.color ? ` — ${item.color}` : ""}${item.size ? ` / ${item.size}` : ""}</td>
      <td style="text-align:center">${item.quantity}</td>
      <td style="text-align:left">${(item.price * item.quantity).toLocaleString("ar-SA")} ر.س</td>
    </tr>
  `).join("");

  const content = `
    <div class="title">✅ تم استلام طلبك!</div>
    <div class="subtitle">شكراً ${params.customerName}، طلبك في أيدٍ أمينة</div>

    <div class="info-box">
      <div class="info-row">
        <span class="info-label">رقم الطلب</span>
        <span class="info-value">#${params.orderRef}</span>
      </div>
      <div class="info-row">
        <span class="info-label">طريقة الدفع</span>
        <span class="info-value">${paymentLabels[params.paymentMethod] || params.paymentMethod}</span>
      </div>
      <div class="info-row">
        <span class="info-label">عنوان التوصيل</span>
        <span class="info-value" style="max-width:60%;text-align:left">${params.deliveryAddress}</span>
      </div>
      ${params.shippingCompany ? `
      <div class="info-row">
        <span class="info-label">شركة الشحن</span>
        <span class="info-value">${params.shippingCompany}</span>
      </div>` : ""}
      <div class="info-row">
        <span class="info-label">حالة الطلب</span>
        <span class="status-badge status-new">جديد</span>
      </div>
    </div>

    <hr class="divider" />
    <p style="font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:0.2em;color:#000">المنتجات المطلوبة</p>

    <table class="items-table">
      <thead>
        <tr>
          <th>المنتج</th>
          <th style="text-align:center">الكمية</th>
          <th style="text-align:left">السعر</th>
        </tr>
      </thead>
      <tbody>${itemsRows}</tbody>
    </table>

    <div class="totals">
      <div class="total-row">
        <span>${params.subtotal.toLocaleString("ar-SA")} ر.س</span>
        <span>المجموع الفرعي</span>
      </div>
      <div class="total-row">
        <span>${params.vatAmount.toLocaleString("ar-SA")} ر.س</span>
        <span>ضريبة القيمة المضافة (١٥٪)</span>
      </div>
      <div class="total-row">
        <span>${params.shippingCost.toLocaleString("ar-SA")} ر.س</span>
        <span>رسوم الشحن</span>
      </div>
      ${params.discountAmount && params.discountAmount > 0 ? `
      <div class="total-row" style="color:#16a34a">
        <span>-${params.discountAmount.toLocaleString("ar-SA")} ر.س</span>
        <span>الخصم</span>
      </div>` : ""}
      <div class="total-row final">
        <span style="color:#000">${params.total.toLocaleString("ar-SA")} ر.س</span>
        <span>الإجمالي</span>
      </div>
    </div>

    <hr class="divider" />

    <p>سيتم تجهيز طلبك والتواصل معك قريباً. يمكنك متابعة حالة طلبك من خلال حسابك في المتجر.</p>

    <a class="btn" href="https://e-commerce.rfperfume.sa/orders">متابعة طلبي</a>

    <hr class="divider" />
    <p style="font-size:11px">هل لديك استفسار؟ تواصل معنا على <a href="mailto:rf-purfume@outlook.com" style="color:#000;font-weight:800">rf-purfume@outlook.com</a></p>
  `;

  return sendEmail({
    to: params.to,
    toName: params.customerName,
    subject: `✅ تم استلام طلبك #${params.orderRef} — رفيف العود`,
    html: baseTemplate(`تأكيد الطلب #${params.orderRef}`, content),
    text: `تم استلام طلبك #${params.orderRef} بقيمة ${params.total} ر.س. شكراً لتسوقك مع رفيف العود.`,
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
      message: `<p>يسعدنا إعلامك أن طلبك <span class="highlight">#${params.orderRef}</span> يتم تجهيزه الآن من قِبل فريقنا. سنُرسل لك إشعاراً فور شحنه.</p>`,
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
        <p>رائع! تم شحن طلبك <span class="highlight">#${params.orderRef}</span> وهو في طريقه إليك.</p>
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
        <p>يسعدنا إعلامك بأن طلبك <span class="highlight">#${params.orderRef}</span> تم تسليمه بنجاح. نتمنى أن تعجبك المنتجات!</p>
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
        <p>تم إلغاء طلبك <span class="highlight">#${params.orderRef}</span>.${params.reason ? ` السبب: ${params.reason}.` : ""}</p>
        <p>إذا كنت قد دفعت ولم تتلقَّ استرداداً، يرجى التواصل معنا فوراً على <a href="mailto:rf-purfume@outlook.com" style="color:#000;font-weight:800">rf-purfume@outlook.com</a></p>
      `,
      cta: "تواصل معنا",
    },
  };

  const cfg = statusConfigs[params.status];

  const content = `
    <div style="text-align:center;margin-bottom:32px">
      <div style="font-size:48px;margin-bottom:12px">${cfg.emoji}</div>
      <div class="title">${cfg.title}</div>
      <div class="subtitle">${cfg.subtitle}</div>
    </div>

    <div class="info-box">
      <div class="info-row">
        <span class="info-label">رقم الطلب</span>
        <span class="info-value">#${params.orderRef}</span>
      </div>
      <div class="info-row">
        <span class="info-label">الحالة الجديدة</span>
        <span class="status-badge ${cfg.badgeClass}">${cfg.badgeText}</span>
      </div>
    </div>

    ${cfg.message}

    <a class="btn" href="https://e-commerce.rfperfume.sa/orders">${cfg.cta}</a>
  `;

  return sendEmail({
    to: params.to,
    toName: params.customerName,
    subject: `${cfg.emoji} طلبك #${params.orderRef} — ${cfg.badgeText} | رفيف العود`,
    html: baseTemplate(`تحديث الطلب #${params.orderRef}`, content),
    text: `تحديث طلبك #${params.orderRef}: ${cfg.badgeText}`,
  });
}

/** Welcome email for new customers */
export async function sendWelcomeEmail(params: {
  to: string;
  customerName: string;
}) {
  const content = `
    <div style="text-align:center;margin-bottom:32px">
      <div style="font-size:48px;margin-bottom:12px">👋</div>
      <div class="title">أهلاً وسهلاً ${params.customerName}!</div>
      <div class="subtitle">انضممت إلى عائلة رفيف العود</div>
    </div>

    <p>يسعدنا انضمامك إلى مجتمعنا. حسابك جاهز الآن وبإمكانك التسوق من مئات المنتجات الفاخرة بكل سهولة وأمان.</p>

    <div class="info-box" style="margin:24px 0">
      <div class="info-row">
        <span class="info-label">✅ حساب آمن</span>
        <span class="info-value" style="font-size:11px">بياناتك محمية بأعلى معايير التشفير</span>
      </div>
      <div class="info-row">
        <span class="info-label">🚚 شحن سريع</span>
        <span class="info-value" style="font-size:11px">توصيل خلال ٢-٤ أيام عمل</span>
      </div>
      <div class="info-row">
        <span class="info-label">💳 دفع متعدد</span>
        <span class="info-value" style="font-size:11px">مدى، فيزا، STC Pay، Apple Pay، تمارة، تابي</span>
      </div>
      <div class="info-row">
        <span class="info-label">🔔 إشعارات فورية</span>
        <span class="info-value" style="font-size:11px">تتبع طلبك لحظة بلحظة</span>
      </div>
    </div>

    <a class="btn" href="https://e-commerce.rfperfume.sa/products">ابدأ التسوق الآن</a>

    <hr class="divider" />
    <p style="font-size:11px;color:rgba(0,0,0,0.3)">إذا لم تكن أنت من أنشأ هذا الحساب، يُرجى التواصل معنا فوراً.</p>
  `;

  return sendEmail({
    to: params.to,
    toName: params.customerName,
    subject: `👋 أهلاً ${params.customerName}! مرحباً بك في رفيف العود`,
    html: baseTemplate("مرحباً بك في رفيف العود", content),
    text: `أهلاً ${params.customerName}! مرحباً بك في رفيف العود. يمكنك الآن التسوق من أفضل المنتجات.`,
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

  const content = `
    <div style="text-align:center;margin-bottom:32px">
      <div style="font-size:48px;margin-bottom:12px">💳</div>
      <div class="title">تم الدفع بنجاح!</div>
      <div class="subtitle">عملية الدفع اكتملت بأمان تام</div>
    </div>

    <div class="info-box">
      <div class="info-row">
        <span class="info-label">رقم الطلب</span>
        <span class="info-value">#${params.orderRef}</span>
      </div>
      <div class="info-row">
        <span class="info-label">المبلغ المدفوع</span>
        <span class="info-value accent">${params.amount.toLocaleString("ar-SA")} ر.س</span>
      </div>
      <div class="info-row">
        <span class="info-label">طريقة الدفع</span>
        <span class="info-value">${methodLabels[params.paymentMethod] || params.paymentMethod}</span>
      </div>
      ${params.transactionId ? `
      <div class="info-row">
        <span class="info-label">رقم العملية</span>
        <span class="info-value" style="font-family:monospace;font-size:11px">${params.transactionId.slice(0, 24)}</span>
      </div>` : ""}
      ${params.authCode ? `
      <div class="info-row">
        <span class="info-label">كود الموافقة</span>
        <span class="info-value" style="font-family:monospace;font-weight:900;color:#15803d">${params.authCode}</span>
      </div>` : ""}
      <div class="info-row">
        <span class="info-label">التاريخ والوقت</span>
        <span class="info-value" style="font-size:11px">${new Date().toLocaleString("ar-SA", { dateStyle: "long", timeStyle: "short" })}</span>
      </div>
    </div>

    <p>احتفظ بهذا البريد كإيصال دفعك. إذا لم تتعرف على هذه العملية، تواصل معنا فوراً.</p>

    <a class="btn" href="https://e-commerce.rfperfume.sa/orders">عرض طلباتي</a>
  `;

  return sendEmail({
    to: params.to,
    toName: params.customerName,
    subject: `💳 تأكيد الدفع — طلب #${params.orderRef} | رفيف العود`,
    html: baseTemplate("تأكيد الدفع", content),
    text: `تم الدفع بنجاح. طلب #${params.orderRef} — ${params.amount.toLocaleString()} ر.س.`,
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
    <div style="text-align:center;margin-bottom:32px">
      <div style="font-size:48px;margin-bottom:12px">🔐</div>
      <div class="title">استعادة كلمة المرور</div>
      <div class="subtitle">تلقينا طلباً لإعادة تعيين كلمة المرور</div>
    </div>

    ${params.otp ? `
    <div style="text-align:center;margin:32px 0">
      <p style="font-size:11px;font-weight:700;color:rgba(0,0,0,0.4);text-transform:uppercase;letter-spacing:0.2em;margin-bottom:12px">رمز التحقق</p>
      <div style="font-size:42px;font-weight:900;letter-spacing:0.3em;font-family:monospace;color:#000;background:#f8f8f6;padding:20px;border:2px solid #000">${params.otp}</div>
      <p style="font-size:11px;color:rgba(0,0,0,0.4);margin-top:8px">الرمز صالح لمدة ١٠ دقائق</p>
    </div>
    ` : ""}

    ${params.resetLink ? `
    <p>اضغط على الزر أدناه لإعادة تعيين كلمة مرورك:</p>
    <a class="btn" href="${params.resetLink}">إعادة تعيين كلمة المرور</a>
    ` : ""}

    <hr class="divider" />
    <p style="font-size:11px;color:rgba(0,0,0,0.3)">إذا لم تطلب إعادة تعيين كلمة المرور، تجاهل هذا البريد. لن يتغير شيء في حسابك.</p>
  `;

  return sendEmail({
    to: params.to,
    toName: params.customerName,
    subject: `🔐 استعادة كلمة المرور — رفيف العود`,
    html: baseTemplate("استعادة كلمة المرور", content),
    text: `رمز استعادة كلمة المرور: ${params.otp || ""}`,
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
  const dataRows = params.data
    ? Object.entries(params.data).map(([k, v]) => `
      <div class="info-row">
        <span class="info-label">${k}</span>
        <span class="info-value" style="font-size:12px">${v}</span>
      </div>`).join("")
    : "";

  const content = `
    <div class="title">${params.title}</div>
    <div class="subtitle">تنبيه إداري — رفيف العود</div>

    <p>${params.message}</p>

    ${dataRows ? `<div class="info-box">${dataRows}</div>` : ""}

    <a class="btn" href="https://e-commerce.rfperfume.sa/admin">لوحة التحكم</a>
  `;

  return sendEmail({
    to: params.to,
    subject: params.subject,
    html: baseTemplate(params.title, content),
    text: `${params.title}\n${params.message}`,
  });
}

/** Low-level direct send — for custom use */
export { sendEmail };
