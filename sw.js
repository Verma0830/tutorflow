const CACHE_NAME = 'tutorflow-cache-v14';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css',
  'https://cdn.jsdelivr.net/npm/flatpickr',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@400;500;600;700;800&family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap'
];

// Files that should ALWAYS be fetched fresh from the network (never cached)
const NEVER_CACHE = ['app.js', 'app.css', 'students.json'];

// Install Event - cache only static assets (not app code)
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - clean old caches and take control immediately
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - app code always from network, static assets cache-first
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  
  // For app code files: ALWAYS go to network (never serve stale code)
  const isAppCode = NEVER_CACHE.some(file => url.pathname.endsWith(file));
  if (isAppCode) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }
  
  // For API calls (Google Apps Script): always network
  if (url.hostname.includes('script.google.com') || url.hostname.includes('googleapis.com')) {
    e.respondWith(fetch(e.request));
    return;
  }
  
  // For static assets (icons, fonts, libraries): cache-first for speed
  e.respondWith(
    caches.match(e.request).then((cached) => {
      return cached || fetch(e.request).then((response) => {
        // Cache new static assets for offline use
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        return response;
      });
    })
  );
});
