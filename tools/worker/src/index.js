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

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
  ]);
}

function stripHtml(input, limit) {
  const text = String(input || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
  return limit ? text.slice(0, limit) : text;
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

async function searchUpstream(q) {
  const results = [];

  try {
    const api =
      'https://zh.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=5&srsearch=' +
      encodeURIComponent(q);
    const res = await withTimeout(
      fetch(api, { headers: { Accept: 'application/json', 'User-Agent': 'wendell-blog-worker' } }),
      SEARCH_TIMEOUT_MS
    );
    if (res.ok) {
      const data = await res.json();
      for (const item of (data.query && data.query.search) || []) {
        results.push({
          title: item.title,
          url: 'https://zh.wikipedia.org/wiki/' + encodeURIComponent(String(item.title).replace(/\s+/g, '_')),
          snippet: stripHtml(item.snippet, 220),
          source: 'wikipedia'
        });
      }
    }
  } catch (e) {
    /* 换下一个源 */
  }

  if (!results.length) {
    try {
      const api =
        'https://api.duckduckgo.com/?q=' + encodeURIComponent(q) + '&format=json&no_html=1&skip_disambig=1';
      const res = await withTimeout(
        fetch(api, { headers: { Accept: 'application/json', 'User-Agent': 'wendell-blog-worker' } }),
        SEARCH_TIMEOUT_MS
      );
      if (res.ok) {
        const data = await res.json();
        if (data.AbstractText) {
          results.push({
            title: data.Heading || q,
            url: data.AbstractURL || '',
            snippet: String(data.AbstractText).slice(0, 220),
            source: 'duckduckgo'
          });
        }
        for (const topic of data.RelatedTopics || []) {
          const items = topic.Topics || [topic];
          for (const item of items) {
            if (results.length >= 5) break;
            if (item.Text && item.FirstURL) {
              results.push({ title: item.Text, url: item.FirstURL, snippet: '', source: 'duckduckgo' });
            }
          }
        }
      }
    } catch (e) {
      /* 两个源都挂了，返回空 */
    }
  }

  return results.slice(0, 6);
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
        'User-Agent': 'Mozilla/5.0 (compatible; wendell-blog-worker)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.5'
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
  return { title: stripHtml(title, 200), text: stripHtml(body, READ_LIMIT) };
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
        const results = await searchUpstream(q);
        return json({ results }, 200, origin, env);
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
        return new Response(page.text, {
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
