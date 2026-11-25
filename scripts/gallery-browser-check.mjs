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
 return {id,title,alt:title,album,date:'2026-01-0'+(3-i),width,height,thumbnail:variants[480],preview:variants[1920],variants,variantWidths,featured:i===0,caption:'CI fixture',camera:i===0?'147mm  F5.6  1/250s  ISO1000':i===1?'相机: Nikon D750 · 镜头: 70-200mm f/2.8 · ISO400 · 0.5s · 未记录焦距':'ISO200'}
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
 // Encode all fixture images before routing: no async image work can outlive a navigation.
 const fixtureImages=new Map()
 for(const row of rows){
  for(const size of [480,960,1920,3840]){
   fixtureImages.set(row.variants[size],await sharp({create:{width:row.width,height:row.height,channels:3,background:'#778899'}}).resize({width:size,height:size,fit:'inside',withoutEnlargement:true}).webp().toBuffer())
  }
 }
 const browser=await chromium.launch({headless:true})
 try{
 for(const mobile of [false,true]){
 const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile,serviceWorkers:'block'})
 // One handler per context; switch fixture behavior rather than replacing live routes.
 let failImages=false
 await context.route('https://gallery-cdn.yenchiu.com/**',route=>{
  const body=fixtureImages.get(route.request().url())
  return failImages||!body
   ? route.abort()
   : route.fulfill({status:200,contentType:'image/webp',body})
 })
 const page=await context.newPage()
 await page.emulateMedia({reducedMotion:'reduce'})
 const requested=[]
 page.on('request',req=>{if(req.url().startsWith('https://gallery-cdn.yenchiu.com/'))requested.push(req.url())})
 await page.goto(base+'/')
 const cover=page.locator('.home-cover')
 const feature=page.locator('.photo-feature')
 assert.equal(await cover.locator('img[src*="gallery-cdn"]').count(),0)
 assert.equal(await page.locator('.hero-art svg').count(),1)
 assert.equal(await feature.getAttribute('href'),'/gallery/photo/'+rows[0].id+'/')
 assert.equal(await feature.locator('img').getAttribute('loading'),'lazy')
 assert.equal(await page.locator('.guide-card').count(),3)
 assert.equal(await page.locator('.home-stats dd').nth(1).textContent(),'3')
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
 assert.equal(await page.evaluate(()=>{const r=document.querySelector('.primary-reading').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight}),true)
 assert.equal(await page.evaluate(()=>document.querySelector('.home-photography').getBoundingClientRect().top>innerHeight),true)
 // Exercise normal motion, not just the reduced-motion smoke path.
 if(mobile){
  await page.emulateMedia({reducedMotion:'no-preference'})
  await page.waitForFunction(()=>customElements.get('landing-hero')&&document.querySelector('.home-cover').style.height)
  const sample=async fraction=>page.evaluate(async fraction=>{
   const track=document.querySelector('landing-hero')
   const cover=track.querySelector('.home-cover')
   const ruler=track.querySelector('.hero-compact-measure')
   const name=track.querySelector('h1')
   const actions=track.querySelector('.cover-actions')
   const credit=track.querySelector('.cover-credit')
   const end=Math.max(0,scrollY+track.getBoundingClientRect().top)+track.offsetHeight-ruler.offsetHeight
   window.scrollTo({top:Math.round(end*fraction),behavior:'instant'})
   const frame=()=>new Promise(resolve=>requestAnimationFrame(resolve))
   await frame();await frame();await frame()
   const read=()=>({height:cover.offsetHeight,opacity:Number(name.style.opacity),transform:name.style.transform,visibility:name.style.visibility,actions:Number(actions.style.opacity),credit:Number(credit.style.opacity)})
   const first=read()
   for(let i=0;i<8;i++)await frame()
   return {first,last:read()}
  },fraction)
  let previous={height:Infinity,opacity:1}
  for(const fraction of [0,.2,.45,.7,.85,1]){
   const {first,last}=await sample(fraction)
   assert.deepEqual(first,last,'Mobile cover must not rebound or flicker after scrolling stops')
   assert(last.height<=previous.height&&last.opacity<=previous.opacity,'Collapse must be monotonic')
   if(last.credit>.02)assert(last.actions<.02,'Wallpaper credit must not overlap hero actions')
   previous=last
  }
  assert.equal(previous.opacity,0)
  assert.equal(previous.visibility,'hidden')
  let expanded=previous
  for(const fraction of [.85,.5,0]){
   const {first,last}=await sample(fraction)
   assert.deepEqual(first,last,'Reverse scroll must settle without rebound')
   assert(last.height>=expanded.height&&last.opacity>=expanded.opacity)
   expanded=last
  }
  assert.equal(expanded.opacity,1)
  await page.emulateMedia({reducedMotion:'reduce'})
 }
 const hint=page.locator('[data-collapse]')
 await hint.click()
 await page.waitForFunction(()=>document.querySelector('landing-hero')?.classList.contains('is-collapsed'))
 await feature.scrollIntoViewIfNeeded()
 await page.waitForFunction(()=>{const img=document.querySelector('.photo-feature img');return img?.complete&&img.naturalWidth>0})
 assert(requested.some(url=>/\/(480|960)\.webp$/.test(url)))
 assert(requested.every(url=>/\/(480|960)\.webp$/.test(url)),'Homepage must not download full-size gallery assets')
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
 await page.goto('about:blank')
 failImages=true
 await page.goto(base+'/')
 await page.locator('.photo-feature').scrollIntoViewIfNeeded()
 await page.locator('.photo-feature.is-image-unavailable').waitFor()
 await page.evaluate(()=>window.scrollTo(0,0))
 await page.locator('.primary-reading').waitFor({state:'visible'})
 await page.goto('about:blank')
 failImages=false
 console.log(mobile?'Homepage mobile editorial smoke test passed':'Homepage desktop editorial smoke test passed')
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
 const checkDetail=async row=>{
  await page.waitForFunction(()=>{const img=document.querySelector('.work-image img');return img?.complete&&img.naturalWidth>0})
  assert.equal(await page.locator('.work-image img').getAttribute('src'),row.preview)
  assert.equal(await page.locator('.full-link').getAttribute('href'),row.variants[3840])
  assert.deepEqual(await page.locator('.camera-settings dd').allTextContents(),row===rows[0]?['147mm','f/5.6','1/250s','ISO 1000']:['Nikon D750','70-200mm f/2.8','0.5s','ISO 400'])
  if(row===rows[1])assert.equal(await page.locator('.camera-fallback').textContent(),'未记录焦距')
  const layout=await page.evaluate(()=>{
   const rect=selector=>document.querySelector(selector).getBoundingClientRect()
   const img=document.querySelector('.work-image img')
   const r=img.getBoundingClientRect()
   return {heading:rect('.work-heading').toJSON(),figure:rect('.work-figure').toJSON(),info:rect('.work-info').toJSON(),ratio:r.width/r.height,natural:img.naturalWidth/img.naturalHeight,noOverflow:document.documentElement.scrollWidth<=innerWidth}
  })
  assert(layout.noOverflow,'Photo detail must not overflow horizontally')
  assert(Math.abs(layout.ratio/layout.natural-1)<.025,'Photography composition must preserve its aspect ratio')
  if(mobile){
   assert(layout.heading.bottom<=layout.figure.top&&layout.figure.bottom<=layout.info.top,'Mobile detail must follow heading, photograph, information order')
  }else{
   assert(layout.figure.right<=layout.heading.left&&layout.heading.bottom<=layout.info.top,'Desktop detail must show photo left, information right')
  }
 }
 await checkDetail(rows[0])
 await page.locator('nav[aria-label="相册作品导航"] a').click()
 await page.waitForURL('**/gallery/photo/'+rows[1].id+'/**')
 assert.equal(await page.locator('h1').textContent(),'竖幅测试')
 await checkDetail(rows[1])
 await context.close()
 console.log(mobile?'Mobile viewport smoke test passed':'Desktop smoke test passed')
 }
 }finally{await browser.close()}
}
