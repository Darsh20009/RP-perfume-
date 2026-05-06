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

// ─── Saudi city → WooCommerce state code ─────────────────────────────────────
const CITY_TO_STATE: Record<string, string> = {
  // Riyadh
  "الرياض": "SA-01", "الخرج": "SA-01", "الزلفي": "SA-01", "المجمعة": "SA-01",
  "عفيف": "SA-01", "الدوادمي": "SA-01", "الدرعية": "SA-01", "الحريق": "SA-01",
  "وادي الدواسر": "SA-01", "السليل": "SA-01", "ضرما": "SA-01",
  // Makkah
  "جدة": "SA-02", "مكة المكرمة": "SA-02", "الطائف": "SA-02", "القنفذة": "SA-02",
  "رابغ": "SA-02", "الجموم": "SA-02", "خليص": "SA-02", "الليث": "SA-02",
  // Madinah
  "المدينة المنورة": "SA-03", "ينبع": "SA-03", "العلا": "SA-03", "المهد": "SA-03",
  "بدر": "SA-03", "خيبر": "SA-03",
  // Eastern Province
  "الدمام": "SA-04", "الخبر": "SA-04", "الجبيل": "SA-04", "القطيف": "SA-04",
  "الأحساء": "SA-04", "الإحساء": "SA-04", "حفر الباطن": "SA-04", "رأس تنورة": "SA-04",
  "بقيق": "SA-04", "الخفجي": "SA-04", "عين دار": "SA-04",
  // Qassim
  "بريدة": "SA-05", "عنيزة": "SA-05", "الرس": "SA-05", "المذنب": "SA-05",
  "البكيرية": "SA-05", "الأسياح": "SA-05",
  // Hail
  "حائل": "SA-06", "بقعاء": "SA-06",
  // Tabuk
  "تبوك": "SA-07", "ضباء": "SA-07", "الوجه": "SA-07",
  // Northern Borders
  "عرعر": "SA-08", "رفحاء": "SA-08", "طريف": "SA-08",
  // Jizan
  "جيزان": "SA-09", "صبيا": "SA-09", "أبو عريش": "SA-09", "صامطة": "SA-09",
  // Najran
  "نجران": "SA-10", "شرورة": "SA-10",
  // Al Bahah
  "الباحة": "SA-11", "بلجرشي": "SA-11", "المخواة": "SA-11",
  // Al Jawf
  "سكاكا": "SA-12", "دومة الجندل": "SA-12", "القريات": "SA-12",
  // Asir
  "أبها": "SA-14", "خميس مشيط": "SA-14", "بيشة": "SA-14", "النماص": "SA-14",
  "محايل عسير": "SA-14", "أحد رفيدة": "SA-14",
};

// ─── Shipping zones cache (10 min TTL) ───────────────────────────────────────
interface ZoneCache {
  zones: Array<{ id: number; name: string; locations: string[]; methods: Array<{ title: string; cost: number; enabled: boolean }> }>;
  expires: number;
}
let zoneCache: ZoneCache | null = null;

async function fetchZoneData(): Promise<ZoneCache["zones"]> {
  if (zoneCache && Date.now() < zoneCache.expires) return zoneCache.zones;

  const rawZones: any[] = await ssRequest("GET", "/shipping/zones");
  const zones: ZoneCache["zones"] = [];

  await Promise.all(
    rawZones.map(async (zone: any) => {
      if (zone.id === 0) return; // skip "Locations not covered"
      try {
        const [locs, methods]: [any[], any[]] = await Promise.all([
          ssRequest("GET", `/shipping/zones/${zone.id}/locations`),
          ssRequest("GET", `/shipping/zones/${zone.id}/methods`),
        ]);

        const locationCodes = (locs || []).map((l: any) => l.code as string).filter(Boolean);
        const parsedMethods = (methods || [])
          .filter((m: any) => m.enabled !== false)
          .map((m: any) => ({
            title: m.method_title || m.title || "توصيل",
            cost: parseFloat(m.settings?.cost?.value || m.settings?.min_amount?.value || "0") || 0,
            enabled: true,
          }));

        zones.push({ id: zone.id, name: zone.name || "", locations: locationCodes, methods: parsedMethods });
      } catch { /* skip zones that fail */ }
    }),
  );

  zoneCache = { zones, expires: Date.now() + 10 * 60 * 1000 };
  return zones;
}

export interface ShippingRateResult {
  cost: number;
  zoneName: string;
  methodTitle: string;
  isFree: boolean;
}

/**
 * Fetch the shipping rate for a given Saudi city from Storage Station's
 * WooCommerce Shipping Zones API.  Falls back to a flat rate of 30 SAR if
 * no matching zone is found.
 */
export async function getShippingRateForCity(
  city: string,
  orderTotal = 0,
  freeShippingThreshold = 0,
): Promise<ShippingRateResult> {
  // Free shipping threshold
  if (freeShippingThreshold > 0 && orderTotal >= freeShippingThreshold) {
    return { cost: 0, zoneName: "شحن مجاني", methodTitle: "شحن مجاني", isFree: true };
  }

  if (!isStorageStationConfigured()) {
    return { cost: 30, zoneName: "افتراضي", methodTitle: "توصيل", isFree: false };
  }

  try {
    const zones = await fetchZoneData();
    const stateCode = CITY_TO_STATE[city.trim()] || "";

    // Find zone whose locations include this state code or a SA wildcard
    let matched = zones.find((z) =>
      z.locations.some((loc) =>
        loc === stateCode ||
        loc === "SA" ||
        loc.startsWith(`${stateCode}:`) ||
        (stateCode && loc === `SA:${stateCode.replace("SA-", "")}`)
      ),
    );

    // Fallback: zone named "Saudi Arabia" or contains city name
    if (!matched) {
      matched = zones.find((z) =>
        /saudi|ksa|المملكة|السعودية/i.test(z.name) ||
        z.name.includes(city)
      );
    }

    if (matched && matched.methods.length > 0) {
      const method = matched.methods[0];
      return {
        cost: method.cost,
        zoneName: matched.name,
        methodTitle: method.title,
        isFree: method.cost === 0,
      };
    }
  } catch (err) {
    console.error("[StorageStation] getShippingRateForCity error:", err);
  }

  // Default fallback
  return { cost: 30, zoneName: "سعر افتراضي", methodTitle: "توصيل", isFree: false };
}

/** Invalidate the zones cache (call after admin updates shipping settings) */
export function invalidateShippingZonesCache() {
  zoneCache = null;
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
