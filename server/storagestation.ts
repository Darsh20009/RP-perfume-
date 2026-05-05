/**
 * Storage Station (storagestation.app) Integration
 * WooCommerce REST API v3
 *
 * Orders are pushed ONLY after payment is confirmed.
 * Each order item is mapped using variantSku.
 */

const SS_BASE_URL = "https://storagestation.app/wp-json/wc/v3";
const SS_KEY = process.env.STORAGE_STATION_API_KEY || "";
const SS_SECRET = process.env.STORAGE_STATION_API_SECRET || "";

export function isStorageStationConfigured(): boolean {
  return !!(SS_KEY && SS_SECRET);
}

function authHeaders(): Record<string, string> {
  const creds = Buffer.from(`${SS_KEY}:${SS_SECRET}`).toString("base64");
  return {
    "Authorization": `Basic ${creds}`,
    "Content-Type": "application/json",
  };
}

async function ssRequest(
  method: "GET" | "POST" | "PUT" | "PATCH",
  path: string,
  body?: Record<string, any>,
): Promise<any> {
  const url = `${SS_BASE_URL}${path}`;
  const res = await fetch(url, {
    method,
    headers: authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!res.ok) {
    const msg = data?.message || data?.code || text || res.statusText;
    throw new Error(`[StorageStation] HTTP ${res.status}: ${msg}`);
  }
  return data;
}

export interface StorageStationOrderResult {
  wcOrderId: number;
  wcOrderNumber: string;
  status: string;
}

/**
 * Build and push a paid order to Storage Station.
 * Only called for delivery orders after payment confirmation.
 */
export async function pushOrderToStorageStation(order: any): Promise<StorageStationOrderResult> {
  if (!isStorageStationConfigured()) {
    throw new Error("[StorageStation] API credentials not configured");
  }

  const orderRef = String(order.id || order._id).slice(-8).toUpperCase();

  // Map shipping address
  const addr = order.shippingAddress || {};
  const city = addr.city || "Riyadh";
  const street = [addr.street, addr.district].filter(Boolean).join("، ") || order.deliveryAddress || "";

  // Split customer name
  const fullName = (order.customerName || "عميل رفيف").trim();
  const nameParts = fullName.split(" ");
  const firstName = nameParts[0] || fullName;
  const lastName = nameParts.slice(1).join(" ") || "-";

  const phone = (order.customerPhone || "").replace(/\D/g, "");

  // Build line items using SKU
  const lineItems = (order.items || []).map((item: any) => ({
    name: item.title || "منتج عطري",
    quantity: item.quantity || 1,
    price: String(item.price || "0"),
    total: String(((item.price || 0) * (item.quantity || 1)).toFixed(2)),
    sku: item.variantSku || "",
    meta_data: [
      { key: "sku", value: item.variantSku || "" },
      { key: "rf_order_id", value: orderRef },
    ],
  }));

  const wcOrder = {
    status: "processing",
    currency: "SAR",
    billing: {
      first_name: firstName,
      last_name: lastName,
      phone,
      address_1: street,
      city,
      country: addr.country || "SA",
      email: "",
    },
    shipping: {
      first_name: firstName,
      last_name: lastName,
      phone,
      address_1: street,
      city,
      country: addr.country || "SA",
    },
    line_items: lineItems,
    shipping_lines: [
      {
        method_title: "شحن رفيف العود",
        method_id: "flat_rate",
        total: String(Number(order.shippingCost || "0").toFixed(2)),
      },
    ],
    meta_data: [
      { key: "rf_order_id", value: String(order.id || order._id) },
      { key: "rf_order_ref", value: orderRef },
      { key: "rf_payment_method", value: order.paymentMethod || "" },
      { key: "rf_notes", value: order.notes || "" },
      { key: "source", value: "rfperfume" },
    ],
    customer_note: order.notes || "",
    payment_method: "bacs",
    payment_method_title: "مدفوع مسبقاً",
    set_paid: true,
  };

  const result = await ssRequest("POST", "/orders", wcOrder);

  return {
    wcOrderId: result.id,
    wcOrderNumber: String(result.number || result.id),
    status: result.status || "processing",
  };
}

/**
 * Update the status of a WooCommerce order on Storage Station.
 */
export async function updateStorageStationOrder(
  wcOrderId: number,
  status: string,
): Promise<void> {
  await ssRequest("PUT", `/orders/${wcOrderId}`, { status });
}

/**
 * Get current status of a Storage Station order.
 */
export async function getStorageStationOrder(wcOrderId: number): Promise<any> {
  return ssRequest("GET", `/orders/${wcOrderId}`);
}
