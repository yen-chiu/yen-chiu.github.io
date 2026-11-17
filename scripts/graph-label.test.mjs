import assert from 'node:assert/strict'
import {graphLabel} from '../src/utils/graph-label.ts'
assert.equal(graphLabel('#cloudflare','tag',true),'')
assert.equal(graphLabel('#cloudflare','tag',true,true),'#cloudflare')
assert.equal(graphLabel('一二三四五六七八九十一二三四','blog',true),'一二三四五六七八九十一二…')
assert.equal(graphLabel('完整文章标题','blog',false),'完整文章标题')
console.log('Graph label checks passed')
