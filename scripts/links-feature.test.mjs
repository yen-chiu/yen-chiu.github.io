import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const json = name => JSON.parse(readFileSync(name, 'utf8'))
const config = json('.github/friend-link.config.json')
const links = json('public/links.json')

test('friend requests target the real Vesper website and an existing group', () => {
  assert.equal(config.site.url, 'https://yenchiu.com/')
  assert.equal(config.site.friendPage, 'https://yenchiu.com/links/')
  assert.ok(links.friends.some(group => group.id_name === config.targetGroup))
  assert.equal(config.targetGroup, 'friends')
})
test('link list uses unique public HTTP(S) URLs', () => {
  const seen = new Set()
  for (const group of links.friends) {
    assert.ok(group.id_name)
    for (const link of group.link_list) {
      const url = new URL(link.link)
      assert.ok(['https:', 'http:'].includes(url.protocol))
      assert.ok(!seen.has(url.href), 'Duplicate: ' + url.href)
      seen.add(url.href)
      assert.ok(link.name && link.intro)
      if (link.rss) assert.ok(['http:', 'https:'].includes(new URL(link.rss).protocol))
    }
  }
})
test('status and feed placeholders use compatible schema', () => {
  const status = json('public/links-status.json')
  const feed = json('public/links-feed.json')
  assert.ok(Array.isArray(status.links))
  assert.ok(Number.isInteger(status.summary.healthy))
  assert.ok(Array.isArray(feed.items))
  assert.ok(Array.isArray(feed.errors))
})
