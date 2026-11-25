import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { load } from 'cheerio'
import sharp from 'sharp'

const root = 'public/avatars/sites'
const data = JSON.parse(await readFile('public/links.json', 'utf8'))
const existing = JSON.parse(await readFile('public/links-avatars.json', 'utf8').catch(() => '{"avatars":{}}'))
const avatars = { ...(existing.avatars || {}) }
const formats = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp',
  'image/gif': 'gif', 'image/x-icon': 'ico', 'image/vnd.microsoft.icon': 'ico', 'image/avif': 'avif' }
function safe(raw) {
  try {
    const u = new URL(raw)
    const h = u.hostname.toLowerCase()
    if (u.protocol !== 'https:' || u.username || u.password || !h.includes('.') ||
      h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') ||
      /^(?:10|127|0|169\.254|172\.(?:1[6-9]|2\d|3[01])|192\.168)\./.test(h) ||
      h.includes(':')) return null
    return u.href
  } catch { return null }
}
function resolve(href, base) { try { return safe(new URL(href, base).href) } catch { return null } }
async function bounded(url, limit, accept) {
  if (!safe(url)) throw Error('Unsafe URL')
  // Follow a few HTTPS redirects only after validating each destination.
  // This supports ordinary www/canonical redirects without blindly following
  // redirects to local networks or metadata endpoints.
  let address = url
  let response
  for (let hop = 0; hop < 4; hop++) {
    response = await fetch(address, {
      redirect: 'manual', signal: AbortSignal.timeout(6000),
      headers: { accept, 'user-agent': 'VesperIcons/1.0' }
    })
    if (![301, 302, 303, 307, 308].includes(response.status)) break
    const location = response.headers.get('location')
    const next = location && resolve(location, address)
    if (!next || hop === 3) throw Error('Unsafe or excessive redirect')
    await response.body?.cancel()
    address = next
  }
  if (!response?.ok || Number(response.headers.get('content-length') || 0) > limit) throw Error('HTTP/size')
  const reader = response.body?.getReader()
  if (!reader) throw Error('Empty body')
  const chunks = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      if (size > limit) throw Error('Oversize')
      chunks.push(value)
    }
  } finally { await reader.cancel().catch(() => {}) }
  return { bytes: Buffer.concat(chunks), type: (response.headers.get('content-type') || '').split(';')[0].toLowerCase() }
}
function detect(type, bytes) {
  const hex = bytes.subarray(0, 12).toString('hex')
  if (hex.startsWith('89504e470d0a1a0a')) return 'png'
  if (hex.startsWith('ffd8ff')) return 'jpg'
  if (bytes.subarray(0, 6).toString().startsWith('GIF8')) return 'gif'
  if (hex.startsWith('00000100')) return 'ico'
  if (bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8,12).toString() === 'WEBP') return 'webp'
  // Do not store third-party SVG: remote embeds and active content are not trustworthy.
  if (type === 'image/svg+xml') return null
  // A valid AVIF is marked by an ISO BMFF file-type box.
  if (type === 'image/avif' && bytes.subarray(4, 12).toString().includes('avif')) return 'avif'
  return null
}
async function candidates(link) {
  const home = new URL(link.link)
  const result = []
  if (link.avatar?.startsWith('https:')) result.push(link.avatar)
  try {
    const { bytes, type } = await bounded(home.href, 350000, 'text/html')
    if (type === 'text/html' || /^\s*<!doctype/i.test(bytes.toString('utf8',0,200))) {
      const $ = load(bytes.toString())
      const found = []
      $('link[rel][href]').each((_, el) => {
        const rel = ($(el).attr('rel') || '').toLowerCase()
        if (!/(^|\s)(?:icon|apple-touch-icon(?:-precomposed)?)(?:\s|$)/.test(rel)) return
        const href = resolve($(el).attr('href'), home.href)
        if (!href) return
        const px = Number(($(el).attr('sizes') || '').match(/\d+/)?.[0] || 0)
        found.push({ href, score: Math.min(px, 512) + (rel.includes('apple') ? 256 : 0) })
      })
      result.push(...found.sort((a,b) => b.score - a.score).map(x => x.href))
    }
  } catch { /* Site may be offline. Continue with conventional icon endpoints. */ }
  result.push(home.origin + '/apple-touch-icon.png', home.origin + '/favicon.ico', home.origin + '/favicon.png')
  return [...new Set(result.map(u => safe(u)).filter(Boolean))]
}
async function save(link) {
  if (link.avatar?.startsWith('/')) return
  if (!safe(link.link)) return
  const options = await candidates(link)
  for (const url of options.slice(0, 9)) {
    try {
      const { bytes, type } = await bounded(url, 512000, 'image/*')
      let output = bytes
      let ext = detect(type, bytes)
      // Rasterise remote SVG icons rather than serving executable SVG from strangers.
      if (type === 'image/svg+xml' || /^\s*(?:<\?xml[^>]*>\s*)?<svg[\s>]/i.test(bytes.toString('utf8', 0, 350))) {
        output = await sharp(bytes, { limitInputPixels: 4000000 })
          .resize(128, 128, { fit: 'contain' }).png().toBuffer()
        ext = 'png'
      }
      if (!ext) continue
      const hash = createHash('sha256').update(output).digest('hex').slice(0, 16)
      const file = root + '/' + hash + '.' + ext
      await writeFile(file, output)
      avatars[link.link] = '/' + file.replace(/^public\//, '')
      return
    } catch { /* Try next candidate. */ }
  }
  // Keep old cached path if the host is temporarily unreachable.
}
await mkdir(root, { recursive: true })
const entries = data.friends.flatMap(group => group.link_list)
for (let i = 0; i < entries.length; i += 3) await Promise.all(entries.slice(i, i + 3).map(save))
const active = new Set(data.friends.flatMap(g => g.link_list.map(l => l.link)))
for (const url of Object.keys(avatars)) if (!active.has(url)) delete avatars[url]
await writeFile('public/links-avatars.json', JSON.stringify({ avatars }, null, 2) + '\n')
console.log('Cached icons for ' + Object.keys(avatars).length + ' links')
