/* ===========================
   Duumini PWA + Pushy SW
   =========================== */

/* 1) Pushy (notifications en arrière-plan) */
importScripts('https://sdk.pushy.me/web/pushy-service-worker.js');

/* 2) App Shell + Offline Cache */
const SW_VERSION = 'duumini-sw-v1';
const CORE_ASSETS = [
  '/',                        // SPA entry (Vite sert index.html au /)
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

/* Install: pré-cache des ressources de base */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SW_VERSION)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

/* Activate: cleanup anciens caches */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys
        .filter((k) => k !== SW_VERSION)
        .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/* Fetch: stratégies simples et robustes */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Navigations → Network-First (fallback /index.html)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SW_VERSION).then((cache) => cache.put('/', copy));
          return res;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Assets (js/css/img/font) → Cache-First
  const dest = req.destination;
  if (['style', 'script', 'image', 'font'].includes(dest)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(SW_VERSION).then((cache) => cache.put(req, copy));
          return res;
        });
      })
    );
    return;
  }

  // Par défaut → Network, fallback cache si offline
  event.respondWith(fetch(req).catch(() => caches.match(req)));
});

/* (Optionnel) Mécanisme d’update : page -> SW */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
