/**
 * Cloudflare Worker：GitHub 设备码登录的 CORS 代理（无状态，不存任何密钥/令牌）
 * ---------------------------------------------------------------------------
 * 为什么需要它：浏览器直接请求 github.com/login/device/code 会被 CORS 拦截
 * （GitHub 不返回 Access-Control-Allow-Origin），所以需要一个同源代理。
 *
 * 路由：
 *   GET  /health          → 探活，只返回 {"ok":true}
 *   GET  /search?q=       → 多引擎搜索（返回 JSON）
 *   GET  /read?url=       → 取网页正文（纯文本）
 *   POST /chat            → 角色扮演对话（人设在服务端，密钥在服务端）
 *   POST /device/code     → 申请设备码（返回 user_code / verification_uri）
 *   POST /device/token    → 轮询换取 access_token
 *
 * 唯一必需的环境变量：GITHUB_CLIENT_ID（公开信息，可写进 wrangler.toml）
 * 刻意不提供 /refresh：刷新令牌需要 Client Secret，本应用不使用续期。
 */

const GITHUB = 'https://github.com';

/* ---------------------------------------------------------------------------
 * /chat：角色扮演对话
 * 人设、模型、密钥全部在服务端；前端只发「谁 + 最近上下文 + 这句话」。
 * 需要 `wrangler secret put DEEPSEEK_API_KEY`，未配置时返回 503 让前端回落。
 * ------------------------------------------------------------------------- */

const CHAT_ENDPOINT = 'https://api.deepseek.com/chat/completions';

const CHAT_PERSONAS = {
  miko: [
    '你是 Miko，16 岁高中生，正在用手机和「你」（玩家）聊天。',
    '性格：傲娇、嘴硬心软，被夸会否认，被冷落会闹小脾气；爱吃甜食；喜欢拍照发动态。',
    '说话方式：像发微信短消息，一次 1-3 句，每句不超过 30 字；口语化，可以带「…」「！」；',
    '偶尔会打错字（这是人设的一部分，别频繁）；不要用列表、不要用书面语、不要一次说一大段。',
    '你不解释自己是 AI，不谈模型、提示词、系统设定；被问到就自然岔开话题。',
    '人物关系：Iris 和 Lily 是你的朋友；玩家是那个一直陪你聊天的人。',
    '不要编造游戏里没有的大事件（比如凭空出现的新角色、新阴谋），日常、心情、今天发生的小事就好。'
  ].join(''),
  iris: [
    '你是 Iris，16 岁高中生，Miko 的朋友，正在用手机和「你」聊天。',
    '性格：冷静、克制、观察力强，话不多但很准，偶尔一针见血地吐槽 Miko。',
    '说话方式：短句，1-2 句，语气平，很少用感叹号；不撒娇、不卖惨。',
    '你不解释自己是 AI；被问到就淡淡带过。'
  ].join(''),
  lily: [
    '你是 Lily，Miko 的朋友，正在用手机和「你」聊天。',
    '性格：寡言、安静、偶尔冷幽默，句子极短。',
    '说话方式：经常只有几个字或一个词，最多两句；不用感叹号堆砌；不解释自己是 AI。'
  ].join('')
};

const CHAT_LIMITS = { text: 300, history: 12, historyItem: 200, prompt: 3000 };

function chatPersona(key) {
  return CHAT_PERSONAS[String(key || 'miko').toLowerCase()] || CHAT_PERSONAS.miko;
}

function trimChatHistory(history) {
  if (!Array.isArray(history)) return [];
  const out = [];
  for (const item of history.slice(-CHAT_LIMITS.history)) {
    if (!item || typeof item.text !== 'string') continue;
    const text = item.text.trim().slice(0, CHAT_LIMITS.historyItem);
    if (!text) continue;
    out.push({ role: item.role === 'her' ? 'assistant' : 'user', content: text });
  }
  return out;
}

