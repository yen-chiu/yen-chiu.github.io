// Real Chromium check of a built site, never calls third-party services.
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {readdir,readFile} from 'node:fs/promises'
import {join,relative} from 'node:path'
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
 // Real SW: no interception of same-origin resources. A separate context
 // avoids Playwright request routing disabling the normal browser cache.
 const offline=await browser.newContext({serviceWorkers:'allow'})
 const offlinePage=await offline.newPage()
 await offlinePage.goto(base+'/')
 await offlinePage.evaluate(()=>navigator.serviceWorker.ready)
 await offlinePage.waitForFunction(()=>!!navigator.serviceWorker.controller)
 await offlinePage.goto(base+'/blog/')
 await offlinePage.waitForFunction(async()=>!!(await caches.match(location.href)),{},{timeout:20000})
 await offline.setOffline(true)
 const cached=await offlinePage.goto(base+'/blog/',{waitUntil:'domcontentloaded'})
 assert.equal(cached?.status(),200)
 const missing=await offlinePage.goto(base+'/blog/vesper-uncached-offline-test/',{waitUntil:'domcontentloaded'})
 assert.equal(missing?.status(),503)
 assert.match(await offlinePage.locator('body').innerText(),/暂时离线/)
 await offline.setOffline(false)
 await offlinePage.goto(base+'/blog/')
 assert.equal(await offlinePage.locator('html').count(),1)
 await offline.close()
 console.log('Network UI and offline navigation regression passed')
}finally{await browser.close()}
