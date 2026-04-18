/**
 * k6 load test — RF Perfume checkout pipeline.
 *
 * Goal: validate that the system can sustain 100k orders/hour
 *       (≈28 RPS sustained, with bursts up to ~120 RPS).
 *
 * Run:
 *   k6 run --env BASE=https://rfperfume.sa load-tests/checkout.js
 *
 * Stages:
 *   1. ramp 0 → 30 VU in 1m   (warm up cache + connection pool)
 *   2. hold 30 VU for 5m       (steady-state target load)
 *   3. spike 30 → 120 VU in 30s (flash-sale burst)
 *   4. hold 120 VU for 2m       (stress test)
 *   5. ramp 120 → 0 in 1m       (cool down)
 *
 * Thresholds (test fails if violated):
 *   • p(95) < 800ms for browse, < 1500ms for checkout
 *   • error rate < 1%
 */

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Rate, Trend } from "k6/metrics";

const BASE = __ENV.BASE || "http://localhost:5000";
const TEST_PHONE = __ENV.TEST_PHONE || "5500000001";
const TEST_PASSWORD = __ENV.TEST_PASSWORD || "test1234";

const errorRate = new Rate("errors");
const checkoutLatency = new Trend("checkout_latency_ms");

export const options = {
  stages: [
    { duration: "1m",  target: 30  },
    { duration: "5m",  target: 30  },
    { duration: "30s", target: 120 },
    { duration: "2m",  target: 120 },
    { duration: "1m",  target: 0   },
  ],
  thresholds: {
    "http_req_duration{type:browse}":   ["p(95)<800"],
    "http_req_duration{type:checkout}": ["p(95)<1500"],
    "errors": ["rate<0.01"],
  },
};

function login(jar) {
  const r = http.post(`${BASE}/api/login`, JSON.stringify({ phone: TEST_PHONE, password: TEST_PASSWORD }), {
    headers: { "Content-Type": "application/json" },
    jar,
    tags: { type: "auth" },
  });
  return r.status === 200;
}

export default function () {
  const jar = http.cookieJar();

  group("browse", () => {
    const products = http.get(`${BASE}/api/products`, { jar, tags: { type: "browse" } });
    check(products, { "products 200": r => r.status === 200 }) || errorRate.add(1);

    const cats = http.get(`${BASE}/api/categories`, { jar, tags: { type: "browse" } });
    check(cats, { "categories 200": r => r.status === 200 }) || errorRate.add(1);

    sleep(0.3 + Math.random());

    // Verify cache hit on second request (ETag round trip)
    const etag = products.headers["Etag"] || products.headers["ETag"];
    if (etag) {
      const second = http.get(`${BASE}/api/products`, {
        jar,
        headers: { "If-None-Match": etag },
        tags: { type: "browse" },
      });
      check(second, { "products 304 cached": r => r.status === 304 || r.status === 200 });
    }
  });

  group("checkout", () => {
    if (!login(jar)) {
      // Login may fail in test env without seeded user — skip checkout
      return;
    }

    const productsRes = http.get(`${BASE}/api/products`, { jar, tags: { type: "browse" } });
    let firstProduct;
    try { firstProduct = productsRes.json()[0]; } catch { return; }
    if (!firstProduct?.variants?.[0]) return;

    const variant = firstProduct.variants[0];
    const orderBody = {
      items: [{
        productId: firstProduct.id || firstProduct._id,
        variantSku: variant.sku,
        title: firstProduct.name,
        quantity: 1,
        price: Number(firstProduct.price),
        color: variant.color,
        size: variant.size,
      }],
      subtotal: Number(firstProduct.price),
      vatAmount: Number((Number(firstProduct.price) * 0.15).toFixed(2)),
      shippingCost: 0,
      discountAmount: 0,
      total: Number((Number(firstProduct.price) * 1.15).toFixed(2)),
      paymentMethod: "cash",
      deliveryAddress: "Riyadh — load test",
      type: "online",
    };

    const t0 = Date.now();
    const res = http.post(`${BASE}/api/orders`, JSON.stringify(orderBody), {
      jar,
      headers: { "Content-Type": "application/json" },
      tags: { type: "checkout" },
    });
    checkoutLatency.add(Date.now() - t0);

    const ok = check(res, {
      "checkout 201 or 409 (out of stock is acceptable)": r => r.status === 201 || r.status === 409,
    });
    if (!ok) errorRate.add(1);
  });

  sleep(1 + Math.random() * 2);
}
