// Export the site-owned SVG adaptation; no external downloads or dependencies added.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import sharp from 'sharp'

const iconDirectory = new URL('../public/favicon/', import.meta.url)
const source = await readFile(new URL('moon-stars.svg', iconDirectory), 'utf8')
const light = source.replace(/<style>[\s\S]*?<\/style>/, '')
const dark = light.replaceAll('#8653b3', '#c9a7f4')
const sizes = [16, 32, 48, 180, 192, 512]
await mkdir(new URL('../public/images/', import.meta.url), { recursive: true })
const frames = []
for (const size of sizes) {
  const buffer = await sharp(Buffer.from(light)).resize(size, size).png().toBuffer()
  await writeFile(new URL(`moon-stars-${size}.png`, iconDirectory), buffer)
  if (size <= 48) frames.push({ size, buffer })
}
// ICO stores PNG frames with alpha; keep small-size fallback independent of a raster codec.
const directory = Buffer.alloc(6 + frames.length * 16)
directory.writeUInt16LE(1, 2)
directory.writeUInt16LE(frames.length, 4)
let offset = directory.length
frames.forEach(({ size, buffer }, index) => {
  const entry = 6 + index * 16
  directory[entry] = size
  directory[entry + 1] = size
  directory.writeUInt16LE(1, entry + 4)
  directory.writeUInt16LE(32, entry + 6)
  directory.writeUInt32LE(buffer.length, entry + 8)
  directory.writeUInt32LE(offset, entry + 12)
  offset += buffer.length
})
await writeFile(new URL('moon-stars.ico', iconDirectory), Buffer.concat([directory, ...frames.map(frame => frame.buffer)]))
await writeFile(new URL('moon-stars-dark-192.png', iconDirectory), await sharp(Buffer.from(dark)).resize(192, 192).png().toBuffer())
const mark = light.replace(/<svg[^>]*>/, '<svg x="110" y="160" width="290" height="290" viewBox="0 0 70 70" fill="none">')
const card = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs><linearGradient id="paper" x2="1" y2="1"><stop stop-color="#eee8f7"/><stop offset="1" stop-color="#fcfbfe"/></linearGradient></defs>
  <rect width="1200" height="630" fill="url(#paper)"/>
  ${mark}
  <path d="M450 180v270" stroke="#d7c9e7" stroke-width="2"/>
  <text x="510" y="300" fill="#251d30" font-size="82" font-weight="650" font-family="Arial,sans-serif">Wendell</text>
  <text x="515" y="372" fill="#6d587d" font-size="32" font-family="Microsoft YaHei,Noto Sans CJK SC,sans-serif">读书，买花，长大。</text>
  <text x="515" y="445" fill="#8653b3" font-size="24" font-family="Arial,sans-serif">yenchiu.com</text>
</svg>`
await writeFile(new URL('../public/images/wendell-moon-stars.svg', import.meta.url), card)
await writeFile(new URL('../public/images/wendell-moon-stars.png', import.meta.url), await sharp(Buffer.from(card)).png().toBuffer())
console.log('Exported transparent icons, ICO fallbacks and 1200x630 share card.')
