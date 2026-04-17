const CACHE_NAME = 'rf-perfume-v1';
const STATIC_ASSETS_CACHE = 'rf-perfume-static-v1';

// Only cache static assets with hashed filenames
const STATIC_EXTENSIONS = ['.js', '.css', '.woff2', '.woff', '.ttf', '.png', '.jpg', '.jpeg', '.svg', '.ico', '.webp'];

function isStaticAsset(url) {
  const urlObj = new URL(url);
  return STATIC_EXTENSIONS.some(ext => urlObj.pathname.endsWith(ext)) && 
         (urlObj.pathname.includes('/assets/') || urlObj.pathname.includes('/icons/') || urlObj.pathname.includes('/uploads/'));
}

function isApiRequest(url) {
  return new URL(url).pathname.startsWith('/api/');
}

function isNavigationRequest(request) {
  return request.mode === 'navigate' || 
         (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'));
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Clear ALL old caches on activation
      caches.keys().then((cacheNames) =>
        Promise.all(
          cacheNames.map((name) => {
            if (name !== CACHE_NAME && name !== STATIC_ASSETS_CACHE) {
              return caches.delete(name);
            }
          })
        )
      ),
    ])
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // Ignore non-GET requests
  if (request.method !== 'GET') return;
  
  // Ignore API requests - always go to network
  if (isApiRequest(request.url)) return;
  
  // For navigation (HTML page) requests: Network-first strategy
  // This ensures fresh HTML is always loaded, preventing stale chunk reference issues
  if (isNavigationRequest(request)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Don't cache HTML responses - always fetch fresh
          return response;
        })
        .catch(() => {
          // Only fall back to cache if offline
          return caches.match('/') || caches.match('/index.html');
        })
    );
    return;
  }
  
  // For static assets with hashed filenames: Cache-first strategy
  if (isStaticAsset(request.url)) {
    event.respondWith(
      caches.open(STATIC_ASSETS_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          });
        })
      )
    );
    return;
  }
  
  // For everything else: Network-first
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

// ─── Web Push ─────────────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch { data = { title: 'رفيف العود', body: event.data.text() }; }

  const title = data.title || 'رفيف العود';
  const options = {
    body: data.body || '',
    icon: data.icon || '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    tag: data.tag || 'rf-perfume-notif',
    renotify: true,
    data: data.data || {},
    vibrate: [200, 100, 200],
    actions: [
      { action: 'open', title: 'فتح' },
      { action: 'close', title: 'إغلاق' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'close') return;

  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.postMessage({ type: 'navigate', url });
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
