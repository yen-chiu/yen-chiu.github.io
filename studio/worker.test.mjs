import test from 'node:test'
import assert from 'node:assert/strict'
import studio from './worker.mjs'

function request(path = '/', options = {}) {
  return new Request('https://studio.example.com' + path, options)
}
const environment = {
  ACCESS_TEAM_DOMAIN: 'example.cloudflareaccess.com',
  ACCESS_AUD: 'expected-audience',
  OWNER_EMAIL: 'owner@example.com',
  GITHUB_TOKEN: 'not-a-real-token'
}

test('private studio denies unsigned visitors on every route', async () => {
  for (const path of ['/', '/api/publish', '/unexpected']) {
    const response = await studio.fetch(request(path))
    assert.equal(response.status, 503, 'Unconfigured app remains unavailable')
    const protectedResponse = await studio.fetch(request(path), environment)
    assert.equal(protectedResponse.status, 403, 'Configured app requires verified Access JWT')
  }
})
test('client-defined identity and forged tokens cannot authorize a request', async () => {
  const forged = await studio.fetch(request('/', {
    headers: { 'Cf-Access-Jwt-Assertion': 'not.a.jwt', 'X-Owner-Email': environment.OWNER_EMAIL }
  }), environment)
  assert.equal(forged.status, 403)
})
test('publishing without a signed Access session never calls external services', async () => {
  const response = await studio.fetch(request('/api/publish', {
    method: 'POST',
    headers: { 'Origin': 'https://studio.example.com', 'Content-Type': 'image/png', 'X-Avatar-Confirm': 'publish' },
    body: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
  }), environment)
  assert.equal(response.status, 403)
})

test('publishing is staged; generation and Pages deployment are separate', async () => {
  const { readFile } = await import('node:fs/promises')
  const workerSource = await readFile(new URL('./worker.mjs', import.meta.url), 'utf8')
  const workflow = await readFile(new URL('../.github/workflows/avatar-studio-publish.yml', import.meta.url), 'utf8')
  assert.match(workerSource, /const TARGET_BRANCH = 'feature\/avatar-studio'/)
  assert.match(workerSource, /branch: TARGET_BRANCH/)
  assert.doesNotMatch(workerSource, /branch: 'main'/)
  assert.match(workflow, /src\/assets\/avatar\.png/)
  assert.match(workflow, /public\/favicon\/wendell-avatar-animated\.webp/)
  assert.match(workflow, /public\/favicon\/wendell-avatar-animated\.gif/)
  assert.match(workflow, /git add -- src\/assets\/avatar\.png public\/favicon\/wendell-avatar-animated\.webp public\/favicon\/wendell-avatar-animated\.gif/)
  assert.match(workflow, /gh workflow run deploy\.yml/)
})
