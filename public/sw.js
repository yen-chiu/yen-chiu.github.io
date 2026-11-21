/*
 * Minimal service worker.
 *
 * Chrome only offers "安装应用" (install) when the site is served by a service
 * worker that handles fetches, so this worker exists to satisfy that
 * requirement and nothing else: every request is forwarded straight to the
 * network, nothing is cached, and no page is ever served stale.
 *
 * If offline support is ever wanted, add a real cache strategy here -- but
 * keep this file free of precaching so a broken deploy can never strand
 * visitors on an old shell.
 */

self.addEventListener('install', () => {
  // Activate this worker immediately instead of waiting for every tab to close.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  // Take control of already-open pages so the install prompt can appear
  // without a reload.
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  // Network passthrough for GET requests. This handler is what makes the
  // site installable; it intentionally does not touch the Cache API.
  if (event.request.method === 'GET') {
    event.respondWith(fetch(event.request))
  }
})
