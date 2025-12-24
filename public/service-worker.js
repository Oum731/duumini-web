/* ===========================
   Duumini PWA + Pushy SW
   =========================== */

/* 1) Pushy (notifications en arrière-plan) */
try {
  importScripts("https://sdk.pushy.me/web/1.0.24/pushy-service-worker.js");
  console.log("[SW] Pushy service worker chargé");
} catch (err) {
  console.error("[SW] Impossible de charger le service worker Pushy :", err);
}

/* 2) App Shell + Offline Cache */
const SW_VERSION = "duumini-sw-v1.8";
const CORE_ASSETS = [
  "/", // SPA entry (Vite sert index.html au /)
  "/index.html",
  "/manifest.webmanifest",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
];

/* Install: pré-cache des ressources de base */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SW_VERSION)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

/* Activate: cleanup anciens caches */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== SW_VERSION)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

/* Fetch: stratégies simples et robustes */
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // ❌ Ne JAMAIS intercepter le flux SSE
  if (url.pathname.startsWith("/api/events/stream")) {
    return; // on laisse le navigateur gérer
  }

  // Navigations → Network-First (fallback /index.html)
  if (req.mode === "navigate") {
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(SW_VERSION).then((cache) => cache.put("/index.html", copy));
        return res;
      })
      .catch(async () => {
        const cached = await caches.match("/index.html");
        return (
          cached ||
          new Response("<h1>Offline</h1>", {
            status: 503,
            headers: { "Content-Type": "text/html; charset=utf-8" },
          })
        );
      })
  );
  return;
}


  // Assets (js/css/img/font) → Cache-First
  const dest = req.destination;
  if (["style", "script", "image", "font"].includes(dest)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req)
          .then((res) => {
            const copy = res.clone();
            caches.open(SW_VERSION).then((cache) => cache.put(req, copy));
            return res;
          })
          .catch(() => {
            // fallback minimal si vraiment rien
            return new Response("", { status: 503 });
          });
      })
    );
    return;
  }

  // Par défaut → Network, fallback cache si offline (sans planter)
  event.respondWith(
    fetch(req).catch(async () => {
      const cached = await caches.match(req);
      return (
        cached ||
        new Response("", {
          status: 503,
          statusText: "Service Unavailable",
        })
      );
    })
  );
});

/* (Optionnel) Mécanisme d’update : page -> SW */
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
