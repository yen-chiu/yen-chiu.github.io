import {createServer} from 'node:http'
import {randomBytes} from 'node:crypto'
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {spawn} from 'node:child_process'
import sharp from 'sharp'
import {fileURLToPath} from 'node:url'
import {safeExif} from './gallery-exif.mjs'
import {configStatus,saveConfig,testConfig,publishEnv} from './gallery-studio-config.mjs'
const port=Number(process.env.GALLERY_STUDIO_PORT||4783), origin='http://127.0.0.1:'+port, token=randomBytes(32).toString('hex')
const html=await readFile(new URL('./gallery-studio.html',import.meta.url),'utf8')
const cameraParser=await readFile(new URL('../src/lib/gallery-camera.mjs',import.meta.url),'utf8')
let busy=false, progress=null
const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data))}
async function body(req){
 let n=0;const chunks=[]
 for await(const c of req){n+=c.length;if(n>48*1024*1024)throw Error('File exceeds 48 MiB request limit');chunks.push(c)}
 return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}
createServer(async(req,res)=>{
 if(req.headers.host!=='127.0.0.1:'+port)return send(res,403,{error:'Invalid host'})
 if(req.method==='GET'&&req.url==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'unsafe-inline'; img-src blob: data:; connect-src 'self'; frame-ancestors 'none'"});return res.end(html.replace('__STUDIO_TOKEN__',token))}
 if(req.method==='GET'&&req.url==='/camera-parser.mjs'){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return res.end(cameraParser)}
 if(req.method!=='POST'||req.headers.origin!==origin||req.headers['x-studio-token']!==token)return send(res,403,{error:'Forbidden'})
 if(!['/preview','/publish','/publish/status','/albums','/config/status','/config/save','/config/test'].includes(req.url))return send(res,404,{error:'Not found'})
 if(req.url==='/publish/status'){
  try{const data=await body(req);return send(res,200,{progress:typeof data.id==='string'&&progress?.id===data.id?progress:null})}catch{return send(res,400,{error:'Invalid status request'})}
 }
 if(req.url==='/albums'){
  try{
   await body(req)
   const catalogue=JSON.parse(await readFile('src/data/gallery-photos.json','utf8'))
   return send(res,200,{albums:[...new Set(catalogue.map(p=>p.album).filter(a=>typeof a==='string'&&a.trim()))].sort((a,b)=>a.localeCompare(b,'zh-CN'))})
  }catch{return send(res,400,{error:'无法读取本地相册索引'})}
 }
 if(busy)return send(res,409,{error:'Another operation is running'})
 busy=true;let dir
 try{
 const data=await body(req)

 if(req.url==='/publish'){
  const id=typeof data.id==='string'&&/^[a-f0-9-]{36}$/i.test(data.id)?data.id:null
  progress={id,done:0,total:data.backup===true?11:10,label:'正在验证照片与发布信息'}
 }
 if(req.url==='/config/status')return send(res,200,configStatus())
 if(req.url==='/config/save')return send(res,200,await saveConfig(data))
 if(req.url==='/config/test')return send(res,200,await testConfig(data))
 if(req.url==='/publish'&&(!configStatus().publicReady||(data.backup===true&&!configStatus().privateReady)))throw Error('请先配置所需的 R2 存储桶')
 const bytes=Buffer.from(data.image||'','base64')
 if(!bytes.length||bytes.length>32*1024*1024)throw Error('Invalid image size')
 const meta=await sharp(bytes,{limitInputPixels:80000000}).metadata()
 if(!['jpeg','png','webp','tiff'].includes(meta.format))throw Error('Unsupported image format')
 if(req.url==='/preview'){
 const {data:preview,info:previewInfo}=await sharp(bytes,{limitInputPixels:80000000}).rotate().resize({width:960,height:960,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer({resolveWithObject:true})
 const thumbnail=await sharp(preview).resize({width:120,height:120,fit:'inside',withoutEnlargement:true}).webp({quality:70}).toBuffer()
 return send(res,200,{image:preview.toString('base64'),thumbnail:thumbnail.toString('base64'),bytes:preview.length,width:meta.width,height:meta.height,format:meta.format,previewWidth:previewInfo.width,previewHeight:previewInfo.height,exif:safeExif(meta.exif)})
 }
 const item=data.metadata||{}
 for(const k of ['title','alt','album','date'])if(typeof item[k]!=='string'||!item[k].trim()||item[k].length>300)throw Error('Invalid '+k)
 if(!/^\d{4}-\d{2}-\d{2}$/.test(item.date))throw Error('Invalid date')
 dir=await mkdtemp(join(tmpdir(),'gallery-studio-'))
 const file=join(dir,'source.'+meta.format), manifest=join(dir,'manifest.json')
 await writeFile(file,bytes,{mode:0o600})
 await writeFile(manifest,JSON.stringify([{file,title:item.title,alt:item.alt,album:item.album,date:item.date,camera:String(item.camera||'').slice(0,300),caption:String(item.caption||'').slice(0,2000),featured:item.featured===true}]),{mode:0o600})
 progress.done=1;progress.label='照片与发布信息已验证，正在生成衍生图片'
 await new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,[fileURLToPath(new URL('./gallery-studio.mjs',import.meta.url)),manifest,'--publish',...(data.backup===true?['--backup-originals']:[])],{stdio:['ignore','inherit','inherit','ipc'],env:publishEnv()})
  const labels={generated:'已生成 WebP',uploaded:'已上传公开图片',backup:'已备份导入文件至私有桶',catalogue:'本地照片索引已更新'}
  child.on('message',message=>{
   if(!message||!Object.hasOwn(labels,message.stage))return
   const size=[480,960,1920,3840].includes(message.size)?' · '+message.size+'px':''
   progress.done=Math.min(progress.total,progress.done+1)
   progress.label=labels[message.stage]+size
  })
  child.on('error',reject);child.on('close',code=>code===0?resolve():reject(Error('Publishing failed; check local terminal')))
 })
 progress.done=progress.total;progress.label='发布完成 · 请审查并提交 Git 索引'
 send(res,200,{ok:true,progress})
 }catch(e){if(req.url==='/publish'&&progress)progress.label='发布未完成 · '+String(e.message||e);send(res,400,{error:String(e.message||e)})}finally{if(dir)await rm(dir,{recursive:true,force:true});busy=false}
}).listen(port,'127.0.0.1',()=>console.log('Gallery Studio: '+origin))
