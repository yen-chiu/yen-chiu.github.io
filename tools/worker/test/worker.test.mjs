import test from 'node:test';
import assert from 'node:assert/strict';

import worker, { resetEngineState } from '../src/index.js';

const ENV = { GITHUB_CLIENT_ID: 'Iv1.testclient', ALLOWED_ORIGIN: 'https://yenchiu.com' };
const BASE = 'https://yenchiu-api.example.workers.dev';

function makeRequest(path, { method = 'POST', origin = 'https://yenchiu.com', body, ip = '203.0.113.1' } = {}) {
  const headers = { Origin: origin, 'CF-Connecting-IP': ip };
  if (body) headers['Content-Type'] = 'application/json';
  return new Request(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
}

function mockGithub(t, response) {
  t.mock.method(globalThis, 'fetch', async (url) => {
    assert.match(String(url), /^https:\/\/github\.com\//);
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  });
}

test('预检请求返回 CORS 头', async () => {
  const res = await worker.fetch(makeRequest('/device/code', { method: 'OPTIONS' }), ENV);
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'https://yenchiu.com');
  assert.match(res.headers.get('Access-Control-Allow-Headers'), /Content-Type/);
});

test('非白名单来源被拒绝', async () => {
  const res = await worker.fetch(makeRequest('/health', { method: 'GET', origin: 'https://evil.example' }), ENV);
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error, 'origin_not_allowed');
});

test('/health 只报告 ok', async () => {
  const res = await worker.fetch(makeRequest('/health', { method: 'GET' }), ENV);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body, { ok: true });
});

test('/device/code 透传 GitHub 返回', async (t) => {
  mockGithub(t, {
    device_code: 'dev-123',
    user_code: 'ABCD-1234',
    verification_uri: 'https://github.com/login/device',
    expires_in: 900,
    interval: 5
  });
  const res = await worker.fetch(makeRequest('/device/code', { ip: '198.51.100.7' }), ENV);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.user_code, 'ABCD-1234');
  assert.equal(res.headers.get('Cache-Control'), 'no-store');
});

test('/device/token 透传错误状态（authorization_pending）', async (t) => {
  t.mock.method(globalThis, 'fetch', async () =>
    new Response(JSON.stringify({ error: 'authorization_pending' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  );
  const res = await worker.fetch(makeRequest('/device/token', { body: { device_code: 'dev-123' }, ip: '198.51.100.8' }), ENV);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).error, 'authorization_pending');
});

test('/device/token 缺少 device_code 时报 400', async () => {
  const res = await worker.fetch(makeRequest('/device/token', { body: {}, ip: '198.51.100.9' }), ENV);
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'missing_device_code');
});

test('同一 IP 频繁申请设备码会被限流', async (t) => {
  mockGithub(t, { device_code: 'd', user_code: 'A-B', interval: 5 });
  const env = { ...ENV, RATE_LIMIT_CODE: '2' };
  const ip = '203.0.113.99';
  const first = await worker.fetch(makeRequest('/device/code', { ip }), env);
  const second = await worker.fetch(makeRequest('/device/code', { ip }), env);
  const third = await worker.fetch(makeRequest('/device/code', { ip }), env);
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(third.status, 429);
  assert.equal((await third.json()).error, 'rate_limited');
  assert.equal(third.headers.get('Retry-After'), '60');
});

test('/refresh 已下线', async () => {
  const res = await worker.fetch(makeRequest('/refresh', { body: { refresh_token: 'r' }, ip: '198.51.100.10' }), ENV);
  assert.equal(res.status, 404);
});

test('未知路由 404', async () => {
  const res = await worker.fetch(makeRequest('/nope', { ip: '198.51.100.11' }), ENV);
  assert.equal(res.status, 404);
});

test('缺少 client_id 时返回 500', async () => {
  const res = await worker.fetch(makeRequest('/device/code', { ip: '198.51.100.12' }), { ALLOWED_ORIGIN: 'https://yenchiu.com' });
  assert.equal(res.status, 500);
  assert.equal((await res.json()).error, 'missing_client_id');
});

test('/search 缺少 q 时报 400', async () => {
  const res = await worker.fetch(makeRequest('/search', { method: 'GET', ip: '198.51.100.21' }), ENV);
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'missing_q');
});

