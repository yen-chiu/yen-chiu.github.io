import assert from 'node:assert/strict'
import {rewriteJavaScript,prefix} from './pages-paths.mjs'
assert.equal(rewriteJavaScript('const r=/blog/; const x="/blog/a";const slash="/";'), 'const r=/blog/; const x="/yen-chiu-astro/blog/a";const slash="/";')
assert.equal(prefix('https://yenchiu.com/chat/'),'https://yenchiu.com/chat/')
assert.equal(prefix('/yen-chiu-astro/blog/a'),'/yen-chiu-astro/blog/a')
assert.equal(rewriteJavaScript('const p=`/blog/${slug}`'), 'const p=`/yen-chiu-astro/blog/${slug}`')
console.log('Pages path regression checks passed')
