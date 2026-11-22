import { readFile, writeFile } from 'node:fs/promises'

const links = JSON.parse(await readFile('public/links.json', 'utf8'))
const friends = (links.friends.find(group => group.id_name === 'friends')?.link_list ?? [])
  .filter(friend => typeof friend.rss === 'string' && /^https?:\/\//i.test(friend.rss))
const updatedAt = new Date().toISOString()
const items = []
const errors = []

function decode(value = '') {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&(?:amp|lt|gt|quot|apos|nbsp|#(\d+)|#x([0-9a-f]+));/gi, (entity, dec, hex) => {
      if (dec || hex) {
        const point = Number.parseInt(dec || hex, hex ? 16 : 10)
        return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : ''
      }
      return { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&nbsp;': ' ' }[entity.toLowerCase()] ?? entity
    }).trim()
}
function tag(xml, name) {
  const match = xml.match(new RegExp('<(?:[\\w-]+:)?' + name + '\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w-]+:)?' + name + '\\s*>', 'i'))
  return match?.[1] ?? ''
}
function safeUrl(value, base) {
  try {
    const url = new URL(decode(value), base)
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null
  } catch { return null }
}
function parseFeed(xml, friend) {
  const entries = [...xml.matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi)]
  return entries.slice(0, 8).map(([, type, entry]) => {
    const isAtom = type.toLowerCase() === 'entry'
    const title = decode(tag(entry, 'title')).slice(0, 160)
    const date = decode(tag(entry, isAtom ? 'updated' : 'pubDate') || tag(entry, 'published') || tag(entry, 'date'))
    const linkText = tag(entry, 'link')
    const atomLink = entry.match(/<link\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*\/?>/i)?.[1]
    const url = safeUrl(isAtom ? (atomLink ?? linkText) : linkText, friend.rss)
    const published = Date.parse(date)
    if (!title || !url) return null
    return {
      title, url, site: friend.name, siteUrl: friend.link,
      publishedAt: Number.isFinite(published) ? new Date(published).toISOString() : null
    }
  }).filter(Boolean)
}
async function collect(friend) {
  try {
    const response = await fetch(friend.rss, {
      redirect: 'follow', signal: AbortSignal.timeout(12000),
      headers: { 'user-agent': 'VesperFriendsRSS/1.0', accept: 'application/rss+xml, application/atom+xml, text/xml, application/xml, */*' }
    })
    if (!response.ok) throw new Error('HTTP ' + response.status)
    if (Number(response.headers.get('content-length') ?? '0') > 1024 * 1024) throw new Error('Feed too large')
    const body = await response.text()
    if (body.length > 1024 * 1024) throw new Error('Feed too large')
    const parsed = parseFeed(body, friend)
    items.push(...parsed.slice(0, 4))
    if (!parsed.length) throw new Error('No valid RSS/Atom items')
  } catch (error) {
    errors.push({ site: friend.name, message: String(error?.message ?? error).slice(0, 120) })
  }
}
await Promise.all(friends.map(collect))
items.sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
await writeFile('public/links-feed.json', JSON.stringify({
  updatedAt, feeds: friends.length, items: items.slice(0, 18), errors
}, null, 2) + '\n')
console.log('Collected ' + items.length + ' posts across ' + friends.length + ' configured feeds')
