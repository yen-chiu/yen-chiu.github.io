/**
 * Cloudflare Worker：GitHub 设备码登录的 CORS 代理（无状态，不存任何密钥/令牌）
 * ---------------------------------------------------------------------------
 * 为什么需要它：浏览器直接请求 github.com/login/device/code 会被 CORS 拦截
 * （GitHub 不返回 Access-Control-Allow-Origin），所以需要一个同源代理。
 *
 * 路由：
 *   GET  /health          → 探活，只返回 {"ok":true}
 *   POST /device/code     → 申请设备码（返回 user_code / verification_uri）
 *   POST /device/token    → 轮询换取 access_token
 *
 * 唯一必需的环境变量：GITHUB_CLIENT_ID（公开信息，可写进 wrangler.toml）
 * 刻意不提供 /refresh：刷新令牌需要 Client Secret，本应用不使用续期。
 */

const GITHUB = 'https://github.com';

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store'
};

function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGIN || 'https://yenchiu.com')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function corsHeaders(origin, env) {
  const list = allowedOrigins(env);
  const allowAll = list.includes('*');
  const ok = allowAll || list.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin || list[0] : list[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };
}

function json(body, status, origin, env, extraHeaders) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { ...JSON_HEADERS, ...corsHeaders(origin, env), ...(extraHeaders || {}) }
  });
}

async function githubPost(path, form) {
  const res = await fetch(GITHUB + path, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'wendell-blog-auth-worker'
    },
    body: new URLSearchParams(form).toString()
  });

  let body = null;
  try {
    body = await res.json();
  } catch (e) {
    body = { error: 'invalid_upstream_response' };
  }
  return { status: res.status, body };
}

/* ---------------------------------------------------------------------------
 * 搜索与读页：给站内人格「上网」用的
 * ------------------------------------------------------------------------- */
const SEARCH_TIMEOUT_MS = 8000;
const READ_TIMEOUT_MS = 10000;
const READ_LIMIT = 8000;
const SEARCH_LIMIT = 6;
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 wendell-blog-worker';

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
  ]);
}

const NAMED_ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  middot: '·',
  mdash: '—',
  ndash: '–',
  hellip: '…',
  ldquo: '“',
  rdquo: '”',
  lsquo: '‘',
  rsquo: '’',
  copy: '©'
};

function decodeEntities(input) {
  return String(input || '').replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (whole, code) => {
    if (code[0] === '#') {
      const n =
        code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : whole;
    }
    const key = code.toLowerCase();
    return Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, key) ? NAMED_ENTITIES[key] : whole;
  });
}

function stripHtml(input, limit) {
  const text = decodeEntities(
    String(input || '')
      .replace(/<!\[CDATA\[|\]\]>/g, '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      // 块级标签先换成换行，别把两段拼成一句话
      .replace(/<\/(p|div|li|tr|h[1-6]|blockquote|section|article)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return limit ? text.slice(0, limit) : text;
}

/** DDG 的 HTML 版：通用网页搜索的主力，中文结果稳定，需要解一次 uddg 跳转。
 *  浏览器直连会被 CORS 挡，所以由 Worker 在服务端取。 */
async function searchDuckDuckGoHtml(q) {
  const res = await withTimeout(
    fetch('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(q), {
      headers: { Accept: 'text/html', 'User-Agent': UA }
    }),
    SEARCH_TIMEOUT_MS
  );
  if (!res.ok) throw new Error('ddg_html_' + res.status);

  const html = await res.text();
  const out = [];
  const anchorRe = /<a\b[^>]*>[\s\S]*?<\/a>/gi;
  let match;
  while ((match = anchorRe.exec(html)) && out.length < 5) {
    const tag = match[0];
    if (!/class="[^"]*\bresult__a\b/i.test(tag)) continue;
    const hrefMatch = tag.match(/href="([^"]+)"/i);
    if (!hrefMatch) continue;

    let target = decodeEntities(hrefMatch[1]).trim();
    try {
      const parsed = new URL(target, 'https://duckduckgo.com');
      const uddg = parsed.searchParams.get('uddg');
      if (uddg) target = uddg;
      else if (!/^https?:/i.test(target)) target = parsed.toString();
    } catch (e) {
      continue;
    }
    if (!/^https?:/i.test(target)) continue;

    const after = html.slice(anchorRe.lastIndex, anchorRe.lastIndex + 4000);
    const snippetMatch = after.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i);
    const title = stripHtml(tag.replace(/^[\s\S]*?>/, ''), 160);
    if (!title) continue;
    out.push({
      title,
      url: target,
      snippet: snippetMatch ? stripHtml(snippetMatch[1], 240) : '',
      source: 'duckduckgo'
    });
  }
  return out;
}

