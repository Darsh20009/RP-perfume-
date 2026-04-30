/**
 * Tamara BNPL — Real API integration.
 * Docs: https://docs.tamara.co/
 *
 * Auth model:
 *   - API Token (Bearer)        → create checkout / authorise / capture / refund
 *   - Notification Token        → webhook signature verification
 *   - Public Key                → frontend widget (optional)
 */

import crypto from "crypto";

const TAMARA_API_BASE = process.env.TAMARA_API_URL || "https://api.tamara.co";

const API_TOKEN = process.env.TAMARA_API_TOKEN || "";
const NOTIFICATION_TOKEN = process.env.TAMARA_NOTIFICATION_TOKEN || "";

export function isTamaraConfigured(): boolean {
  return !!API_TOKEN;
}

const orderToCheckoutId = new Map<string, string>();
const orderToTamaraOrderId = new Map<string, string>();

export interface TamaraCheckoutInput {
  orderId: string;
  amount: number;
  customer: { name: string; phone: string; email: string };
  shipping?: { city?: string; address?: string; zip?: string };
  items?: Array<{ title: string; quantity: number; price: number; sku?: string }>;
  origin: string;
  installments?: 3 | 4 | 6;
  lang?: "ar" | "en";
}

export interface TamaraCheckoutResult {
  success: boolean;
  checkoutUrl?: string;
  checkoutId?: string;
  tamaraOrderId?: string;
  error?: string;
}

export async function createTamaraCheckout(input: TamaraCheckoutInput): Promise<TamaraCheckoutResult> {
  if (!isTamaraConfigured()) {
    return { success: false, error: "Tamara API token not configured" };
  }

  const fmt = (n: number) => Number(n).toFixed(2);
  const lang = input.lang || "ar";
  const locale = lang === "ar" ? "ar_SA" : "en_SA";

  const nameParts = (input.customer.name || "Customer").trim().split(/\s+/);
  const firstName = nameParts[0] || "Customer";
  const lastName = nameParts.slice(1).join(" ") || ".";

  const normalizePhone = (raw: string): string => {
    const digits = (raw || "").replace(/\D/g, "");
    if (!digits) return "500000000";
    if (digits.startsWith("966")) return digits.slice(3);
    if (digits.startsWith("0")) return digits.slice(1);
    return digits;
  };
  const phone = normalizePhone(input.customer.phone);

  const items = (input.items && input.items.length > 0)
    ? input.items
    : [{ title: `Order ${input.orderId}`, quantity: 1, price: input.amount, sku: input.orderId }];

  const itemsTotal = items.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.quantity) || 1), 0);
  // Tamara requires total_amount === sum(items) + tax + shipping - discount.
  // We send tax/shipping/discount as 0 and let total_amount = items total. The order total
  // is enforced in our DB; gateway-side amount validation is done at confirmation.
  const totalAmount = itemsTotal > 0 ? itemsTotal : Number(input.amount);

  const body = {
    order_reference_id: input.orderId,
    total_amount: { amount: fmt(totalAmount), currency: "SAR" },
    description: `Order ${input.orderId}`,
    country_code: "SA",
    payment_type: "PAY_BY_INSTALMENTS",
    instalments: input.installments || 4,
    locale,
    items: items.map((it, idx) => ({
      reference_id: it.sku || `i${idx + 1}`,
      type: "perfume",
      name: (it.title || "Perfume").slice(0, 100),
      sku: it.sku || `sku-${idx + 1}`,
      quantity: Math.max(1, Math.floor(Number(it.quantity) || 1)),
      total_amount: { amount: fmt((Number(it.price) || 0) * (Number(it.quantity) || 1)), currency: "SAR" },
      unit_price: { amount: fmt(Number(it.price) || 0), currency: "SAR" },
    })),
    consumer: {
      first_name: firstName,
      last_name: lastName,
      email: input.customer.email || "support@rfperfume.sa",
      phone_number: phone,
    },
    shipping_address: {
      first_name: firstName,
      last_name: lastName,
      line1: input.shipping?.address || "King Fahd Rd",
      city: input.shipping?.city || "Riyadh",
      country_code: "SA",
      phone_number: phone,
    },
    tax_amount: { amount: "0.00", currency: "SAR" },
    shipping_amount: { amount: "0.00", currency: "SAR" },
    merchant_url: {
      success: `${input.origin}/api/payments/tamara/return?orderId=${encodeURIComponent(input.orderId)}&status=success`,
      failure: `${input.origin}/api/payments/tamara/return?orderId=${encodeURIComponent(input.orderId)}&status=failure`,
      cancel: `${input.origin}/api/payments/tamara/return?orderId=${encodeURIComponent(input.orderId)}&status=cancel`,
      notification: `${input.origin}/api/payments/tamara/webhook`,
    },
  };

  try {
    const res = await fetch(`${TAMARA_API_BASE}/checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_TOKEN}`,
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    let data: any = {};
    try { data = JSON.parse(text); } catch { /* keep text */ }

    if (!res.ok) {
      console.error("[Tamara] checkout HTTP", res.status, text.slice(0, 500));
      const errMsg = data?.errors?.[0]?.error_code
        || data?.errors?.[0]?.message
        || data?.message
        || `Tamara error ${res.status}`;
      return { success: false, error: errMsg };
    }

    const checkoutUrl: string | undefined = data?.checkout_url;
    const checkoutId: string | undefined = data?.checkout_id;
    const tamaraOrderId: string | undefined = data?.order_id;

    if (!checkoutUrl) {
      console.warn("[Tamara] no checkout_url in response:", JSON.stringify(data).slice(0, 300));
      return { success: false, error: "Tamara did not return a checkout URL" };
    }

    if (checkoutId) orderToCheckoutId.set(input.orderId, checkoutId);
    if (tamaraOrderId) orderToTamaraOrderId.set(input.orderId, tamaraOrderId);

    return { success: true, checkoutUrl, checkoutId, tamaraOrderId };
  } catch (err: any) {
    console.error("[Tamara] checkout network error:", err?.message || err);
    return { success: false, error: err?.message || "Network error talking to Tamara" };
  }
}

