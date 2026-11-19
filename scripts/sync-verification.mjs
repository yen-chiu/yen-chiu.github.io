// Refresh the standalone /verify/ page from the maintained Inhuman checkout:
// node scripts/sync-verification.mjs ../Inhuman/FOCUS
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

if (!process.argv[2]) throw new Error('Pass the local Inhuman/FOCUS source directory')
const source = resolve(process.argv[2])
const target = fileURLToPath(new URL('../public/verify/', import.meta.url))
const html = await readFile(join(source, 'FOCUS.html'), 'utf8')
if (!html.includes('BV1UT42167xb')) throw new Error('Unexpected verification source')
await mkdir(target, { recursive: true })
await writeFile(join(target, 'index.html'), html)
await cp(join(source, 'verification.css'), join(target, 'verification.css'))
await cp(join(source, 'images'), join(target, 'images'), { recursive: true })
console.log('Synced the standalone verification page and its local assets to public/verify/')
