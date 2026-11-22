import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

const source=await readFile(new URL('../src/components/appearance/appearance-bootstrap.js',import.meta.url),'utf8')
function boot(saved=new Map()){
  const styles=new Map(),classes=new Set(),dataset={}
  const document=new EventTarget()
  document.documentElement={style:{setProperty:(k,v)=>styles.set(k,v)},dataset,classList:{toggle:(k,on)=>on?classes.add(k):classes.delete(k)}}
  const media=new EventTarget();media.matches=false
  const window=new EventTarget()
  const context=vm.createContext({window,document,localStorage:{getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v)},matchMedia:()=>media,CustomEvent})
  vm.runInContext(source,context)
  return {api:window.wendellAppearance,styles,classes,dataset,saved,document,media,again:()=>vm.runInContext(source,context)}
}
const one=boot(new Map([['chat-unrelated','preserve']]))
assert.equal(one.dataset.wallpaper,'banner')
one.api.set({hue:0,theme:'dark',wallpaper:'overlay',layout:'grid',title:false,waves:true})
assert.equal(one.styles.get('--brand-hue'),'0')
assert.ok(one.classes.has('dark'))
const two=boot(one.saved)
assert.equal(two.dataset.postLayout,'grid')
assert.equal(two.dataset.bannerTitle,'false')
assert.equal(two.dataset.bannerWaves,'true')
two.api.set({theme:'light'})
two.media.matches=true;two.media.dispatchEvent(new Event('change'))
assert.ok(!two.classes.has('dark'),'OS preference must not override an explicit light choice')
two.api.set({theme:'system'});assert.ok(two.classes.has('dark'))
two.api.reset();assert.equal(two.api.get().hue,267)
assert.equal(two.saved.get('chat-unrelated'),'preserve')
two.dataset.wallpaper='wrong';two.document.dispatchEvent(new Event('astro:page-load'))
assert.equal(two.dataset.wallpaper,'banner')
two.again();assert.equal(two.api.get().hue,267)
// 银墨开场是 WebGL 效果，默认关闭，只有访客自己打开才会加载着色器。
assert.equal(one.api.get().silverInk,false)
one.api.set({silverInk:true})
const ink=boot(one.saved)
assert.equal(ink.api.get().silverInk,true)
ink.api.reset()
assert.equal(ink.api.get().silverInk,false)
for(const value of ['{broken','null','42','{"hue":"invalid","layout":"unknown"}']){
 const safe=boot(new Map([['wendell-appearance-v1',value]]))
 assert.equal(safe.api.get().hue,267);assert.equal(safe.dataset.postLayout,'list')
}
one.api.set({hue:999});assert.equal(one.api.get().hue,360)
one.api.set({hue:-99});assert.equal(one.api.get().hue,0)
// Independently convert generated HSL tokens and verify readable foregrounds
// throughout the whole slider, including yellow/green's high luminance.
function luminance(h,s,l){
 h/=360;s/=100;l/=100
 const q=l<.5?l*(1+s):l+s-l*s,p=2*l-q
 const channel=t=>{t=(t+1)%1;const c=t<1/6?p+(q-p)*6*t:t<.5?q:t<2/3?p+(q-p)*(2/3-t)*6:p;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4}
 return channel(h+1/3)*.2126+channel(h)*.7152+channel(h-1/3)*.0722
}
for(let hue=0;hue<=360;hue++){
 one.api.set({hue})
 const [h,s,l]=one.styles.get('--primary-light').match(/[\d.]+/g).map(Number)
 assert.ok(1.05/(luminance(h,s,l)+.05)>=5.2-1e-6,`Contrast failed at hue ${hue}`)
}
console.log('Appearance persistence, storage recovery, theme behavior and 361 hue contrast checks passed')

// Existing wallpaper preferences survive while the old combined hidden mode
// migrates into independent home-cover and inner-page background controls.
const legacyHidden=boot(new Map([['wendell-appearance-v1',JSON.stringify({wallpaper:'hidden',hue:165,theme:'dark',layout:'grid'})]]))
assert.equal(legacyHidden.dataset.wallpaper,'banner')
assert.equal(legacyHidden.dataset.homeCover,'false')
assert.equal(legacyHidden.api.get().hue,165)
assert.equal(legacyHidden.api.get().layout,'grid')
for(const wallpaper of ['banner','fullscreen','overlay']){
 const existing=boot(new Map([['wendell-appearance-v1',JSON.stringify({wallpaper})]]))
 assert.equal(existing.dataset.wallpaper,wallpaper)
 assert.equal(existing.dataset.homeCover,'true')
 existing.api.set({cover:false})
 assert.equal(existing.dataset.wallpaper,wallpaper)
 const reloaded=boot(existing.saved)
 assert.equal(reloaded.dataset.homeCover,'false')
 reloaded.api.set({wallpaper:'overlay'})
 assert.equal(reloaded.dataset.homeCover,'false')
 reloaded.api.reset()
 assert.equal(reloaded.dataset.homeCover,'true')
}
console.log('Legacy background migration and independent cover persistence passed')
