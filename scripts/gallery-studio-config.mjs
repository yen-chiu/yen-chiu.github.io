import {readFile,writeFile,mkdir,rename,rm} from 'node:fs/promises'
import {homedir} from 'node:os'
import {join,dirname} from 'node:path'
import {randomBytes} from 'node:crypto'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'

const file=process.env.GALLERY_STUDIO_CONFIG||join(homedir(),'.yenchiu-gallery','config.json')
const fixed={R2_PUBLIC_BUCKET:'yenchiu-gallery',R2_PUBLIC_URL:'https://gallery-cdn.yenchiu.com',R2_PRIVATE_BUCKET:'yenchiu-gallery-originals'}
const keys=['R2_ACCOUNT_ID','R2_PUBLIC_ACCESS_KEY_ID','R2_PUBLIC_SECRET_ACCESS_KEY','R2_PRIVATE_ACCESS_KEY_ID','R2_PRIVATE_SECRET_ACCESS_KEY']
const envValues=()=>Object.fromEntries(keys.filter(k=>process.env[k]).map(k=>[k,process.env[k]]))
let saved={}
try{const data=JSON.parse(await readFile(file,'utf8'));saved=Object.fromEntries(keys.filter(k=>typeof data[k]==='string').map(k=>[k,data[k]]))}catch(e){if(e.code!=='ENOENT')console.warn('Gallery Studio: saved configuration unreadable; configure again.')}
let current={...envValues(),...saved}
let remembered=Object.keys(saved).length>0
function validate(data){
 if(!/^[a-f0-9]{32}$/i.test(data.R2_ACCOUNT_ID||''))throw Error('Account ID 必须是 32 位十六进制字符')
 for(const prefix of ['R2_PUBLIC','R2_PRIVATE']){
  const a=data[prefix+'_ACCESS_KEY_ID'],s=data[prefix+'_SECRET_ACCESS_KEY']
  if(prefix==='R2_PUBLIC'||a||s){
   if(typeof a!=='string'||!/^[A-Za-z0-9]{16,128}$/.test(a)||typeof s!=='string'||!/^[A-Za-z0-9+/=_-]{16,256}$/.test(s))throw Error(prefix==='R2_PUBLIC'?'请填写有效的公开桶密钥':'请完整填写私有桶密钥')
  }
 }
 return data
}
export function configStatus(){
 return {accountId:current.R2_ACCOUNT_ID||'',publicReady:!!(current.R2_ACCOUNT_ID&&current.R2_PUBLIC_ACCESS_KEY_ID&&current.R2_PUBLIC_SECRET_ACCESS_KEY),privateReady:!!(current.R2_ACCOUNT_ID&&current.R2_PRIVATE_ACCESS_KEY_ID&&current.R2_PRIVATE_SECRET_ACCESS_KEY),remembered}
}
function candidate(input){
 const next={...current}
 for(const key of keys){if(typeof input[key]==='string'&&input[key].trim())next[key]=input[key].trim()}
 return validate(next)
}
export async function saveConfig(input){
 const next=candidate(input)
 if(input.remember===true){
  await mkdir(dirname(file),{recursive:true,mode:0o700})
  const temp=file+'.'+randomBytes(8).toString('hex')+'.tmp'
  try{await writeFile(temp,JSON.stringify(next,null,2)+'\n',{mode:0o600,flag:'wx'});await rename(temp,file)}finally{await rm(temp,{force:true})}
 }else if(remembered){await rm(file,{force:true})}
 current=next;remembered=input.remember===true
 return configStatus()
}
export function publishEnv(){return {...process.env,...fixed,...current}}
const exec=promisify(execFile)
export async function testConfig(input){
 const next=candidate(input), result={}
 for(const prefix of ['R2_PUBLIC','R2_PRIVATE']){
  if(!next[prefix+'_ACCESS_KEY_ID']){result[prefix]='not-configured';continue}
  const env={...process.env,AWS_ACCESS_KEY_ID:next[prefix+'_ACCESS_KEY_ID'],AWS_SECRET_ACCESS_KEY:next[prefix+'_SECRET_ACCESS_KEY'],AWS_EC2_METADATA_DISABLED:'true',AWS_PAGER:''}
  delete env.AWS_PROFILE;delete env.AWS_SESSION_TOKEN;delete env.AWS_DEFAULT_PROFILE
  try{
   await exec('aws',['s3api','list-objects-v2','--bucket',fixed[prefix+'_BUCKET'],'--max-keys','1','--endpoint-url','https://'+next.R2_ACCOUNT_ID+'.r2.cloudflarestorage.com','--region','auto','--no-cli-pager'],{env,timeout:15000,windowsHide:true,maxBuffer:65536})
   result[prefix]='ok'
  }catch(e){result[prefix]=e.code==='ENOENT'?'aws-missing':'failed'}
 }
 return result
}
