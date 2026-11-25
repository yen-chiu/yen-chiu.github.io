import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const home = readFileSync('src/pages/index.astro', 'utf8')

test('directory uses nine distinct local vector icons, not font glyphs', () => {
  const entries = home.match(/const entries = \[([\s\S]*?)\n\]/)?.[1]
  assert.ok(entries)
  const icons = [...entries.matchAll(/icon: '([^']+)', iconPath: '([^']+)'/g)]
  assert.equal(icons.length, 9)
  assert.equal(new Set(icons.map(icon => icon[1])).size, 9)
  assert.match(entries, /title: '链接'.*icon: 'link'/)
  assert.doesNotMatch(entries, /symbol:/)
  assert.match(home, /<svg class='entry-symbol'[^>]*width='24' height='24'[^>]*stroke-width='1\.5'[^>]*aria-hidden='true'/)
  assert.match(home, /<svg class='entry-arrow'[^>]*width='14' height='14'[^>]*aria-hidden='true'/)
  assert.match(home, /<path d=\{e\.iconPath\}/)
})

test('directory arrow uses muted color and pointer-only motion', () => {
  assert.match(home, /\.entry-arrow\{[^}]*color:hsl\(var\(--muted-foreground\)\)/)
  assert.match(home, /@media \(hover:hover\) and \(pointer:fine\) and \(prefers-reduced-motion:no-preference\)/)
  assert.match(home, /html\.motion-off[^{}]*\.entry-arrow[^{}]*\{transform:none\}/)
})
