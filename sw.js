/* ============================================================
   SUC HEMS AH-40 · Service Worker
   v3.0 — Rutas relativas (compatible con GitHub Pages).
   Sin dependencias externas: todo lo necesario se cachea aquí.
   Para forzar una actualización en todos los dispositivos,
   sube los cambios y aumenta el número de versión de abajo.
   ============================================================ */
const CACHE_VERSION = "suc-hems-v34";

const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./logo-suc.png",
  "./logo-hems.png",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-192-maskable.png",
  "./icon-512-maskable.png",
  "./apple-touch-icon.png"
];

/* INSTALL: precachea todos los recursos de la app */
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

/* ACTIVATE: elimina versiones de caché antiguas */
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* FETCH:
   - Navegación (HTML): red primero, caché si no hay conexión.
     Así las actualizaciones llegan en cuanto hay red, pero la
     app abre siempre, incluso sin cobertura.
   - Resto (imágenes, manifest): caché primero, red de respaldo. */
self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // no hay recursos externos

  if (req.mode === "navigate" || url.pathname.endsWith("index.html")) {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then(hit => hit || caches.match("./index.html"))
        )
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(hit =>
      hit ||
      fetch(req).then(res => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put(req, copy));
        }
        return res;
      })
    )
  );
});

/* Mensajes desde la página (actualización manual) */
self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});
