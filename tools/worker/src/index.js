/**
 * Cloudflare Worker：GitHub 设备码登录的 CORS 代理（无状态、默认不存任何密钥）
 * ---------------------------------------------------------------------------
 * 为什么需要它：浏览器直接请求 github.com/login/device/code 会被 CORS 拦截
 * （GitHub 不返回 Access-Control-Allow-Origin），所以需要一个同源代理。
 *
 * 路由：
 *   GET  /health          → 探测是否可用、是否开启静默续期
 *   POST /device/code     → 申请设备码（返回 user_code / verification_uri）
 *   POST /device/token    → 轮询换取 access_token
 *   POST /refresh         → 用 refresh_token 续期（需要配置 GITHUB_CLIENT_SECRET）
 *
 * 唯一必需的环境变量：GITHUB_CLIENT_ID（公开信息，可写进 wrangler.toml）
 * 可选：GITHUB_CLIENT_SECRET（仅当需要静默续期时用 `wrangler secret put` 配置）
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

function json(body, status, origin, env) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { ...JSON_HEADERS, ...corsHeaders(origin, env) }
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
      return json(
        { ok: true, refresh: Boolean(env.GITHUB_CLIENT_SECRET), origins: list },
        200,
        origin,
        env
      );
    }

    if (url.pathname === '/device/code' && request.method === 'POST') {
      const { status, body } = await githubPost('/login/device/code', {
        client_id: env.GITHUB_CLIENT_ID
      });
      return json(body, status === 200 ? 200 : status, origin, env);
    }

    if (url.pathname === '/device/token' && request.method === 'POST') {
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

    if (url.pathname === '/refresh' && request.method === 'POST') {
      if (!env.GITHUB_CLIENT_SECRET) {
        return json({ error: 'refresh_not_configured' }, 501, origin, env);
      }
      let payload = {};
      try {
        payload = await request.json();
      } catch (e) {
        payload = {};
      }
      if (!payload.refresh_token) {
        return json({ error: 'missing_refresh_token' }, 400, origin, env);
      }
      const { status, body } = await githubPost('/login/oauth/access_token', {
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: payload.refresh_token
      });
      return json(body, status, origin, env);
    }

    return json({ error: 'not_found' }, 404, origin, env);
  }
};