test('/search 合并 DuckDuckGo 与维基结果并去重', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url) => {
    const href = String(url);
    if (href.includes('html.duckduckgo.com')) {
      return new Response(
        '<div class="result">' +
          '<a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fbaike.baidu.com%2Fitem%2F%E8%8B%8F%E8%BD%BC&rut=x">苏轼 - 百度百科</a>' +
          '<a class="result__snippet" href="#">苏轼（1037—1101），北宋文学家。</a></div>' +
          '<div class="result">' +
          '<a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fzh.wikipedia.org%2Fwiki%2F%25E8%258B%258F%25E8%25BD%25BC&rut=y">苏轼 - 维基百科</a>' +
          '<a class="result__snippet" href="#">苏轼，字子瞻。</a></div>',
        { status: 200, headers: { 'Content-Type': 'text/html' } }
      );
    }
    assert.match(href, /zh\.wikipedia\.org/);
    return new Response(
      JSON.stringify({
        query: {
          search: [
            { title: '苏轼', snippet: '<span>北宋</span>文学家' },
            { title: '苏辙', snippet: '苏轼之弟' }
          ]
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  });
  const res = await worker.fetch(makeRequest('/search?q=%E8%8B%8F%E8%BD%BC', { method: 'GET', ip: '198.51.100.22' }), ENV);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.results.length, 3);
  assert.equal(body.results[0].title, '苏轼 - 百度百科');
  assert.equal(body.results[0].source, 'duckduckgo');
  assert.match(body.results[0].url, /baike\.baidu\.com/);
  assert.equal(body.results[1].title, '苏轼 - 维基百科');
  assert.equal(body.results[1].source, 'duckduckgo');
  assert.equal(body.results[2].title, '苏辙');
  assert.equal(body.results[2].source, 'wikipedia');
  assert.equal(body.results[2].snippet, '苏轼之弟');
});

test('/search 在 DuckDuckGo 不可用时仍返回维基结果', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url) => {
    if (String(url).includes('duckduckgo.com')) {
      return new Response('blocked', { status: 403 });
    }
    return new Response(JSON.stringify({ query: { search: [{ title: '苏轼', snippet: '北宋文学家' }] } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  });
  const res = await worker.fetch(makeRequest('/search?q=%E8%8B%8F%E8%BD%BC', { method: 'GET', ip: '198.51.100.25' }), ENV);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.results.length, 1);
  assert.equal(body.results[0].source, 'wikipedia');
});

test('/search 允许 www.yenchiu.com 来源', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 502 }));
  const env = { ...ENV, ALLOWED_ORIGIN: 'https://yenchiu.com,https://www.yenchiu.com' };
  const res = await worker.fetch(
    makeRequest('/search?q=test', { method: 'GET', origin: 'https://www.yenchiu.com', ip: '198.51.100.26' }),
    env
  );
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'https://www.yenchiu.com');
});

