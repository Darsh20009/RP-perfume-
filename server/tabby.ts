/**
 * Tabby BNPL — Real API integration (v2 Checkout).
 * Docs: https://docs.tabby.ai/
 *
 * Auth model:
 *   - PUBLIC key (pk_…) → create checkout sessions (pre-scoring)
 *   - SECRET key (sk_…) → retrieve / capture / refund / webhook signature
 */

const TABBY_API_BASE = "https://api.tabby.ai";

const PUBLIC_KEY = process.env.TABBY_PUBLIC_KEY || "";
const SECRET_KEY = process.env.TABBY_SECRET_KEY || "";
const MERCHANT_CODE = process.env.TABBY_MERCHANT_CODE || "RFperfume";

export function isTabbyConfigured(): boolean {
  return !!(PUBLIC_KEY && SECRET_KEY);
}

// In-memory cache mapping our orderId → Tabby payment id (best-effort; webhook also looks up by reference_id)
const orderToPaymentId = new Map<string, string>();

export interface TabbyCheckoutInput {
  orderId: string;
  amount: number;
  customer: { name: string; phone: string; email: string };
  shipping?: { city?: string; address?: string; zip?: string };
  items?: Array<{ title: string; quantity: number; price: number; sku?: string }>;
  origin: string; // e.g. https://rfperfume.replit.app
  lang?: "ar" | "en";
}

export interface TabbyCheckoutResult {
  success: boolean;
  sessionId?: string;
  checkoutUrl?: string;
  paymentId?: string;
  rejectionReason?: string;
  error?: string;
}

/**
 * Create a Tabby checkout session and return the hosted-checkout URL.
 */
