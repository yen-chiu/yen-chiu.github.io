import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'

const root = 'dist'
const publicDir = 'public'
const origin = 'https://yenchiu.com'

async function collectHtml(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) await collectHtml(file, out)
    else if (file.endsWith('.html')) out.push(file)
  }
  return out
}

const toPosix = (value) => value.split(path.sep).join('/')

// Hand-authored pages under public/ are copied verbatim; BaseHead never renders
// their head, so they keep their own (sometimes intentionally noindex) metadata.
const handAuthored = new Set()
try {
  for (const file of await collectHtml(publicDir)) {
    handAuthored.add(toPosix(path.relative(publicDir, file)))
  }
} catch (error) {
  if (error.code !== 'ENOENT') throw error
}

const htmlFiles = await collectHtml(root)
assert.ok(htmlFiles.length, 'No built HTML files found')

const sitemapIndex = await readFile(path.join(root, 'sitemap-index.xml'), 'utf8')
assert.match(sitemapIndex, /<sitemapindex\b/, 'Sitemap index missing')
const robotsTxt = await readFile(path.join(root, 'robots.txt'), 'utf8')
assert.match(robotsTxt, /Sitemap:\s*https:\/\/yenchiu\.com\/sitemap-index\.xml/i)

// Astro renders Astro.url.pathname percent-encoded (Chinese slugs become %E5%8A%A8...),
// while the route derived from the filesystem keeps the raw characters.
const decodePath = (value) => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}
const normalizePath = (value) => decodePath(value).replace(/\/+$/, '') || '/'
const routeOf = (rel) =>
  rel === 'index.html'
    ? '/'
    : rel.endsWith('/index.html')
      ? '/' + rel.slice(0, -'/index.html'.length)
      : '/' + rel.replace(/\.html$/, '')

const robotsOf = (html) =>
  [...html.matchAll(/<meta\b[^>]*\bname=["']robots["'][^>]*>/gi)][0]?.[0] ?? ''

let checked = 0
const skipped = { redirect: 0, partial: 0, static: 0 }
for (const file of htmlFiles) {
  const rel = toPosix(path.relative(root, file))
  const html = await readFile(file, 'utf8')
  const robots = robotsOf(html)

  // Astro builds `redirects` entries as tiny HTML stubs: no <html>, no head meta
  // beyond <title>/<meta http-equiv="refresh">. They must stay out of the index.
  if (/http-equiv=["']refresh["']/i.test(html)) {
    assert.match(robots, /noindex/i, `Redirect must be noindex: ${rel}`)
    skipped.redirect++
    continue
  }
  // Partials (e.g. docs/DocsContents) render component markup only: no <html>, no head.
  if (!/<html[\s>]/i.test(html)) {
    skipped.partial++
    continue
  }
  if (handAuthored.has(rel)) {
    skipped.static++
    continue
  }

  const route = routeOf(rel)
  const canonical = [...html.matchAll(/<link\b[^>]*\brel=["']canonical["'][^>]*>/gi)][0]?.[0]
  assert.ok(canonical, `Missing canonical: ${rel}`)
  const href = canonical.match(/\bhref=["']([^"']+)["']/i)?.[1]
  assert.ok(href, `Canonical href missing: ${rel}`)

  const url = new URL(href)
  assert.equal(url.origin, origin, `Canonical origin mismatch: ${rel}`)
  assert.equal(
    normalizePath(url.pathname),
    normalizePath(route),
    `Canonical path mismatch: ${rel} (canonical ${url.pathname}, route ${route})`
  )
  assert.ok(!url.search && !url.hash, `Canonical contains query/fragment: ${rel}`)

  if (rel === '404.html') {
    assert.match(robots, /content=["']noindex, follow["']/i, '404 must be noindex, follow')
  } else {
    assert.match(robots, /content=["']index, follow["']/i, `Unexpected robots: ${rel}`)
  }
  checked++
}

assert.ok(checked > 0, 'No pages were audited')
const skippedTotal = skipped.redirect + skipped.partial + skipped.static
console.log(
  `SEO audit passed: ${checked} pages (canonical/robots) + sitemap/robots.txt` +
    (skippedTotal
      ? `; skipped ${skippedTotal} (${skipped.redirect} redirects, ${skipped.partial} partials, ${skipped.static} static)`
      : '')
)
