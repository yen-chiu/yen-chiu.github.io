import assert from 'node:assert/strict'
import {unified} from 'unified'
import remarkParse from 'remark-parse'
import wikilinks from '../src/plugins/remark-wikilinks.ts'
import {buildBacklinksMap,getBacklinksForPost,getOutgoingLinks} from '../src/utils/backlinks.ts'
const processor=unified().use(remarkParse).use(wikilinks,{basePath:'/blog'})
const tree=await processor.run(processor.parse('[[second|第二篇]] and `[[do-not-link]]`'))
const paragraph=tree.children[0]
assert.equal(paragraph.children[0].url,'/blog/second')
assert.equal(paragraph.children[0].children[0].value,'第二篇')
assert.equal(paragraph.children.at(-1).type,'inlineCode')
const posts=[{id:'notes/first',body:'[[second]]',data:{title:'第一篇',slug:'first'}},{id:'notes/second',body:'正文',data:{title:'第二篇',slug:'second'}}]
const map=await buildBacklinksMap(posts,'/blog')
assert.equal(getBacklinksForPost(map,'notes/second')[0].title,'第一篇')
assert.equal(getOutgoingLinks(posts[0],posts,'/blog')[0].title,'第二篇')
console.log('Wikilink and backlink regression checks passed')
