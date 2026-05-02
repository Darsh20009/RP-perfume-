import crypto from "crypto";

// Auto-detect Paymob region from the secret key prefix:
//   - "sau_sk_..." or "sau_pk_..." → KSA  → https://ksa.paymob.com
//   - "egy_sk_..." or anything else  → Egypt → https://accept.paymob.com
// Override with PAYMOB_BASE_URL if you really need a custom base.
function detectPaymobBase(): string {
  if (process.env.PAYMOB_BASE_URL) return process.env.PAYMOB_BASE_URL.replace(/\/+$/, "");
  const sk = process.env.PAYMOB_SECRET_KEY || "";
  const pk = process.env.PAYMOB_PUBLIC_KEY || "";
  if (sk.startsWith("sau_") || pk.startsWith("sau_")) return "https://ksa.paymob.com";
  return "https://accept.paymob.com";
}
const PAYMOB_BASE = detectPaymobBase();
const PAYMOB_API_BASE = `${PAYMOB_BASE}/api`;
console.log(`[Paymob] Using base URL: ${PAYMOB_BASE}`);

function getConfig() {
  return {
    apiKey: process.env.PAYMOB_API_KEY || "",
    integrationId: process.env.PAYMOB_INTEGRATION_ID || "",
    iframeId: process.env.PAYMOB_IFRAME_ID || "",
    hmacSecret: process.env.PAYMOB_HMAC_SECRET || "",
    secretKey: process.env.PAYMOB_SECRET_KEY || "",
    publicKey: process.env.PAYMOB_PUBLIC_KEY || "",
  };
}

export function isPaymobConfigured(): boolean {
  const c = getConfig();
  // New unified flow needs: secret + public + integration_id + hmac
  if (c.secretKey && c.publicKey && c.integrationId && c.hmacSecret) return true;
  // Old iframe flow needs: api_key + integration_id + iframe_id
  return !!(c.apiKey && c.integrationId && c.iframeId);
}

export function paymobMode(): "intention" | "iframe" | "none" {
  const c = getConfig();
  if (c.secretKey && c.publicKey && c.integrationId) return "intention";
  if (c.apiKey && c.integrationId && c.iframeId) return "iframe";
  return "none";
}

async function getAuthToken(): Promise<string> {
  const { apiKey } = getConfig();
  if (!apiKey) throw new Error("PAYMOB_API_KEY غير مُعدّ");

  const res = await fetch(`${PAYMOB_API_BASE}/auth/tokens`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Paymob auth failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return data.token;
}

async function registerOrder(authToken: string, merchantOrderId: string, amountCents: number, items: any[]) {
  const res = await fetch(`${PAYMOB_API_BASE}/ecommerce/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_token: authToken,
      delivery_needed: false,
      amount_cents: amountCents,
      merchant_order_id: merchantOrderId,
      currency: "SAR",
      items: items.map(item => ({
        name: item.title || item.name || "منتج",
        amount_cents: Math.round((item.price || 0) * 100),
        quantity: item.quantity || 1,
        description: item.title || "",
      })),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Paymob order registration failed: ${res.status} ${text}`);
  }

  return await res.json();
}