export async function createTabbyCheckout(input: TabbyCheckoutInput): Promise<TabbyCheckoutResult> {
  if (!isTabbyConfigured()) {
    return { success: false, error: "Tabby keys are not configured on the server" };
  }

  const fmt = (n: number) => n.toFixed(2);
  const lang = input.lang || "ar";
  const items = (input.items && input.items.length > 0)
    ? input.items
    : [{ title: `Order ${input.orderId}`, quantity: 1, price: input.amount, sku: input.orderId }];

  // Tabby phone format: digits with country code, no +. We accept "+966 5x..." or local "05x..." and normalize.
  const normalizePhone = (raw: string): string => {
    const digits = (raw || "").replace(/\D/g, "");
    if (!digits) return "";
    if (digits.startsWith("966")) return digits;
    if (digits.startsWith("0")) return "966" + digits.slice(1);
    return "966" + digits;
  };

  const body = {
    payment: {
      amount: fmt(input.amount),
      currency: "SAR",
      description: `Order ${input.orderId}`,
      buyer: {
        phone: normalizePhone(input.customer.phone) || "966500000000",
        email: input.customer.email || "support@rfperfume.sa",
        name: input.customer.name || "Customer",
      },
      buyer_history: {
        registered_since: new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString(),
        loyalty_level: 0,
      },
      order: {
        tax_amount: "0.00",
        shipping_amount: "0.00",
        discount_amount: "0.00",
        updated_at: new Date().toISOString(),
        reference_id: input.orderId,
        items: items.map(it => ({
          title: it.title.slice(0, 100),
          quantity: Math.max(1, Math.floor(it.quantity)),
          unit_price: fmt(it.price),
          discount_amount: "0.00",
          reference_id: it.sku || input.orderId,
          category: "perfume",
        })),
      },
      shipping_address: {
        city: input.shipping?.city || "Riyadh",
        address: input.shipping?.address || "Saudi Arabia",
        zip: input.shipping?.zip || "12345",
      },
      order_history: [],
      meta: {
        order_id: input.orderId,
        customer: input.customer.email || input.customer.phone || input.orderId,
      },
    },
    lang,
    merchant_code: MERCHANT_CODE,
    merchant_urls: {
      success: `${input.origin}/api/payments/tabby/return?orderId=${encodeURIComponent(input.orderId)}&status=success`,
      cancel: `${input.origin}/api/payments/tabby/return?orderId=${encodeURIComponent(input.orderId)}&status=cancel`,
      failure: `${input.origin}/api/payments/tabby/return?orderId=${encodeURIComponent(input.orderId)}&status=failure`,
    },
  };

  try {
    const res = await fetch(`${TABBY_API_BASE}/api/v2/checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${PUBLIC_KEY}`,
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    let data: any = {};
    try { data = JSON.parse(text); } catch { /* keep text */ }

    if (!res.ok) {
      console.error("[Tabby] checkout HTTP", res.status, text.slice(0, 400));
      const errMsg = data?.errors?.[0]?.message || data?.message || `Tabby error ${res.status}`;
      return { success: false, error: errMsg };
    }

    // Tabby returns configuration.available_products.installments[] with web_url to redirect
    const installments = data?.configuration?.available_products?.installments;
    const firstWebUrl = Array.isArray(installments) && installments.length > 0 ? installments[0]?.web_url : null;

    if (!firstWebUrl) {
      // The customer was rejected by Tabby's pre-scoring
      const reason = data?.status === "rejected"
        ? (data?.configuration?.products?.installments?.[0]?.rejection_reason || data?.rejection_reason || "rejected")
        : "no_checkout_url";
      console.warn("[Tabby] no installments offered:", reason, JSON.stringify(data).slice(0, 300));
      return { success: false, rejectionReason: reason, error: lang === "ar"
        ? "تابي لم توافق على هذه العملية. جرّب طريقة دفع أخرى."
        : "Tabby did not approve this purchase. Please try another payment method." };
    }

    if (data?.id) orderToPaymentId.set(input.orderId, data.id);

    return {
      success: true,
      sessionId: data.id,
      paymentId: data.payment?.id || data.id,
      checkoutUrl: firstWebUrl,
    };
  } catch (err: any) {
    console.error("[Tabby] checkout network error:", err?.message || err);
    return { success: false, error: err?.message || "Network error talking to Tabby" };
  }
}

/**
 * Fetch payment status from Tabby (uses the SECRET key).
 */
export async function retrieveTabbyPayment(paymentId: string): Promise<{
  ok: boolean; status?: string; amount?: number; data?: any; error?: string;
}> {
  if (!isTabbyConfigured()) return { ok: false, error: "not_configured" };
  try {
    const res = await fetch(`${TABBY_API_BASE}/api/v2/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${SECRET_KEY}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("[Tabby] retrieve HTTP", res.status, JSON.stringify(data).slice(0, 300));
      return { ok: false, error: data?.message || `HTTP ${res.status}` };
    }
    return { ok: true, status: data?.status, amount: parseFloat(data?.amount || "0"), data };
  } catch (err: any) {
    console.error("[Tabby] retrieve network:", err?.message);
    return { ok: false, error: err?.message };
  }
}

/**
 * Capture an authorized payment so funds are transferred. Required to convert AUTHORIZED → CLOSED.
 */
export async function captureTabbyPayment(paymentId: string, amount: number): Promise<{ ok: boolean; error?: string }> {
  if (!isTabbyConfigured()) return { ok: false, error: "not_configured" };
  try {
    const res = await fetch(`${TABBY_API_BASE}/api/v1/payments/${paymentId}/captures`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SECRET_KEY}`,
      },
      body: JSON.stringify({ amount: amount.toFixed(2) }),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error("[Tabby] capture HTTP", res.status, t.slice(0, 300));
      return { ok: false, error: `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (err: any) {
    console.error("[Tabby] capture network:", err?.message);
    return { ok: false, error: err?.message };
  }
}

/**
 * Resolve our orderId → tabby paymentId. We cache from the create call; for older sessions we
 * fall back to a search via Tabby (best-effort).
 */
export function getCachedPaymentId(orderId: string): string | undefined {
  return orderToPaymentId.get(orderId);
}

export function rememberPaymentId(orderId: string, paymentId: string) {
  orderToPaymentId.set(orderId, paymentId);
}
