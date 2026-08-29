/**
 * HIROTO AI — Service Worker for PWA
 * Provides instant launch, offline resilience, and asset caching
 */

const CACHE_NAME = "hiroto-pwa-v2";
const ASSETS_TO_CACHE = [
  "./",
  "./d.html",
  "./index.html",
  "./style.css",
  "./app.js",
  "./engine.js",
  "./supabaseClient.js",
  "./logo.jpg",
  "./bg.jpg",
  "./manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
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
  // Pass network-first for external API calls
  if (event.request.url.includes("tirangaprediction.ai") || 
      event.request.url.includes("supabase.co") ||
      event.request.url.includes("allorigins") ||
      event.request.url.includes("corsproxy")) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request).then((response) => {
        return caches.open(CACHE_NAME).then((cache) => {
          if (event.request.method === "GET") {
            cache.put(event.request, response.clone());
          }
          return response;
        });
      });
    }).catch(() => caches.match("./d.html"))
  );
});
