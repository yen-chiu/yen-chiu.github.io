import {createServer} from 'node:http'
import {randomBytes} from 'node:crypto'
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {spawn} from 'node:child_process'
import sharp from 'sharp'
const port=4783, origin='http://127.0.0.1:'+port, token=randomBytes(32).toString('hex')
const html=await readFile(new URL('./gallery-studio.html',import.meta.url),'utf8')
let busy=false
const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data))}
async function body(req){
 let n=0;const chunks=[]
 for await(const c of req){n+=c.length;if(n>48*1024*1024)throw Error('File exceeds 48 MiB request limit');chunks.push(c)}
 return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}
createServer(async(req,res)=>{
 if(req.headers.host!=='127.0.0.1:'+port)return send(res,403,{error:'Invalid host'})
 if(req.method==='GET'&&req.url==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src blob: data:; connect-src 'self'; frame-ancestors 'none'"});return res.end(html.replace('__STUDIO_TOKEN__',token))}
 if(req.method!=='POST'||req.headers.origin!==origin||req.headers['x-studio-token']!==token)return send(res,403,{error:'Forbidden'})
 if(!['/preview','/publish'].includes(req.url))return send(res,404,{error:'Not found'})
 if(busy)return send(res,409,{error:'Another operation is running'})
 busy=true;let dir
 try{
 const data=await body(req)
 const bytes=Buffer.from(data.image||'','base64')
 if(!bytes.length||bytes.length>32*1024*1024)throw Error('Invalid image size')
 const meta=await sharp(bytes,{limitInputPixels:80000000}).metadata()
 if(!['jpeg','png','webp','tiff'].includes(meta.format))throw Error('Unsupported image format')
 if(req.url==='/preview'){
 const preview=await sharp(bytes,{limitInputPixels:80000000}).rotate().resize({width:960,height:960,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer()
 return send(res,200,{image:preview.toString('base64'),bytes:preview.length,width:meta.width,height:meta.height})
 }
 const item=data.metadata||{}
 for(const k of ['title','alt','album','date'])if(typeof item[k]!=='string'||!item[k].trim()||item[k].length>300)throw Error('Invalid '+k)
 if(!/^\d{4}-\d{2}-\d{2}$/.test(item.date))throw Error('Invalid date')
 dir=await mkdtemp(join(tmpdir(),'gallery-studio-'))
 const file=join(dir,'source.'+meta.format), manifest=join(dir,'manifest.json')
 await writeFile(file,bytes,{mode:0o600})
 await writeFile(manifest,JSON.stringify([{file,title:item.title,alt:item.alt,album:item.album,date:item.date,camera:String(item.camera||'').slice(0,300),caption:String(item.caption||'').slice(0,2000),featured:item.featured===true}]),{mode:0o600})
 await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[new URL('./gallery-studio.mjs',import.meta.url).pathname,manifest,'--publish',...(data.backup===true?['--backup-originals']:[])],{stdio:'inherit'});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error('Publishing failed; check local terminal')))})
 send(res,200,{ok:true})
 }catch(e){send(res,400,{error:String(e.message||e)})}finally{if(dir)await rm(dir,{recursive:true,force:true});busy=false}
}).listen(port,'127.0.0.1',()=>console.log('Gallery Studio: '+origin))
