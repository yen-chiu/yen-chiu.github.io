import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'

const code = readFileSync(new URL('../src/components/appearance/appearance-bootstrap.js', import.meta.url), 'utf8')

function mount(saved = null) {
  const settings = new Map()
  if (saved) settings.set('wendell-appearance-v1', JSON.stringify(saved))
  const styles = new Map()
  const classes = new Map()
  const root = {
    style: {
      setProperty: (name, value) => styles.set(name, value),
      removeProperty: name => styles.delete(name)
    },
    classList: { toggle: (name, on) => classes.set(name, on) },
    dataset: {}
  }
  const window = {
    dispatchEvent() {},
    addEventListener() {}
  }
  vm.runInNewContext(code, {
    window,
    document: { documentElement: root, addEventListener() {} },
    localStorage: {
      getItem: key => settings.get(key) ?? null,
      setItem: (key, value) => settings.set(key, value)
    },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    URL,
    Blob,
    CustomEvent: class {
      constructor(type) { this.type = type }
    }
  }, { filename: 'appearance-bootstrap.js' })
  return { api: window.wendellAppearance, root, styles, settings }
}

test('wallpaper choice follows the original appearance persistence mechanism', () => {
  const { api, root, styles, settings } = mount()
  assert.equal(api.get().wallpaper, 'banner')
  assert.equal(api.get().wallpaperSource, '/images/moonlit-cover.svg')
  api.set({
    wallpaper: 'fullscreen',
    wallpaperSource: '/images/wallpapers/aurora-ridge.svg',
    wallpaperOpacity: 42
  })
  assert.equal(root.dataset.wallpaper, 'fullscreen')
  assert.equal(styles.get('--site-wallpaper-opacity'), '0.42')
  assert.match(styles.get('--site-wallpaper-image'), /aurora-ridge\.svg/)
  const saved = JSON.parse(settings.get('wendell-appearance-v1'))
  const next = mount(saved)
  assert.equal(next.api.get().wallpaperOpacity, 42)
  assert.equal(next.api.get().wallpaperSource, '/images/wallpapers/aurora-ridge.svg')
})

test('untrusted or invalid wallpaper URLs fall back to the local image', () => {
  const { api, styles } = mount()
  for (const source of ['http://example.com/wall.png', 'javascript:alert(1)', 'data:image/svg+xml,...',
    'file:///tmp/wall.png', '/admin', 'https://user:secret@example.com/x']) {
    api.set({ wallpaperSource: source })
    assert.equal(api.get().wallpaperSource, '/images/moonlit-cover.svg')
  }
  api.set({ wallpaperSource: 'https://images.example.com/photo.jpg' })
  assert.equal(api.get().wallpaperSource, 'https://images.example.com/photo.jpg')
  assert.match(styles.get('--site-wallpaper-image'), /images\.example\.com/)
})

test('legacy settings migrate and opacity is clamped to readable range', () => {
  const { api } = mount({ theme: 'dark', wallpaper: 'overlay', hue: 215 })
  assert.equal(api.get().theme, 'dark')
  assert.equal(api.get().wallpaper, 'overlay')
  assert.equal(api.get().wallpaperSource, '/images/moonlit-cover.svg')
  api.set({ wallpaperOpacity: 200 })
  assert.equal(api.get().wallpaperOpacity, 75)
  api.set({ wallpaperOpacity: -40 })
  assert.equal(api.get().wallpaperOpacity, 8)
  api.reset()
  assert.equal(api.get().wallpaper, 'banner')
  assert.equal(api.get().wallpaperOpacity, 24)
})

test('all built-in wallpaper paths are real local assets', () => {
  for (const path of [
    'public/images/moonlit-cover.svg',
    'public/images/wallpapers/aurora-ridge.svg',
    'public/images/wallpapers/silver-mist.svg',
    'public/images/wallpapers/rose-twilight.svg'
  ]) {
    assert.ok(existsSync(path), path + ' is missing')
    const svg = readFileSync(path, 'utf8')
    assert.match(svg, /^<svg[\s>]/)
    assert.match(svg, /<\/svg>\s*$/)
    assert.ok(svg.length < 10_000, path + ' is unexpectedly large')
  }
})


