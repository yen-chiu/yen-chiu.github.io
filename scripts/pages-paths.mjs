import { readdir, readFile, writeFile } from 'node:fs/promises'
const base = '/yen-chiu-astro'
async function walk(dir) {
 for (const entry of await readdir(dir, {withFileTypes:true})) {
  const path = `${dir}/${entry.name}`
  if (entry.isDirectory()) { await walk(path); continue }
  if (!/\.(html|js|css|json|xml|txt)$/.test(path)) continue
  let text = await readFile(path,'utf8')
  text = text.replace(/(["'`(=])\/(?!\/|yen-chiu-astro(?:\/|["'`?#]))(?=[a-zA-Z_]|["'`])/g, `$1${base}/`)
  await writeFile(path,text)
 }
}
await walk('dist')
