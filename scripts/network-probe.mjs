// GitHub-hosted runs are not mainland ISP measurements. No visitor telemetry
// or credentials. Security challenges are failed observations, not timings.
import {execFileSync} from 'node:child_process'
import {appendFileSync,writeFileSync,mkdtempSync,rmSync,readFileSync} from 'node:fs'
import {devNull,tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {pathToFileURL} from 'node:url'

export const paths=['/','/blog/','/gallery/','/music/','/rss.xml','/sw.js']
export function finalHeader(raw,name){
 const blocks=raw.trim().split(/\r?\n\r?\n/).filter(x=>/^HTTP\//i.test(x))
 return blocks.at(-1)?.split(/\r?\n/).find(x=>x.toLowerCase().startsWith(name.toLowerCase()+':'))?.slice(name.length+1).trim()||null
}
export function classifyResponse(status,mitigated){
 if(mitigated?.toLowerCase()==='challenge')return 'cloudflare_challenge'
 if(status>=200&&status<300)return 'success'
 if(status===401||status===403)return 'access_denied'
 if(status>=500&&status<600)return 'http_server_error'
 if(status>=400&&status<500)return 'http_client_error'
 if(status>=300&&status<400)return 'http_redirect'
 return 'http_other_error'
}
export function classifyCurlFailure(error){
 const code=error.status
 if(error.code==='ETIMEDOUT'||code===28)return 'timeout'
 if(code===5||code===6)return 'dns_error'
 if(code===7)return 'connect_error'
 if([35,51,58,59,60,66,77,80,82,83,90,91,98].includes(code))return 'tls_error'
 if(code===47)return 'redirect_error'
 if(typeof code==='number'&&code!==0)return 'transport_error'
 return 'probe_error'
}
const percentile=(values,p)=>values.length?[...values].sort((a,b)=>a-b)[Math.max(0,Math.ceil(values.length*p)-1)]:null
const counts=rows=>rows.reduce((acc,r)=>{acc[r.category]=(acc[r.category]||0)+1;return acc},{})
const rate=(success,total)=>total?Number((100*success/total).toFixed(2)):0
export function summarize(rows){
 return paths.map(path=>{
  const list=rows.filter(r=>new URL(r.url).pathname===path),ok=list.filter(r=>r.ok)
  return {path,success:ok.length,attempts:list.length,successRate:rate(ok.length,list.length),categories:counts(list),ttfbMedianMs:percentile(ok.map(r=>r.ttfbMs),.5),ttfbP95Ms:percentile(ok.map(r=>r.ttfbMs),.95),totalMedianMs:percentile(ok.map(r=>r.totalMs),.5),totalP95Ms:percentile(ok.map(r=>r.totalMs),.95)}
 })
}
export function runProbe({base='https://yenchiu.com',label='unspecified observer',samples=3,execute=execFileSync}={}){
 base=new URL(base)
 if(base.protocol!=='https:'||base.username||base.password||base.search||base.hash||base.pathname!=='/')throw Error('Use a public HTTPS origin, without path or credentials')
 if(!Number.isInteger(samples)||samples<1||samples>10)throw Error('samples must be 1-10')
 const rows=[],tmp=mkdtempSync(join(tmpdir(),'vesper-probe-'))
 try{
  for(const path of paths)for(let i=0;i<samples;i++){
   const url=new URL(path,base).href,headersPath=join(tmp,'headers.txt')
   writeFileSync(headersPath,'')
   try{
    const stdout=execute('curl',['--silent','--show-error','--location','--max-redirs','3','--proto','=https','--proto-redir','=https','--connect-timeout','8','--max-time','25','--compressed','--dump-header',headersPath,'--output',devNull,'--write-out','%{json}',url],{encoding:'utf8',timeout:30000,windowsHide:true})
    const data=JSON.parse(stdout)
    const raw=readFileSync(headersPath,'utf8'),header=name=>finalHeader(raw,name)
    const status=data.response_code,mitigated=header('cf-mitigated'),category=classifyResponse(status,mitigated)
    rows.push({url,sample:i+1,status,category,ok:category==='success',dnsMs:Math.round(data.time_namelookup*1000),connectMs:Math.round(data.time_connect*1000),tlsMs:Math.round(data.time_appconnect*1000),ttfbMs:Math.round(data.time_starttransfer*1000),totalMs:Math.round(data.time_total*1000),bytes:data.size_download,remoteIp:data.remote_ip,cache:header('cf-cache-status'),ray:header('cf-ray'),age:header('age'),cacheControl:header('cache-control'),mitigated})
   }catch(error){
    const raw=readFileSync(headersPath,'utf8')
    rows.push({url,sample:i+1,ok:false,category:classifyCurlFailure(error),curlExit:typeof error.status==='number'?error.status:null,ray:finalHeader(raw,'cf-ray'),mitigated:finalHeader(raw,'cf-mitigated'),error:'Probe failed (curl exit '+(error.status??'unavailable')+')'})
   }
  }
 }finally{rmSync(tmp,{recursive:true,force:true})}
 const success=rows.filter(r=>r.ok).length
 return {timestamp:new Date().toISOString(),observer:label,origin:base.origin,samples,totals:{attempts:rows.length,success,failed:rows.length-success,successRate:rate(success,rows.length),categories:counts(rows)},summary:summarize(rows),rows}
}
export function exitCode(report){return report.rows.some(r=>!r.ok)?1:0}
export function markdownSummary(report){
 const t=report.totals
 const lines=['## Network probe — public HTTPS observation','', 'GitHub-hosted runs are **not mainland ISP measurements**. Only successful responses contribute to latency percentiles.','', 'Success: **'+t.success+'/'+t.attempts+' ('+t.successRate+'%)**; failed: **'+t.failed+'**.','', '| Category | Samples |','| --- | ---: |',...Object.entries(t.categories).map(([k,v])=>'| '+k+' | '+v+' |'),'','| Path | Success | Challenge | Median TTFB (ms) | P95 total (ms) |','| --- | ---: | ---: | ---: | ---: |',...report.summary.map(r=>'| '+r.path+' | '+r.success+'/'+r.attempts+' | '+(r.categories.cloudflare_challenge||0)+' | '+(r.ttfbMedianMs??'—')+' | '+(r.totalP95Ms??'—')+' |')]
 const failures=report.rows.filter(r=>!r.ok)
 if(failures.length){
  lines.push('','### Failed samples (Ray ID where present)','','| Path | Sample | Category | HTTP | Ray ID |','| --- | ---: | --- | ---: | --- |')
  for(const r of failures)lines.push('| '+new URL(r.url).pathname+' | '+r.sample+' | '+r.category+' | '+(r.status??'—')+' | '+(/^[0-9a-f]+(?:-[a-z0-9]+)?$/i.test(r.ray||'')?r.ray:'—')+' |')
 }
 lines.push('','A confirmed challenge is not a successful fetch; a bare 403 does not identify the security product. Check Cloudflare Security Events using the Ray ID.','')
 return lines.join('\n')
}
function main(){
 const arg=name=>process.argv.find(x=>x.startsWith(name+'='))?.slice(name.length+1)
 const report=runProbe({base:arg('--base')||'https://yenchiu.com',label:arg('--label')||'unspecified observer',samples:Number(arg('--samples')||3)})
 writeFileSync(arg('--out')||'network-probe.json',JSON.stringify(report,null,2)+'\n')
 console.table(report.summary.map(({categories,...row})=>({...row,failures:JSON.stringify(categories)})))
 console.log('Outcome counts:',JSON.stringify(report.totals))
 if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,markdownSummary(report))
 process.exitCode=exitCode(report)
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main()