test('homepage follows the chosen wallpaper without forcing inner-page background mode', () => {
  const { api, root, styles, settings } = mount()
  assert.equal(api.get().homeWallpaperSource, 'inherit')
  api.set({ wallpaperSource: '/images/wallpapers/rose-twilight.svg' })
  assert.match(styles.get('--home-wallpaper-image'), /rose-twilight\.svg/)
  assert.equal(root.dataset.homeWallpaperCustom, 'true')
  assert.equal(root.dataset.wallpaper, 'banner', 'inner pages may remain plain')
  const saved = JSON.parse(settings.get('wendell-appearance-v1'))
  assert.equal(mount(saved).api.get().homeWallpaperSource, 'inherit')
})

test('a separate homepage wallpaper does not change the reader background', () => {
  const { api, styles, settings, root } = mount()
  api.set({
    wallpaperSource: '/images/wallpapers/aurora-ridge.svg',
    homeWallpaperSource: '/images/wallpapers/silver-mist.svg'
  })
  assert.match(styles.get('--site-wallpaper-image'), /aurora-ridge\.svg/)
  assert.match(styles.get('--home-wallpaper-image'), /silver-mist\.svg/)
  assert.equal(root.dataset.homeWallpaperCustom, 'true')
  api.set({ wallpaperSource: '/images/moonlit-cover.svg' })
  assert.match(styles.get('--home-wallpaper-image'), /silver-mist\.svg/)
  assert.equal(mount(JSON.parse(settings.get('wendell-appearance-v1'))).api.get().homeWallpaperSource,
    '/images/wallpapers/silver-mist.svg')
  api.set({ homeWallpaperSource: 'inherit' })
  assert.match(styles.get('--home-wallpaper-image'), /moonlit-cover\.svg/)
  assert.equal(root.dataset.homeWallpaperCustom, 'false')
})

test('homepage remote URLs are validated and resetting preserves old defaults', () => {
  const { api, styles } = mount({ wallpaperSource: '/images/wallpapers/aurora-ridge.svg' })
  assert.equal(api.get().homeWallpaperSource, 'inherit', 'old user preferences still work')
  api.set({ homeWallpaperSource: 'javascript:alert(1)' })
  assert.equal(api.get().homeWallpaperSource, 'inherit')
  api.set({ homeWallpaperSource: 'https://cdn.example.com/home.webp' })
  assert.match(styles.get('--home-wallpaper-image'), /cdn\.example\.com/)
  api.set({ homeWallpaperSource: 'home-uploaded' })
  assert.equal(api.get().homeWallpaperSource, 'home-uploaded')
  assert.match(styles.get('--home-wallpaper-image'), /moonlit-cover\.svg/,
    'local image is shown only after IndexedDB supplies the blob')
  api.reset()
  assert.equal(api.get().homeWallpaperSource, 'inherit')
  assert.equal(api.get().wallpaperSource, '/images/moonlit-cover.svg')
})


test('homepage and settings panel both expose the independent cover controls', () => {
  const home = readFileSync('src/pages/index.astro', 'utf8')
  const panel = readFileSync('src/components/appearance/AppearancePanel.astro', 'utf8')
  assert.match(home, /--home-wallpaper-image/)
  assert.match(home, /data-home-wallpaper-custom/)
  assert.match(home, /syncCoverCredit/)
  assert.match(panel, /data-home-wallpaper-mode='inherit'/)
  assert.match(panel, /data-home-wallpaper-mode='separate'/)
  assert.match(panel, /data-home-wallpaper-source=/)
  assert.match(panel, /data-home-wallpaper-file/)
  assert.match(panel, /data-home-wallpaper-url/)
  assert.match(panel, /uploadHome\(image\)/)
})
