import assert from 'node:assert/strict'
import {rewriteJavaScript,prefix} from './pages-paths.mjs'
// 根域部署：base 为空，脚本必须是彻底的 no-op（保留以便将来回退子路径）
assert.equal(rewriteJavaScript('const r=/blog/; const x="/blog/a";const slash="/";'), 'const r=/blog/; const x="/blog/a";const slash="/";')
assert.equal(prefix('https://yenchiu.com/chat/'),'https://yenchiu.com/chat/')
assert.equal(prefix('/blog/a'),'/blog/a')
assert.equal(rewriteJavaScript('const p=`/blog/${slug}`'), 'const p=`/blog/${slug}`')
console.log('Pages path regression checks passed')
