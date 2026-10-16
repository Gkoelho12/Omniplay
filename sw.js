/* OmniPlay · service worker: guarda a app para funcionar 100% offline */
const CACHE = 'omniplay-v6';
const SHELL = [
  './', 'index.html', 'mexicana.html', 'style.css', 'manifest.webmanifest', 'assets/icon.svg',
  'js/config.js', 'js/util.js', 'js/backend.js', 'js/session.js', 'js/views.js', 'js/play.js', 'js/app.js', 'js/mexicana_page.js',
  'js/vendor/supabase.js', 'js/games/connect4.js', 'js/games/reflex.js', 'js/games/mexicana.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('supabase.co')) return; // dados/realtime: nunca em cache
  // stale-while-revalidate (ficheiros próprios + fontes)
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      const net = fetch(req).then((res) => {
        if (res && res.status === 200 && (url.origin === location.origin || url.hostname.includes('gstatic') || url.hostname.includes('googleapis'))) {
          const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => hit || (req.mode === 'navigate' ? caches.match('index.html') : undefined));
      return hit || net;
    })
  );
});
