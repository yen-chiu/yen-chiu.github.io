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

    if (!env.GITHUB_CLIENT_ID) {
      return json({ error: 'missing_client_id' }, 500, origin, env);
    }

    if (url.pathname === '/health') {
      // 只报告「能用/不能用」，不回显来源白名单或任何配置细节
      return json({ ok: true }, 200, origin, env);
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
