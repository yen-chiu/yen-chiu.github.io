// Read-only repository inventory; use --write to refresh the review artifact.
import { execFileSync } from 'node:child_process'
import { readFile, writeFile, access } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import { visit } from 'unist-util-visit'

const root = path.resolve(import.meta.dirname, '..')
const candidates = [...new Set(execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean))]
const files = []
for (const file of candidates) { try { await access(path.join(root, file)); files.push(file) } catch {} }
const imagePattern = /\.(png|jpe?g|gif|webp|avif|svg|ico)$/i
const textPattern = /\.(mdx?|astro|[cm]?[jt]sx?|json|css|html|ya?ml|xml|webmanifest)$/i
const texts = await Promise.all(files.filter(f => textPattern.test(f) && !/lock|brand-assets-inventory/.test(f)).map(async file => ({ file, text: await readFile(path.join(root, file), 'utf8') })))
const images = []
for (const file of files.filter(f => imagePattern.test(f))) {
  const bytes = await readFile(path.join(root, file))
  const basename = path.basename(file)
  const references = texts.filter(t => t.text.includes(basename)).map(t => t.file)
  images.push({ file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), references })
}
const groups = Map.groupBy(images, item => item.sha256)
const duplicates = [...groups.values()].filter(group => group.length > 1).map(group => group.map(item => item.file))
const brandMentions = texts.filter(t => /iris|lemonadorable|cworld/i.test(t.text)).map(t => t.file)
const missingDocumentationAssets = []
for (const { file, text } of texts.filter(t => /\.md$/.test(t.file))) {
  const refs = []
  visit(unified().use(remarkParse).parse(text), node => {
    if (node.type === 'image') refs.push(node.url)
    if (node.type === 'html') for (const match of node.value.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/g)) refs.push(match[1])
  })
  for (const ref of refs) {
    if (/^(?:https?:|data:|#)/.test(ref)) continue
    const clean = decodeURIComponent(ref.split(/[?#]/)[0])
    const target = clean.startsWith('/') ? path.join(root, 'public', clean) : path.resolve(root, path.dirname(file), clean)
    try { await access(target) } catch { missingDocumentationAssets.push({ file, ref }) }
  }
}
const report = {
  scope: 'All git-tracked raster/vector images and text files; basename references are candidates, not proof of runtime reachability. Dynamic globs, legacy URLs and remote assets require manual review.',
  imageCount: images.length,
  totalBytes: images.reduce((n, item) => n + item.bytes, 0),
  duplicates,
  withoutLiteralBasenameReference: images.filter(item => !item.references.length).map(item => item.file),
  brandMentions,
  missingDocumentationAssets,
  images
}
if (process.argv.includes('--write')) await writeFile(path.join(root, 'docs/brand-assets-inventory.json'), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ imageCount: report.imageCount, totalBytes: report.totalBytes, duplicates, missingDocumentationAssets }, null, 2))
if (missingDocumentationAssets.length) process.exitCode = 1
