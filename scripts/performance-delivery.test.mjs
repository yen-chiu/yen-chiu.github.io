import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'

const bootstrap = readFileSync('src/components/appearance/appearance-bootstrap.js', 'utf8')
const css = readFileSync('src/assets/styles/global.css', 'utf8')

function boot({ width = 390, cores = 4, reduced = false, hidden = false } = {}) {
  const dataset = {}
  const classes = new Set()
  const document = new EventTarget()
  document.hidden = hidden
  document.documentElement = {
    dataset,
    classList: { toggle: (name, on) => on ? classes.add(name) : classes.delete(name) },
    style: { setProperty() {} }
  }
  const window = new EventTarget()
  window.innerWidth = width
  const media = new EventTarget()
  media.matches = reduced
  vm.runInNewContext(bootstrap, {
    window, document,
    navigator: { hardwareConcurrency: cores },
    localStorage: { getItem: () => null, setItem() {} },
    matchMedia: () => media,
    CustomEvent
  })
  return { dataset, window, document, media, api: window.wendellAppearance }
}

test('mobile and lower-core devices suppress decorative effects without hiding content', () => {
  assert.equal(boot({ width: 390, cores: 8 }).dataset.effectQuality, 'low')
  assert.equal(boot({ width: 1280, cores: 2 }).dataset.effectQuality, 'low')
  assert.equal(boot({ width: 1280, cores: 8 }).dataset.effectQuality, 'high')
  assert.match(css, /html\[data-effect-quality='low'\] \.star-field/)
  assert.doesNotMatch(css, /data-effect-quality[^\n]*#content/)
})

test('OS and user reduced motion always select static decorations', () => {
  const os = boot({ reduced: true, width: 1280, cores: 8 })
  assert.equal(os.dataset.effectQuality, 'static')
  os.api.set({ motion: 'always' })
  assert.equal(os.dataset.effectQuality, 'static')
  const user = boot({ width: 1280, cores: 8 })
  user.api.set({ motion: 'reduced' })
  assert.equal(user.dataset.effectQuality, 'static')
})

test('background tabs pause decorative effects and foreground restores them', () => {
  const state = boot({ width: 1280, cores: 8 })
  assert.equal(state.dataset.effectsPaused, 'false')
  state.document.hidden = true
  state.document.dispatchEvent(new Event('visibilitychange'))
  assert.equal(state.dataset.effectsPaused, 'true')
  state.document.hidden = false
  state.document.dispatchEvent(new Event('visibilitychange'))
  assert.equal(state.dataset.effectsPaused, 'false')
})

test('responsive images are requested at display sizes without eager-loading all cards', () => {
  const preview = readFileSync('packages/pure/components/pages/PostPreview.astro', 'utf8')
  const listing = readFileSync('src/pages/blog/[...page].astro', 'utf8')
  const hero = readFileSync('packages/pure/components/pages/Hero.astro', 'utf8')
  assert.match(preview, /loading='lazy'/)
  assert.match(preview, /widths=\{\[320, 480, 640, 960\]\}/)
  assert.match(listing, /loading=\{index === 0 \? 'eager' : 'lazy'\}/)
  assert.match(listing, /sizes='/)
  assert.match(hero, /widths=\{\[360, 540, 720, 960, 1200\]\}/)
  assert.doesNotMatch(hero, /id='blurImage'/)
})
