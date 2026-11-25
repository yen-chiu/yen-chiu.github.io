// Run on your own machine or a trusted regional runner. GitHub-hosted runs
// are not mainland ISP measurements. No visitor telemetry or credentials.
import {execFileSync} from 'node:child_process'
import {writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {mkdtempSync,rmSync,readFileSync} from 'node:fs'
const arg=name=>process.argv.find(x=>x.startsWith(name+'='))?.slice(name.length+1)
const base=new URL(arg('--base')||'https://yenchiu.com')
if(base.protocol!=='https:'||base.username||base.password||base.search||base.hash||base.pathname!=='/')throw Error('Use a public HTTPS origin, without path or credentials')
const label=arg('--label')||'unspecified observer'
const samples=Number(arg('--samples')||3)
if(!Number.isInteger(samples)||samples<1||samples>10)throw Error('samples must be 1-10')
const paths=['/','/blog/','/gallery/','/music/','/rss.xml','/sw.js']
const rows=[]
const tmp=mkdtempSync(join(tmpdir(),'vesper-probe-'))
try{
 for(const path of paths)for(let i=0;i<samples;i++){
  const url=new URL(path,base).href
  const headersPath=join(tmp,'headers.txt'), bodyPath=join(tmp,'body')
  try{
   const stdout=execFileSync('curl',['--silent','--show-error','--location','--max-redirs','3','--proto','=https','--proto-redir','=https','--connect-timeout','8','--max-time','25','--compressed','--dump-header',headersPath,'--output',bodyPath,'--write-out','%{json}',url],{encoding:'utf8',timeout:30000,windowsHide:true})
   const data=JSON.parse(stdout)
   const blocks=readFileSync(headersPath,'utf8').trim().split(/\r?\n\r?\n/).filter(x=>/^HTTP\//i.test(x))
   const final=blocks.at(-1)||''
   const header=name=>final.split(/\r?\n/).find(x=>x.toLowerCase().startsWith(name+':'))?.slice(name.length+1).trim()||null
   rows.push({url,sample:i+1,status:data.response_code,ok:data.response_code>=200&&data.response_code<300,dnsMs:Math.round(data.time_namelookup*1000),connectMs:Math.round(data.time_connect*1000),tlsMs:Math.round(data.time_appconnect*1000),ttfbMs:Math.round(data.time_starttransfer*1000),totalMs:Math.round(data.time_total*1000),bytes:data.size_download,remoteIp:data.remote_ip,cache:header('cf-cache-status'),ray:header('cf-ray'),age:header('age'),cacheControl:header('cache-control')})
  }catch(error){rows.push({url,sample:i+1,ok:false,error:'curl failed (exit '+(error.status??'timeout')+')'})}
 }
}finally{rmSync(tmp,{recursive:true,force:true})}
const percentile=(values,p)=>values.length?[...values].sort((a,b)=>a-b)[Math.max(0,Math.ceil(values.length*p)-1)]:null
const summary=paths.map(path=>{
 const list=rows.filter(r=>new URL(r.url).pathname===path),ok=list.filter(r=>r.ok)
 return {path,success:ok.length,attempts:list.length,ttfbMedianMs:percentile(ok.map(r=>r.ttfbMs),.5),ttfbP95Ms:percentile(ok.map(r=>r.ttfbMs),.95),totalMedianMs:percentile(ok.map(r=>r.totalMs),.5),totalP95Ms:percentile(ok.map(r=>r.totalMs),.95)}
})
const report={timestamp:new Date().toISOString(),observer:label,origin:base.origin,samples,summary,rows}
writeFileSync(arg('--out')||'network-probe.json',JSON.stringify(report,null,2)+'\n')
console.table(summary)
if(rows.some(r=>!r.ok))process.exitCode=1