test('/search 中文结果不足时用 Bing 补充', async (t) => {
  resetEngineState();
  t.mock.method(globalThis, 'fetch', async (url) => {
    const href = String(url);
    if (href.includes('html.duckduckgo.com')) {
      return new Response(
        '<div class="result"><a class="result__a" href="https://example.com/ddg">DDG 结果</a>' +
          '<a class="result__snippet">DDG 摘要</a></div>',
        { status: 200, headers: { 'Content-Type': 'text/html' } }
      );
    }
    if (href.includes('wikipedia.org')) {
      return new Response(JSON.stringify({ query: { search: [] } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (href.includes('bing.com/search')) {
      return new Response(
        '<li class="b_algo"><h2><a href="https://example.com/bing1">苏轼 - Bing 结果一</a></h2><p>摘要一</p></li>' +
          '<li class="b_algo"><h2><a href="https://example.com/bing2">苏轼 - Bing 结果二</a></h2><p>摘要二</p></li>',
        { status: 200, headers: { 'Content-Type': 'text/html' } }
      );
    }
    return new Response('', { status: 200 });
  });
  const res = await worker.fetch(
    makeRequest('/search?q=' + encodeURIComponent('苏轼'), { method: 'GET', ip: '198.51.100.30' }),
    ENV
  );
  const body = await res.json();
  assert.equal(body.results.length, 3);
  assert.equal(body.results.filter((r) => r.source === 'bing').length, 2);
  resetEngineState();
});

test('/search Bing 失败不冷却', async (t) => {
  resetEngineState();
  let bingCalls = 0;
  t.mock.method(globalThis, 'fetch', async (url) => {
    const href = String(url);
    if (href.includes('bing.com/search')) {
      bingCalls += 1;
      return new Response('blocked', { status: 429 });
    }
    if (href.includes('html.duckduckgo.com') || href.includes('lite.duckduckgo.com') || href.includes('search.yahoo.com')) {
      return new Response('', { status: 200 });
    }
    if (href.includes('api.duckduckgo.com')) {
      return new Response(JSON.stringify({}), { status: 200 });
    }
    if (href.includes('wikipedia.org')) {
      return new Response(JSON.stringify({ query: { search: [] } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response('', { status: 200 });
  });
  const req = () =>
    makeRequest('/search?q=' + encodeURIComponent('苏轼'), { method: 'GET', ip: '198.51.100.31' });
  await worker.fetch(req(), ENV);
  await worker.fetch(req(), ENV);
  assert.equal(bingCalls, 2);
  resetEngineState();
});

test('/search DDG bot-wall 冷却后跳过', async (t) => {
  resetEngineState();
  let ddgCalls = 0;
  t.mock.method(globalThis, 'fetch', async (url) => {
    const href = String(url);
    if (href.includes('html.duckduckgo.com')) {
      ddgCalls += 1;
      return new Response('', { status: 429 });
    }
    if (href.includes('lite.duckduckgo.com')) return new Response('', { status: 429 });
    if (href.includes('search.yahoo.com')) return new Response('', { status: 200 });
    if (href.includes('api.duckduckgo.com')) return new Response(JSON.stringify({}), { status: 200 });
    if (href.includes('wikipedia.org')) {
      return new Response(JSON.stringify({ query: { search: [] } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response('', { status: 200 });
  });
  const req = () =>
    makeRequest('/search?q=cloudflare', { method: 'GET', ip: '198.51.100.32' });
  await worker.fetch(req(), ENV);
  const afterFirst = ddgCalls;
  await worker.fetch(req(), ENV);
  assert.equal(afterFirst, 1);
  assert.equal(ddgCalls, 1);
  resetEngineState();
});

test('/search Yahoo 401 按会话冷却', async (t) => {
  resetEngineState();
  let yahooCalls = 0;
  t.mock.method(globalThis, 'fetch', async (url) => {
    const href = String(url);
    if (href.includes('html.duckduckgo.com') || href.includes('lite.duckduckgo.com')) {
      return new Response('', { status: 200 });
    }
    if (href.includes('search.yahoo.com')) {
      yahooCalls += 1;
      return new Response('denied', { status: 401 });
    }
    if (href.includes('api.duckduckgo.com')) return new Response(JSON.stringify({}), { status: 200 });
    if (href.includes('wikipedia.org')) {
      return new Response(JSON.stringify({ query: { search: [] } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response('', { status: 200 });
  });
  const req = () =>
    makeRequest('/search?q=cloudflare', { method: 'GET', ip: '198.51.100.33' });
  await worker.fetch(req(), ENV);
  const afterFirst = yahooCalls;
  await worker.fetch(req(), ENV);
  assert.equal(afterFirst, 1);
  assert.equal(yahooCalls, 1);
  resetEngineState();
});

test('/search 命中 5 分钟缓存', async (t) => {
  resetEngineState();
  const store = new Map();
  globalThis.caches = {
    default: {
      async match(req) {
        const body = store.get(req.url);
        return body
          ? new Response(body, { headers: { 'Content-Type': 'application/json' } })
          : undefined;
      },
      async put(req, res) {
        store.set(req.url, await res.text());
      }
    }
  };
  try {
    let upstreamCalls = 0;
    t.mock.method(globalThis, 'fetch', async (url) => {
      const href = String(url);
      if (href.includes('html.duckduckgo.com')) {
        upstreamCalls += 1;
        return new Response(
          '<div class="result"><a class="result__a" href="https://example.com/ddg">DDG 结果</a>' +
            '<a class="result__snippet">DDG 摘要</a></div>',
          { status: 200, headers: { 'Content-Type': 'text/html' } }
        );
      }
      if (href.includes('wikipedia.org')) {
        upstreamCalls += 1;
        return new Response(
          JSON.stringify({ query: { search: [{ title: '缓存条目', snippet: '摘要' }] } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response('', { status: 200 });
    });
    const req = () => makeRequest('/search?q=cachetest', { method: 'GET', ip: '198.51.100.34' });
    const first = await worker.fetch(req(), ENV);
    await first.json();
    const callsAfterFirst = upstreamCalls;
    const second = await worker.fetch(req(), ENV);
    const body = await second.json();
    assert.equal(upstreamCalls, callsAfterFirst);
    assert.equal(second.headers.get('X-Search-Cache'), 'HIT');
    assert.equal(body.cached, true);
    assert.equal(body.results.length, 2);
  } finally {
    delete globalThis.caches;
    resetEngineState();
  }
});

test('/read 拒绝内网地址', async () => {
  for (const target of ['http://127.0.0.1/x', 'http://10.0.0.5/a', 'http://169.254.169.254/latest', 'ftp://example.com/x']) {
    const res = await worker.fetch(
      makeRequest('/read?url=' + encodeURIComponent(target), { method: 'GET', ip: '198.51.100.23' }),
      ENV
    );
    assert.equal(res.status, 502);
    const body = await res.json();
    assert.match(body.error, /private_host|bad_protocol/);
  }
});

test('/read 抓回网页并转成纯文本', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url) => {
    assert.match(String(url), /example\.com/);
    return new Response('<html><head><title>示例</title></head><body><p>正文 <b>加粗</b></p><script>x()</script></body></html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  });
  const res = await worker.fetch(
    makeRequest('/read?url=' + encodeURIComponent('https://example.com/a'), { method: 'GET', ip: '198.51.100.24' }),
    ENV
  );
  assert.equal(res.status, 200);
  assert.match(res.headers.get('Content-Type'), /text\/plain/);
  const text = await res.text();
  assert.match(text, /正文 加粗/);
  assert.doesNotMatch(text, /x\(\)/);
});

/* ---------------- /chat：角色扮演对话 ---------------- */

test('/chat 未配置密钥时返回 503，前端据此回落', async () => {
  const res = await worker.fetch(makeRequest('/chat', { body: { text: '在吗' } }), ENV);
  assert.equal(res.status, 503);
  assert.equal((await res.json()).error, 'chat_not_configured');
});

test('/chat 只接受 POST', async () => {
  const res = await worker.fetch(makeRequest('/chat', { method: 'GET' }), { ...ENV, DEEPSEEK_API_KEY: 'k' });
  assert.equal(res.status, 405);
});

test('/chat 校验文本长度与缺失', async () => {
  const env = { ...ENV, DEEPSEEK_API_KEY: 'k' };
  const empty = await worker.fetch(makeRequest('/chat', { body: {} }), env);
  assert.equal(empty.status, 400);
  assert.equal((await empty.json()).error, 'missing_text');
  const long = await worker.fetch(makeRequest('/chat', { body: { text: 'a'.repeat(301) } }), env);
  assert.equal(long.status, 413);
});

test('/chat 把上下文映射成 user/assistant，并用人设作为 system', async () => {
  const env = { ...ENV, DEEPSEEK_API_KEY: 'k', RATE_LIMIT_CHAT: 100 };
  resetEngineState();
  let seen = null;
  const restore = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    assert.match(String(url), /^https:\/\/api\.deepseek\.com\//);
    assert.equal(init.headers.Authorization, 'Bearer k');
    seen = JSON.parse(init.body);
    return new Response(JSON.stringify({ choices: [{ message: { content: '哼。' } }] }), { status: 200 });
  };
  try {
    const res = await worker.fetch(makeRequest('/chat', {
      body: { persona: 'miko', text: '今天怎么样', history: [{ role: 'me', text: '在吗' }, { role: 'her', text: '……在' }] }
    }), env);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).reply, '哼。');
    assert.equal(seen.messages[0].role, 'system');
    assert.match(seen.messages[0].content, /Miko/);
    assert.deepEqual(seen.messages.map((m) => m.role), ['system', 'user', 'assistant', 'user']);
    assert.equal(seen.stream, false);
  } finally {
    globalThis.fetch = restore;
  }
});

test('/chat 上游失败时返回 502', async () => {
  const env = { ...ENV, DEEPSEEK_API_KEY: 'k', RATE_LIMIT_CHAT: 100 };
  resetEngineState();
  const restore = globalThis.fetch;
  globalThis.fetch = async () => new Response('boom', { status: 500 });
  try {
    const res = await worker.fetch(makeRequest('/chat', { body: { text: '嗨' } }), env);
    assert.equal(res.status, 502);
    assert.equal((await res.json()).error, 'upstream_failed');
  } finally {
    globalThis.fetch = restore;
  }
});

test('/chat 按 IP 限流', async () => {
  const env = { ...ENV, DEEPSEEK_API_KEY: 'k', RATE_LIMIT_CHAT: 2 };
  resetEngineState();
  const restore = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: '嗯' } }] }), { status: 200 });
  try {
    const a = await worker.fetch(makeRequest('/chat', { body: { text: '1' }, ip: '198.51.100.30' }), env);
    const b = await worker.fetch(makeRequest('/chat', { body: { text: '2' }, ip: '198.51.100.30' }), env);
    const c = await worker.fetch(makeRequest('/chat', { body: { text: '3' }, ip: '198.51.100.30' }), env);
    assert.deepEqual([a.status, b.status, c.status], [200, 200, 429]);
    assert.equal(c.headers.get('Retry-After'), '60');
    const other = await worker.fetch(makeRequest('/chat', { body: { text: '4' }, ip: '198.51.100.31' }), env);
    assert.equal(other.status, 200);
  } finally {
    globalThis.fetch = restore;
  }
});
