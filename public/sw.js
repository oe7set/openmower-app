// Minimal service worker. Exists solely to satisfy Chromium's PWA install
// heuristic (which requires a fetch handler) — this app is online-only and
// has no offline use case, so we simply pass requests through to the network.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
