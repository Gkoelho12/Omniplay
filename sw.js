/* OmniPlay · service worker: guarda a app para funcionar 100% offline */
const CACHE = 'omniplay-v8';
const SHELL = [
  './',
  'index.html',
  'mexicana.html',
  'amigos.html',
  'style.css',
  'manifest.webmanifest',
  'assets/icon.svg',
  'js/config.js',
  'js/util.js',
  'js/backend.js',
  'js/session.js',
  'js/views.js',
  'js/play.js',
  'js/app.js',
  'js/mexicana_page.js',
  'js/amigos_page.js',
  'js/vendor/supabase.js',
  'js/games/connect4.js',
  'js/games/reflex.js',
  'js/games/mexicana.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => {
      return Promise.allSettled(
        SHELL.map((url) => c.add(url).catch((err) => console.warn('SW cache skip:', url, err)))
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) =>
      Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('supabase.co')) return; // dados/realtime: nunca em cache

  const isMexicana = url.pathname.includes('mexicana');
  const isAmigos = url.pathname.includes('amigos') || url.pathname.includes('friends');

  // Para navegações de página HTML: tenta a rede primeiro para garantir a versão atual
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(async () => {
        // Fallback offline apropriado para cada página
        if (isMexicana) {
          return (await caches.match('mexicana.html')) || (await caches.match('/mexicana.html'));
        }
        if (isAmigos) {
          return (await caches.match('amigos.html')) || (await caches.match('/amigos.html'));
        }
        return (await caches.match('index.html')) || (await caches.match('/'));
      })
    );
    return;
  }

  // Para assets estáticos (CSS, JS, imagens): stale-while-revalidate
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      const net = fetch(req).then((res) => {
        if (res && res.status === 200 && (url.origin === location.origin || url.hostname.includes('gstatic') || url.hostname.includes('googleapis'))) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
