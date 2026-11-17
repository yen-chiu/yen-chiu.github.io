import assert from 'node:assert/strict'

import { dateKey, monthCells } from '../src/utils/calendar.ts'

assert.equal(dateKey(new Date('2024-02-29T16:30:00Z')), '2024-03-01')
assert.equal(dateKey(new Date('2024-02-29T15:59:00Z')), '2024-02-29')
let cells = monthCells(2024, 1)
assert.equal(cells.filter(Boolean).length, 29)
assert.deepEqual(cells.slice(0, 4), [null, null, null, '2024-02-01'])
assert.equal(monthCells(2026, 10).filter(Boolean).length, 30)
assert.equal(monthCells(2023, 0)[6], '2023-01-01')
assert.equal(monthCells(2024, 11).at(-1), '2024-12-31')
console.log('Calendar civil-date, leap-year and Monday-first checks passed')
