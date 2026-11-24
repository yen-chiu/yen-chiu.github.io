// Local-only publishing tool. Requires Node, Sharp and authenticated AWS CLI for --publish.
import sharp from 'sharp'
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
const [manifest,...flags]=process.argv.slice(2)
if(!manifest) throw Error('Usage: node scripts/gallery-studio.mjs manifest.json [--publish] [--backup-originals]')
const publish=flags.includes('--publish'), backup=flags.includes('--backup-originals')
const config=JSON.parse(await readFile(manifest,'utf8'))
if(!Array.isArray(config)) throw Error('Manifest must be an array')
const base=(process.env.R2_PUBLIC_URL||'https://gallery-cdn.yenchiu.com').replace(/\/$/,'')
if(!/^https:\/\/[^/]+$/.test(base)) throw Error('Invalid public URL')
if(publish){
 for(const prefix of ['R2_PUBLIC',...(backup?['R2_PRIVATE']:[])])for(const suffix of ['BUCKET','ACCESS_KEY_ID','SECRET_ACCESS_KEY'])if(!process.env[prefix+'_'+suffix])throw Error('Missing '+prefix+'_'+suffix)
 if(!/^[a-f0-9]{32}$/i.test(process.env.R2_ACCOUNT_ID||''))throw Error('Invalid R2 account ID')
 if(process.env.R2_PUBLIC_BUCKET===process.env.R2_PRIVATE_BUCKET)throw Error('Public and private buckets must differ')
 execFileSync('aws',['--version'],{stdio:'ignore'})
}
const catalogue='src/data/gallery-photos.json'
const existing=JSON.parse(await readFile(catalogue,'utf8'))
const output=resolve('.gallery-studio-output')
const upload=(file,key,privateBucket=false)=>{
 const prefix=privateBucket?'R2_PRIVATE':'R2_PUBLIC'
 const account=process.env.R2_ACCOUNT_ID
 const bucket=process.env[prefix+'_BUCKET']
 const access=process.env[prefix+'_ACCESS_KEY_ID'],secret=process.env[prefix+'_SECRET_ACCESS_KEY']
 if(!account||!bucket||!access||!secret)throw Error('Missing '+prefix+' configuration')
 execFileSync('aws',['s3','cp',file,'s3://'+bucket+'/'+key,'--endpoint-url','https://'+account+'.r2.cloudflarestorage.com','--region','auto',...(privateBucket?[]:['--content-type','image/webp','--cache-control','public,max-age=31536000,immutable'])],{stdio:'inherit',env:{...process.env,AWS_ACCESS_KEY_ID:access,AWS_SECRET_ACCESS_KEY:secret,AWS_SESSION_TOKEN:'',AWS_PROFILE:''}})
}
for(const item of config){
 if(!item.file||!item.title||!item.alt||!item.album||!/^\d{4}-\d{2}-\d{2}$/.test(item.date))throw Error('Missing required photo metadata')
 const bytes=await readFile(item.file)
 const id=createHash('sha256').update(bytes).digest('hex').slice(0,24)
 const dir=join(output,id);await mkdir(dir,{recursive:true})
 const metadata=await sharp(bytes).metadata()
 if(!metadata.width||!metadata.height)throw Error('Invalid image')
 const variants={}, variantWidths={}
 let dimensions
 for(const size of [480,960,1920,3840]){
  const name=size+'.webp', file=join(dir,name)
  const info=await sharp(bytes).rotate().resize({width:size,height:size,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toFile(file)
  if(size===3840)dimensions=info
  variantWidths[size]=info.width
  const key='photos/'+id+'/v1/'+name
  if(publish)upload(file,key)
  variants[size]=base+'/'+key
 }
 if(publish&&backup)upload(item.file,'originals/'+id+'/'+id+'.'+(metadata.format==='jpeg'?'jpg':metadata.format),true)
 const record={id,title:item.title,alt:item.alt,album:item.album,date:item.date,width:dimensions.width,height:dimensions.height,thumbnail:variants[480],preview:variants[1920],variants,variantWidths,camera:item.camera||'',caption:item.caption||'',featured:item.featured===true}
 const i=existing.findIndex(p=>p.id===id);if(i<0)existing.push(record);else existing[i]=record
}
await mkdir(output,{recursive:true})
const target=publish?catalogue:join(output,'preview-catalogue.json')
await writeFile(target+'.tmp',JSON.stringify(existing,null,2)+'\n');await rename(target+'.tmp',target)
console.log(publish?'Published catalogue; review and commit it.':'Local derivatives generated; no uploads or catalogue changes.')
