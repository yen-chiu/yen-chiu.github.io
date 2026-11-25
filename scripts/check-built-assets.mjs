// Check local resource URLs in every generated HTML/CSS file, excluding navigation links.
import { readdir, readFile, access } from 'node:fs/promises'
import path from 'node:path'
import { load } from 'cheerio'

const root = path.resolve(import.meta.dirname, '../dist')
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : path.join(dir, entry.name)))).flat()
}
const missing = new Map()
let checked = 0
async function check(file, ref) {
  if (!ref || /^(?:https?:|data:|blob:|mailto:|#|\/\/)/i.test(ref)) return
  const decoded = decodeURIComponent(ref)
  if (decoded.startsWith('#')) return
  const clean = decoded.split(/[?#]/)[0]
  if (!clean) return
  const target = clean.startsWith('/') ? path.join(root, clean) : path.resolve(path.dirname(file), clean)
  checked++
  try { await access(target) } catch {
    const key = path.relative(root, target).replaceAll('\\', '/')
    if (!missing.has(key)) missing.set(key, { asset: key, pages: [] })
    const page = path.relative(root, file).replaceAll('\\', '/')
    if (!missing.get(key).pages.includes(page)) missing.get(key).pages.push(page)
  }
}
for (const file of await walk(root)) {
  if (!/\.(html|css)$/.test(file)) continue
  const text = await readFile(file, 'utf8')
  let css = text
  if (file.endsWith('.html')) {
    const $ = load(text)
    for (const el of $('img,script[src],source,video,audio,link[rel="stylesheet"],link[rel="icon"],link[rel="manifest"],link[rel="preload"]').toArray()) {
      for (const key of ['src', 'href', 'poster']) await check(file, $(el).attr(key))
      for (const candidate of ($(el).attr('srcset') || '').split(',')) await check(file, candidate.trim().split(/\s+/)[0])
    }
    css = $('style').toArray().map(el => $(el).text()).concat($('[style]').toArray().map(el => $(el).attr('style'))).join('\n')
  }
  for (const match of css.matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)/g)) await check(file, match[1])
}
console.log(JSON.stringify({ checkedReferences: checked, missing: [...missing.values()] }, null, 2))
if (missing.size) process.exitCode = 1
