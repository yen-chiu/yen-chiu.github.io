import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {execFileSync} from 'node:child_process'
import sharp from 'sharp'
const script=fileURLToPath(new URL('./gallery-studio.mjs',import.meta.url))
test('portrait preview preserves actual widths and never publishes',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'gallery-test-'))
 try{
 await mkdir(join(dir,'src/data'),{recursive:true})
 await writeFile(join(dir,'src/data/gallery-photos.json'),'[]')
 await sharp({create:{width:300,height:600,channels:3,background:'#456'}}).jpeg().toFile(join(dir,'source.jpg'))
 await writeFile(join(dir,'manifest.json'),JSON.stringify([{file:'source.jpg',title:'Test',alt:'Test image',album:'Test',date:'2026-01-01'}]))
 execFileSync(process.execPath,[script,'manifest.json'],{cwd:dir})
 const [p]=JSON.parse(await readFile(join(dir,'.gallery-studio-output/preview-catalogue.json'),'utf8'))
 assert.equal(p.variantWidths[480],240)
 assert.equal(p.variantWidths[3840],300)
 assert.equal(p.height,600)
 assert.equal(await readFile(join(dir,'src/data/gallery-photos.json'),'utf8'),'[]')
 const meta=await sharp(join(dir,'.gallery-studio-output',p.id,'480.webp')).metadata()
 assert.equal(meta.width,240);assert.equal(meta.exif,undefined)
 }finally{await rm(dir,{recursive:true,force:true})}
})
