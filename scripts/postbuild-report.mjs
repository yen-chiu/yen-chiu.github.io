// 构建后处理：删掉浏览器用不到的 ttf/woff 字体副本（KaTeX 同时打包三种格式），并打印体积报告。
import fs from 'node:fs'
import path from 'node:path'

const DIST = 'dist'

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

const files = walk(DIST)

// 1. 字体：只保留 woff2
// 同步移除 CSS 中的旧格式回退，避免引用随后删除的文件。
// 仅处理已有 woff2 的 @font-face，其他字体保持完整。
const removableFonts = new Set()
for (const cssFile of files.filter(f => f.endsWith('.css'))) {
  const before = fs.readFileSync(cssFile, 'utf8')
  const after = before.replace(/@font-face\s*\{[^}]*\}/g, face => {
    if (!/url\([^)]*\.woff2(?:["']?\))/.test(face)) return face
    return face.replace(/,\s*url\(["']?([^"')]+\.(?:woff|ttf))["']?\)\s*format\([^)]+\)/g, (_, url) => {
      removableFonts.add(url.startsWith('/') ? path.resolve(DIST, '.' + url) : path.resolve(path.dirname(cssFile), url))
      return ''
    })
  })
  if (after !== before) fs.writeFileSync(cssFile, after)
}
const legacyFonts = files.filter(f => removableFonts.has(path.resolve(f)))
let reclaimed = 0
for (const file of legacyFonts) {
  reclaimed += fs.statSync(file).size
  fs.rmSync(file)
}

const fonts = walk(DIST).filter((f) => /\.(woff2?|ttf|otf)$/i.test(f))
const fontBytes = fonts.reduce((sum, f) => sum + fs.statSync(f).size, 0)

// 2. 体积报告
const GROUP = [
  ['html', /\.html$/i],
  ['js', /\.js$/i],
  ['css', /\.css$/i],
  ['图片', /\.(png|jpe?g|webp|avif|gif|svg)$/i],
  ['字体', /\.(woff2?|ttf|otf)$/i],
  ['其它', /./],
]

const remaining = walk(DIST)
const groups = new Map(GROUP.map(([name]) => [name, { count: 0, bytes: 0 }]))
let totalBytes = 0
for (const file of remaining) {
  const size = fs.statSync(file).size
  totalBytes += size
  const bucket = groups.get(GROUP.find(([, pattern]) => pattern.test(file))[0])
  bucket.count += 1
  bucket.bytes += size
}

const kb = (bytes) => Math.round(bytes / 1024).toLocaleString('en-US') + 'KB'
console.log(`\n构建产物：${remaining.length} 个文件，${(totalBytes / 1024 / 1024).toFixed(1)}MB`)
for (const [name, { count, bytes }] of groups) {
  if (count === 0) continue
  console.log(`  ${name.padEnd(4, '　')} ${String(count).padStart(4)} 个  ${kb(bytes)}`)
}
console.log(`  字体只留 woff2：${fonts.length} 个，${kb(fontBytes)}；本次删掉 ttf/woff ${legacyFonts.length} 个，省 ${kb(reclaimed)}`)

const biggest = remaining
  .map((f) => ({ f: f.replace(/\\/g, '/'), size: fs.statSync(f).size }))
  .sort((a, b) => b.size - a.size)
  .slice(0, 8)
console.log('  最大文件：')
for (const { f, size } of biggest) console.log(`    ${kb(size).padStart(7)}  ${f.replace(/^dist\//, '')}`)
