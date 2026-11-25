// Browser test against real loopback Studio, using only synthetic images and fake keys.
import assert from 'node:assert/strict'
import {mkdtemp,readFile,writeFile,rm,mkdir} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,delimiter} from 'node:path'
import {spawn} from 'node:child_process'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
import sharp from 'sharp'
const {chromium}=createRequire(process.env.GALLERY_PLAYWRIGHT_DIR+'/package.json')('playwright')
const dir=await mkdtemp(join(tmpdir(),'studio-browser-'))
const config=join(dir,'config.json'), bin=join(dir,'bin')
const account='a'.repeat(32),access='b'.repeat(32),secret='c'.repeat(64)
const privateAccess='d'.repeat(32),privateSecret='e'.repeat(64)
const base='http://127.0.0.1:4783'
const catalogue=join(dir,'src/data/gallery-photos.json')
let child,browser
try{
 await mkdir(bin)
 await mkdir(join(dir,'src/data'),{recursive:true})
 await writeFile(catalogue,'[]\n')
 await writeFile(join(bin,'aws'),`#!/bin/sh
set -eu
if [ "$1" = --version ]; then exit 0; fi
[ "\${AWS_PROFILE+x}" != x ] && [ "\${AWS_DEFAULT_PROFILE+x}" != x ] && [ "\${AWS_SESSION_TOKEN+x}" != x ] || exit 10
if [ "$1" = s3api ]; then
 [ "$AWS_ACCESS_KEY_ID" = "${access}" ] && [ "$AWS_SECRET_ACCESS_KEY" = "${secret}" ] && [ "$2" = list-objects-v2 ]
 exit $?
fi
[ "$1" = s3 ] && [ "$2" = cp ] && [ -f "$3" ]
case "$4" in
 s3://yenchiu-gallery/photos/*/v1/*.webp) [ "$AWS_ACCESS_KEY_ID" = "${access}" ] && [ "$AWS_SECRET_ACCESS_KEY" = "${secret}" ];;
 s3://yenchiu-gallery-originals/originals/*/*.jpg) [ "$AWS_ACCESS_KEY_ID" = "${privateAccess}" ] && [ "$AWS_SECRET_ACCESS_KEY" = "${privateSecret}" ];;
 *) exit 9;;
esac
[ ! -f "$GALLERY_TEST_DIR/fail-upload" ] || exit 8
printf '%s\\n' "$4" >> "$GALLERY_TEST_DIR/uploads.log"
`,{mode:0o700})
 const env={...process.env}
 for(const key of Object.keys(env))if(key.startsWith('R2_')||key.startsWith('AWS_'))delete env[key]
 Object.assign(env,{GALLERY_TEST_DIR:dir,GALLERY_STUDIO_CONFIG:config,GALLERY_STUDIO_PORT:'4783',PATH:bin+delimiter+env.PATH,AWS_PROFILE:'unrelated-profile',AWS_DEFAULT_PROFILE:'unrelated-default-profile',AWS_SESSION_TOKEN:'unrelated-session-token'})
 child=spawn(process.execPath,[fileURLToPath(new URL('./gallery-studio-server.mjs',import.meta.url))],{env,cwd:dir,stdio:'inherit'})
 for(let i=0;i<80;i++){try{if((await fetch(base)).ok)break}catch{}if(i===79)throw Error('Studio did not start');await new Promise(r=>setTimeout(r,250))}
 assert.equal((await fetch(base+'/config/status',{method:'POST',body:'{}'})).status,403)
 assert.equal((await fetch(base+'/publish/status',{method:'POST',body:'{}'})).status,403)
 assert.equal((await fetch(base+'/albums',{method:'POST',body:'{}'})).status,403)
 browser=await chromium.launch()
 const page=await browser.newPage({viewport:{width:1280,height:900}})
 await page.goto(base)
 await page.waitForFunction(()=>document.querySelector('#connectionState').textContent.includes('尚未配置'))
 assert.equal(await page.locator('#publish').isDisabled(),true)
 assert.equal(await page.locator('html').getAttribute('data-theme'),'dark')
 await page.locator('#themeSelect').selectOption('light')
 assert.equal(await page.locator('html').getAttribute('data-theme'),'light')
 await page.locator('#themeSelect').selectOption('system')
 await page.emulateMedia({colorScheme:'light'})
 await page.waitForFunction(()=>document.documentElement.dataset.theme==='light')
 await page.locator('#themeSelect').selectOption('dark')
 await page.locator('#openSettings').click()
 const input=k=>page.locator('#configForm [name="'+k+'"]')
 await input('R2_ACCOUNT_ID').fill('invalid')
 await page.locator('#saveConfig').click()
 await page.waitForFunction(()=>document.querySelector('#configMessage').textContent.includes('32 位'))
 await input('R2_ACCOUNT_ID').fill(account)
 await input('R2_PUBLIC_ACCESS_KEY_ID').fill(access)
 await input('R2_PUBLIC_SECRET_ACCESS_KEY').fill(secret)
 await page.locator('#testConfig').click()
 await page.waitForFunction(()=>document.querySelector('#configMessage').textContent.includes('读取认证通过'))
 await input('remember').check()
 const response=page.waitForResponse(r=>r.url().endsWith('/config/save'))
 await page.locator('#saveConfig').click()
 const body=await (await response).text()
 assert(!body.includes(secret)&&!body.includes(access))
 await page.waitForFunction(()=>document.querySelector('#configMessage').textContent.includes('配置已保存'))
 assert.equal(await input('R2_PUBLIC_SECRET_ACCESS_KEY').inputValue(),'')
 assert.equal(JSON.parse(await readFile(config,'utf8')).R2_PUBLIC_SECRET_ACCESS_KEY,secret)
 await page.locator('#closeSettings').click()
 const img=await sharp({create:{width:600,height:900,channels:3,background:'#abc'}}).jpeg().toBuffer()
 await page.locator('#file').setInputFiles([{name:'one.jpg',mimeType:'image/jpeg',buffer:img},{name:'two.jpg',mimeType:'image/jpeg',buffer:img}])
 await page.waitForFunction(()=>!document.querySelector('#compress').disabled)
 await page.waitForFunction(()=>document.querySelector('#preview').naturalWidth>0)
 assert.equal(await page.locator('#queueList button').count(),2)
 assert.equal(await page.locator('#queueList button[aria-current=true] img').count(),1)
 await page.locator('#zoomIn').click()
 assert.equal(await page.locator('#viewMode').textContent(),'100%')
 await page.locator('#zoomFit').click()
 assert.equal(await page.locator('#viewMode').textContent(),'适应窗口')
 await page.locator('#originalView').click()
 await page.waitForFunction(()=>document.querySelector('#preview').src.startsWith('blob:')&&document.querySelector('#preview').complete)
 await page.locator('#originalView').click()
 await page.waitForFunction(()=>document.querySelector('#preview').src.startsWith('data:image/webp'))
 await page.locator('#form [name=title]').fill('第一张')
 const cameraText='相机: Nikon D750 · 镜头: 70-200mm f/2.8 · ISO1000 · 147mm · 1/250s · F5.6'
 await page.locator('#form [name=camera]').fill(cameraText)
 assert.deepEqual(await page.locator('#cameraFields dd').allTextContents(),['Nikon D750','70-200mm f/2.8','147mm','f/5.6','1/250s','ISO 1000'])
 assert.match(await page.locator('#cameraHelp').textContent(),/选填.*EXIF/)
 assert.equal(await page.locator('#cameraGuide').getAttribute('open'),null)
 await page.locator('#cameraGuide summary').click()
 assert.equal(await page.locator('#cameraGuide code:visible').count(),3)
 await page.locator('[data-copy-camera]').first().click()
 await page.waitForFunction(()=>/已复制示例|示例已选中/.test(document.querySelector('#cameraCopyStatus').textContent))
 assert.equal(await page.locator('#form [name=camera]').inputValue(),cameraText,'Examples must never overwrite actual metadata')
 await page.locator('#cameraGuide summary').click()

 await page.locator('#queueList button[data-index="1"]').click()
 await page.waitForFunction(()=>!document.querySelector('#compress').disabled)
 await page.locator('#form [name=title]').fill('第二张')
 await page.locator('#form [name=camera]').fill('ISO400 · 0.5s')
 assert.deepEqual(await page.locator('#cameraFields dd').allTextContents(),['0.5s','ISO 400'])
 await page.locator('#file').setInputFiles({name:'three.jpg',mimeType:'image/jpeg',buffer:img})
 await page.waitForFunction(()=>!document.querySelector('#compress').disabled)
 assert.equal(await page.locator('#queueList button').count(),3,'New import appends rather than replacing the existing queue')
 await page.locator('#queue').selectOption('0')
 await page.waitForFunction(()=>!document.querySelector('#compress').disabled)
 assert.equal(await page.locator('#form [name=title]').inputValue(),'第一张')
 assert.equal(await page.locator('#form [name=camera]').inputValue(),cameraText)
 assert.equal(await page.locator('#cameraFields dd').count(),6)
 await page.locator('#compress').click()
 await page.waitForFunction(()=>document.querySelector('#info').textContent.includes('960px'))
 await page.locator('#form [name=backup]').check()
 assert.equal(await page.locator('#publish').isDisabled(),true)
 await page.locator('#openSettings').click()
 await input('R2_PRIVATE_ACCESS_KEY_ID').fill(privateAccess)
 await input('R2_PRIVATE_SECRET_ACCESS_KEY').fill(privateSecret)
 await page.locator('#saveConfig').click()
 await page.waitForFunction(()=>document.querySelector('#connectionState').textContent.includes('私有桶已配置'))
 await page.locator('#closeSettings').click()
 await page.locator('#form [name=alt]').fill('Test portrait')
 await page.locator('#form [name=album]').fill('CI test')
 await page.locator('#form [name=date]').fill('2026-01-01')
 page.on('dialog',d=>d.accept())
 await writeFile(join(dir,'fail-upload'),'1')
 await page.locator('#publish').click()
 await page.waitForFunction(()=>document.querySelector('#queueStatus').textContent.includes('0 /')&&document.querySelector('#status').textContent.includes('Publishing failed'))
 assert.equal(await readFile(catalogue,'utf8'),'[]\n')
 assert.match(await page.locator('#progressText').textContent(),/发布未完成/)
 assert(await page.locator('#progressBar').evaluate(el=>el.value<el.max))
 await rm(join(dir,'fail-upload'))
 await page.locator('#publish').click()
 await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('上传完成'))
 const [photo]=JSON.parse(await readFile(catalogue,'utf8'))
 assert.equal(photo.title,'第一张')
 assert.equal(await page.locator('#progressBar').evaluate(el=>el.value),11)
 assert.equal(await page.locator('#progressBar').evaluate(el=>el.max),11)
 await page.waitForFunction(()=>[...document.querySelector('#albumSuggestions').options].some(o=>o.value==='CI test'))
 assert.equal(photo.camera,cameraText)
 assert.equal(photo.variantWidths[480],320)
 assert.equal(photo.width,600)
 const uploads=(await readFile(join(dir,'uploads.log'),'utf8')).trim().split('\n')
 assert.equal(uploads.length,5)
 for(const size of [480,960,1920,3840])assert(uploads.includes('s3://yenchiu-gallery/photos/'+photo.id+'/v1/'+size+'.webp'))
 assert(uploads.includes('s3://yenchiu-gallery-originals/originals/'+photo.id+'/'+photo.id+'.jpg'))
 assert(!JSON.stringify(photo).includes('yenchiu-gallery-originals'))
 console.log('Studio publish failure, retry, four public derivatives and private backup passed (fake AWS only)')
 await page.locator('#clearQueue').click()
 assert.equal(await page.locator('#queueList button').count(),0)
 await page.locator('#file').setInputFiles({name:'invalid.jpg',mimeType:'image/jpeg',buffer:Buffer.from('invalid image')})
 await page.waitForFunction(()=>document.querySelector('#status').textContent.length>0&&!document.querySelector('#file').disabled)
 assert.equal(await page.locator('#publish').isDisabled(),true)
 assert.equal(await page.locator('#compress').isDisabled(),true)
 await page.setViewportSize({width:390,height:844})
 await page.reload()
 await page.waitForFunction(()=>document.querySelector('#connectionState').textContent.includes('公开桶与私有桶已配置'))
 await page.locator('#openSettings').click()
 assert.equal(await input('R2_PUBLIC_SECRET_ACCESS_KEY').inputValue(),'')
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
 assert.equal(await page.evaluate(()=>localStorage.length),0)
 await page.locator('#closeSettings').click()
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
 console.log('Studio desktop/mobile settings, preview queue, credential handling and rejection checks passed (fake AWS only)')
}finally{
 await browser?.close()
 if(child){const exited=new Promise(r=>child.once('exit',r));if(child.exitCode===null&&child.signalCode===null){child.kill();await exited}}
 await rm(dir,{recursive:true,force:true})
}
