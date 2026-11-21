import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { isDirectCategory } from '../src/utils/category-membership.ts'
import { categoryRedirects, canonicalCategory } from '../src/data/category-taxonomy.ts'
import { getAllCategories, getPostCategory, getPostPath, getPostSourceId } from '../src/utils/content-paths.ts'

const manifest = JSON.parse(readFileSync('migration/content-manifest.json', 'utf8'))
const posts = manifest.map(row => ({
  id: row.destination.replaceAll('\\', '/').replace('src/content/blog/', '').replace(/\.md$/, ''),
  filePath: row.destination.replaceAll('\\', '/'),
  data: { slug: row.url.slice('/blog/'.length) }
}))
const categories = getAllCategories(posts)
assert.deepEqual(Object.fromEntries([...categories].filter(([path]) => !path.includes('/')).map(([path, posts]) => [path, posts.length])), {
  '生活记录': 4, '建站笔记': 6, '技术实践': 7
})
assert.equal(categories.size, 11)
assert.equal(isDirectCategory(['技术实践', '技术实践/工具与开发'], '技术实践'), false)
assert.equal(isDirectCategory(['技术实践', '技术实践/工具与开发'], '技术实践/工具与开发'), true)
assert.equal(isDirectCategory(['建站笔记'], '建站笔记'), true)
assert.equal(isDirectCategory([], ''), false)
assert.equal(new Set([...categories].filter(([path]) => !path.includes('/')).flatMap(([, posts]) => posts.map(post => post.id))).size, 17)
posts.forEach((post, index) => {
  assert.equal(getPostPath(post), manifest[index].url)
  assert.equal(getPostSourceId(post), post.id)
  assert.ok(getPostCategory(post))
})
assert.equal(canonicalCategory('Uncategories/Git'), '技术实践/工具与开发')
assert.equal(canonicalCategory('杂记/折腾'), '建站笔记/写作发布')
assert.equal(canonicalCategory('未来栏目/新主题'), '未来栏目/新主题')
assert.equal(getPostCategory({ id: 'no-folder', data: {} }), undefined)
assert.equal(Object.keys(categoryRedirects).length, 16)
for (const [oldPath, target] of Object.entries(categoryRedirects)) {
  assert.ok(categories.has(target.slice('/categories/'.length)), `${oldPath}: missing target`)
  assert.notEqual(oldPath, target)
  assert.equal(categoryRedirects[target], undefined, 'Redirects must not form chains')
}
console.log('Taxonomy: 17 unchanged article paths, 3 topics / 8 subtopics, 16 compatible legacy category routes')

if (process.argv.includes('--built')) {
  const base = ''
  // trailingSlash 现在是 'always'，构建后的重定向目标与链接都带尾斜杠；
  // 断言里统一去掉尾斜杠再比较，脚本对两种配置都成立。
  const bare = (value) => value.replace(/\/+$/, '')
  const index = JSON.parse(readFileSync('dist/contentIndex.json', 'utf8'))
  const blogEntries = Object.values(index).filter(entry => entry.collection === 'blog')
  assert.equal(blogEntries.length, 17)
  assert.deepEqual([...new Set(blogEntries.flatMap(entry => entry.categories.filter(path => !path.includes('/'))))].sort(), ['建站笔记', '技术实践', '生活记录'].sort())
  for (const [oldPath, target] of Object.entries(categoryRedirects)) {
    const html = readFileSync(`dist${oldPath}/index.html`, 'utf8')
    const redirect = decodeURI(html.match(/http-equiv="refresh" content="0;url=([^"]+)"/)?.[1] ?? '')
    assert.equal(bare(redirect), bare(base + target), `${oldPath}: redirect must stay in the preview base path`)
    const canonicalHref = decodeURI(html).match(/rel="canonical" href="([^"]+)"/)?.[1] ?? ''
    assert.equal(
      bare(canonicalHref),
      bare(`https://yenchiu.com${base}${target}`),
      `${oldPath}: canonical must use the preview path`
    )
    readFileSync(`dist${target}/index.html`, 'utf8')
  }
  const home = readFileSync('dist/index.html', 'utf8')
  assert.equal((home.match(/<article\b[^>]*class="guide-card(?:\s|")/g) ?? []).length, 3)
  assert.ok(!/class="post-list(?:\s|")/.test(home), 'The full article feed belongs on the blog page')
  for (const slug of ['qq-bot-postmortem', 'xss-audit', 'miko-web']) {
    assert.ok(home.includes(`href="${base}/blog/${slug}/"`))
    readFileSync(`dist/blog/${slug}/index.html`, 'utf8')
  }
  console.log('Built pages: 16 legacy redirects / canonical URLs retain base; search index and curated destinations verified')
}
