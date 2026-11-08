// sw.js —— 离线缓存：
//   代码（html/js/css）走网络优先，保证更新即时生效、离线时回退缓存；
//   数据与素材（data/、assets/）走缓存优先，首次使用后即可离线。
const VERSION = 'll-v2';
const CORE = [
  './',
  './index.html',
  './css/app.css',
  './js/app.js',
  './js/engine.js',
  './js/save.js',
  './manifest.webmanifest',
  './data/story_cn.txt',
  './data/strings_cn.xml',
  './data/glossary_cn.json',
  './assets/img/background.png',
  './assets/img/splash_portrait.png',
  './assets/img/notification_icon.png',
  './assets/img/icon-192.png',
  './assets/img/icon-512.png',
  './assets/fonts/LetterGothicStd.otf',
  './assets/fonts/LetterGothicStd-Bold.otf',
];

const CODE_RE = /\.(?:js|css|html)$/;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) =>
      Promise.all(CORE.map((url) => cache.add(url).catch(() => null)))
    ).then(() => self.skipWaiting())
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
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => { put(req, res); return res; });
    })
  );
});
