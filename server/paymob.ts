import crypto from "crypto";

const PAYMOB_BASE = "https://accept.paymob.com/api";

function getConfig() {
  return {
    apiKey: process.env.PAYMOB_API_KEY || "",
    integrationId: process.env.PAYMOB_INTEGRATION_ID || "",
    iframeId: process.env.PAYMOB_IFRAME_ID || "",
    hmacSecret: process.env.PAYMOB_HMAC_SECRET || "",
  };
}

export function isPaymobConfigured(): boolean {
  const c = getConfig();
  return !!(c.apiKey && c.integrationId && c.iframeId);
}

async function getAuthToken(): Promise<string> {
  const { apiKey } = getConfig();
  if (!apiKey) throw new Error("PAYMOB_API_KEY غير مُعدّ");

  const res = await fetch(`${PAYMOB_BASE}/auth/tokens`, {
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
  const res = await fetch(`${PAYMOB_BASE}/ecommerce/orders`, {
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

  const res = await fetch(`${PAYMOB_BASE}/acceptance/payment_keys`, {
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
    console.warn("[Paymob] HMAC secret not configured, skipping verification");
    return true;
  }

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
    data.order?.id || data.order,
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
