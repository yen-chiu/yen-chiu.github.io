import assert from 'node:assert/strict'
import {sitePath} from '../src/utils/site-path.ts'
assert.equal(sitePath('blog/中文','/yen-chiu-astro'),'/yen-chiu-astro/blog/中文')
assert.equal(sitePath('/yen-chiu-astro/blog/a','/yen-chiu-astro'),'/yen-chiu-astro/blog/a')
assert.equal(sitePath('https://yenchiu.com/chat/','/yen-chiu-astro'),'https://yenchiu.com/chat/')
assert.equal(sitePath('#section','/yen-chiu-astro'),'#section')
console.log('Runtime path regression checks passed')
assert.equal(sitePath('contentIndex.json','/yen-chiu-astro'),'/yen-chiu-astro/contentIndex.json')
assert.equal(sitePath('search','/yen-chiu-astro'),'/yen-chiu-astro/search')
