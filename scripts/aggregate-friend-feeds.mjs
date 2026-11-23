import { readFile, writeFile } from 'node:fs/promises'

const links = JSON.parse(await readFile('public/links.json', 'utf8'))
const friends = (links.friends.find(group => group.id_name === 'friends')?.link_list ?? [])
  .filter(friend => typeof friend.link === 'string' && /^https?:\/\//i.test(friend.link))
const updatedAt = new Date().toISOString()
const allFriends = links.friends.find(group => group.id_name === 'friends')?.link_list ?? []
const previous = await readFile('public/links-feed.json', 'utf8')
  .then(JSON.parse)
  .catch(() => ({ items: [] }))
const previousItems = Array.isArray(previous.items) ? previous.items : []
const PER_FEED_LIMIT = 12
const MAX_ARTICLES = 120
let successfulFeeds = 0
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
  return entries.slice(0, 24).map(([, type, entry]) => {
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
function alternateFeedUrls(html, base) {
  const urls = []
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const attrs = Object.fromEntries([...match[0].matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)]
      .map(([, name, value]) => [name.toLowerCase(), value]))
    if (!/\balternate\b/i.test(attrs.rel ?? '') ||
      !/(application\/(?:rss|atom)\+xml|text\/xml)/i.test(attrs.type ?? '')) continue
    const candidate = safeUrl(attrs.href, base)
    if (candidate) urls.push(candidate)
  }
  return [...new Set(urls)]
}
async function discoverFeedUrls(friend) {
  if (typeof friend.rss === 'string' && /^https?:\/\//i.test(friend.rss)) return [friend.rss]
  try {
    const response = await fetch(friend.link, {
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
      headers: { 'user-agent': 'VesperFriendsRSS/1.0', accept: 'text/html' }
    })
    if (!response.ok || Number(response.headers.get('content-length') || '0') > 250000) return []
    const html = (await response.text()).slice(0, 250000)
    const listed = alternateFeedUrls(html, response.url || friend.link)
    // Common feed filenames are only candidates: never publish one unless it parses.
    const origin = new URL(response.url || friend.link).origin
    return [...new Set([...listed, origin + '/rss.xml', origin + '/atom.xml', origin + '/feed.xml'])]
  } catch { return [] }
}
async function collect(friend) {
  try {
    const candidates = await discoverFeedUrls(friend)
    if (!candidates.length) throw new Error('No RSS/Atom address found')
    let lastError = 'No valid RSS/Atom feed'
    for (const feedUrl of candidates.slice(0, 6)) {
      try {
        const response = await fetch(feedUrl, {
          redirect: 'follow', signal: AbortSignal.timeout(12000),
          headers: { 'user-agent': 'VesperFriendsRSS/1.0', accept: 'application/rss+xml, application/atom+xml, text/xml, application/xml, */*' }
        })
        if (!response.ok) throw new Error('HTTP ' + response.status)
        if (Number(response.headers.get('content-length') ?? '0') > 1024 * 1024) throw new Error('Feed too large')
        const body = await response.text()
        if (body.length > 1024 * 1024) throw new Error('Feed too large')
        if (!/<(?:rss|feed|rdf:RDF)\b/i.test(body.slice(0, 2000))) throw new Error('Not RSS/Atom XML')
        const parsed = parseFeed(body, { ...friend, rss: feedUrl })
        if (!parsed.length) throw new Error('No valid RSS/Atom items')
        successfulFeeds++
        items.push(...parsed.slice(0, PER_FEED_LIMIT).map(item => ({
          ...item,
          avatar: typeof friend.avatar === 'string' ? friend.avatar : '',
          stale: false
        })))
        return
      } catch (error) { lastError = String(error?.message ?? error).slice(0, 120) }
    }
    throw new Error(lastError)
  } catch (error) {
    errors.push({ site: friend.name, message: String(error?.message ?? error).slice(0, 120) })
    // Keep a site's last successful articles when only its current fetch failed.
    // This is cached content, not evidence that the site is currently active.
    const cached = previousItems.filter(item =>
      item.siteUrl === friend.link && /^https?:\/\//i.test(item.url ?? ''))
    items.push(...cached.slice(0, PER_FEED_LIMIT).map(item => ({
      ...item,
      avatar: typeof friend.avatar === 'string' ? friend.avatar : '',
      stale: true
    })))
  }
}
await Promise.all(friends.map(collect))
const unique = [...new Map(items.map(item => [item.url, item])).values()]
unique.sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
const selected = unique.slice(0, MAX_ARTICLES)
await writeFile('public/links-feed.json', JSON.stringify({
  updatedAt,
  feeds: friends.length,
  activeFeeds: successfulFeeds,
  totalFriends: allFriends.length,
  articleCount: selected.length,
  items: selected,
  errors
}, null, 2) + '\n')
console.log('Aggregated ' + selected.length + ' articles from ' + successfulFeeds +
  ' successful feeds, ' + errors.length + ' failed; ' + allFriends.length + ' friends total')