/**
 * After the consumer authorises in Tamara, we need to (a) authorise the order
 * (mark it ready for capture) and then (b) capture funds. Tamara's normal flow:
 *   approved → authorised (auto by us) → captured (we trigger after shipping)
 * For checkout-time confirmation (no shipping yet), we authorise immediately so
 * the order moves out of "approved" and remains valid; we'll capture from admin.
 */
export async function authoriseTamaraOrder(tamaraOrderId: string): Promise<{ ok: boolean; error?: string }> {
  if (!isTamaraConfigured()) return { ok: false, error: "not_configured" };
  try {
    const res = await fetch(`${TAMARA_API_BASE}/orders/${tamaraOrderId}/authorise`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok && res.status !== 409) {
      const t = await res.text();
      console.error("[Tamara] authorise HTTP", res.status, t.slice(0, 300));
      return { ok: false, error: `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (err: any) {
    console.error("[Tamara] authorise network:", err?.message);
    return { ok: false, error: err?.message };
  }
}

export async function getTamaraOrder(tamaraOrderId: string): Promise<{
  ok: boolean; status?: string; amount?: number; orderReferenceId?: string; data?: any; error?: string;
}> {
  if (!isTamaraConfigured()) return { ok: false, error: "not_configured" };
  try {
    const res = await fetch(`${TAMARA_API_BASE}/orders/${tamaraOrderId}`, {
      headers: { Authorization: `Bearer ${API_TOKEN}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("[Tamara] get-order HTTP", res.status, JSON.stringify(data).slice(0, 300));
      return { ok: false, error: data?.message || `HTTP ${res.status}` };
    }
    return {
      ok: true,
      status: data?.status,
      amount: parseFloat(data?.total_amount?.amount || "0"),
      orderReferenceId: data?.order_reference_id,
      data,
    };
  } catch (err: any) {
    console.error("[Tamara] get-order network:", err?.message);
    return { ok: false, error: err?.message };
  }
}

/**
 * Verify Tamara webhook signature.
 *
 * Tamara sends `tamara-token` header (HMAC-SHA256 of the raw body using the
 * notification token as the secret). We use a constant-time comparison.
 */
export function verifyTamaraWebhook(rawBody: string | Buffer, headerToken: string): boolean {
  if (!NOTIFICATION_TOKEN) {
    if (process.env.NODE_ENV === "production") {
      console.error("[Tamara webhook] TAMARA_NOTIFICATION_TOKEN not set in production — rejecting");
      return false;
    }
    console.warn("[Tamara webhook] notification token not configured (dev only) — accepting");
    return true;
  }
  if (!headerToken) return false;

  try {
    const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody || "", "utf8");
    const computed = crypto.createHmac("sha256", NOTIFICATION_TOKEN).update(body).digest("hex");
    const a = Buffer.from(computed, "hex");
    const b = Buffer.from(String(headerToken).trim(), "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch (err: any) {
    console.error("[Tamara webhook] signature verify error:", err?.message);
    return false;
  }
}

export function getCachedTamaraOrderId(orderId: string): string | undefined {
  return orderToTamaraOrderId.get(orderId);
}

export function rememberTamaraOrderId(orderId: string, tamaraOrderId: string) {
  orderToTamaraOrderId.set(orderId, tamaraOrderId);
}
