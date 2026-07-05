const CACHE_VERSION = 'suc-hems-v18';
const CACHE_NAME = `${CACHE_VERSION}`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const CDN_CACHE = `${CACHE_VERSION}-cdn`;

// Archivos críticos a cachear en instalación
const CRITICAL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// CDNs a cachear dinámicamente
const CDN_URLS = [
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/lucide@latest',
  'https://fonts.googleapis.com'
];

// ============================================================================
// EVENTO: INSTALL - Cachea archivos críticos
// ============================================================================
self.addEventListener('install', event => {
  console.log('[SW] Instalando Service Worker...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Cacheando archivos críticos');
        return cache.addAll(CRITICAL_ASSETS);
      })
      .then(() => {
        console.log('[SW] Salteando workers anteriores');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('[SW] Error durante instalación:', error);
      })
  );
});

// ============================================================================
// EVENTO: ACTIVATE - Limpia cachés antiguos
// ============================================================================
self.addEventListener('activate', event => {
  console.log('[SW] Activando Service Worker...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(cacheName => !cacheName.startsWith(CACHE_VERSION))
            .map(cacheName => {
              console.log('[SW] Eliminando caché antigua:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('[SW] Reclamando clientes...');
        return self.clients.claim();
      })
  );
});

// ============================================================================
// EVENTO: FETCH - Estrategia offline-first con fallbacks
// ============================================================================
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar navegaciones a otros orígenes
  if (url.origin !== location.origin) {
    return;
  }

  // Rutas estáticas: Network first, fallback a caché
  if (request.method === 'GET') {
    // CDN y recursos externos: Cache first
    if (isCDNRequest(request.url)) {
      event.respondWith(cacheFirstStrategy(request, CDN_CACHE));
      return;
    }

    // HTML, CSS, JS: Network first, fallback a caché
    event.respondWith(networkFirstStrategy(request, RUNTIME_CACHE));
    return;
  }

  // POST y otros métodos: Solo network
  event.respondWith(fetch(request));
});

// ============================================================================
// ESTRATEGIAS DE CACHING
// ============================================================================

/**
 * Network First: Intenta red primero, fallback a caché
 * Ideal para: HTML, datos dinámicos
 */
function networkFirstStrategy(request, cacheName) {
  return fetch(request)
    .then(response => {
      // Cachea respuestas exitosas
      if (!response || response.status !== 200 || response.type !== 'basic') {
        return response;
      }

      const responseToCache = response.clone();
      caches.open(cacheName)
        .then(cache => {
          cache.put(request, responseToCache);
        })
        .catch(error => {
          console.log('[SW] Error cacheando en network-first:', error);
        });

      return response;
    })
    .catch(() => {
      // Fallback a caché si falla la red
      return caches.match(request)
        .then(cachedResponse => {
          if (cachedResponse) {
            console.log('[SW] Sirviendo desde caché:', request.url);
            return cachedResponse;
          }
          // Fallback final: página offline (si existe)
          if (request.destination === 'document') {
            return caches.match('/index.html');
          }
          return new Response('Sin conexión. Reintenta cuando tengas disponibilidad.', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
              'Content-Type': 'text/plain; charset=utf-8'
            })
          });
        });
    });
}

/**
 * Cache First: Intenta caché primero, fallback a red
 * Ideal para: Recursos estáticos, CDNs
 */
function cacheFirstStrategy(request, cacheName) {
  return caches.match(request)
    .then(cachedResponse => {
      if (cachedResponse) {
        console.log('[SW] Sirviendo desde caché (cache-first):', request.url);
        return cachedResponse;
      }

      return fetch(request)
        .then(response => {
          // No cachea respuestas inválidas
          if (!response || response.status !== 200) {
            return response;
          }

          const responseToCache = response.clone();
          caches.open(cacheName)
            .then(cache => {
              cache.put(request, responseToCache);
            })
            .catch(error => {
              console.log('[SW] Error cacheando en cache-first:', error);
            });

          return response;
        })
        .catch(() => {
          console.log('[SW] Sin red y sin caché para:', request.url);
          return new Response('Recurso no disponible.', {
            status: 503,
            statusText: 'Service Unavailable'
          });
        });
    });
}

// ============================================================================
// UTILIDADES
// ============================================================================

/**
 * Detecta si una solicitud es a un CDN
 */
function isCDNRequest(url) {
  return CDN_URLS.some(cdnUrl => url.includes(cdnUrl)) ||
         url.includes('unpkg.com') ||
         url.includes('cdn.tailwindcss.com') ||
         url.includes('fonts.googleapis.com') ||
         url.includes('fonts.gstatic.com');
}

// ============================================================================
// NOTIFICACIONES AL CLIENTE
// ============================================================================

/**
 * Mensajes de debug (opcional)
 */
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_VERSION });
  }
});

console.log('[SW] Service Worker cargado - Versión:', CACHE_VERSION);
