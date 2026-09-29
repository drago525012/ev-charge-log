/* Service worker: offline app shell + Android share target. */
const VERSION = 'v1.4.0';
const SHELL = [
  './', 'index.html', 'styles.css', 'app.js', 'parse.js', 'manifest.webmanifest',
  'icons/app-192.png', 'icons/app-512.png',
  'icons/apps/pea.png', 'icons/apps/spark.png', 'icons/apps/hoven.png', 'icons/apps/igreen.png',
  'icons/apps/pluz.png', 'icons/apps/onecharge.png', 'icons/apps/evolt.png', 'icons/apps/elexa.png',
  'icons/apps/mea.png', 'icons/apps/altervim.png', 'icons/apps/rever.png',
  'vendor/leaflet/leaflet.js', 'vendor/leaflet/leaflet.css',
];
const SHELL_CACHE = 'shell-' + VERSION;
const SHARE_CACHE = 'share-inbox';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('shell-') && k !== SHELL_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Android "Share to" -> stash the image, then open the add form.
  if (e.request.method === 'POST' && url.pathname.endsWith('/share-target')) {
    e.respondWith((async () => {
      try {
        const form = await e.request.formData();
        const file = form.get('image');
        if (file) {
          const cache = await caches.open(SHARE_CACHE);
          await cache.put('shared-image', new Response(file, { headers: { 'Content-Type': file.type || 'image/jpeg' } }));
        }
      } catch (err) {
        console.error('share-target failed', err);
      }
      return Response.redirect('./?shared=1#/add', 303);
    })());
    return;
  }

  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Network-first for the shell so updates show up, cache as fallback when offline.
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html')))
  );
});