async function getPaymentKey(params: {
  authToken: string;
  orderId: number;
  amountCents: number;
  billingData: {
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string;
    street: string;
    city: string;
    country: string;
  };
}): Promise<string> {
  const { integrationId } = getConfig();
  if (!integrationId) throw new Error("PAYMOB_INTEGRATION_ID غير مُعدّ");

  const res = await fetch(`${PAYMOB_API_BASE}/acceptance/payment_keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_token: params.authToken,
      amount_cents: params.amountCents,
      expiration: 3600,
      order_id: params.orderId,
      billing_data: {
        apartment: "N/A",
        email: params.billingData.email || "customer@rfperfume.sa",
        floor: "N/A",
        first_name: params.billingData.first_name || "عميل",
        street: params.billingData.street || "N/A",
        building: "N/A",
        phone_number: params.billingData.phone_number || "N/A",
        shipping_method: "N/A",
        postal_code: "N/A",
        city: params.billingData.city || "الرياض",
        country: params.billingData.country || "SA",
        last_name: params.billingData.last_name || ".",
        state: "N/A",
      },
      currency: "SAR",
      integration_id: parseInt(integrationId),
      lock_order_when_paid: true,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Paymob payment key failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return data.token;
}

export async function initiatePaymobPayment(params: {
  merchantOrderId: string;
  amount: number;
  items: any[];
  customer: {
    name: string;
    email: string;
    phone: string;
    address?: string;
    city?: string;
  };
}): Promise<{ iframeUrl: string; paymobOrderId: number; paymentToken: string }> {
  const { iframeId } = getConfig();
  if (!iframeId) throw new Error("PAYMOB_IFRAME_ID غير مُعدّ");

  const amountCents = Math.round(params.amount * 100);

  const authToken = await getAuthToken();

  const order = await registerOrder(authToken, params.merchantOrderId, amountCents, params.items);

  const nameParts = (params.customer.name || "عميل").split(" ");
  const firstName = nameParts[0] || "عميل";
  const lastName = nameParts.slice(1).join(" ") || ".";

  const addressParts = (params.customer.address || "").split(",").map(s => s.trim());

  const paymentKey = await getPaymentKey({
    authToken,
    orderId: order.id,
    amountCents,
    billingData: {
      first_name: firstName,
      last_name: lastName,
      email: params.customer.email || "customer@rfperfume.sa",
      phone_number: params.customer.phone || "",
      street: addressParts[0] || "N/A",
      city: params.customer.city || addressParts[1] || "الرياض",
      country: "SA",
    },
  });

  const iframeUrl = `https://accept.paymob.com/api/acceptance/iframes/${iframeId}?payment_token=${paymentKey}`;

  return {
    iframeUrl,
    paymobOrderId: order.id,
    paymentToken: paymentKey,
  };
}

export function verifyPaymobHmac(data: Record<string, any>, receivedHmac: string): boolean {
  const { hmacSecret } = getConfig();
  if (!hmacSecret) {
    // FAIL-CLOSED in production: if we don't have the HMAC secret we cannot
    // prove the callback came from Paymob, so refuse to honour it. In dev we
    // return true (with a loud warning) so local testing without the secret
    // still works.
    if (process.env.NODE_ENV === "production") {
      console.error("[Paymob] HMAC secret not configured in production — rejecting callback");
      return false;
    }
    console.warn("[Paymob] HMAC secret not configured, skipping verification (dev only)");
    return true;
  }

  // The `order` field in Paymob's HMAC tuple is the internal order id. In a
  // raw transaction body it appears as `order.id` (nested object); in a
  // pre-flattened payload that becomes the dotted key `"order.id"`; in some
  // event shapes it's a bare numeric `order`. Resolve all three so this verifier
  // works whether the caller passes the original txn or a flattened map.
  const orderField =
    data["order.id"] ??
    (data.order && typeof data.order === "object" ? data.order.id : data.order) ??
    "";

  const concatenatedString = [
    data.amount_cents,
    data.created_at,
    data.currency,
    data.error_occured,
    data.has_parent_transaction,
    data.id,
    data.integration_id,
    data.is_3d_secure,
    data.is_auth,
    data.is_capture,
    data.is_refunded,
    data.is_standalone_payment,
    data.is_voided,
    orderField,
    data.owner,
    data.pending,
    data["source_data.pan"],
    data["source_data.sub_type"],
    data["source_data.type"],
    data.success,
  ].join("");

  const computed = crypto
    .createHmac("sha512", hmacSecret)
    .update(concatenatedString)
    .digest("hex");

  return computed === receivedHmac;
}

/**
 * NEW: Unified Intention flow (Paymob's recommended modern API).
 * Uses SECRET key + PUBLIC key + integration_id, returns a hosted-checkout URL.
 * Endpoint: POST {base}/v1/intention/  (Authorization: Token <secret_key>)
 * Then redirect to: {base}/unifiedcheckout/?publicKey=<pk>&clientSecret=<cs>
 */
export async function initiatePaymobIntention(params: {
  merchantOrderId: string;
  amount: number;
  items: any[];
  customer: { name: string; email: string; phone: string; address?: string; city?: string };
  notificationUrl: string;
  redirectionUrl: string;
}): Promise<{ iframeUrl: string; intentionId: string; clientSecret: string }> {
  const { secretKey, publicKey, integrationId } = getConfig();
  if (!secretKey || !publicKey || !integrationId) {
    throw new Error("Paymob intention flow needs PAYMOB_SECRET_KEY + PAYMOB_PUBLIC_KEY + PAYMOB_INTEGRATION_ID");
  }

  const amountCents = Math.round(params.amount * 100);
  const nameParts = (params.customer.name || "Customer").split(" ");
  const firstName = nameParts[0] || "Customer";
  const lastName = nameParts.slice(1).join(" ") || ".";

  const integrationIds = integrationId.split(",").map(s => parseInt(s.trim())).filter(n => !isNaN(n));

  // Build items with prices in cents. Paymob enforces:
  //   sum(item.amount * item.quantity) === amount
  // If our order has shipping/tax/discount that aren't represented as items,
  // the totals won't match and Paymob returns 406 "unmatched_item_prices".
  // Fix: compute the diff and inject a balancing line item ("شحن وضرائب" or
  // "خصم") so the sum always equals the grand total.
  const mappedItems = (params.items || []).map(it => ({
    name: (it.title || it.name || "منتج").slice(0, 100),
    amount: Math.round((Number(it.price) || 0) * 100),
    quantity: Number(it.quantity) || 1,
    description: (it.title || it.name || "").slice(0, 100),
  }));
  const itemsSum = mappedItems.reduce((s, it) => s + it.amount * it.quantity, 0);
  const diff = amountCents - itemsSum;
  if (diff > 0) {
    mappedItems.push({
      name: "شحن وضرائب",
      amount: diff,
      quantity: 1,
      description: "shipping/tax adjustment",
    });
  } else if (diff < 0) {
    mappedItems.push({
      name: "خصم",
      amount: diff, // negative to subtract
      quantity: 1,
      description: "discount adjustment",
    });
  }
  // Fallback: if we ended up with zero items (empty cart edge case), send a
  // single line item with the full amount so Paymob accepts the intention.
  if (mappedItems.length === 0) {
    mappedItems.push({
      name: "إجمالي الطلب",
      amount: amountCents,
      quantity: 1,
      description: `Order ${params.merchantOrderId}`,
    });
  }

  const body = {
    amount: amountCents,
    currency: "SAR",
    payment_methods: integrationIds,
    items: mappedItems,
    billing_data: {
      first_name: firstName,
      last_name: lastName,
      phone_number: params.customer.phone || "",
      email: params.customer.email || "customer@rfperfume.sa",
      country: "SAU",
      city: params.customer.city || "الرياض",
      street: params.customer.address || "N/A",
      building: "N/A",
      floor: "N/A",
      apartment: "N/A",
      state: params.customer.city || "الرياض",
    },
    customer: {
      first_name: firstName,
      last_name: lastName,
      email: params.customer.email || "customer@rfperfume.sa",
    },
    extras: { merchant_order_id: params.merchantOrderId },
    special_reference: params.merchantOrderId,
    notification_url: params.notificationUrl,
    redirection_url: params.redirectionUrl,
  };

  const res = await fetch(`${PAYMOB_BASE}/v1/intention/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Token ${secretKey}`,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let data: any = {};
  try { data = JSON.parse(text); } catch {}
  if (!res.ok) {
    console.error("[Paymob intention] HTTP", res.status, text.slice(0, 500));
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        "Paymob رفض المفتاح السري (401). افتح لوحة Paymob → Developers → API Keys، " +
        "ولّد Secret Key + Public Key جديدين، ثم حدّث PAYMOB_SECRET_KEY و PAYMOB_PUBLIC_KEY في الأسرار."
      );
    }
    throw new Error(`Paymob intention failed: ${res.status} ${data?.detail || data?.message || ""}`);
  }

  const clientSecret = data?.client_secret;
  const intentionId = data?.id;
  if (!clientSecret) throw new Error("Paymob intention returned no client_secret");

  const iframeUrl = `${PAYMOB_BASE}/unifiedcheckout/?publicKey=${encodeURIComponent(publicKey)}&clientSecret=${encodeURIComponent(clientSecret)}`;

  return { iframeUrl, intentionId, clientSecret };
}

export function flattenPaymobCallback(obj: any, prefix = ""): Record<string, any> {
  const result: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === "object" && obj[key] !== null && !Array.isArray(obj[key])) {
      Object.assign(result, flattenPaymobCallback(obj[key], fullKey));
    } else {
      result[fullKey] = obj[key];
    }
  }
  return result;
}
