// Verify the real rendered player, using a local synthetic silent audio response.
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
const {chromium}=createRequire(process.env.MUSIC_PLAYWRIGHT_DIR+'/package.json')('playwright')
const base='http://127.0.0.1:4321'
const rate=8000, frames=rate*12
const wav=Buffer.alloc(44+frames*2)
wav.write('RIFF',0);wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8)
wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22)
wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34)
wav.write('data',36);wav.writeUInt32LE(frames*2,40)
for(let i=0;i<60;i++){try{if((await fetch(base+'/music/')).ok)break}catch{}if(i===59)throw Error('Preview unavailable');await new Promise(r=>setTimeout(r,500))}
const browser=await chromium.launch()
try{
 for(const mobile of [false,true]){
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile,reducedMotion:'no-preference',serviceWorkers:'block'})
  let requests=0
  await context.route('https://commons.wikimedia.org/wiki/Special:Redirect/file/**',route=>{requests++;return route.fulfill({status:200,contentType:'audio/wav',body:wav,headers:{'access-control-allow-origin':'*'}})})
  const page=await context.newPage()
  await page.goto(base+'/music/')
  const player=page.locator('vesper-music-player')
  const arm=player.locator('.music-tonearm.has-tonearm-asset')
  const vinyl=player.locator('.music-vinyl')
  await arm.waitFor()
  await page.waitForFunction(()=>customElements.get('vesper-music-player')&&window.wendellAppearance)
  if(mobile)assert.equal(await page.locator('html').getAttribute('data-effect-quality'),'low')
  assert.equal(requests,0,'Audio must not load until play is clicked')
  assert.equal(await vinyl.evaluate(el=>getComputedStyle(el).animationPlayState),'paused')
  assert.equal(await arm.evaluate(el=>getComputedStyle(el).transitionDuration),'0.9s')
  const angle=()=>arm.evaluate(el=>{const m=new DOMMatrixReadOnly(getComputedStyle(el).transform);return Math.atan2(m.b,m.a)*180/Math.PI})
  assert(Math.abs(await angle()+29)<.1)
  const checkIntermediate=async()=>page.waitForFunction(()=>{const el=document.querySelector('.music-tonearm.has-tonearm-asset');const m=new DOMMatrixReadOnly(getComputedStyle(el).transform);const a=Math.atan2(m.b,m.a)*180/Math.PI;return a>-26&&a<-3})
  await player.locator('[data-play]').click()
  await checkIntermediate()
  await page.waitForFunction(()=>{const el=document.querySelector('.music-vinyl');const a=el.getAnimations()[0];return a?.playState==='running'&&a.currentTime>100})
  await page.waitForFunction(()=>{const m=new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.music-tonearm.has-tonearm-asset')).transform);return Math.abs(Math.atan2(m.b,m.a))<.002})
  await player.locator('[data-play]').click()
  await checkIntermediate()
  await page.waitForFunction(()=>{const m=new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.music-tonearm.has-tonearm-asset')).transform);return Math.abs(Math.atan2(m.b,m.a)*180/Math.PI+29)<.1})
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('.music-vinyl')).animationPlayState==='paused')
  const pausedTime=await vinyl.evaluate(el=>el.getAnimations()[0].currentTime)
  await page.waitForTimeout(150)
  assert.equal(await vinyl.evaluate(el=>el.getAnimations()[0].currentTime),pausedTime)
  await page.evaluate(()=>window.wendellAppearance.set({motion:'reduced'}))
  assert.equal(await vinyl.evaluate(el=>getComputedStyle(el).animationName),'none')
  assert.equal(await arm.evaluate(el=>getComputedStyle(el).transitionProperty),'none')
  assert(requests>0)
  console.log(mobile?'Mobile vinyl and tonearm playback/reduced-motion passed':'Desktop vinyl and tonearm playback/reduced-motion passed')
  await context.close()
 }
}finally{await browser.close()}
