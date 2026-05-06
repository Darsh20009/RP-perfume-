const CACHE_VERSION = 'v7';
const STATIC_CACHE  = `rf-perfume-static-${CACHE_VERSION}`;
const API_CACHE     = `rf-perfume-api-${CACHE_VERSION}`;
const IMAGE_CACHE   = `rf-perfume-images-${CACHE_VERSION}`;

// Static file extensions to cache
const STATIC_EXTENSIONS = ['.js', '.css', '.woff2', '.woff', '.ttf', '.ico', '.webp', '.svg'];

// API endpoints cached with stale-while-revalidate (serve instantly, refresh in background)
const CACHED_API_PATHS = [
  '/api/products',
  '/api/marketing/active',
  '/api/store/settings',
  '/api/pages',
  '/api/categories',
  '/api/reviews/featured',
];

function isStaticAsset(url) {
  const p = new URL(url).pathname;
  return STATIC_EXTENSIONS.some(ext => p.endsWith(ext)) &&
         (p.includes('/assets/') || p.includes('/icons/'));
}

function isUploadImage(url) {
  const p = new URL(url).pathname;
  return p.startsWith('/uploads/') || p.startsWith('/images/') ||
         p.startsWith('/banners/') || p.startsWith('/logos/');
}

function isCachedApi(url) {
  const p = new URL(url).pathname;
  return CACHED_API_PATHS.some(api => p === api || p.startsWith(api + '?'));
}

function isNavigationRequest(req) {
  return req.mode === 'navigate' ||
         (req.method === 'GET' && req.headers.get('accept')?.includes('text/html'));
}

// ── Install: skip waiting immediately ──────────────────────────────────────────
self.addEventListener('install', () => self.skipWaiting());

// ── Activate: clean old caches ─────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== STATIC_CACHE && k !== API_CACHE && k !== IMAGE_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: route by type ───────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = request.url;

  // 1. Navigation → network-first (always fresh HTML)
  if (isNavigationRequest(request)) {
    event.respondWith(
      fetch(request).catch(() => caches.match('/') || caches.match('/index.html'))
    );
    return;
  }

  // 2. Upload images & public image folders → cache-first, 1-year TTL
  if (isUploadImage(url)) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then(cache =>
        cache.match(request).then(cached => {
          if (cached) return cached;
          return fetch(request).then(res => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          }).catch(() => cached);
        })
      )
    );
    return;
  }

  // 3. Key API endpoints → stale-while-revalidate
  //    Serve from cache instantly, update cache in background
  if (isCachedApi(url)) {
    event.respondWith(
      caches.open(API_CACHE).then(cache =>
        cache.match(request).then(cached => {
          const networkFetch = fetch(request).then(res => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          }).catch(() => cached);

          // Return cached immediately if available, otherwise wait for network
          return cached || networkFetch;
        })
      )
    );
    return;
  }

  // 4. Hashed static assets (JS/CSS/fonts) → cache-first
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(cache =>
        cache.match(request).then(cached => {
          if (cached) return cached;
          return fetch(request).then(res => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          });
        })
      )
    );
    return;
  }

  // 5. Everything else → network with cache fallback
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

// ── Web Push ───────────────────────────────────────────────────────────────────
self.addEventListener('push', event => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch { data = { title: 'رفيف العود', body: event.data.text() }; }

  const title = data.title || 'رفيف العود';
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || '',
    icon: data.icon || '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    tag: data.tag || 'rf-perfume-notif',
    renotify: true,
    data: data.data || {},
    vibrate: [200, 100, 200],
    actions: [{ action: 'open', title: 'فتح' }, { action: 'close', title: 'إغلاق' }],
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'close') return;
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if ('focus' in c) { c.postMessage({ type: 'navigate', url }); return c.focus(); }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
