// Trusted deploy only. Token must be scoped to Cache Purge on the site zone.
import {readFile} from 'node:fs/promises'
const token=process.env.CF_CACHE_PURGE_TOKEN
const zone=process.env.CF_ZONE_ID
if(!token||!zone||!/^[a-f0-9]{32}$/i.test(zone))throw Error('Missing or invalid scoped Cloudflare configuration')
const urls=JSON.parse(await readFile('cache-purge-urls.json','utf8'))
if(!Array.isArray(urls)||!urls.length||urls.length>10000)throw Error('Invalid purge manifest')
for(const value of urls){
 const url=new URL(value)
 if(url.origin!=='https://yenchiu.com'||url.username||url.password||url.search||url.hash||/^\/(?:_astro|folio|echora|studio|api)(?:\/|$)/i.test(decodeURIComponent(url.pathname)))throw Error('Unexpected purge URL')
}
for(let i=0;i<urls.length;i+=50){
 const batch=urls.slice(i,i+50)
 let ok=false
 for(let attempt=0;attempt<3;attempt++){
  const response=await fetch('https://api.cloudflare.com/client/v4/zones/'+zone+'/purge_cache',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({files:batch}),signal:AbortSignal.timeout(15000),redirect:'error'})
  const data=await response.json()
  if(response.ok&&data.success){ok=true;break}
  if(response.status!==429&&response.status<500)throw Error('Cloudflare rejected purge: HTTP '+response.status)
  await new Promise(resolve=>setTimeout(resolve,Math.min(30000,1000*2**attempt)))
 }
 if(!ok)throw Error('Cache purge failed after retries; check Cloudflare dashboard')
 console.log('Purge accepted '+Math.min(i+batch.length,urls.length)+' / '+urls.length)
 await new Promise(resolve=>setTimeout(resolve,300))
}
