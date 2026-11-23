import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(path, 'utf8')
const player = read('src/components/music/MusicPlayer.astro')
const page = read('src/pages/music/index.astro')
const home = read('src/pages/index.astro')
const header = read('src/components/CustomHeader.astro')
const tracks = read('src/data/music.ts')
const engine = read('src/utils/music-engine.ts')

test('separate music page and embedded homepage radio both exist', () => {
  assert.match(page, /<MusicPlayer\s*\/>/)
  assert.match(home, /<MusicPlayer compact\s*\/>/)
  assert.match(home, /href=\{sitePath\('\/music\/'\)\}/)
  assert.match(header, /href:'\/music\/'/)
})

test('player is opt-in, accessible and mobile responsive', () => {
  assert.match(engine, /preload = 'none'/)
  // Playback moved into the shared engine so one track keeps running across
  // pages; the player must drive it through the engine, not its own <audio>.
  assert.match(engine, /await this\.audio\.play\(\)/)
  assert.match(engine, /this\.audio\.pause\(\)/)
  assert.match(player, /musicEngine\.toggle\(\)/)
  assert.match(player, /musicEngine\.subscribe/)
  assert.match(player, /musicEngine\.seek\(/)
  assert.match(player, /musicEngine\.setVolume\(/)
  assert.match(player, /aria-label='播放进度'/)
  assert.match(player, /aria-label='音量'/)
  assert.match(player, /@media\(max-width:680px\)/)
  assert.match(player, /prefers-reduced-motion:reduce/)
  assert.doesNotMatch(player, /autoplay/i)
  assert.match(engine, /export const musicEngine = new MusicEngine\(\)/)
  assert.doesNotMatch(player, /astro:before-swap/)
})

test('mixed sources use official websites and sample rights are disclosed', () => {
  assert.match(tracks, /source: 'audio' \| 'external'/)
  assert.match(tracks, /Nocturne_Op\._9_no\._2_in_E_flat_major\.mp3/)
  assert.match(tracks, /CC0 1\.0/)
  assert.match(tracks, /https:\/\/open\.spotify\.com\//)
  assert.match(tracks, /https:\/\/soundcloud\.com\//)
  // The page states that mixed sources use official entry points; the old
  // "查看原曲" link text was replaced by that sentence in the player refactor.
  assert.match(page, /官方播放入口/)
})


test('queue navigation and playback modes are wired to shared engine', () => {
  assert.match(engine, /async next\(\)/)
  assert.match(engine, /async previous\(\)/)
  assert.match(engine, /private async onEnded\(\)/)
  assert.match(engine, /cycleRepeat\(\)/)
  assert.match(engine, /toggleShuffle\(\)/)
  assert.match(player, /data-previous/)
  assert.match(player, /data-next/)
  assert.match(player, /data-repeat/)
  assert.match(player, /data-shuffle/)
})


test('cover and lyrics fallback and mobile controls exist', () => {
  assert.match(player, /data-cover/)
  assert.match(player, /data-cover-fallback/)
  assert.match(player, /data-lyrics-body/)
  assert.match(player, /track\.lyrics\?\.trim\(\)/)
  assert.match(player, /min-width:44px/)
})
