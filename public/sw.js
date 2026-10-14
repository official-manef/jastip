// Titipin service worker — offline app shell + runtime caching + update flow.
//
// Versi naik tiap rilis asset berubah. SW baru TIDAK langsung mengambil alih;
// ia menunggu pesan SKIP_WAITING dari halaman, supaya app bisa menampilkan toast
// "versi baru" dan membiarkan pengguna memuat ulang saat siap (bukan paksa).
const VERSION = "titipin-v2";
const SHELL = `shell-${VERSION}`;
const ASSETS = `assets-${VERSION}`;
const SHELL_URLS = ["/", "/manifest.webmanifest", "/favicon.svg", "/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(SHELL_URLS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== SHELL && k !== ASSETS).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

// Halaman meminta SW yang menunggu untuk segera aktif setelah pengguna menekan
// "Muat ulang". Halaman lalu mendengar `controllerchange` dan me-reload.
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // always live

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL).then((cache) => cache.put("/", copy));
          return response;
        })
        .catch(() => caches.match("/").then((hit) => hit || caches.match(request))),
    );
    return;
  }

  event.respondWith(
    caches.open(ASSETS).then(async (cache) => {
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
