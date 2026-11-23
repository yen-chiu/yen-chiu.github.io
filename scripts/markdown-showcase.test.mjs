import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync, readFileSync } from 'node:fs'

const current = 'src/content/blog/Blogging/Tutorial/post-2023-04-06-02.mdx'
const legacy = 'src/content/blog/Blogging/Tutorial/post-2023-04-06-02.md'
const page = readFileSync(current, 'utf8')
const manifest = JSON.parse(readFileSync('migration/content-manifest.json', 'utf8'))
const references = manifest.filter(row => row.url === '/blog/markdown')

test('Markdown showcase replaces the old file without duplicate blog routes', () => {
  assert.ok(existsSync(current), 'The MDX source must be present')
  assert.equal(existsSync(legacy), false, 'Old Markdown source must be removed')
  assert.equal(references.length, 1)
  assert.equal(references[0].destination.replaceAll('\\', '/'), current)
  // 仓库里的内容文件来自 Windows，可能是 CRLF；这里不能写死 \n。
  assert.match(page, /^---\r?\n[\s\S]*?\nslug: markdown\r?\n/)
  assert.match(page, /draft: false/)
  assert.match(page, /updatedDate:/)
  assert.match(page, /post-2023-04-06-02/)
})

test('layout showcase uses actually installed components and supported sections', () => {
  assert.match(page, /import \{ Aside, Button, Card, Tabs, TabItem, Steps, Spoiler \} from 'astro-pure\/user'/)
  assert.match(page, /import \{ Typst \} from 'astro-typst\/src\/components'/)
  assert.match(page, /import AcademicLayoutDemo from '@\/components\/blog\/AcademicLayoutDemo.astro'/)
  assert.ok(existsSync('src/components/blog/AcademicLayoutDemo.astro'))
  for (const heading of [
    '标题、段落与文字', '链接、引用与脚注', '各种列表', '表格、对齐与长内容',
    '数学公式与 KaTeX', '代码高亮与 Shiki', 'Mermaid 图表',
    '图片、图注与媒体', '双链、内部跳转与知识网络',
    '折叠、提示与特殊内容', 'MDX 组件', 'Typst', '页面级功能检查'
  ]) {
    assert.ok(page.includes(heading), 'Missing typography section: ' + heading)
  }
})

test('physics and chemistry samples are sourced and never reuse thesis material', () => {
  assert.match(page, /Maxwell 方程组与电磁波/)
  assert.match(page, /Nernst 方程/)
  assert.match(page, /openstax\.org\/books\/university-physics-volume-2/)
  assert.match(page, /openstax\.org\/books\/chemistry-2e/)
  assert.match(page, /<AcademicLayoutDemo \/>/)
  assert.ok(!/高指标鞍点|鞍点动力系统|HiSD|Mueller.Brown|Biggs EXP|Index-4/.test(page))
  assert.match(page, /不是实测电压/)
})

test('code fences and display math blocks remain paired', () => {
  const fences = page.split('\n').filter(line => /^~~~/.test(line)).length
  const displays = page.split('\n').filter(line => line.trim() === '$$').length
  assert.ok(fences >= 20)
  assert.equal(fences % 2, 0, 'Unbalanced code fences')
  assert.ok(displays >= 20)
  assert.equal(displays % 2, 0, 'Unbalanced math delimiters')
})

test('mobile readability rules include internal scrolling for wide content', () => {
  const css = readFileSync('src/assets/styles/global.css', 'utf8')
  assert.match(css, /span\.katex-display\s*\{[^}]*overflow-x:\s*auto/s)
  assert.match(css, /#content table\s*\{[^}]*overflow-x:\s*auto/s)
})

test('Mermaid chart types use distinct mobile sizing and one scroll container', () => {
  const css = readFileSync('src/assets/styles/global.css', 'utf8')
  assert.match(css, /#content \.mermaid\s*\{[^}]*overflow-x:\s*auto/s)
  assert.match(css, /svg\[aria-roledescription='pie'\]/)
  assert.match(css, /svg\[aria-roledescription='gantt'\]/)
  assert.match(css, /svg\[aria-roledescription='sequence'\]/)
  assert.doesNotMatch(css, /min-width:\s*720px/)
  assert.doesNotMatch(css, /min-width:\s*420px/)
})
