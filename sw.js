// Service worker: lets the game open without internet after the first visit.
// It always tries the network first, so new versions show up right away when online.

const CACHE = 'dirt-to-the-moon-v4';
const FILES = [
  './',
  'index.html',
  'style.css',
  'manifest.webmanifest',
  'vendor/planck.min.js',
  'icons/icon-192.png',
  'src/main.js',
  'src/config.js',
  'src/levels.js',
  'src/themes.js',
  'src/util.js',
  'src/terrain.js',
  'src/bike.js',
  'src/game.js',
  'src/render.js',
  'src/sprites.js',
  'src/font.js',
  'src/ui.js',
  'src/input.js',
  'src/audio.js',
  'src/save.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(FILES))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))),
  );
});
