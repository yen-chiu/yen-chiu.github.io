import assert from 'node:assert/strict'
import test from 'node:test'
import { createAvatarTapCounter, FOCUS_URL } from '../src/utils/avatar-easter-egg.ts'

test('the fifth consecutive tap triggers FOCUS, then starts a new sequence', () => {
  const tap = createAvatarTapCounter()
  assert.deepEqual([0, 200, 400, 600, 800].map(tap), [false, false, false, false, true])
  assert.equal(tap(1000), false)
  assert.equal(FOCUS_URL, 'https://yenchiu.com/Inhuman/FOCUS/FOCUS.html')
})

test('a pause clears the partial sequence; separate avatars have separate counts', () => {
  const tap = createAvatarTapCounter()
  ;[0, 100, 200, 300].forEach(now => assert.equal(tap(now), false))
  assert.equal(tap(2000), false)
  assert.deepEqual([2100, 2200, 2300, 2400].map(tap), [false, false, false, true])
  assert.equal(createAvatarTapCounter()(2500), false)
})
