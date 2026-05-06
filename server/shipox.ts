/**
 * Shipox API Integration — 3rd Mile (Storage Station)
 * Base URL: https://3rdmile.my.shipox.com
 *
 * Authentication: POST /api/v1/customer/authenticate → Bearer JWT (1h TTL)
 *
 * Service Types (provided by 3rd Mile):
 *  STANDARD      3RD_MILE          serviceTypeId=2189326635  packagePriceId=2190315031
 *  RETURN        3RD_MILE_PICKUP   serviceTypeId=2352662191  packagePriceId=2352666310
 *  EXPRESS_SMSA  3RD_MILE_EXPRESS  serviceTypeId=2424675804  packagePriceId=2645366804
 *  EXPRESS_JT    3RD_MILE_EXPRESS_2 serviceTypeId=2437153112 packagePriceId=2645367767
 */

const SHIPOX_BASE_URL = process.env.SHIPOX_BASE_URL || "https://3rdmile.my.shipox.com";
const SHIPOX_USERNAME  = process.env.SHIPOX_USERNAME  || "";
const SHIPOX_PASSWORD  = process.env.SHIPOX_PASSWORD  || "";

export const SHIPOX_SERVICE_TYPES = {
  STANDARD: {
    id: 2189326635,
    packagePriceId: 2190315031,
    label: "شحنات الإرسال (3RD_MILE)",
    code: "3RD_MILE",
  },
  RETURN: {
    id: 2352662191,
    packagePriceId: 2352666310,
    label: "شحنات الإرجاع (3RD_MILE_PICKUP)",
    code: "3RD_MILE_PICKUP",
  },
  EXPRESS_SMSA: {
    id: 2424675804,
    packagePriceId: 2645366804,
    label: "خارج التغطية — سمسا (3RD_MILE_EXPRESS)",
    code: "3RD_MILE_EXPRESS",
  },
  EXPRESS_JT: {
    id: 2437153112,
    packagePriceId: 2645367767,
    label: "خارج التغطية — J&T (3RD_MILE_EXPRESS_2)",
    code: "3RD_MILE_EXPRESS_2",
  },
} as const;

export type ShipoxServiceType = keyof typeof SHIPOX_SERVICE_TYPES;

let tokenCache: { token: string; expiresAt: number } | null = null;

export function isShipoxConfigured(): boolean {
  return !!(SHIPOX_USERNAME && SHIPOX_PASSWORD);
}

async function getToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) return tokenCache.token;

  const res = await fetch(`${SHIPOX_BASE_URL}/api/v1/customer/authenticate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: SHIPOX_USERNAME, password: SHIPOX_PASSWORD }),
  });

  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!res.ok) {
    throw new Error(`[Shipox] Auth failed (${res.status}): ${data?.message || text}`);
  }

  const token = data?.data?.id_token || data?.token || data?.access_token || data?.jwt;
  if (!token) throw new Error("[Shipox] No token in auth response");

  tokenCache = { token, expiresAt: Date.now() + 55 * 60 * 1000 };
  return token;
}

export function invalidateShipoxToken() {
  tokenCache = null;
}

async function shipoxRequest(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: any,
): Promise<any> {
  const token = await getToken();
  const res = await fetch(`${SHIPOX_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!res.ok) {
    const msg = data?.message || data?.detail || data?.title || data?.data?.message || text || res.statusText;
    throw new Error(`[Shipox] HTTP ${res.status}: ${msg}`);
  }
  // Shipox wraps all responses in { data: {...}, request_id, status }
  return (data && typeof data === "object" && "data" in data && "status" in data)
    ? data.data
    : data;
}

export interface ShipoxOrderResult {
  orderId: string;
  orderNumber: string;
  trackingNumber: string;
  status: string;
}

export interface ShipoxSenderOptions {
  senderName?: string;
  senderPhone?: string;
  senderAddress?: string;
  senderCity?: string;
}

/**
 * Create a Shipox shipment for a given RF order.
 */
