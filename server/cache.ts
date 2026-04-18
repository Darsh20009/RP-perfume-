/**
 * Lightweight in-memory cache for hot read endpoints.
 *
 *  • TTL-based (per key)
 *  • Tag-based invalidation (e.g. invalidate "products" tag when admin creates/edits)
 *  • LRU-ish: hard cap on entries, evicts oldest on overflow
 *  • Hit/miss counters exposed for the admin Performance page
 *  • Globally enabled/disabled at runtime (admin toggle)
 *
 * NOTE: single-process only. For multi-instance deployments, replace with Redis.
 */

import type { Request, Response, NextFunction } from "express";

type Entry = {
  body: any;
  expires: number;
  tags: string[];
};

const STORE = new Map<string, Entry>();
const MAX_ENTRIES = 5000;

const stats = {
  hits: 0,
  misses: 0,
  sets: 0,
  invalidations: 0,
  startedAt: Date.now(),
};

let enabled = true;
let defaultTtlMs = 60_000; // 60s default

export function setCacheEnabled(v: boolean) { enabled = !!v; }
export function isCacheEnabled() { return enabled; }
export function setDefaultTtlMs(ms: number) {
  if (Number.isFinite(ms) && ms > 0) defaultTtlMs = Math.min(ms, 24 * 60 * 60 * 1000);
}
export function getDefaultTtlMs() { return defaultTtlMs; }

export function getStats() {
  const total = stats.hits + stats.misses;
  return {
    ...stats,
    enabled,
    defaultTtlMs,
    size: STORE.size,
    hitRate: total ? +(stats.hits / total * 100).toFixed(2) : 0,
    uptimeSec: Math.floor((Date.now() - stats.startedAt) / 1000),
  };
}

export function resetStats() {
  stats.hits = 0; stats.misses = 0; stats.sets = 0; stats.invalidations = 0;
  stats.startedAt = Date.now();
}

export function cacheGet<T = any>(key: string): T | null {
  if (!enabled) return null;
  const e = STORE.get(key);
  if (!e) { stats.misses++; return null; }
  if (e.expires < Date.now()) {
    STORE.delete(key);
    stats.misses++;
    return null;
  }
  stats.hits++;
  return e.body as T;
}

export function cacheSet(key: string, body: any, ttlMs?: number, tags: string[] = []) {
  if (!enabled) return;
  if (STORE.size >= MAX_ENTRIES) {
    // evict oldest 10%
    const cull = Math.ceil(MAX_ENTRIES * 0.1);
    let n = 0;
    for (const k of STORE.keys()) { STORE.delete(k); if (++n >= cull) break; }
  }
  STORE.set(key, {
    body,
    expires: Date.now() + (ttlMs ?? defaultTtlMs),
    tags,
  });
  stats.sets++;
}

/** Invalidate every cached entry that has any of the given tags */
export function invalidateTags(...tags: string[]) {
  if (!tags.length) return 0;
  const tagSet = new Set(tags);
  let removed = 0;
  for (const [k, v] of STORE.entries()) {
    if (v.tags.some(t => tagSet.has(t))) {
      STORE.delete(k);
      removed++;
    }
  }
  if (removed) stats.invalidations += removed;
  return removed;
}

export function cacheClear() {
  const n = STORE.size;
  STORE.clear();
  stats.invalidations += n;
  return n;
}

/**
 * Express middleware factory — caches the JSON response of GET requests.
 *   app.get("/api/products", cacheMiddleware({ ttlMs: 30_000, tags: ["products"] }), handler);
 */
export function cacheMiddleware(opts: { ttlMs?: number; tags?: string[]; keyFn?: (req: Request) => string } = {}) {
  const tags = opts.tags || [];
  return function (req: Request, res: Response, next: NextFunction) {
    if (req.method !== "GET" || !enabled) return next();
    const key = opts.keyFn ? opts.keyFn(req) : `${req.originalUrl}`;
    const hit = cacheGet(key);
    if (hit !== null) {
      res.setHeader("X-Cache", "HIT");
      return res.json(hit);
    }
    res.setHeader("X-Cache", "MISS");
    // Hijack res.json to capture body before sending
    const origJson = res.json.bind(res);
    res.json = ((body: any) => {
      // only cache success responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cacheSet(key, body, opts.ttlMs, tags);
      }
      return origJson(body);
    }) as any;
    next();
  };
}
