import test from 'node:test';
import assert from 'node:assert/strict';

import worker from '../src/index.js';

const ENV = { GITHUB_CLIENT_ID: 'Iv1.testclient', ALLOWED_ORIGIN: 'https://yenchiu.com' };
const BASE = 'https://wendell-auth.example.workers.dev';

function makeRequest(path, { method = 'POST', origin = 'https://yenchiu.com', body } = {}) {
  const headers = { Origin: origin };
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

test('/health 报告状态', async () => {
  const res = await worker.fetch(makeRequest('/health', { method: 'GET' }), ENV);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.refresh, false);
});

test('/device/code 透传 GitHub 返回', async (t) => {
  mockGithub(t, {
    device_code: 'dev-123',
    user_code: 'ABCD-1234',
    verification_uri: 'https://github.com/login/device',
    expires_in: 900,
    interval: 5
  });
  const res = await worker.fetch(makeRequest('/device/code'), ENV);
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
  const res = await worker.fetch(makeRequest('/device/token', { body: { device_code: 'dev-123' } }), ENV);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).error, 'authorization_pending');
});

test('/device/token 缺少 device_code 时报 400', async () => {
  const res = await worker.fetch(makeRequest('/device/token', { body: {} }), ENV);
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'missing_device_code');
});

test('/refresh 未配置 secret 时返回 501', async () => {
  const res = await worker.fetch(makeRequest('/refresh', { body: { refresh_token: 'r' } }), ENV);
  assert.equal(res.status, 501);
});

test('/refresh 配置 secret 后可用', async (t) => {
  mockGithub(t, { access_token: 'ghu_new', expires_in: 28800, refresh_token: 'ghr_new' });
  const res = await worker.fetch(
    makeRequest('/refresh', { body: { refresh_token: 'ghr_old' } }),
    { ...ENV, GITHUB_CLIENT_SECRET: 'secret' }
  );
  assert.equal(res.status, 200);
  assert.equal((await res.json()).access_token, 'ghu_new');
});

test('未知路由 404', async () => {
  const res = await worker.fetch(makeRequest('/nope'), ENV);
  assert.equal(res.status, 404);
});

test('缺少 client_id 时返回 500', async () => {
  const res = await worker.fetch(makeRequest('/device/code'), { ALLOWED_ORIGIN: 'https://yenchiu.com' });
  assert.equal(res.status, 500);
  assert.equal((await res.json()).error, 'missing_client_id');
});
