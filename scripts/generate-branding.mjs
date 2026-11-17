// Deterministic favicon/share-card exports from the user-provided transparent PNG.
// Keep page portraits separate. Run with: node scripts/generate-branding.mjs
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import sharp from 'sharp'
const iconDirectory=new URL('../public/favicon/',import.meta.url)
const source=await readFile(new URL('wendell-avatar-source.png',iconDirectory))
const sizes=[16,32,48,64,128,180,192,256,512],frames=[]
await mkdir(new URL('../public/images/',import.meta.url),{recursive:true})
for(const size of sizes){
 const buffer=await sharp(source).resize(size,size,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer()
 await writeFile(new URL(`wendell-avatar-${size}.png`,iconDirectory),buffer)
 if([16,32,48,64,128,256].includes(size))frames.push({size,buffer})
}
// PNG-backed ICO frames preserve alpha in every supported size (256 is encoded as 0).
const directory=Buffer.alloc(6+frames.length*16)
directory.writeUInt16LE(1,2);directory.writeUInt16LE(frames.length,4)
let offset=directory.length
frames.forEach(({size,buffer},index)=>{
 const entry=6+index*16;directory[entry]=size===256?0:size;directory[entry+1]=size===256?0:size
 directory.writeUInt16LE(1,entry+4);directory.writeUInt16LE(32,entry+6)
 directory.writeUInt32LE(buffer.length,entry+8);directory.writeUInt32LE(offset,entry+12);offset+=buffer.length
})
await writeFile(new URL('wendell-avatar.ico',iconDirectory),Buffer.concat([directory,...frames.map(f=>f.buffer)]))
const portrait=await sharp(source).resize(460,460).png().toBuffer()
const card=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<defs><linearGradient id="paper" x2="1" y2="1"><stop stop-color="#eee8f7"/><stop offset="1" stop-color="#fff6f2"/></linearGradient></defs>
<rect width="1200" height="630" fill="url(#paper)"/>
<circle cx="260" cy="315" r="205" fill="#ffffff" fill-opacity=".4"/>
<image x="30" y="80" width="460" height="460" href="data:image/png;base64,${portrait.toString('base64')}"/>
<path d="M510 180v270" stroke="#d7c9e7" stroke-width="2"/>
<text x="565" y="300" fill="#251d30" font-size="82" font-weight="650" font-family="Arial,sans-serif">Wendell</text>
<text x="570" y="372" fill="#6d587d" font-size="32" font-family="Microsoft YaHei,Noto Sans CJK SC,sans-serif">读书，买花，长大。</text>
<text x="570" y="445" fill="#8653b3" font-size="24" font-family="Arial,sans-serif">yenchiu.com</text></svg>`
await writeFile(new URL('../public/images/wendell-avatar-card.svg',import.meta.url),card)
await writeFile(new URL('../public/images/wendell-avatar-card.png',import.meta.url),await sharp(Buffer.from(card)).png().toBuffer())
console.log('Exported transparent PNG/ICO icons and the 1200x630 share card from the supplied avatar.')
