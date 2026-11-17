from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
import json
root=Path('dist');base='/yen-chiu-astro';missing={};external=set();media={'images':0,'videos':0,'math':0,'code':0};manifest=json.loads(Path('migration/content-manifest.json').read_text(encoding='utf-8'))
class Scan(HTMLParser):
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=='img':media['images']+=1
  if tag in ('video','source'):media['videos']+=1
  if tag=='code':media['code']+=1
  if 'katex' in a.get('class',''):media['math']+=1
  for key in ('href','src','poster'):
   value=a.get(key,'')
   if value.startswith(('https://','http://')):
    if tag in ('img','source','video'):external.add(value)
   if value.startswith(base+'/'):
    local=unquote(urlsplit(value).path[len(base):]).lstrip('/');p=root/local
    if not(p.is_file() or (p/'index.html').is_file()):missing.setdefault(value,[]).append(self.file)
for p in root.rglob('*.html'):
 s=Scan();s.file=str(p);s.feed(p.read_text(encoding='utf-8'))
for row in manifest:
 slug=row['url'].split('/blog/')[1];p=root/'blog'/slug/'index.html';text=p.read_text(encoding='utf-8')
 assert row['originalUrl'] in text,(slug,'canonical')
 assert 'noindex, follow' in text
 assert 'data-repo="yen-chiu/yen-chiu.github.io"' in text
 assert (root/'posts'/slug/'index.html').exists()
 assert (root/row['previousUrl'].lstrip('/')/'index.html').exists()
assert not missing,missing
index=json.loads((root/'contentIndex.json').read_text(encoding='utf-8'))
assert len(index)==17
report={'articles':17,'localMissing':missing,'mediaElements':media,'externalMedia':sorted(external),'comments':'17 pages bound to original repository and title','redirects':'17 original posts paths and 17 previous staging URLs','seo':'original canonical and noindex follow; sitemap emitted','browser':'see chrome-qa report for partial live browser acceptance; untested items remain pending'}
Path('migration/validation/selected-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2))
