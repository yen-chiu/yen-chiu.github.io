// CI-only fixture and browser smoke test. Never publish these records or assets.
import {writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
const catalogue=new URL('../src/data/gallery-photos.json',import.meta.url)
const rows=[['a','横幅测试','山野',1200,800],['b','竖幅测试','山野',600,900],['c','另一专题','城市',800,800]].map(([key,title,album,width,height],i)=>{
 const id=key.repeat(24),variants={},variantWidths={}
 for(const size of [480,960,1920,3840]){
  variants[size]='https://gallery-cdn.yenchiu.com/photos/'+id+'/v1/'+size+'.webp'
  variantWidths[size]=Math.min(width,Math.round(width*size/Math.max(width,height)))
 }
 return {id,title,alt:title,album,date:'2026-01-0'+(3-i),width,height,thumbnail:variants[480],preview:variants[1920],variants,variantWidths,featured:i===0,caption:'CI fixture'}
})
if(process.argv.includes('--fixture')){
 if(process.env.CI!=='true')throw Error('Fixture generation is CI-only')
 await writeFile(catalogue,JSON.stringify(rows,null,2)+'\n')
}else{
 const prefix=process.env.GALLERY_PLAYWRIGHT_DIR
 if(!prefix)throw Error('Set GALLERY_PLAYWRIGHT_DIR to the isolated Playwright installation')
 const {chromium}=createRequire(prefix+'/package.json')('playwright')
 const sharp=(await import('sharp')).default
 const base='http://127.0.0.1:4321'
 const albumId=createHash('sha256').update('山野').digest('hex').slice(0,20)
 for(let i=0;i<60;i++){try{if((await fetch(base+'/gallery/')).ok)break}catch{}if(i===59)throw Error('Preview unavailable');await new Promise(r=>setTimeout(r,500))}
 const browser=await chromium.launch({headless:true})
 try{
 for(const mobile of [false,true]){
 const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile,serviceWorkers:'block'})
 await context.route('https://gallery-cdn.yenchiu.com/**',async route=>{
  const row=rows.find(p=>route.request().url().includes(p.id))
  const size=Number(route.request().url().match(/\/(\d+)\.webp$/)?.[1])
  if(!row||!size)return route.abort()
  const body=await sharp({create:{width:row.width,height:row.height,channels:3,background:'#778899'}}).resize({width:size,height:size,fit:'inside',withoutEnlargement:true}).webp().toBuffer()
  await route.fulfill({status:200,contentType:'image/webp',body})
 })
 const page=await context.newPage()
 await page.goto(base+'/gallery/')
 const wall=page.locator('.wall figure')
 assert.equal(await wall.count(),3)
 await page.locator('button[data-album="山野"]').click()
 assert.equal(await page.locator('.wall figure:visible').count(),2)
 await wall.first().locator('[data-photo]').click()
 await page.locator('dialog[open]').waitFor()
 await page.waitForFunction(()=>{const img=document.querySelector('[data-full]');return img?.complete&&img.naturalWidth>0})
 assert.equal(await page.locator('[data-title-out]').textContent(),'横幅测试')
 await page.locator('[data-next]').click()
 assert.equal(await page.locator('[data-title-out]').textContent(),'竖幅测试')
 if(!mobile){await page.keyboard.press('ArrowLeft');assert.equal(await page.locator('[data-title-out]').textContent(),'横幅测试')}
 await page.locator('[data-close]').click()
 assert.equal(await page.locator('dialog[open]').count(),0)
 await page.waitForFunction(()=>document.activeElement===document.querySelector('.wall figure [data-photo]'))
 await page.goto(base+'/gallery/album/'+albumId+'/')
 assert.equal(await page.locator('h1').textContent(),'山野')
 assert.equal(await page.locator('.wall figure').count(),2)
 await page.locator('.wall figure a').first().click()
 await page.waitForURL('**/gallery/photo/'+rows[0].id+'/**')
 assert.equal(await page.locator('h1').textContent(),'横幅测试')
 await page.locator('nav[aria-label="相册作品导航"] a').click()
 await page.waitForURL('**/gallery/photo/'+rows[1].id+'/**')
 assert.equal(await page.locator('h1').textContent(),'竖幅测试')
 await context.close()
 console.log(mobile?'Mobile viewport smoke test passed':'Desktop smoke test passed')
 }
 }finally{await browser.close()}
}