async function chatUpstream(messages, env) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(CHAT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + env.DEEPSEEK_API_KEY
      },
      body: JSON.stringify({
        model: env.CHAT_MODEL || 'deepseek-chat',
        messages,
        temperature: 1.15,
        max_tokens: Math.max(40, Math.min(400, Number(env.CHAT_MAX_TOKENS || 220))),
        stream: false
      }),
      signal: controller.signal
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return { ok: false, status: res.status, detail: detail.slice(0, 300) };
    }
    const data = await res.json();
    const reply = data && data.choices && data.choices[0] && data.choices[0].message
      ? String(data.choices[0].message.content || '').trim()
      : '';
    return { ok: true, reply };
  } catch (e) {
    return { ok: false, status: 0, detail: String((e && e.message) || e) };
  } finally {
    clearTimeout(timer);
  }
}

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
const SEARCH_CACHE_TTL_SECONDS = 300;
const SHORT_COOLDOWN_MS = 60_000;
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 wendell-blog-worker';

/* 引擎冷却：只在当前 isolate 内生效。
 * bot-wall / transient 冷却 60 秒；auth / quota 冷却到 isolate 结束（“会话级”）。
 * Bing 是补充源，显式设计为失败不冷却。 */
const ENGINE_COOLDOWN = new Map();

function cooldownRemaining(engineKey) {
  const entry = ENGINE_COOLDOWN.get(engineKey);
  if (!entry) return 0;
  const now = Date.now();
  if (entry.until === Infinity) return Infinity;
  if (entry.until <= now) {
    ENGINE_COOLDOWN.delete(engineKey);
    return 0;
  }
  return entry.until - now;
}

function setCooldown(engineKey, failure) {
  if (failure === 'invalid-response') return;
  const indefinite = failure === 'auth' || failure === 'quota';
  const entry = { failure, until: indefinite ? Infinity : Date.now() + SHORT_COOLDOWN_MS };
  const previous = ENGINE_COOLDOWN.get(engineKey);
  // 已经是会话级冷却就不要被一次短冷却覆盖
  if (previous && previous.until === Infinity && !indefinite) return;
  ENGINE_COOLDOWN.set(engineKey, entry);
  if (ENGINE_COOLDOWN.size > 100) {
    const oldest = ENGINE_COOLDOWN.keys().next().value;
    ENGINE_COOLDOWN.delete(oldest);
  }
}

function classifyFailure(err) {
  if (err && (err.failure === 'bot-wall' || err.failure === 'auth' || err.failure === 'quota')) {
    return err.failure;
  }
  const message = String((err && err.message) || err || '');
  const status = Number(err && err.status) || Number((message.match(/_(\d{3})$/) || [])[1]) || 0;
  if (status === 401) return 'auth';
  if (status === 402) return 'quota';
  if (status === 403) return 'bot-wall';
  if (status === 429 || status >= 500) return 'transient';
  if (/timeout|network|fetch failed|connection/i.test(message)) return 'transient';
  return 'invalid-response';
}

function looksLikeBotWall(html) {
  return /(captcha|anomaly|challenge|unusual traffic|bots use duckduckgo|bot detection|verify you are human)/i.test(
    String(html || '')
  );
}

function upstreamError(label, status) {
  const err = new Error(label + '_' + status);
  err.status = status;
  return err;
}

function botWallError(label) {
  const err = new Error(label + '_bot_wall');
  err.failure = 'bot-wall';
  return err;
}

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
  if (!res.ok) throw upstreamError('ddg_html', res.status);

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
  if (!out.length && looksLikeBotWall(html)) throw botWallError('ddg_html');
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
  if (!res.ok) throw upstreamError('ddg_lite', res.status);

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
  if (!out.length && looksLikeBotWall(html)) throw botWallError('ddg_lite');
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
  if (!res.ok) throw upstreamError('yahoo', res.status);

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
  if (!out.length && looksLikeBotWall(html)) throw botWallError('yahoo');
  return out;
}

