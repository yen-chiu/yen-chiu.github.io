from pathlib import Path
import json,re,shutil,hashlib
import yaml
root=Path(__file__).resolve().parents[1]
source=root.parent/'yen-chiu.github.io'
manifest=[]
for group in ('blog','docs'):
    folder=root/'src/content'/group
    target=root/'migration/upstream-examples'/group
    if folder.exists() and not target.exists():
        target.parent.mkdir(parents=True,exist_ok=True)
        shutil.move(str(folder),str(target))
    folder.mkdir(parents=True,exist_ok=True)
for index,p in enumerate(sorted((source/'_posts').glob('*.md')),1):
    raw=p.read_text(encoding='utf-8-sig'); _,fm,body=raw.split('---',2); meta=yaml.safe_load(fm)
    slug='post-'+p.name[:10]+'-'+str(index).zfill(2)
    body=re.sub(r'\{\{\s*site.media_base\s*\}\}', 'https://media.yenchiu.com',body)
    body=re.sub(r'\{\{\s*site.baseurl\s*\}\}', '',body)
    body=re.sub(r"\{% include embed/bilibili.html id='([^']+)' %\}",r'[在哔哩哔哩观看](https://www.bilibili.com/video/\1/)',body)
    # Keep old post links on the live site until every original permalink is mapped.
    body=re.sub(r'(?<=[(\"\'])/posts/', 'https://yenchiu.com/posts/',body)
    body=re.sub(r'!\[([^\]]*)\]\((https?://[^\s)]+)(?:\s+"[^"]*")?\)',r'<img src="\2" alt="\1" loading="lazy">',body)
    converted={'title':str(meta['title']),'description':str(meta.get('description',meta['title']))[:160], 'publishDate':str(meta.get('date',p.name[:10])), 'tags':list(dict.fromkeys(meta.get('tags',[])+meta.get('categories',[]))), 'slug':slug,'draft':bool(meta.get('hidden',False)), 'comment':False}
    out=root/'src/content/blog'/('/'.join(meta.get('categories',[])) or '未分类')/f'{slug}.md'
    out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text('---\n'+yaml.safe_dump(converted,allow_unicode=True,sort_keys=False)+'---\n'+body,encoding='utf-8')
    manifest.append({'source':str(p.relative_to(source)), 'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'destination':str(out.relative_to(root)),'url':'/blog/'+slug,'originalMetadata':meta})
for folder in ('img','files','media'):
    src=source/'assets'/folder
    if src.exists(): shutil.copytree(src,root/'public/assets'/folder,dirs_exist_ok=True)
shutil.copy2(source/'avatar.png',root/'src/assets/avatar.png')
(root/'migration/content-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2,default=str)+'\n',encoding='utf-8')
print('Migrated',len(manifest),'posts')
