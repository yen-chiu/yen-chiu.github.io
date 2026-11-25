import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
const read = path => readFileSync(path,'utf8')
const source = read('public/sw.js')
function request(path, extra={}) {
  return {url:new URL(path,'https://yenchiu.com').href, method:'GET', headers:new Headers(), cache:'default', mode:'navigate', ...extra}
}
function worker() {
  const handlers={}
  const context=vm.createContext({self:{location:{origin:'https://yenchiu.com'},addEventListener:(name,cb)=>handlers[name]=cb},URL,Headers,Response,Blob})
  vm.runInContext(source,context)
  return {classify:r=>context.classify(r),eligible:(r,b,n)=>context.eligible(r,b,n)}
}
test('cache scopes are explicit and exclude private paths and refresh queries',()=>{
  const {classify}=worker()
  assert.equal(classify(request('/blog/example/')),'vesper-offline-v2-pages')
  assert.equal(classify(request('/_astro/main.abc123.js',{mode:'cors'})),'vesper-offline-v2-assets')
  for(const path of ['/folio/','/echora/','/studio/','/api/','/links-status.json','/contentIndex.json','/sw.js','/blog/?v=1','https://gallery-cdn.yenchiu.com/photos/a.webp','https://giscus.app/'])assert.equal(classify(request(path)),null,path)
  assert.equal(classify(request('/blog/',{cache:'reload'})),null)
  assert.equal(classify(request('/_astro/a.js',{mode:'cors',headers:new Headers({range:'bytes=0-2'})})),null)
})
test('private and oversized responses cannot be persisted',()=>{
  const {eligible}=worker()
  const response=(headers={},extra={})=>({status:200,type:'basic',redirected:false,headers:new Headers({'content-type':'text/html',...headers}),...extra})
  assert.equal(eligible(response(),1024,'vesper-offline-v2-pages'),true)
  assert.equal(eligible(response({'cache-control':'private'}),1024,'vesper-offline-v2-pages'),false)
  assert.equal(eligible(response({'content-length':'2048'}),1024,'vesper-offline-v2-pages'),false)
  assert.equal(eligible(response({}, {status:404}),1024,'vesper-offline-v2-pages'),false)
})
test('cross-origin preconnects and eager comments are removed; click routes remain',()=>{
  const head=read('src/components/BaseHead.astro')
  assert.doesNotMatch(head,/rel='(?:preconnect|dns-prefetch)'[^\n]*https:\/\//)
  const giscus=read('src/components/giscus/Giscus.astro')
  assert.match(giscus,/data-load-comments/)
  assert.doesNotMatch(giscus,/requestIdleCallback|IntersectionObserver/)
  assert.match(read('astro.config.ts'),/defaultStrategy: 'tap'/)
  assert.match(read('src/components/categories/CategoryBrowserOverlay.astro'),/import\('\.\/category-browser-overlay'\)/)
})
test('network auto respects saveData and manual override',()=>{
  const window=new EventTarget(), document=new EventTarget(), media=new EventTarget(), connection=new EventTarget()
  window.innerWidth=390;connection.saveData=true;connection.effectiveType='4g';media.matches=false
  document.documentElement={dataset:{},classList:{toggle(){}},style:{setProperty(){}}}
  vm.runInNewContext(read('src/components/appearance/appearance-bootstrap.js'),{window,document,navigator:{hardwareConcurrency:8,connection},localStorage:{getItem:()=>null,setItem(){}},matchMedia:()=>media,CustomEvent})
  assert.equal(document.documentElement.dataset.networkMode,'saving')
  window.wendellAppearance.set({network:'standard'})
  assert.equal(document.documentElement.dataset.networkMode,'standard')
  window.wendellAppearance.set({network:'saving'})
  assert.equal(document.documentElement.dataset.networkMode,'saving')
  window.wendellAppearance.set({network:'auto'})
  connection.saveData=false;connection.effectiveType='4g';connection.dispatchEvent(new Event('change'))
  assert.equal(document.documentElement.dataset.networkMode,'standard')
})