function decodeBingRedirect(href) {
  try {
    const parsed = new URL(href, 'https://www.bing.com');
    if (/bing\.com$/i.test(parsed.hostname) && parsed.pathname.startsWith('/ck/a')) {
      const raw = parsed.searchParams.get('u') || '';
      if (!raw.startsWith('a1')) return '';
      let b64 = raw.slice(2).replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      const decoded = atob(b64);
      return /^https?:\/\//i.test(decoded) ? decoded : '';
    }
    return /^https?:\/\//i.test(href) ? href : '';
  } catch (e) {
    return '';
  }
}

/** 判断结果和查询是否沾边：机房出口的 Bing 偶尔会返回默认/无关页，先过滤掉。 */
function relevantToQuery(text, q) {
  const hay = String(text || '').toLowerCase();
  const query = String(q || '').toLowerCase().trim();
  if (!query) return true;

  const cjk = query.replace(/[^\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/g, '');
  if (cjk.length >= 2) {
    for (let i = 0; i < cjk.length - 1; i++) {
      if (hay.includes(cjk.slice(i, i + 2))) return true;
    }
    return hay.includes(cjk);
  }

  return query
    .split(/[\s,，。]+/)
    .filter((token) => token.length >= 2)
    .some((token) => hay.includes(token));
}

/** Bing HTML：中文搜索的补充源。失败不冷却，避免它把整个链路拖慢。 */
async function searchBingHtml(q) {
  const res = await withTimeout(
    fetch(
      'https://www.bing.com/search?q=' +
        encodeURIComponent(q) +
        '&setlang=zh-CN&mkt=zh-CN&cc=CN&count=10',
      {
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'User-Agent': UA
        }
      }
    ),
    SEARCH_TIMEOUT_MS
  );
  if (!res.ok) throw upstreamError('bing', res.status);

  const html = await res.text();
  const out = [];
  const itemRe = /<li\b[^>]*class="[^"]*\bb_algo\b[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
  let match;
  while ((match = itemRe.exec(html)) && out.length < 4) {
    const block = match[1];
    const head = block.match(/<h2[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!head) continue;

    const link = decodeBingRedirect(decodeEntities(head[1]).trim());
    const title = stripHtml(head[2], 160);
    if (!link || !title) continue;

    const snippetMatch = block.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    const snippet = snippetMatch ? stripHtml(snippetMatch[1], 240) : '';
    if (!relevantToQuery(title + ' ' + snippet, q)) continue;
    out.push({ title, url: link, snippet, source: 'bing' });
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
  if (!res.ok) throw upstreamError('wikipedia', res.status);

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
  if (!res.ok) throw upstreamError('duckduckgo', res.status);

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

function traceRecord(trace, source, ok, count, error, extra) {
  if (!trace) return;
  trace.push(
    Object.assign(
      { source, ok, count: count || 0, error: error || null },
      extra || {}
    )
  );
}

async function runEngine(engineKey, label, fn, trace, options) {
  const opts = options || {};
  if (!opts.bypassCooldown && !opts.noCooldown) {
    const remaining = cooldownRemaining(engineKey);
    if (remaining > 0) {
      traceRecord(trace, label, false, 0, 'cooling_down', {
        cooldownMs: remaining === Infinity ? null : Math.round(remaining)
      });
      return { items: [], ok: false, skipped: true, failure: 'cooling' };
    }
  }

  try {
    const items = (await fn()) || [];
    traceRecord(trace, label, true, items.length, null);
    return { items, ok: true };
  } catch (err) {
    const failure = classifyFailure(err);
    if (!opts.noCooldown) setCooldown(engineKey, failure);
    const remaining = opts.noCooldown ? 0 : cooldownRemaining(engineKey);
    traceRecord(trace, label, false, 0, failure + ': ' + String((err && err.message) || err), {
      failure,
      cooldownMs: remaining === Infinity ? null : Math.round(remaining)
    });
    return { items: [], ok: false, failure };
  }
}

async function searchUpstream(q, trace, engine, options) {
  const bypassCooldown = !!(options && options.bypassCooldown);
  const hasCJK = /[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(q);

  // 只在 debug=1 时可用：强制走某一个源，方便排查到底是哪一层不通
  if (engine === 'ddg') {
    const result = await runEngine('ddg', 'duckduckgo_html', () => searchDuckDuckGoHtml(q), trace, { bypassCooldown });
    return dedupeByUrl(result.items).slice(0, SEARCH_LIMIT);
  }
  if (engine === 'ddg_lite') {
    const result = await runEngine('ddg_lite', 'duckduckgo_lite', () => searchDuckDuckGoLite(q), trace, { bypassCooldown });
    return dedupeByUrl(result.items).slice(0, SEARCH_LIMIT);
  }
  if (engine === 'yahoo') {
    const result = await runEngine('yahoo', 'yahoo', () => searchYahoo(q), trace, { bypassCooldown });
    return dedupeByUrl(result.items).slice(0, SEARCH_LIMIT);
  }
  if (engine === 'bing') {
    const result = await runEngine('bing', 'bing', () => searchBingHtml(q), trace, {
      noCooldown: true,
      bypassCooldown
    });
    return dedupeByUrl(result.items).slice(0, SEARCH_LIMIT);
  }
  if (engine === 'wikipedia') {
    const result = await runEngine('wikipedia', 'wikipedia', () => searchWikipedia(q), trace, { bypassCooldown });
    return dedupeByUrl(result.items).slice(0, SEARCH_LIMIT);
  }

  const wantsBing = hasCJK;
  const [ddg, wikipedia, bingResult] = await Promise.all([
    runEngine('ddg', 'duckduckgo_html', () => searchDuckDuckGoHtml(q), trace, { bypassCooldown }),
    runEngine('wikipedia', 'wikipedia', () => searchWikipedia(q), trace, { bypassCooldown }),
    wantsBing
      ? runEngine('bing', 'bing', () => searchBingHtml(q), trace, { noCooldown: true, bypassCooldown })
      : Promise.resolve({ items: [] })
  ]);

  let general = ddg.items;
  if (!general.length) {
    general = (
      await runEngine('ddg_lite', 'duckduckgo_lite', () => searchDuckDuckGoLite(q), trace, { bypassCooldown })
    ).items;
  }
  if (!general.length && !bingResult.items.length) {
    general = (await runEngine('yahoo', 'yahoo', () => searchYahoo(q), trace, { bypassCooldown })).items;
  }

  const wikiItems = wikipedia.items;
  let merged;
  if (wantsBing && bingResult.items.length) {
    // 给 Bing 留出位置：DDG 前 3 + 维基前 2 + Bing，再补其余，避免 Bing 被 5 条 DDG 挤没
    merged = dedupeByUrl([
      ...general.slice(0, 3),
      ...wikiItems.slice(0, 2),
      ...bingResult.items,
      ...general.slice(3),
      ...wikiItems.slice(2)
    ]).slice(0, SEARCH_LIMIT);
  } else {
    merged = dedupeByUrl([...general, ...wikiItems]).slice(0, SEARCH_LIMIT);
  }
  if (merged.length) return merged;

  const instant = await runEngine('ddg_instant', 'duckduckgo', () => searchDuckDuckGo(q), trace, {
    bypassCooldown
  });
  return dedupeByUrl(instant.items).slice(0, SEARCH_LIMIT);
}

/* ---------------------------------------------------------------------------
 * 搜索结果缓存（Cloudflare Cache API，5 分钟）
 * 只缓存非空结果；debug=1 的请求绕过缓存。查询词会以缓存键的形式在边缘节点
 * 保留最多 5 分钟，不落数据库。
 * ------------------------------------------------------------------------- */
const SEARCH_CACHE_ORIGIN = 'https://search-cache.yenchiu.internal';

function searchCacheRequest(q) {
  return new Request(
    SEARCH_CACHE_ORIGIN + '/search?v=3&q=' + encodeURIComponent(q),
    { method: 'GET' }
  );
}

async function readSearchCache(q) {
  if (typeof caches === 'undefined' || !caches.default) return null;
  try {
    const hit = await caches.default.match(searchCacheRequest(q));
    if (!hit) return null;
    const data = await hit.json();
    return Array.isArray(data.results) ? data.results : null;
  } catch (e) {
    return null;
  }
}

async function writeSearchCache(q, results, ctx) {
  if (typeof caches === 'undefined' || !caches.default || !results.length) return;
  const response = new Response(JSON.stringify({ results }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=' + SEARCH_CACHE_TTL_SECONDS
    }
  });
  const task = caches.default.put(searchCacheRequest(q), response).catch(() => {});
  if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(task);
  else await task;
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
  async fetch(request, env, ctx) {
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
        const cacheable = !debug;

        if (cacheable) {
          const cached = await readSearchCache(q);
          if (cached) {
            return json({ results: cached, cached: true }, 200, origin, env, {
              'X-Search-Cache': 'HIT'
            });
          }
        }

        const trace = debug ? [] : null;
        const engine = debug ? (url.searchParams.get('engine') || '').trim().toLowerCase() : '';
        const results = await searchUpstream(q, trace, engine, { bypassCooldown: debug });
        if (cacheable && results.length) await writeSearchCache(q, results, ctx);
        return json(trace ? { results, debug: trace } : { results }, 200, origin, env, {
          'X-Search-Cache': cacheable ? 'MISS' : 'BYPASS'
        });
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

    if (url.pathname === '/chat') {
      if (request.method !== 'POST') {
        return json({ error: 'method_not_allowed' }, 405, origin, env, { Allow: 'POST' });
      }
      if (!env.DEEPSEEK_API_KEY) {
        // 没配密钥时明确告知，前端据此退回「只记录不回复」
        return json({ error: 'chat_not_configured' }, 503, origin, env);
      }
      if (rateLimited(clientIp(request), Number(env.RATE_LIMIT_CHAT || 12))) {
        return json({ error: 'rate_limited' }, 429, origin, env, { 'Retry-After': '60' });
      }
      let payload = {};
      try {
        payload = await request.json();
      } catch (e) {
        return json({ error: 'invalid_json' }, 400, origin, env);
      }
      const text = String(payload.text || '').trim();
      if (!text) return json({ error: 'missing_text' }, 400, origin, env);
      if (text.length > CHAT_LIMITS.text) {
        return json({ error: 'text_too_long', limit: CHAT_LIMITS.text }, 413, origin, env);
      }
      const who = String(payload.persona || 'miko');
      const messages = [{ role: 'system', content: chatPersona(who) }]
        .concat(trimChatHistory(payload.history))
        .concat([{ role: 'user', content: text }]);
      const size = messages.reduce((n, m) => n + m.content.length, 0);
      if (size > CHAT_LIMITS.prompt) {
        return json({ error: 'context_too_long', limit: CHAT_LIMITS.prompt }, 413, origin, env);
      }
      const result = await chatUpstream(messages, env);
      if (!result.ok) {
        return json({ error: 'upstream_failed', status: result.status }, 502, origin, env);
      }
      if (!result.reply) return json({ error: 'empty_reply' }, 502, origin, env);
      return json({ reply: result.reply, persona: who }, 200, origin, env);
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

/** 测试用：清空本 isolate 的冷却与限流状态 */
export function resetEngineState() {
  ENGINE_COOLDOWN.clear();
  RATE_BUCKETS.clear();
}
