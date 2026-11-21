import assert from 'node:assert/strict'
import test from 'node:test'
import {
  anniversaryYear,
  currentAnniversaryYear,
  localDay,
  period,
  statusForYear,
  visibleLetter
} from '../src/utils/herbarium.ts'

test('anniversaryYear 以 3 月 12 日为分界', () => {
  assert.equal(anniversaryYear('2023-03-11'), null, '建站日之前不计入生长年度')
  assert.equal(anniversaryYear('2023-03-12'), 2023, '建站当天属于第 1 年')
  assert.equal(anniversaryYear('2024-03-11'), 2023, '周年前一天仍属于上一年')
  assert.equal(anniversaryYear('2024-03-12'), 2024, '周年当天进入新的一年')
  assert.equal(anniversaryYear('2026-11-21'), 2026)
})

test('anniversaryYear 拒绝非法日期', () => {
  assert.equal(anniversaryYear('2023-3-12'), null, '格式不对')
  assert.equal(anniversaryYear('2023-02-30'), null, '不存在的日期')
  assert.equal(anniversaryYear(''), null)
  assert.equal(anniversaryYear('not-a-date'), null)
})

test('period 是左闭右开区间，且跨闰年不出错', () => {
  assert.deepEqual(period(2023), {
    start: '2023-03-12',
    endExclusive: '2024-03-12',
    timezone: 'Asia/Shanghai'
  })
  assert.deepEqual(period(2024), {
    start: '2024-03-12',
    endExclusive: '2025-03-12',
    timezone: 'Asia/Shanghai'
  })
  assert.equal(period(2024).start, period(2023).endExclusive, '上一年终点即下一年起点')
})

test('分桶边界：年份区间首尾相接且不重叠', () => {
  const days = ['2023-03-12', '2024-03-11', '2024-03-12', '2025-03-11', '2026-03-11', '2026-03-12']
  assert.deepEqual(days.map(anniversaryYear), [2023, 2023, 2024, 2024, 2025, 2026])
})

test('currentAnniversaryYear 按上海时区取当天', () => {
  const at = iso => new Date(iso)
  assert.equal(currentAnniversaryYear(at('2026-03-11T23:30:00+08:00')), 2025, '周年前一天仍是上一年')
  assert.equal(currentAnniversaryYear(at('2026-03-12T00:30:00+08:00')), 2026, '跨过周年即进入新任一年')
  assert.equal(localDay(at('2026-03-11T16:30:00Z')), '2026-03-12', 'UTC 16:30 已是上海次日')
})

test('statusForYear 只有当前生长年度是 open', () => {
  const now = new Date('2026-11-21T09:00:00+08:00')
  assert.equal(statusForYear(2023, now), 'pending')
  assert.equal(statusForYear(2026, now), 'open')
  assert.equal(statusForYear(2027, now), 'pending')
})

test('visibleLetter 只放行公开且已发布的手记', () => {
  const base = { title: '手记', writtenAt: '2026-11-01', content: '正文' }
  assert.equal(visibleLetter({ year: 2026, title: null, milestones: [], letter: null }), null)
  assert.equal(
    visibleLetter({ year: 2026, title: null, milestones: [], letter: { ...base, visibility: 'private', status: 'published' } }),
    null,
    '私密手记不显示'
  )
  assert.equal(
    visibleLetter({ year: 2026, title: null, milestones: [], letter: { ...base, visibility: 'public', status: 'draft' } }),
    null,
    '草稿不显示'
  )
  const letter = { ...base, visibility: 'public', status: 'published' }
  assert.deepEqual(visibleLetter({ year: 2026, title: null, milestones: [], letter }), letter)
})
