from pathlib import Path
import json,re,hashlib
r=Path(__file__).resolve().parents[1]; source=r.parent/'yen-chiu.github.io'
m=json.loads((r/'migration/content-manifest.json').read_text(encoding='utf-8'))
assert len(m)==len(list((source/'_posts').glob('*.md')))==17
for row in m:
 assert hashlib.sha256((source/row['source']).read_bytes()).hexdigest()==row['sha256']
 assert (r/row['destination']).exists()
text=(r/'src/migration-persona.html').read_text(encoding='utf-8')
assets=re.findall(r'(?:src|href)="(/assets/[^"?#]+)',text)
missing=[a for a in assets if not (r/'public'/a.lstrip('/')).exists()]
assert not missing,missing
assert not re.search(r'\{[{%]',text)
print(json.dumps({'articles':len(m),'persona_asset_references':len(assets),'missing_persona_assets':missing},ensure_ascii=False))