export async function createShipoxOrder(
  order: any,
  serviceType: ShipoxServiceType = "STANDARD",
  sender: ShipoxSenderOptions = {},
): Promise<ShipoxOrderResult> {
  if (!isShipoxConfigured()) {
    throw new Error("[Shipox] SHIPOX_USERNAME / SHIPOX_PASSWORD not set");
  }

  const svc = SHIPOX_SERVICE_TYPES[serviceType];
  const addr = order.shippingAddress || {};
  const city = addr.city || addr.cityName || "Riyadh";
  const street = [addr.street, addr.district, addr.building].filter(Boolean).join("، ")
    || order.deliveryAddress
    || "غير محدد";
  const fullName = (order.customerName || "عميل رفيف").trim();
  const phone    = (order.customerPhone || "0500000000").replace(/\D/g, "");
  const orderRef = String(order.id || order._id).slice(-8).toUpperCase();
  const piecesCount = (order.items || []).reduce((s: number, i: any) => s + (i.quantity || 1), 0) || 1;

  const payload: Record<string, any> = {
    service_type_id:   svc.id,
    packages_price_id: svc.packagePriceId,

    sender_name:    sender.senderName    || "رفيف العود",
    sender_phone:   sender.senderPhone   || "0500000000",
    sender_address: sender.senderAddress || "الرياض",
    sender_city_name: sender.senderCity  || "Riyadh",

    recipient_name:      fullName,
    recipient_phone:     phone,
    recipient_address:   street,
    recipient_city_name: city,

    description:     `طلب رفيف العود #${orderRef}`,
    pieces_count:    piecesCount,
    weight:          0.5,
    cod_amount:      0,
    notes:           order.notes || "",
    reference_number: orderRef,
  };

  const data = await shipoxRequest("POST", "/api/v2/customer/order", payload);

  const id      = String(data?.id || data?.order_id || data?.orderId || "");
  const number  = data?.order_number || data?.orderNumber || data?.tracking_number || id;
  const tracking = data?.tracking_number || data?.awb || number;

  return {
    orderId:        id,
    orderNumber:    number,
    trackingNumber: tracking,
    status:         data?.status || "created",
  };
}

/**
 * Get AWB airwaybill label URL (PDF) for one or more order numbers.
 */
export async function getShipoxAWBUrl(orderNumbers: string[]): Promise<string> {
  if (!isShipoxConfigured()) throw new Error("[Shipox] Not configured");
  const qs = orderNumbers.map(n => `order_numbers=${encodeURIComponent(n)}`).join("&");
  const data = await shipoxRequest("GET", `/api/v1/customer/orders/airwaybill_mini?${qs}`);
  return data?.url || data?.pdf_url || data?.awb_url || data?.label_url || "";
}

/**
 * Get public tracking history for a shipment (no auth required).
 */
export async function trackShipoxOrder(orderNumber: string): Promise<any[]> {
  try {
    const res = await fetch(
      `${SHIPOX_BASE_URL}/api/v1/public/order/${encodeURIComponent(orderNumber)}/history_items`,
    );
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : (data?.history_items || data?.items || []);
  } catch {
    return [];
  }
}

/**
 * Cancel a Shipox shipment by orderId.
 */
export async function cancelShipoxOrder(orderId: string): Promise<void> {
  if (!isShipoxConfigured()) throw new Error("[Shipox] Not configured");
  await shipoxRequest("PUT", `/api/v1/customer/order/${orderId}/status?status=cancelled`);
}

/**
 * Create a return / pickup shipment.
 */
export async function createShipoxReturn(
  order: any,
  sender: ShipoxSenderOptions = {},
): Promise<ShipoxOrderResult> {
  return createShipoxOrder(order, "RETURN", sender);
}

/**
 * Fetch authenticated customer account info (useful for health-check).
 */
export async function getShipoxAccount(): Promise<any> {
  return shipoxRequest("GET", "/api/v1/customer/account");
}
