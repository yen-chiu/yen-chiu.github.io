import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, access, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

test('font cleanup removes stale fallbacks and preserves fonts without a woff2 alternative', async () => {
  const fixture = await mkdtemp(path.join(tmpdir(), 'vesper-fonts-'))
  try {
    const out = path.join(fixture, 'dist')
    await mkdir(out)
    for (const file of ['math.woff2', 'math.woff', 'math.ttf', 'other.woff', 'absolute.woff2', 'absolute.ttf']) await writeFile(path.join(out, file), 'fixture')
    await writeFile(path.join(out, 'fonts.css'), '@font-face{font-family:math;src:url(math.woff2) format("woff2"),url("math.woff") format("woff"),url(math.ttf) format("truetype")}@font-face{font-family:other;src:url(other.woff) format("woff")}@font-face{font-family:absolute;src:url(/absolute.woff2) format("woff2"),url(/absolute.ttf) format("truetype")}')
    const run = () => execFileSync(process.execPath, [path.join(import.meta.dirname, 'postbuild-report.mjs')], { cwd: fixture })
    run()
    const css = await readFile(path.join(out, 'fonts.css'), 'utf8')
    assert.ok(css.includes('url(math.woff2)'))
    assert.ok(css.includes('url(other.woff)'))
    assert.ok(!css.includes('url("math.woff")'))
    assert.ok(!css.includes('url(math.ttf)'))
    await access(path.join(out, 'math.woff2'))
    await access(path.join(out, 'other.woff'))
    await assert.rejects(access(path.join(out, 'math.woff')))
    await assert.rejects(access(path.join(out, 'math.ttf')))
    await assert.rejects(access(path.join(out, 'absolute.ttf')))
    await access(path.join(out, 'absolute.woff2'))
    run()
    assert.equal(await readFile(path.join(out, 'fonts.css'), 'utf8'), css)
  } finally { await rm(fixture, { recursive: true, force: true }) }
})
