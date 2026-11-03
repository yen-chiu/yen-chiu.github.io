import test from 'node:test';
import assert from 'node:assert/strict';

import worker from '../src/index.js';

const ENV = { GITHUB_CLIENT_ID: 'Iv1.testclient', ALLOWED_ORIGIN: 'https://yenchiu.com' };
const BASE = 'https://wendell-auth.example.workers.dev';

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
