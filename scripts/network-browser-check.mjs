// Real Chromium check of a built site, never calls third-party services.
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {readdir,readFile} from 'node:fs/promises'
import {join,relative} from 'node:path'
import {createServer,request as httpRequest} from 'node:http'
import {once} from 'node:events'
const {chromium}=createRequire(process.env.NETWORK_PLAYWRIGHT_DIR+'/package.json')('playwright')
const base='http://127.0.0.1:4321'
for(let i=0;i<60;i++){
 try{if((await fetch(base+'/')).ok)break}catch{}
 if(i===59)throw Error('Preview unavailable')
 await new Promise(r=>setTimeout(r,500))
}
async function findArticle(dir){
 for(const item of await readdir(dir,{withFileTypes:true})){
  const file=join(dir,item.name)
  if(item.isDirectory()){const result=await findArticle(file);if(result)return result}
  else if(file.endsWith('index.html')&&(await readFile(file,'utf8')).includes('data-load-comments'))return file
 }
}
const article=await findArticle('dist/blog')
assert(article,'A real article with comments is required')
const articlePath='/'+relative('dist',article).replaceAll('\\','/').split('/').map(encodeURIComponent).join('/').replace(/index\.html$/,'')
const browser=await chromium.launch({headless:true})
try{
 const context=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844},isMobile:true,hasTouch:true})
 let commentRequests=0
 await context.route('**/*',route=>{
  const url=new URL(route.request().url())
  if(url.origin===base)return route.continue()
  if(url.hostname==='giscus.app')commentRequests++
  return route.abort()
 })
 const page=await context.newPage()
 await page.goto(base+'/')
 await page.waitForFunction(()=>!!window.wendellAppearance)
 await page.evaluate(()=>window.wendellAppearance.set({network:'saving'}))
 assert.equal(await page.locator('html').getAttribute('data-network-mode'),'saving')
 assert.equal(await page.locator('html').getAttribute('data-animated-avatar'),'false')
 const folder=page.locator('[data-category-open], a[href="#category-browser"]').first()
 await folder.evaluate(el=>el.click())
 await page.waitForFunction(()=>document.querySelector('[data-category-browser-overlay]')?.open)
 await page.waitForFunction(()=>document.querySelector('[data-category-browser-overlay]')?.dataset.initialized==='true')
 await page.locator('[data-category-browser-close]').click()
 await page.goto(base+articlePath)
 const comments=page.locator('[data-load-comments]')
 await comments.waitFor()
 assert.equal(commentRequests,0,'No comment requests before explicit click')
 await comments.click()
 await page.waitForFunction(()=>document.querySelector('[data-comment-status]')?.textContent?.includes('暂时无法加载'))
 assert(commentRequests>0,'Explicit comment click must request service')
 assert.equal(await comments.isEnabled(),true)
 await context.close()
 // Real SW: Chromium's offline emulation can leave loopback reachable from
 // a service worker. Use a test-only loopback origin that forwards to the
 // unchanged preview server, then drops transport connections on demand.
 // Do not mock the worker, cache, navigation response or status code.
 let disconnected=false
 const dropped=new Set()
 const proxy=createServer((req,res)=>{
  if(disconnected){
   dropped.add(req.url)
   req.socket.destroy()
   return
  }
  const upstream=httpRequest(new URL(req.url,base),{
   method:req.method,headers:{...req.headers,host:new URL(base).host}
  },response=>{
   res.writeHead(response.statusCode,response.headers)
   response.pipe(res)
  })
  upstream.on('error',()=>res.destroy())
  req.on('aborted',()=>upstream.destroy())
  res.on('close',()=>{if(!res.writableEnded)upstream.destroy()})
  req.pipe(upstream)
 })
 proxy.listen(0,'127.0.0.1')
 await once(proxy,'listening')
 const offlineBase='http://127.0.0.1:'+proxy.address().port
 const offline=await browser.newContext({serviceWorkers:'allow'})
 try{
  const offlinePage=await offline.newPage()
  const missingPath='/blog/vesper-uncached-offline-test/'
  await offlinePage.goto(offlineBase+'/')
  await offlinePage.evaluate(()=>navigator.serviceWorker.ready)
  await offlinePage.waitForFunction(()=>!!navigator.serviceWorker.controller)
  await offlinePage.goto(offlineBase+'/blog/')
  await offlinePage.waitForFunction(async()=>!!(await caches.match(location.href)),{},{timeout:20000})
  // A genuine online 404 must stay a 404, not a fabricated offline page.
  const online404=await offlinePage.goto(offlineBase+missingPath,{waitUntil:'domcontentloaded'})
  assert.equal(online404?.status(),404)
  assert.equal(await offlinePage.evaluate(async()=>!!(await caches.match(location.href))),false)
  disconnected=true
  const cached=await offlinePage.goto(offlineBase+'/blog/',{waitUntil:'domcontentloaded'})
  assert.equal(cached?.status(),200)
  assert.equal(cached?.fromServiceWorker(),true,'Cached navigation must come from the worker')
  assert(dropped.has('/blog/'),'Cached page must attempt network first')
  const missing=await offlinePage.goto(offlineBase+missingPath,{waitUntil:'domcontentloaded'})
  assert.equal(missing?.status(),503)
  assert.equal(missing?.fromServiceWorker(),true,'Offline fallback must come from the worker')
  assert(dropped.has(missingPath),'Uncached navigation must experience transport failure')
  assert.match(await offlinePage.locator('body').innerText(),/暂时离线/)
  disconnected=false
  const restored=await offlinePage.goto(offlineBase+'/blog/',{waitUntil:'domcontentloaded'})
  assert.equal(restored?.status(),200)
  assert.equal(await offlinePage.locator('html').count(),1)
 }finally{
  await offline.close()
  proxy.closeAllConnections()
  await new Promise(resolve=>proxy.close(resolve))
 }
 console.log('Network UI and offline navigation regression passed')
}finally{await browser.close()}
