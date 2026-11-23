import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(path, 'utf8')
const player = read('src/components/music/MusicPlayer.astro')
const page = read('src/pages/music/index.astro')
const home = read('src/pages/index.astro')
const header = read('src/components/CustomHeader.astro')
const tracks = read('src/data/music.ts')

test('separate music page and embedded homepage radio both exist', () => {
  assert.match(page, /<MusicPlayer\s*\/>/)
  assert.match(home, /<MusicPlayer compact\s*\/>/)
  assert.match(home, /href=\{sitePath\('\/music\/'\)\}/)
  assert.match(header, /href:'\/music\/'/)
})

test('player is opt-in, accessible and mobile responsive', () => {
  assert.match(player, /preload='none'/)
  assert.match(player, /audio\.play\(\)/)
  assert.match(player, /audio\.pause\(\)/)
  assert.match(player, /aria-label='播放进度'/)
  assert.match(player, /aria-label='音量'/)
  assert.match(player, /@media\(max-width:680px\)/)
  assert.match(player, /prefers-reduced-motion:reduce/)
  assert.doesNotMatch(player, /autoplay/i)
})

test('mixed sources use official websites and sample rights are disclosed', () => {
  assert.match(tracks, /source: 'audio' \| 'external'/)
  assert.match(tracks, /Nocturne_Op\._9_no\._2_in_E_flat_major\.mp3/)
  assert.match(tracks, /CC0 1\.0/)
  assert.match(tracks, /https:\/\/open\.spotify\.com\//)
  assert.match(tracks, /https:\/\/soundcloud\.com\//)
  assert.match(page, /查看/)
})
