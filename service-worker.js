const CACHE_NAME = "juju-racer-v1";

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./src/styles.css",
  "./src/game.js",
  "./assets/audio/coin.mp3",
  "./assets/audio/jump.mp3",
  "./assets/audio/lose.wav",
  "./assets/audio/theme.mp3",
  "./assets/audio/turbo.mp3",
  "./assets/generated/juju-app-icon.png",
  "./assets/generated/juju-avatar-v4.png",
  "./assets/generated/juju-install-cover.png",
  "./assets/generated/juju-cover-v4.png",
  "./assets/generated/juju-coin-v4-chroma.png",
  "./assets/generated/juju-moto-sprites-v2-chroma.png",
  "./assets/generated/juju-obstacles-v3-chroma.png",
  "./assets/generated/juju-straight-bg-v3.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) =>
      cached || fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
    )
  );
});
