import test from 'node:test'
import assert from 'node:assert/strict'
import {writeFileSync} from 'node:fs'
import {classifyResponse,classifyCurlFailure,finalHeader,runProbe,exitCode,markdownSummary} from './network-probe.mjs'

test('only final response headers are used, case insensitive',()=>{
 const raw='HTTP/1.1 200 Connection established\r\n\r\nHTTP/2 302\r\nCF-Mitigated: challenge\r\nCF-Ray: old\r\n\r\nHTTP/2 200\r\ncf-ray: abcd-IAD\r\nCF-Cache-Status: HIT\r\n\r\n'
 assert.equal(finalHeader(raw,'cf-mitigated'),null)
 assert.equal(finalHeader(raw,'CF-Ray'),'abcd-IAD')
 assert.equal(finalHeader(raw,'cf-cache-status'),'HIT')
})
test('challenge is distinct from bare 403 and never a success',()=>{
 for(const status of [200,403,503])assert.equal(classifyResponse(status,'Challenge'),'cloudflare_challenge')
 for(const [status,category] of [[200,'success'],[204,'success'],[401,'access_denied'],[403,'access_denied'],[404,'http_client_error'],[429,'http_client_error'],[503,'http_server_error'],[302,'http_redirect'],[0,'http_other_error']])assert.equal(classifyResponse(status,null),category)
})
test('curl transport outcomes are classified separately',()=>{
 for(const [status,category] of [[5,'dns_error'],[6,'dns_error'],[7,'connect_error'],[28,'timeout'],[35,'tls_error'],[60,'tls_error'],[47,'redirect_error'],[56,'transport_error']])assert.equal(classifyCurlFailure({status}),category)
 assert.equal(classifyCurlFailure({code:'ETIMEDOUT'}),'timeout')
 assert.equal(classifyCurlFailure({code:'ENOENT'}),'probe_error')
})
test('probe preserves diagnostics, resets headers between samples, excludes failures from timing',()=>{
 let n=0
 const report=runProbe({samples:3,execute:(command,args)=>{
  assert.equal(command,'curl')
  const file=args[args.indexOf('--dump-header')+1]
  const i=n++
  if(i===1)throw Object.assign(new Error('DNS failure'),{status:6})
  const challenge=i===0||i===3
  const status=challenge?403:i===4?503:200
  writeFileSync(file,'HTTP/2 '+status+'\r\ncf-ray: abcd-IAD\r\n'+(challenge?'cf-mitigated: challenge\r\n':'')+'\r\n')
  const seconds=challenge?9:.2
  return JSON.stringify({response_code:status,time_namelookup:.01,time_connect:.02,time_appconnect:.03,time_starttransfer:seconds,time_total:seconds,size_download:123,remote_ip:'192.0.2.1'})
 }})
 assert.equal(report.totals.attempts,18)
 assert.equal(report.totals.success,14)
 assert.equal(report.totals.failed,4)
 assert.deepEqual(report.totals.categories,{cloudflare_challenge:2,dns_error:1,success:14,http_server_error:1})
 assert.equal(report.rows[0].ray,'abcd-IAD')
 assert.equal(report.rows[1].ray,null)
 assert.equal(report.rows[1].mitigated,null)
 assert.equal(report.summary[0].ttfbMedianMs,200)
 assert.equal(report.summary[1].totalP95Ms,200)
 assert.equal(exitCode(report),1)
 assert.match(markdownSummary(report),/cloudflare_challenge/)
 assert.match(markdownSummary(report),/abcd-IAD/)
})
test('all challenges have null timing percentiles; fully successful run exits zero',()=>{
 function fixture(challenge){return runProbe({samples:1,execute:(_command,args)=>{
  writeFileSync(args[args.indexOf('--dump-header')+1],'HTTP/2 '+(challenge?403:200)+'\r\n'+(challenge?'CF-Mitigated: challenge\r\n':'')+'\r\n')
  return JSON.stringify({response_code:challenge?403:200,time_namelookup:0,time_connect:0,time_appconnect:0,time_starttransfer:.1,time_total:.2,size_download:1})
 }})}
 const blocked=fixture(true)
 assert.equal(blocked.totals.successRate,0)
 assert.equal(blocked.summary[0].ttfbMedianMs,null)
 assert.equal(blocked.summary[0].totalP95Ms,null)
 assert.equal(exitCode(blocked),1)
 const ok=fixture(false)
 assert.equal(ok.totals.successRate,100)
 assert.equal(exitCode(ok),0)
})
