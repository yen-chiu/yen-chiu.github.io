// sw.js —— 离线缓存
//   代码（html/js/css）网络优先：更新即时生效，离线时回退缓存；
//   数据与素材（data/ assets/）缓存优先：首次用过即可离线。
const VERSION = 'miko-v1';
const CORE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.webmanifest',
  './data/story.json',
  './data/meta.json',
  './assets/icon/icon-192.png',
  './assets/icon/icon-512.png',
  './assets/icon/logo-title.webp',
  './assets/icon/logo-sub.webp',
  './assets/images/聊天背景.webp',
];

const CODE_RE = /\.(?:js|css|html)$/;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => Promise.all(CORE.map((url) => cache.add(url).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function put(req, res) {
  if (!res || !res.ok || res.type !== 'basic') return;
  const copy = res.clone();
  caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {});
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  const isCode = req.mode === 'navigate' || CODE_RE.test(url.pathname);
  if (isCode) {
    event.respondWith(
      fetch(req)
        .then((res) => { put(req, res); return res; })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
    );
    return;
  }
  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => { put(req, res); return res; }))
  );
});
