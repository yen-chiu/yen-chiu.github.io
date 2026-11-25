import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { fadeProgress, springStep } from '../src/utils/hero-motion.ts'

for (const dt of [1 / 60, 1 / 30, 1 / 120]) {
  let state = { position: 0, velocity: 0 },
    max = 0
  for (let i = 0; i < 3 / dt; i++) {
    state = springStep(state, 1, dt)
    max = Math.max(max, state.position)
  }
  assert.ok(Math.abs(state.position - 1) < 0.001)
  assert.ok(max < 1.09)
  for (let i = 0; i < 3 / dt; i++) state = springStep(state, 0, dt)
  assert.ok(Math.abs(state.position) < 0.001)
}
assert.equal(fadeProgress(-1, 0.1, 0.9), 0)
assert.equal(fadeProgress(2, 0.1, 0.9), 1)
let previous = 0
for (let p = 0; p <= 1; p += 0.01) {
  const value = fadeProgress(p, 0.1, 0.9)
  assert.ok(value >= previous)
  previous = value
}
assert.equal(springStep({ position: 0, velocity: 0 }, 1, 0).position, 0)
console.log('Spring convergence, bounded rebound, reverse motion and continuous fade checks passed')

const home = readFileSync('src/pages/index.astro', 'utf8')
assert.match(home, /const directScroll = \(\) => touchViewport\.matches \|\| motionReduced\(\)/)
assert.match(home, /spring = directScroll\(\)\s*\? \{ position: target, velocity: 0 \}/)
assert.match(home, /const rebound = directScroll\(\) \? 0/)
assert.match(home, /height: clamp\(230px, 42svh, 340px\)/)
assert.match(home, /const compact = compactHeight\(\)/)
assert.match(home, /this\.viewportObserver\.observe\(this\)/)
assert.match(home, /if \(cover\.style\.height !== nextHeight\)/)
assert.match(home, /\.hero-intro\{animation:none!important\}/)
assert.match(home, /\.cover-actions a,\.cover-credit\{backdrop-filter:none\}/)
assert.doesNotMatch(home, /Math\.min\(340, innerHeight \* 0\.42\)/)
