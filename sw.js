/**
 * HIROTO AI — Service Worker for PWA
 * Network-First strategy ensures laptops and phones always load latest updates
 */

const CACHE_NAME = "hiroto-pwa-v6";
const ASSETS_TO_CACHE = [
  "/",
  "/d.html",
  "/index.html",
  "/style.css",
  "/terminal.js",
  "/engine.js",
  "/supabaseClient.js",
  "/logo.jpg",
  "/bg.jpg",
  "/manifest.json"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  // Always bypass cache for real-time external APIs
  if (event.request.url.includes("ar-lottery01.com") ||
      event.request.url.includes("tirangaprediction.ai") || 
      event.request.url.includes("supabase.co") ||
      event.request.url.includes("workers.dev") ||
      event.request.url.includes("allorigins") ||
      event.request.url.includes("corsproxy")) {
    return;
  }

  // Network-First: Always fetch freshest files from network, fallback to cache offline
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && event.request.method === "GET") {
          const resClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, resClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          return cached || caches.match("/d.html");
        });
      })
  );
});
