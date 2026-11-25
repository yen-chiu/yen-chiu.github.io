// Create exact public URLs from the deployed build. Do not purge the entire zone.
import {readdir,writeFile} from 'node:fs/promises'
import {join,relative} from 'node:path'
const origin='https://yenchiu.com'
const urls=new Set()
async function walk(dir){
 for(const entry of await readdir(dir,{withFileTypes:true})){
  const path=join(dir,entry.name)
  const rel=relative('dist',path).replaceAll('\\','/')
  if(/^(?:_astro|folio|echora|studio|api)(?:\/|$)/i.test(rel)||rel.startsWith('.'))continue
  if(entry.isDirectory())await walk(path)
  else if(entry.isFile()&&/\.(?:html|xml|json|js|css|txt|webmanifest|png|jpg|jpeg|svg|webp|gif|ico|avif)$/i.test(rel)){
   const encoded=rel.split('/').map(encodeURIComponent).join('/')
   urls.add(origin+'/'+encoded)
   if(encoded==='index.html'||encoded.endsWith('/index.html'))urls.add(origin+'/'+encoded.slice(0,-'index.html'.length))
  }
 }
}
await walk('dist')
if(!urls.has(origin+'/'))throw Error('Root HTML missing from build')
await writeFile('cache-purge-urls.json',JSON.stringify([...urls].sort())+'\n')
console.log('Exact public URLs: '+urls.size)
