import test from 'node:test'
import assert from 'node:assert/strict'
import {safeExif} from './gallery-exif.mjs'
test('missing and malformed EXIF are harmless',()=>{
 for(const b of [undefined,Buffer.alloc(0),Buffer.from('Exif\0\0II'),Buffer.alloc(100)])assert.deepEqual(safeExif(b),{})
})
test('reads camera model but ignores GPS and serial tags',()=>{
 const b=Buffer.alloc(128);b.write('II');b.writeUInt16LE(42,2);b.writeUInt32LE(8,4);b.writeUInt16LE(3,8)
 for(const [i,tag,value] of [[0,272,'D750'],[1,34853,'GPS!'],[2,42033,'SER!']]){
 const p=10+i*12;b.writeUInt16LE(tag,p);b.writeUInt16LE(2,p+2);b.writeUInt32LE(5,p+4);b.writeUInt32LE(64+i*8,p+8);b.write(value,64+i*8)
 }
 assert.deepEqual(safeExif(b),{camera:'D750',date:''})
})
