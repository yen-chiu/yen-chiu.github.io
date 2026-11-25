import test from 'node:test'
import assert from 'node:assert/strict'
import {parseCamera} from '../src/lib/gallery-camera.mjs'
const fields=input=>Object.fromEntries(parseCamera(input).settings.map(({label,value})=>[label,value]))
test('existing published line and unordered input produce the same four fields',()=>{
 const expected={'焦距':'147mm','光圈':'f/5.6','快门':'1/250s','感光度':'ISO 1000'}
 assert.deepEqual(fields('147mm  F5.6  1/250s  ISO1000'),expected)
 assert.deepEqual(fields('ISO 1000 · 1/250s；F5.6, 147 mm'),expected)
 assert.deepEqual(fields('ＩＳＯ１０００ · １４７ｍｍ · Ｆ５．６ · １／２５０秒'),expected)
})
test('partial values, decimals and labelled equipment',()=>{
 assert.deepEqual(fields('ISO400 · 0.5s'),{'快门':'0.5s','感光度':'ISO 400'})
 assert.deepEqual(fields('相机: Nikon D750 · 镜头: 70-200mm f/2.8 · ISO800 · 147mm'),{'相机':'Nikon D750','镜头':'70-200mm f/2.8','焦距':'147mm','感光度':'ISO 800'})
 assert.deepEqual(fields('NIKON D750 · 35mm F1.8'),{'相机':'NIKON D750','焦距':'35mm','光圈':'f/1.8'})
 assert.deepEqual(fields('快门: 2秒；焦距: 35.5mm；光圈: f/8'),{'焦距':'35.5mm','光圈':'f/8','快门':'2s'})
})
test('unlabelled zoom lens is not mistaken for shooting settings',()=>{
 const result=parseCamera('70-200mm f/2.8 · ISO 400')
 assert.deepEqual(result.settings,[{label:'感光度',value:'ISO 400'}])
 assert.deepEqual(result.notes,['70-200mm f/2.8'])
})
test('empty, invalid, unknown and conflicting values are not invented or lost',()=>{
 assert.deepEqual(parseCamera(''),{settings:[],notes:[]})
 assert.deepEqual(parseCamera('unknown equipment · 0mm · f/0 · 1/0s · ISO0').settings,[])
 assert.deepEqual(parseCamera('ISO200 ISO400 · 50mm').settings,[{label:'焦距',value:'50mm'}])
 assert.match(parseCamera('ISO200 ISO400').notes.join(' '),/ISO 200.*ISO 400/)
 assert.deepEqual(fields('ISO200 ISO200'),{'感光度':'ISO 200'})
 assert.deepEqual(parseCamera('未记录 · 85mm').notes,['未记录'])
})
