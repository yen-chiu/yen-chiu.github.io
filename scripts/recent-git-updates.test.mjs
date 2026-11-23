import assert from 'node:assert/strict'
import test from 'node:test'
import { parseRecentGitLog } from '../src/utils/recent-git-updates.ts'

const line = (sha, when, author, subject) =>
  [sha, when, author, subject].join('\t') + '\0'

test('关于页自动汇总新提交，按中国日期分组并保留类别', () => {
  const raw = [
    line('a'.repeat(40), '2026-11-22T16:30:00Z', 'Wendell', 'copy(ui): clarify links help'),
    line('b'.repeat(40), '2026-11-23T02:00:00Z', 'Wendell', 'edit(posts): refine article'),
    line('c'.repeat(40), '2026-11-22T02:00:00Z', 'Wendell', 'feat(links): feed cards')
  ].join('')
  const result = parseRecentGitLog(raw, '2026-11-21')
  assert.equal(result.length, 2)
  assert.equal(result[0].date, '2026-11-23')
  assert.equal(result[0].site, 'main')
  assert.equal(result[0].items.length, 2)
  assert.ok(result[0].items.some(item => item.title === '页面说明与交互提示'))
  assert.ok(result[0].items.some(item => item.title === '文章内容'))
  assert.equal(result[1].date, '2026-11-22')
  assert.equal(result[1].items[0].title, '友情链接与邻站动态')
})

test('已记入正式更新日志的日期不再重复生成', () => {
  const raw = line('a'.repeat(40), '2026-11-21T11:00:00+08:00', 'Wendell', 'fix: already curated')
  assert.deepEqual(parseRecentGitLog(raw, '2026-11-21'), [])
})

test('忽略机器人、合并提交、重复项以及无效记录', () => {
  const normal = line('f'.repeat(40), '2026-11-23T10:00:00+08:00', 'Wendell', 'fix: broken navigation')
  const raw = [
    normal, normal,
    line('e'.repeat(40), '2026-11-23T11:00:00+08:00', 'dependabot[bot]', 'chore: bump dependency'),
    line('d'.repeat(40), '2026-11-23T12:00:00+08:00', 'Wendell', 'Merge pull request #123'),
    line('z-not-sha', '2026-11-23T12:00:00+08:00', 'Wendell', 'feat: no sha')
  ].join('')
  const updates = parseRecentGitLog(raw, '2026-11-20')
  assert.equal(updates.length, 1)
  assert.equal(updates[0].items.length, 1)
  assert.equal(updates[0].items[0].title, '问题修复')
  assert.ok(updates[0].items[0].links[0].url.endsWith('/commit/' + 'f'.repeat(40)))
})

test('只有旧提交时返回空集，留给正式日志兜底', () => {
  assert.deepEqual(parseRecentGitLog('', '2026-11-21'), [])
  assert.deepEqual(parseRecentGitLog(line('f'.repeat(40), '2026-11-20T11:00:00Z', 'Wendell', 'feat: old'), '2026-11-21'), [])
})
