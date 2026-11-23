/**
 * Avatar Studio runs on a separate Cloudflare Worker behind Access, NOT on
 * publicly served GitHub Pages. It revalidates signed Access JWTs itself.
 * No GitHub credentials are ever sent to the browser.
 */
const REPOSITORY = 'yen-chiu/yen-chiu.github.io'
const TARGET_PATH = 'src/assets/avatar.png'
const TARGET_BRANCH = 'feature/avatar-studio'
const MAX_BYTES = 4 * 1024 * 1024
const encoder = new TextEncoder()
const noStore = { 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'none'; img-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; form-action 'none'; frame-ancestors 'none'; base-uri 'none'" }

const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { ...noStore, 'Content-Type': 'application/json; charset=utf-8' }
})
function decode(part) {
  const binary = atob(part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '='))
  return Uint8Array.from(binary, ch => ch.charCodeAt(0))
}
function audienceMatches(aud, expected) {
  return Array.isArray(aud) ? aud.includes(expected) : aud === expected
}
async function authorize(request, env) {
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD || !env.OWNER_EMAIL || !env.GITHUB_TOKEN) {
    throw new Error('Avatar Studio is not configured')
  }
  const token = request.headers.get('cf-access-jwt-assertion')
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  let header, payload
  try {
    header = JSON.parse(new TextDecoder().decode(decode(parts[0])))
    payload = JSON.parse(new TextDecoder().decode(decode(parts[1])))
  } catch { return null }
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') return null
  const teamDomain = String(env.ACCESS_TEAM_DOMAIN).replace(/^https:\/\//, '').replace(/\/+$/, '')
  if (!/^[a-z0-9.-]+\.cloudflareaccess\.com$/i.test(teamDomain)) throw new Error('Invalid Access domain')
  if (payload.iss !== 'https://' + teamDomain || !audienceMatches(payload.aud, env.ACCESS_AUD)) return null
  if (typeof payload.exp !== 'number' || payload.exp <= Date.now()/1000 ||
      typeof payload.nbf === 'number' && payload.nbf > Date.now()/1000 ||
      typeof payload.iat === 'number' && payload.iat > Date.now()/1000 + 60) return null
  if (String(payload.email || '').toLowerCase() !== String(env.OWNER_EMAIL).toLowerCase()) return null
  const keysResponse = await fetch('https://' + teamDomain + '/cdn-cgi/access/certs')
  if (!keysResponse.ok) throw new Error('Access certificate fetch failed')
  const certs = await keysResponse.json()
  const jwk = (certs.keys || []).find(key => key.kid === header.kid && key.kty === 'RSA')
  if (!jwk) return null
  const key = await crypto.subtle.importKey('jwk', jwk, {name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256'}, false, ['verify'])
  const signature = decode(parts[2])
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, encoder.encode(parts[0] + '.' + parts[1]))
  return valid ? payload : null
}
function validatePng(buffer) {
  const bytes = new Uint8Array(buffer)
  if (bytes.length < 33 || bytes.length > MAX_BYTES) throw new Error('PNG must be 4 MB or smaller')
  const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10]
  if (!pngSignature.every((value, index) => bytes[index] === value)) throw new Error('Not a PNG image')
  const view = new DataView(buffer)
  if (view.getUint32(8) !== 13 || String.fromCharCode(...bytes.slice(12,16)) !== 'IHDR') throw new Error('Malformed PNG header')
  const width = view.getUint32(16), height = view.getUint32(20)
  if (width < 128 || height < 128 || width > 2048 || height > 2048 || width !== height) {
    throw new Error('Use a square PNG between 128px and 2048px')
  }
  if (![2, 3, 6].includes(bytes[25]) || bytes[24] !== 8) {
    throw new Error('Use an 8-bit RGB, indexed or RGBA PNG')
  }
  if (bytes[26] !== 0 || bytes[27] !== 0 || bytes[28] !== 0) throw new Error('Unsupported PNG encoding')
  // PNG ends with a zero-length IEND chunk (length, type and CRC).
  if (bytes.length < 45 || view.getUint32(bytes.length - 12) !== 0 ||
      String.fromCharCode(...bytes.slice(-8, -4)) !== 'IEND') throw new Error('Incomplete PNG')
  return { width, height }
}
function base64(bytes) {
  let result = ''
  for (let i = 0; i < bytes.length; i += 8192) {
    result += String.fromCharCode(...bytes.subarray(i, i + 8192))
  }
  return btoa(result)
}
async function github(env, method, body) {
  const endpoint = 'https://api.github.com/repos/' + REPOSITORY + '/contents/' + TARGET_PATH
  const response = await fetch(endpoint + (method === 'GET' ? '?ref=' + encodeURIComponent(TARGET_BRANCH) : ''), {
    method,
    headers: { 'Authorization': 'Bearer ' + env.GITHUB_TOKEN,
      'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'Vesper-Avatar-Studio', ...(body ? {'Content-Type': 'application/json'} : {}) },
    body: body ? JSON.stringify(body) : undefined
  })
  if (!response.ok) throw new Error('GitHub request failed: HTTP ' + response.status)
  return response.json()
}
const HTML = String.raw`<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Avatar Studio · Vesper</title>
<style>
:root{color-scheme:light dark;font-family:ui-sans-serif,system-ui,-apple-system,"PingFang SC",sans-serif;background:#f3f4f6;color:#18202c}
*{box-sizing:border-box}body{margin:0;padding:24px}main{max-width:960px;margin:2rem auto}header{display:flex;align-items:baseline;justify-content:space-between;gap:1rem;flex-wrap:wrap}
h1{font-size:clamp(1.6rem,4vw,2.3rem);letter-spacing:-.04em;margin:0}.sub{color:#6b7280;font-size:.9rem}section{background:#fff;border:1px solid #e1e5eb;border-radius:18px;padding:24px;margin:18px 0}
.preview{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}.portrait{width:min(100%,220px);aspect-ratio:1;border-radius:50%;display:block;margin:20px auto;object-fit:contain;background:repeating-conic-gradient(#eceef2 0% 25%,#fff 0% 50%) 50%/22px 22px}
.animated.on{animation:float 2.88s ease-in-out infinite}@keyframes float{0%,100%{transform:translateY(0)}25%{transform:translateY(2px)}75%{transform:translateY(-2px)}}@media(prefers-reduced-motion:reduce){.animated.on{animation:none}}
figure{margin:0;text-align:center}figcaption{font-size:.83rem;color:#6b7280}
.upload{display:block;border:1.5px dashed #aab5c2;border-radius:12px;padding:24px;text-align:center;cursor:pointer}
.upload:focus-within{outline:2px solid #64748b}input[type=file]{max-width:100%}
.actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:24px}button{border-radius:10px;border:1px solid #aab5c2;padding:12px 18px;background:#fafafa;color:#1f2937;font-weight:600;cursor:pointer}
button.primary{background:#34465f;color:#fff;border-color:#34465f}button:disabled{opacity:.4;cursor:not-allowed}
small,p{line-height:1.7}#status{min-height:1.8em}#status.error{color:#b91c1c}
@media(max-width:600px){body{padding:12px}section{padding:16px}.preview{gap:8px}}
@media(prefers-color-scheme:dark){:root{background:#141820;color:#edf2f8}section{background:#1d2430;border-color:#384151}.sub,figcaption{color:#a9b7c7}button{background:#293341;color:#eef2f9;border-color:#657489}.upload{border-color:#7b8797}}
</style></head><body><main>
<header><div><div class="sub">VESPER / PRIVATE WORKSPACE</div><h1>Avatar Studio</h1></div><span class="sub">仅授权账号可访问</span></header>
<section><label class="upload">上传 PNG（128–2048px 正方形，最大 4 MB）<p><input id="file" type="file" accept="image/png"></p></label>
<p class="sub">上传前所有预览仅发生在本机。不会自动发布，也不会将图片传给第三方服务。</p></section>
<section><div class="preview">
<figure><img id="static" class="portrait" alt="新头像静态预览"><figcaption>静态 PNG · 原始图像</figcaption></figure>
<figure><img id="animated" class="portrait animated" alt="微动态效果预览"><figcaption>微动态预览 · 与正式 WebP/GIF 使用相同的浮动节奏</figcaption></figure>
</div><p class="sub">这是浏览器动画效果预览，不是尚未生成的 WebP/GIF 文件；正式文件由 GitHub Actions 在发布后基于 PNG 同源生成。</p></section>
<section><h2>发布</h2><p class="sub">确认后先把 PNG 提交到 Avatar Studio 开发分支；独立生成任务验证 WebP/GIF 后，才把三个头像文件一次性发布至 main。若生成失败，主站头像保持不变。</p>
<div class="actions"><button id="publish" class="primary" disabled>确认更新网站头像</button>
<a href="https://github.com/yen-chiu/yen-chiu.github.io/actions/workflows/avatar-studio-publish.yml" target="_blank" rel="noopener noreferrer">查看部署记录</a></div>
<p id="status" role="status" aria-live="polite"></p>
</section></main>
<script>
const file = document.getElementById('file'), publish = document.getElementById('publish')
const status = document.getElementById('status'), still = document.getElementById('static')
const moving = document.getElementById('animated')
let selected, blobUrl
function report(message, error){status.textContent=message;status.className=error?'error':''}
file.addEventListener('change',async()=> {
  publish.disabled=true;selected=null;moving.classList.remove('on')
  if(blobUrl)URL.revokeObjectURL(blobUrl)
  const f=file.files[0];if(!f)return
  if(f.type!=='image/png'||f.size>4*1024*1024){report('请使用不超过 4MB 的 PNG 文件',true);return}
  blobUrl=URL.createObjectURL(f)
  try{
    const image=await createImageBitmap(f)
    if(image.width!==image.height||image.width<128||image.width>2048)throw Error('PNG 必须为 128–2048px 的正方形')
    image.close()
    selected=f;still.src=blobUrl;moving.src=blobUrl
    moving.classList.add('on');publish.disabled=false
    report('本地预览已就绪。确认前不会提交到仓库。')
  }catch(error){report(error.message||'无法读取图片',true)}
})
publish.addEventListener('click',async()=> {
  if(!selected||!confirm('确认提交新头像到 Avatar Studio 生成队列？验证通过后会自动将 PNG、WebP、GIF 一起发布到网站 main 分支。'))return
  publish.disabled=true
  report('正在验证授权并提交 PNG 到 Avatar Studio 分支…')
  try{
    const response=await fetch('/api/publish',{method:'POST',body:selected,headers:{'Content-Type':'image/png','X-Avatar-Confirm':'publish'},credentials:'same-origin'})
    const data=await response.json()
    if(!response.ok)throw Error(data.error||'发布失败')
    report('已提交生成任务。三个文件通过验证后将一起发布，随后触发网站部署。任务提交：'+data.commit)
  }catch(error){report(error.message||'请求失败',true);publish.disabled=false}
})
</script></body></html>`;
export default {
  async fetch(request, env) {
    try {
      const identity = await authorize(request, env)
      if (!identity) return json({ error: 'Not authorized' }, 403)
      const url = new URL(request.url)
      if (request.method === 'GET' && url.pathname === '/') {
        return new Response(HTML, { headers: { ...noStore, 'Content-Type': 'text/html; charset=utf-8' } })
      }
      if (request.method === 'POST' && url.pathname === '/api/publish') {
        if (request.headers.get('origin') !== url.origin) return json({ error: 'Origin mismatch' }, 403)
        if (request.headers.get('x-avatar-confirm') !== 'publish') return json({ error: 'Explicit confirmation required' }, 400)
        if (request.headers.get('content-type') !== 'image/png') return json({ error: 'Only PNG allowed' }, 415)
        if (Number(request.headers.get('content-length') || 0) > MAX_BYTES) return json({ error: 'File too large' }, 413)
        const bytes = await request.arrayBuffer()
        let dimensions
        try { dimensions = validatePng(bytes) } catch(error) { return json({ error: error.message }, 400) }
        const current = await github(env, 'GET')
        const updated = await github(env, 'PUT', {
          message: 'chore(avatar): stage PNG for independent asset generation',
          branch: TARGET_BRANCH, path: TARGET_PATH, sha: current.sha,
          content: base64(new Uint8Array(bytes))
        })
        return json({ ok: true, staged: true, commit: updated.commit?.sha, ...dimensions })
      }
      return json({ error: 'Not found' }, 404)
    } catch (error) {
      // Do not reveal tokens, URLs, emails or upstream response bodies.
      console.error('Avatar Studio server error', String(error?.message || error))
      return json({ error: 'Server configuration or upstream error' }, 503)
    }
  }
}
