/* Vesper public-site offline cache. Never cache private apps, R2 originals,
 * third-party responses, mutable data, query URLs, or range requests.
 * Network-first navigation; immutable Astro assets are cache-first. */
const PREFIX = 'vesper-offline-'
const PAGES = PREFIX + 'v2-pages'
const ASSETS = PREFIX + 'v2-assets'
const PUBLIC_PATH = /^\/(?:$|(?:blog|docs|gallery|music|links|categories|tags|archives|about|projects|changelog|journal|persona|terms|search)(?:\/|$))/
let queue = Promise.resolve()

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const key of await caches.keys()) {
    if (key.startsWith(PREFIX) && key !== PAGES && key !== ASSETS) await caches.delete(key)
  }
  await self.clients.claim()
})()))

function classify(request) {
  if (request.method !== 'GET' || request.headers.has('range') ||
      request.headers.has('authorization') || request.cache === 'no-store' ||
      request.cache === 'reload') return null
  const url = new URL(request.url)
  if (url.origin !== self.location.origin || url.search) return null
  if (request.mode === 'navigate' && PUBLIC_PATH.test(url.pathname) &&
      (url.pathname.endsWith('/') || !url.pathname.split('/').pop().includes('.'))) return PAGES
  if (url.pathname.startsWith('/_astro/') &&
      /\.(?:js|css|woff2?|png|webp|avif|jpg|jpeg|svg|gif)$/i.test(url.pathname)) return ASSETS
  return null
}
function eligible(response, maxBytes, name) {
  const length = Number(response.headers.get('content-length'))
  const type = response.headers.get('content-type') || ''
  return response.status === 200 && !response.redirected &&
    response.type === 'basic' &&
    !/(?:private|no-store)/i.test(response.headers.get('cache-control') || '') &&
    response.headers.get('vary') !== '*' &&
    (name === PAGES ? type.includes('text/html') : !type.includes('text/html')) &&
    (!length || (Number.isFinite(length) && length <= maxBytes))
}
async function remember(name, request, response) {
  const maxBytes = name === PAGES ? 512 * 1024 : 2 * 1024 * 1024
  const limit = name === PAGES ? 20 : 64
  if (!eligible(response, maxBytes, name) || !response.body) return
  // Bound decoded bytes even when transfer length is absent or compressed.
  // Read the clone, not the response delivered to the visitor.
  const reader = response.body.getReader()
  const chunks = []
  let bytes = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      bytes += value.byteLength
      if (bytes > maxBytes) { void reader.cancel().catch(() => {}); return }
      chunks.push(value)
    }
  } catch { return }
  finally { reader.releaseLock() }
  // A decoded body must not retain compressed transport headers.
  const headers = new Headers(response.headers)
  headers.delete('content-encoding')
  headers.delete('content-length')
  const saved = new Response(new Blob(chunks), { status: 200, headers })
  const cache = await caches.open(name)
  await cache.delete(request)
  await cache.put(request, saved)
  const keys = await cache.keys()
  for (const key of keys.slice(0, Math.max(0, keys.length - limit))) await cache.delete(key)
}
function offlinePage() {
  return new Response('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>离线 · YenChiu</title><style>body{font:16px system-ui,sans-serif;margin:12vh auto;padding:1.5rem;max-width:32rem;line-height:1.8}a{color:inherit}</style><h1>暂时离线</h1><p>此页面尚未缓存。恢复网络后重新加载，或尝试返回曾浏览的页面。</p><a href="/">返回首页</a> · <a href="">重试</a></html>', { status: 503, headers: {'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'} })
}
async function handle(request, name, event) {
  const cache = await caches.open(name).catch(() => null)
  if (name === ASSETS && cache) {
    const cached = await cache.match(request).catch(() => undefined)
    if (cached) return cached
  }
  try {
    const response = await fetch(request)
    if (cache && eligible(response, name === PAGES ? 512*1024 : 2*1024*1024, name) && response.body) {
      const clone = response.clone()
      // Serialize bounded storage updates, without delaying the network response.
      queue = queue.then(() => remember(name, request, clone)).catch(() => {})
      event.waitUntil(queue)
    }
    return response
  } catch {
    const cached = cache ? await cache.match(request).catch(() => undefined) : undefined
    return cached || (name === PAGES ? offlinePage() : Response.error())
  }
}
self.addEventListener('fetch', event => {
  const name = classify(event.request)
  if (name) event.respondWith(handle(event.request, name, event))
})
