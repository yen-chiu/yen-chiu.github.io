import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'

const root = 'dist'
const htmlFiles = []
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) await walk(file)
    else if (file.endsWith('.html')) htmlFiles.push(file)
  }
}
await walk(root)
assert.ok(htmlFiles.length, 'No built HTML files found')
const origin = 'https://yenchiu.com'
const sitemapIndex = await readFile(path.join(root, 'sitemap-index.xml'), 'utf8')
assert.match(sitemapIndex, /<sitemapindex\b/, 'Sitemap index missing')
const robotsTxt = await readFile(path.join(root, 'robots.txt'), 'utf8')
assert.match(robotsTxt, /Sitemap:\s*https:\/\/yenchiu\.com\/sitemap-index\.xml/i)

let checked = 0
for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8')
  const rel = path.relative(root, file).split(path.sep).join('/')
  const route = rel === 'index.html' ? '/' : rel.endsWith('/index.html') ? '/' + rel.slice(0, -'/index.html'.length) : '/' + rel.replace(/\.html$/, '')
  const canonical = [...html.matchAll(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi)][0]?.[0]
  assert.ok(canonical, `Missing canonical: ${rel}`)
  const href = canonical.match(/href=["']([^"']+)["']/i)?.[1]
  assert.ok(href, `Canonical href missing: ${rel}`)
  const url = new URL(href)
  assert.equal(url.origin, origin, `Canonical origin mismatch: ${rel}`)
  assert.equal(url.pathname.replace(/\/$/, '') || '/', route.replace(/\/$/, '') || '/', `Canonical path mismatch: ${rel}`)
  assert.ok(!url.search && !url.hash, `Canonical contains query/fragment: ${rel}`)
  const robots = [...html.matchAll(/<meta\b[^>]*name=["']robots["'][^>]*>/gi)][0]?.[0] ?? ''
  if (rel === '404.html') assert.match(robots, /content=["']noindex, follow["']/i, '404 must be noindex')
  else assert.match(robots, /content=["']index, follow["']/i, `Unexpected robots: ${rel}`)
  checked++
}
console.log(`SEO audit passed: ${checked} HTML files, canonical/robots/sitemap/robots.txt`)
