// Future of Student – by Hussain | Service Worker v3.0
// Full offline support + enhanced caching

const CACHE_NAME = 'future-student-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/app.html',
  '/view.html',
  '/templates.html',
  '/manifest.json',
  '/offline.html',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-72.png',
  '/icons/icon-96.png',
  '/icons/icon-128.png'
];

const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

// ===== INSTALL =====
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('[SW] Caching static assets');
      // Cache assets one by one to avoid one failure killing all
      for (const asset of STATIC_ASSETS) {
        try { await cache.add(asset); } catch(e) { console.warn('[SW] Could not cache:', asset); }
      }
    }).then(() => self.skipWaiting())
  );
});

// ===== ACTIVATE =====
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// ===== FETCH =====
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;
  if (url.protocol === 'chrome:') return;

  // Firebase / external APIs — network only, no cache
  if (url.hostname.includes('firebase') || url.hostname.includes('googleapis.com') && !FONT_HOSTS.includes(url.hostname)) {
    return;
  }

  // Fonts: Cache first, then network
  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        }).catch(() => new Response('', { status: 503 }));
      })
    );
    return;
  }

  // HTML pages: Network first, fallback to cache, then offline page
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(request)
            .then((cached) => cached || caches.match('/offline.html'))
        )
    );
    return;
  }

  // All other assets: Cache first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      }).catch(() => {
        if (request.destination === 'image') {
          return new Response(
            '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="#1a1a2e" width="200" height="200"/><text fill="#e94560" font-size="32" x="50%" y="50%" text-anchor="middle" dy=".35em">📴</text></svg>',
            { headers: { 'Content-Type': 'image/svg+xml' } }
          );
        }
        return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
      });
    })
  );
});

console.log('[SW] Future of Student – by Hussain | Service Worker v3.0 loaded');