/** DDG 的精简版：偶尔 HTML 版会返回空壳（反爬挑战），这个更素，解析也更稳。 */
async function searchDuckDuckGoLite(q) {
  const res = await withTimeout(
    fetch('https://lite.duckduckgo.com/lite/?q=' + encodeURIComponent(q), {
      headers: { Accept: 'text/html', 'User-Agent': UA }
    }),
    SEARCH_TIMEOUT_MS
  );
  if (!res.ok) throw new Error('ddg_lite_' + res.status);

  const html = await res.text();
  const out = [];
  const linkRe = /<a\b[^>]*class=['"]result-link['"][^>]*>[\s\S]*?<\/a>/gi;
  let match;
  while ((match = linkRe.exec(html)) && out.length < 5) {
    const tag = match[0];
    const hrefMatch = tag.match(/href=['"]([^'"]+)['"]/i);
    if (!hrefMatch) continue;

    let target = decodeEntities(hrefMatch[1]).trim();
    try {
      const parsed = new URL(target, 'https://duckduckgo.com');
      const uddg = parsed.searchParams.get('uddg');
      if (uddg) target = uddg;
      else if (!/^https?:/i.test(target)) target = parsed.toString();
    } catch (e) {
      continue;
    }
    if (!/^https?:/i.test(target)) continue;

    const after = html.slice(linkRe.lastIndex, linkRe.lastIndex + 3000);
    const snippetMatch = after.match(/class=['"]result-snippet['"][^>]*>([\s\S]*?)<\/td>/i);
    const title = stripHtml(tag.replace(/^[\s\S]*?>/, ''), 160);
    if (!title) continue;
    out.push({
      title,
      url: target,
      snippet: snippetMatch ? stripHtml(snippetMatch[1], 240) : '',
      source: 'duckduckgo'
    });
  }
  return out;
}

function yahooTarget(href) {
  try {
    const parsed = new URL(href);
    if (/search\.yahoo\.com$/i.test(parsed.hostname)) {
      const m = parsed.pathname.match(/\/RU=([^/]+)/);
      if (m) return decodeURIComponent(m[1]);
      return '';
    }
    return /^https?:/i.test(href) ? href : '';
  } catch (e) {
    return '';
  }
}

/** Yahoo：Bing 的干净镜像，DDG 被限流时接手；结果链接要解一次 /RU=<url>/。 */
async function searchYahoo(q) {
  const res = await withTimeout(
    fetch('https://search.yahoo.com/search?p=' + encodeURIComponent(q), {
      headers: { Accept: 'text/html', 'User-Agent': UA }
    }),
    SEARCH_TIMEOUT_MS
  );
  if (!res.ok) throw new Error('yahoo_' + res.status);

  const html = await res.text();
  const out = [];
  const itemRe = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
  let match;
  while ((match = itemRe.exec(html)) && out.length < 5) {
    const block = match[1];
    const titleTag = block.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
    if (!titleTag) continue;
    const anchor = block.match(/<a[^>]+href="([^"]+)"/i);
    if (!anchor) continue;

    const link = yahooTarget(decodeEntities(anchor[1]).trim());
    const title = stripHtml(titleTag[1], 160);
    if (!link || !title) continue;

    const snippetMatch = block.match(
      /<div class="compText[^"]*"[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i
    );
    out.push({
      title,
      url: link,
      snippet: snippetMatch ? stripHtml(snippetMatch[1], 240) : '',
      source: 'yahoo'
    });
  }
  return out;
}

/** 维基百科：适合概念、人物、事件；中文维基在部分网络环境不可达，所以只当补充。 */
async function searchWikipedia(q) {
  const api =
    'https://zh.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=5&srsearch=' +
    encodeURIComponent(q);
  const res = await withTimeout(
    fetch(api, { headers: { Accept: 'application/json', 'User-Agent': 'wendell-blog-worker' } }),
    SEARCH_TIMEOUT_MS
  );
  if (!res.ok) throw new Error('wikipedia_' + res.status);

  const data = await res.json();
  return ((data.query && data.query.search) || []).map((item) => ({
    title: stripHtml(item.title, 160),
    url: 'https://zh.wikipedia.org/wiki/' + encodeURIComponent(String(item.title).replace(/\s+/g, '_')),
    snippet: stripHtml(item.snippet, 240),
    source: 'wikipedia'
  }));
}

/** 最后的兜底：DuckDuckGo 摘要接口只适合“是什么”类问题，聊胜于无。 */
async function searchDuckDuckGo(q) {
  const api =
    'https://api.duckduckgo.com/?q=' + encodeURIComponent(q) + '&format=json&no_html=1&skip_disambig=1';
  const res = await withTimeout(
    fetch(api, { headers: { Accept: 'application/json', 'User-Agent': UA } }),
    SEARCH_TIMEOUT_MS
  );
  if (!res.ok) throw new Error('duckduckgo_' + res.status);

  const data = await res.json();
  const out = [];
  if (data.AbstractText) {
    out.push({
      title: data.Heading || q,
      url: data.AbstractURL || '',
      snippet: String(data.AbstractText).slice(0, 240),
      source: 'duckduckgo'
    });
  }
  for (const topic of data.RelatedTopics || []) {
    const items = topic.Topics || [topic];
    for (const item of items) {
      if (out.length >= 5) break;
      if (item.Text && item.FirstURL) {
        out.push({ title: item.Text, url: item.FirstURL, snippet: '', source: 'duckduckgo' });
      }
    }
  }
  return out;
}

function dedupeByUrl(list) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    if (!item || !item.url || seen.has(item.url)) continue;
    seen.add(item.url);
    out.push(item);
  }
  return out;
}

