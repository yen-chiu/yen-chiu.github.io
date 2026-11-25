// Capture the actual local production preview; no fixtures or image compositing.
// PLAYWRIGHT_PACKAGE points to an existing Playwright installation (no dependency changes).
import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import path from 'node:path'
import sharp from 'sharp'

if (!process.env.PLAYWRIGHT_PACKAGE) throw Error('Set PLAYWRIGHT_PACKAGE to an installed playwright package.json')
const { chromium } = createRequire(process.env.PLAYWRIGHT_PACKAGE)('playwright')
const base = process.env.SHOWCASE_BASE_URL || 'http://127.0.0.1:4321'
const root = path.resolve(import.meta.dirname, '..')
const output = path.join(root, 'docs/assets/showcase')
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const captures = []
const issues = []
try {
  for (const mobile of [false, true]) {
    const viewport = mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }
    const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1, colorScheme: 'light', reducedMotion: 'reduce' })
    const page = await context.newPage()
    page.on('pageerror', error => issues.push({ mobile, error: error.message }))
    await page.addInitScript(() => sessionStorage.setItem('vesper-opening-motto-seen', '1'))
    const capture = async (name, route) => {
      await page.evaluate(() => document.fonts.ready)
      await page.waitForTimeout(1200)
      const layout = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }))
      assert.ok(layout.scrollWidth <= layout.width + 1, `${name} has horizontal overflow: ${JSON.stringify(layout)}`)
      const broken = await page.locator('img').evaluateAll(images => images.filter(img => img.getBoundingClientRect().width && img.getBoundingClientRect().top < innerHeight && img.complete && !img.naturalWidth).map(img => img.getAttribute('src')))
      assert.deepEqual(broken, [], `${name} has broken visible images`)
      const file = `${name}-${mobile ? 'mobile' : 'desktop'}.webp`
      const png = await page.screenshot({ animations: 'disabled' })
      const bytes = await sharp(png).webp({ quality: 82, effort: 6 }).toFile(path.join(output, file))
      assert.ok(bytes.size < 220 * 1024, `${file} exceeds 220 KiB`)
      captures.push({ file, route, viewport, bytes: bytes.size, layout, brokenVisibleImages: broken })
      console.log(`${file}: ${bytes.size} bytes`)
    }
    await page.goto(base + '/', { waitUntil: 'networkidle' })
    await capture('home', '/')
    await page.locator('.search-button').click()
    await page.locator('dialog.search-container[open]').waitFor()
    await page.locator('.search-bar').fill('Vesper')
    await page.waitForTimeout(1800)
    assert.ok((await page.locator('.search-layout').innerText()).includes('Vesper'), 'Full-text search must return real Vesper results')
    await capture('search', '/ · search dialog · query=Vesper')
    await page.getByRole('button', { name: '关闭搜索', exact: true }).click()
    await page.goto(base + '/archives/', { waitUntil: 'networkidle' })
    await capture('archives', '/archives/')
    await context.close()
  }
} finally {
  await browser.close()
}
await writeFile(path.join(output, 'capture-report.json'), JSON.stringify({ base, captures, pageErrors: issues }, null, 2) + '\n')
assert.deepEqual(issues, [], 'Browser errors occurred; inspect capture-report.json')
