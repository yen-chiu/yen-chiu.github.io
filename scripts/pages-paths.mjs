import { readdir, readFile, writeFile } from 'node:fs/promises'
import ts from 'typescript'
// 2026-11 起部署在根域，不再需要给 dist 补前缀；保留脚本与调用点以便将来回退子路径。
export const base = ''
const route = /^\/(?:_astro|assets|favicon|images|blog|tags|categories|archives|docs|search|persona|about|projects|links|terms|journal|contentIndex\.json|rss\.xml|robots\.txt)(?:[/.?#]|$)/
export function prefix(value) { return base && route.test(value) ? base + value : value }
export function rewriteJavaScript(text) {
 if (!base) return text
 const source = ts.createSourceFile('bundle.js', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
 const edits=[]
 function visit(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node)) {
   const start=node.getStart(source)+1
   const value=text.slice(start,node.end-(ts.isTemplateHead(node)?2:1))
   if (route.test(value)) edits.push(start)
  }
  ts.forEachChild(node,visit)
 }
 visit(source)
 for(const pos of edits.sort((a,b)=>b-a)) text=text.slice(0,pos)+base+text.slice(pos)
 return text
}
async function walk(dir) {
 for(const entry of await readdir(dir,{withFileTypes:true})) {
  const path=`${dir}/${entry.name}`
  if(entry.isDirectory()) {await walk(path);continue}
  if(!/\.(html|js|css|json|xml|txt)$/.test(path)) continue
  let text=await readFile(path,'utf8')
  if(path.endsWith('.js')) text=rewriteJavaScript(text)
  else if(path.endsWith('.json')) {
   text=JSON.stringify(JSON.parse(text),(_,value)=>typeof value==='string'?prefix(value):value)
  } else if(path.endsWith('.html')) {
   text=text.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi,(_,open,body,close)=>open+rewriteJavaScript(body)+close)
   text=text.replace(/(\b(?:href|src|action|poster)=["'])(\/[^"']*)(["'])/gi,(_,start,url,end)=>start+(url==='/'?base+'/':prefix(url))+end)
   text=text.replace(/(srcset=["'])([^"']*)(["'])/gi,(_,start,urls,end)=>start+urls.replace(/\/[^\s,]+/g,url=>prefix(url))+end)
  } else if(path.endsWith('.css')) {
   text=text.replace(/url\((["']?)(\/[^)'"\s]+)\1\)/g,(_,quote,url)=>`url(${quote}${prefix(url)}${quote})`)
  }

  await writeFile(path,text)
 }
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/pages-paths.mjs')) await walk('dist')