async function searchUpstream(q, trace, engine) {
  const record = (source, ok, count, error) => {
    if (trace) trace.push({ source, ok, count: count || 0, error: error || null });
  };

  // 只在 debug=1 时可用：强制走某一个源，方便排查到底是哪一层不通
  if (engine === 'ddg') {
    try {
      const html = await searchDuckDuckGoHtml(q);
      record('duckduckgo_html', true, html.length, null);
      return dedupeByUrl(html).slice(0, SEARCH_LIMIT);
    } catch (e) {
      record('duckduckgo_html', false, 0, String(e.message || e));
      return [];
    }
  }
  if (engine === 'ddg_lite') {
    try {
      const lite = await searchDuckDuckGoLite(q);
      record('duckduckgo_lite', true, lite.length, null);
      return dedupeByUrl(lite).slice(0, SEARCH_LIMIT);
    } catch (e) {
      record('duckduckgo_lite', false, 0, String(e.message || e));
      return [];
    }
  }
  if (engine === 'yahoo') {
    try {
      const yahoo = await searchYahoo(q);
      record('yahoo', true, yahoo.length, null);
      return dedupeByUrl(yahoo).slice(0, SEARCH_LIMIT);
    } catch (e) {
      record('yahoo', false, 0, String(e.message || e));
      return [];
    }
  }
  if (engine === 'wikipedia') {
    try {
      const wiki = await searchWikipedia(q);
      record('wikipedia', true, wiki.length, null);
      return dedupeByUrl(wiki).slice(0, SEARCH_LIMIT);
    } catch (e) {
      record('wikipedia', false, 0, String(e.message || e));
      return [];
    }
  }

  const [ddg, wikipedia] = await Promise.allSettled([searchDuckDuckGoHtml(q), searchWikipedia(q)]);
  record('duckduckgo_html', ddg.status === 'fulfilled', ddg.status === 'fulfilled' && ddg.value.length, ddg.status === 'rejected' && String(ddg.reason));
  record(
    'wikipedia',
    wikipedia.status === 'fulfilled',
    wikipedia.status === 'fulfilled' && wikipedia.value.length,
    wikipedia.status === 'rejected' && String(wikipedia.reason)
  );

  let general = ddg.status === 'fulfilled' ? ddg.value : [];
  if (!general.length) {
    try {
      general = await searchDuckDuckGoLite(q);
      record('duckduckgo_lite', true, general.length, null);
    } catch (e) {
      record('duckduckgo_lite', false, 0, String(e.message || e));
    }
  }
  if (!general.length) {
    try {
      general = await searchYahoo(q);
      record('yahoo', true, general.length, null);
    } catch (e) {
      record('yahoo', false, 0, String(e.message || e));
    }
  }

  const merged = dedupeByUrl([
    ...general,
    ...(wikipedia.status === 'fulfilled' ? wikipedia.value : [])
  ]).slice(0, SEARCH_LIMIT);
  if (merged.length) return merged;

  try {
    const instant = await searchDuckDuckGo(q);
    record('duckduckgo', true, instant.length, null);
    return dedupeByUrl(instant).slice(0, SEARCH_LIMIT);
  } catch (e) {
    record('duckduckgo', false, 0, String(e.message || e));
    return [];
  }
}

