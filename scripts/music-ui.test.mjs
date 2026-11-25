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


test('waveform seek keeps native keyboard and touch controls', () => {
  assert.match(player, /data-wave-seek/)
  assert.match(player, /music-wave-bars/)
  assert.match(player, /music-wave-played/)
  assert.match(player, /data-seek type='range'/)
  assert.match(player, /musicEngine\.seek\(Number\(seek\.value\)\/1000\)/)
  assert.match(player, /touch-action:pan-y/)
  assert.match(player, /aria-hidden='true'/)
})


test('visual refinements keep seek accessibility and compact controls',()=>{assert.match(player,/music-spindle/);assert.match(player,/music-track-equalizer/);assert.match(player,/aria-current/);assert.match(player,/data-seek-tooltip/);assert.match(player,/pointercancel/);assert.match(player,/aria-valuetext/);assert.match(player,/prefers-reduced-motion:reduce/);assert.match(player,/\.is-compact \.music-actions \[data-shuffle\]/)})


test('waveform data is sourced from precomputed RMS values, not synthetic trigonometry',()=>{assert.match(player,/music-waveforms\.json/);assert.match(player,/data-waveforms/);assert.match(player,/renderWave\(track\.id\)/);assert.doesNotMatch(player,/Math\.sin\(i\*1\.73\)/)})

test('rebuilt vinyl and tonearm are shipped as WebP assets, not just CSS placeholders',()=>{
  for(const name of ['vinyl','tonearm']){
    const bytes=readFileSync('public/images/music/'+name+'.webp')
    assert.equal(bytes.toString('ascii',0,4),'RIFF')
    assert.equal(bytes.toString('ascii',8,12),'WEBP')
    assert(bytes.length>1024&&bytes.length<150000, name+' asset size outside budget')
  }
  assert.match(player,/class='vinyl-asset'/)
  assert.match(player,/class='tonearm-asset'/)
  assert.match(player,/\.has-vinyl-asset/)
  assert.match(player,/transform-origin:78% 20%/)
})

test('tonearm has a smooth transform on mobile but respects reduced motion',()=>{
  assert.match(player,/\.music-tonearm\{[^}]*transition:transform 900ms cubic-bezier\(/)
  assert.match(player,/\.is-playing \.music-tonearm\.has-tonearm-asset\{transform:rotate\(0deg\)\}/)
  assert.doesNotMatch(player,/data-effect-quality='low'\]\) \.music-tonearm/)
  assert.match(player,/html\.motion-off\) \.music-tonearm/)
  assert.match(player,/data-effect-quality='static'\]\) \.music-tonearm\{transition:none!important\}/)
  assert.match(player,/prefers-reduced-motion:reduce[^\n]*\.music-tonearm[^\n]*transition:none!important/)
})

test('vinyl rotation follows playback even in low-quality mobile mode',()=>{
  assert.match(player,/\.music-vinyl\{[^}]*animation:music-spin 24s linear infinite;animation-play-state:paused/)
  assert.match(player,/\.is-playing \.music-vinyl\{animation-play-state:running\}/)
  assert.doesNotMatch(player,/data-effect-quality='low'\]\) \.music-vinyl/)
  assert.match(player,/html\.motion-off\) \.music-vinyl/)
  assert.match(player,/prefers-reduced-motion:reduce[^\n]*\.music-vinyl[^\n]*animation:none!important/)
})

test('music credits have one structured catalogue and compact footer',()=>{
  const archive=read('src/pages/music/credits/index.astro')
  assert.match(tracks,/license: string/)
  assert.match(tracks,/sourceUrl: string/)
  assert.match(player,/creditLicense\.textContent=track\.license/)
  assert.match(player,/creditSource\.href=track\.sourceUrl/)
  assert.match(player,/encodeURIComponent\(track\.id\)/)
  assert.match(page,/sitePath\('\/music\/credits\/'\)/)
  assert.doesNotMatch(page,/musicTracks\.map/)
  assert.match(archive,/musicTracks\.map/)
  assert.match(archive,/track\.attribution/)
  assert.match(archive,/track\.licenseUrl/)
  assert.match(archive,/const pageSize = 20/)
  assert.match(archive,/location\.hash/)
})
