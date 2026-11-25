// Scan built HTML for third-party requests and measure generated page size.
// This is a static inventory, not a browser waterfall or live network result.
import {readdir,readFile,writeFile} from 'node:fs/promises'
import {join,relative} from 'node:path'
import {gzipSync} from 'node:zlib'
import {load} from 'cheerio'
const origin='https://yenchiu.com'
const rows=[], hosts=new Map()
async function walk(dir) {
 for(const item of await readdir(dir,{withFileTypes:true})){
  const file=join(dir,item.name)
  if(item.isDirectory())await walk(file)
  else if(item.isFile()&&file.endsWith('.html')){
   const body=await readFile(file), $=load(body)
   const page=relative('dist',file).replaceAll('\\','/')
   const urls=new Set()
   const track=(raw,kind)=>{
    if(!raw)return
    try{
     const url=new URL(raw,origin)
     if(!['https:','http:'].includes(url.protocol)||url.origin===origin)return
     urls.add(url.origin)
     if(!hosts.has(url.origin))hosts.set(url.origin,{count:0,kinds:new Set(),pages:new Set()})
     const entry=hosts.get(url.origin);entry.count++;entry.kinds.add(kind);entry.pages.add(page)
    }catch{}
   }
   $('script[src],img[src],iframe[src],audio[src],video[src],video[poster],source[src],embed[src],object[data],link[href]').each((_,el)=>{
    const node=$(el),tag=el.tagName
    if(tag==='link'&&!/stylesheet|preconnect|dns-prefetch|preload|prefetch|modulepreload|icon/i.test(node.attr('rel')||''))return
    track(node.attr('src')||node.attr('poster')||node.attr('data')||node.attr('href'),tag==='link'?'link:'+node.attr('rel'):tag)
   })
   $('[srcset]').each((_,el)=>{for(const part of ($(el).attr('srcset')||'').split(','))track(part.trim().split(/\s+/)[0],'srcset')})
   rows.push({page,htmlBytes:body.length,gzipBytes:gzipSync(body).length,externalOrigins:[...urls].sort()})
  }
 }
}
await walk('dist')
const report={type:'static build inventory; excludes runtime JS and CSS imports',pages:rows.sort((a,b)=>b.gzipBytes-a.gzipBytes),external:[...hosts.entries()].map(([host,e])=>({host,occurrences:e.count,kinds:[...e.kinds],pages:e.pages.size})).sort((a,b)=>b.occurrences-a.occurrences)}
await writeFile('network-build-audit.json',JSON.stringify(report,null,2)+'\n')
console.table(report.external);console.table(report.pages.slice(0,10))