/** 只允许公网地址：挡住内网、回环与元数据服务 */
function isPrivateHost(hostname) {
  const h = String(hostname || '').toLowerCase();
  if (!h) return true;
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local')) return true;
  if (h.startsWith('[')) return true; // IPv6 直接拒绝
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}

async function readUpstream(target) {
  let parsed;
  try {
    parsed = new URL(target);
  } catch (e) {
    throw new Error('bad_url');
  }
  if (!/^https?:$/.test(parsed.protocol)) throw new Error('bad_protocol');
  if (isPrivateHost(parsed.hostname)) throw new Error('private_host');

  const res = await withTimeout(
    fetch(parsed.toString(), {
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5'
      },
      redirect: 'follow'
    }),
    READ_TIMEOUT_MS
  );
  if (!res.ok) throw new Error('upstream_' + res.status);

  const type = res.headers.get('content-type') || '';
  if (!/text\/|html|xml|json|markdown/i.test(type)) throw new Error('not_text');

  const body = await res.text();
  const title = (body.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '';
  // 优先只取正文容器，再把导航、侧栏、页脚这些整块扔掉，别让它们占满 8000 字
  const container =
    (body.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i) ||
      body.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i) ||
      [])[1] || body;
  const cleaned = container
    .replace(/<nav\b[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<aside\b[\s\S]*?<\/aside>/gi, ' ')
    .replace(/<footer\b[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<form\b[\s\S]*?<\/form>/gi, ' ');

  // 只取正文段落：语言列表、菜单、按钮这类零碎文字不该占掉给模型的 8000 字
  const paragraphs = [];
  let used = 0;
  const blockRe = /<(p|h1|h2|h3)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;
  while ((match = blockRe.exec(cleaned)) && used < READ_LIMIT) {
    const text = stripHtml(match[2]);
    if (text.length < 2) continue;
    paragraphs.push(text);
    used += text.length + 2;
  }
  const text = paragraphs.length > 2 ? paragraphs.join('\n\n') : stripHtml(cleaned, READ_LIMIT);
  return { title: stripHtml(title, 200), text: text.slice(0, READ_LIMIT) };
}

/* ---------------------------------------------------------------------------
 * 简易限流：Worker 实例内的滑动窗口计数。
 * 单个 isolate 内的近似值，只用于挡住脚本批量申请 device code / 轮询，
 * 真正的全局限流请在 Cloudflare 控制台给这个 Worker 配 Rate limiting 规则。
 * ------------------------------------------------------------------------- */

const RATE_BUCKETS = new Map();

function clientIp(request) {
  // 只信任 Cloudflare 注入的头；X-Forwarded-For 客户端可伪造，不能作为限流依据
  return request.headers.get('CF-Connecting-IP') || 'unknown';
}

function rateLimited(ip, limit) {
  if (!Number.isFinite(limit) || limit <= 0) return false;
  const now = Date.now();
  const windowMs = 60_000;
  const hits = (RATE_BUCKETS.get(ip) || []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    RATE_BUCKETS.set(ip, hits);
    return true;
  }
  hits.push(now);
  RATE_BUCKETS.set(ip, hits);
  // 淘汰最老的条目，而不是整体清空（清空会让换 IP 的人顺带重置所有人）
  if (RATE_BUCKETS.size > 5000) {
    const oldest = RATE_BUCKETS.keys().next().value;
    RATE_BUCKETS.delete(oldest);
  }
  return false;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const url = new URL(request.url);
    const list = allowedOrigins(env);
    const originOk = list.includes('*') || list.includes(origin);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin, env) });
    }

    if (!originOk) {
      return json({ error: 'origin_not_allowed', origin }, 403, origin, env);
    }

    if (url.pathname === '/health') {
      // 只报告「能用/不能用」，不回显来源白名单或任何配置细节
      return json({ ok: true }, 200, origin, env);
    }

    // 站内人格的「上网」：搜索返回 JSON，读页返回纯文本（客户端直接当正文用）
    if (url.pathname === '/search') {
      const q = (url.searchParams.get('q') || '').trim();
      if (!q) return json({ error: 'missing_q' }, 400, origin, env);
      if (rateLimited(clientIp(request), Number(env.RATE_LIMIT_SEARCH || 30))) {
        return json({ error: 'rate_limited' }, 429, origin, env, { 'Retry-After': '60' });
      }
      try {
        const debug = url.searchParams.get('debug') === '1';
        const trace = debug ? [] : null;
        const engine = debug ? (url.searchParams.get('engine') || '').trim().toLowerCase() : '';
        const results = await searchUpstream(q, trace, engine);
        return json(trace ? { results, debug: trace } : { results }, 200, origin, env);
      } catch (e) {
        return json({ error: 'search_failed' }, 502, origin, env);
      }
    }

    if (url.pathname === '/read') {
      const target = (url.searchParams.get('url') || '').trim();
      if (!target) return json({ error: 'missing_url' }, 400, origin, env);
      if (rateLimited(clientIp(request), Number(env.RATE_LIMIT_READ || 20))) {
        return json({ error: 'rate_limited' }, 429, origin, env, { 'Retry-After': '60' });
      }
      try {
        const page = await readUpstream(target);
        const head = page.title ? page.title + '\n\n' : '';
        return new Response(head + page.text, {
          status: 200,
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-store',
            ...corsHeaders(origin, env)
          }
        });
      } catch (e) {
        return json({ error: String(e.message || 'read_failed') }, 502, origin, env);
      }
    }

    if (!env.GITHUB_CLIENT_ID) {
      return json({ error: 'missing_client_id' }, 500, origin, env);
    }

    if (url.pathname === '/device/code' && request.method === 'POST') {
      if (rateLimited(clientIp(request), Number(env.RATE_LIMIT_CODE || 10))) {
        return json({ error: 'rate_limited' }, 429, origin, env, { 'Retry-After': '60' });
      }
      const { status, body } = await githubPost('/login/device/code', {
        client_id: env.GITHUB_CLIENT_ID
      });
      return json(body, status === 200 ? 200 : status, origin, env);
    }

    if (url.pathname === '/device/token' && request.method === 'POST') {
      if (rateLimited(clientIp(request), Number(env.RATE_LIMIT_TOKEN || 300))) {
        return json({ error: 'rate_limited' }, 429, origin, env, { 'Retry-After': '60' });
      }
      let payload = {};
      try {
        payload = await request.json();
      } catch (e) {
        payload = {};
      }
      if (!payload.device_code) {
        return json({ error: 'missing_device_code' }, 400, origin, env);
      }
      const { status, body } = await githubPost('/login/oauth/access_token', {
        client_id: env.GITHUB_CLIENT_ID,
        device_code: payload.device_code,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
      });
      return json(body, status, origin, env);
    }

    return json({ error: 'not_found' }, 404, origin, env);
  }
};
