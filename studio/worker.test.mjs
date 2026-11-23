import test from 'node:test'
import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import studio, { __test } from './worker.mjs'

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

test('publishing restores the dirty worktree before checking out main', async () => {
  const { readFile } = await import('node:fs/promises')
  const workflow = await readFile(new URL('../.github/workflows/avatar-studio-publish.yml', import.meta.url), 'utf8')
  const restore = workflow.indexOf('git checkout -- src/assets/avatar.png')
  const switchToMain = workflow.indexOf('git switch -C avatar-publish origin/main')
  assert.ok(restore > 0, 'the workflow must restore generated files')
  assert.ok(switchToMain > restore, 'restore must run before switching to main')
  assert.match(workflow, /git rebase origin\/main/, 'a rejected push must rebase and retry')
  assert.match(workflow, /if git push origin HEAD:main/)
})

test('blobSha matches the Git object id for known content', async () => {
  assert.equal(await __test.blobSha(new Uint8Array()), 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391')
  const hello = new TextEncoder().encode('hello\n')
  assert.equal(await __test.blobSha(hello), 'ce013625030ba8dba906f756967f9e9ca394464a')
})

test('validatePng accepts the real source avatar and rejects broken uploads', async () => {
  const { readFile } = await import('node:fs/promises')
  const avatar = await readFile(new URL('../src/assets/avatar.png', import.meta.url))
  const dimensions = __test.validatePng(avatar)
  assert.equal(dimensions.width, dimensions.height)

  assert.throws(() => __test.validatePng(new Uint8Array(16)), /4 MB or smaller/)
  const notPng = new Uint8Array(avatar)
  notPng[1] = 0
  assert.throws(() => __test.validatePng(notPng), /Not a PNG image/)
  const truncated = avatar.subarray(0, avatar.length - 12)
  assert.throws(() => __test.validatePng(truncated), /Incomplete PNG/)
})

test('a duplicate upload is reported as unchanged instead of creating commits', async () => {
  const { readFile } = await import('node:fs/promises')
  const workerSource = await readFile(new URL('./worker.mjs', import.meta.url), 'utf8')
  assert.match(workerSource, /current\.sha === sha/)
  assert.match(workerSource, /unchanged: true/)
  assert.match(workerSource, /HTTP \(409\|422\)/)
})

test('generated assets are committed together and never separately', async () => {
  const { readFile } = await import('node:fs/promises')
  const workflow = await readFile(new URL('../.github/workflows/avatar-studio-publish.yml', import.meta.url), 'utf8')
  const files = ['src/assets/avatar.png', 'public/favicon/wendell-avatar-animated.gif', 'public/favicon/wendell-avatar-animated.webp']
  for (const file of files) assert.ok(workflow.includes(file), file)
  assert.match(workflow, /staged_paths=.*git diff --cached --name-only/)
  assert.match(workflow, /exit 1/)
  await writeFile(join(tmpdir(), 'avatar-studio-contract.txt'), 'ok')
})
