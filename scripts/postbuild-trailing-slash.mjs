// 构建后把站内页面链接统一补上尾斜杠。
// GitHub Pages 是目录式托管：/blog/x 会 301 到 /blog/x/，页面里若写 /blog/x，
// 每次点击都要多一跳；Astro 的 trailingSlash 只影响 canonical 与路由，不会改写
// 组件里手写的 href，所以在这里统一收口。
//
// 只改「确实存在 dist/<path>/index.html」的链接，避免误伤 /CNAME、/rss.xml 之类
// 没有扩展名但不是页面的路径；查询串与 hash 原样保留。
// 同时处理 Astro 为旧链接生成的 <meta http-equiv="refresh" content="0;url=/x"> 桩。

import { existsSync } from 'node:fs'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve('dist')
let hrefRewrites = 0
let redirectRewrites = 0

const splitTail = (value) => {
  const cuts = [value.indexOf('#'), value.indexOf('?')].filter((n) => n >= 0)
  if (!cuts.length) return [value, '']
  const cut = Math.min(...cuts)
  return [value.slice(0, cut), value.slice(cut)]
}

const decode = (value) => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

const isPage = (pathPart) => existsSync(path.join(root, decode(pathPart), 'index.html'))

const slashable = (value) => {
  if (!value.startsWith('/') || value.startsWith('//')) return null
  const [pathPart, tail] = splitTail(value)
  if (pathPart === '/' || pathPart.endsWith('/')) return null
  if (!isPage(pathPart)) return null
  return `${pathPart}/${tail}`
}

const walk = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...(await walk(full)))
    else if (entry.name.endsWith('.html')) files.push(full)
  }
  return files
}

const files = await walk(root)
for (const file of files) {
  const html = await readFile(file, 'utf8')
  let next = html.replace(/href=(["'])([^"']*)\1/g, (whole, quote, value) => {
    const replaced = slashable(value)
    if (!replaced) return whole
    hrefRewrites++
    return `href=${quote}${replaced}${quote}`
  })
  next = next.replace(/(<meta[^>]*http-equiv=["']refresh["'][^>]*content=["'])([^"']*)(["'])/i, (whole, head, content, tail) => {
    const rewritten = content.replace(/url=([^;"']+)/i, (match, value) => {
      const replaced = slashable(value)
      if (!replaced) return match
      redirectRewrites++
      return `url=${replaced}`
    })
    return rewritten === content ? whole : `${head}${rewritten}${tail}`
  })
  if (next !== html) await writeFile(file, next)
}

console.log(
  `Trailing-slash rewrite: ${hrefRewrites} page links + ${redirectRewrites} redirect targets normalised across ${files.length} HTML files`
)
