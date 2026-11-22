import { readFile, writeFile } from 'node:fs/promises'

const data = JSON.parse(await readFile('public/links.json', 'utf8'))
const previous = JSON.parse(await readFile('public/links-status.json', 'utf8'))
const oldByUrl = new Map((previous.links ?? []).map(item => [item.url, item]))
const entries = data.friends.flatMap(group => group.link_list.map(item => ({
  url: item.link, name: item.name, group: group.id_name
})))
const now = new Date().toISOString()

async function probe(address) {
  try {
    const url = new URL(address)
    if (!['http:', 'https:'].includes(url.protocol)) return { ok: false, code: null, error: 'Unsupported protocol' }
    const options = method => ({
      method, redirect: 'follow',
      signal: AbortSignal.timeout(12000),
      headers: { 'user-agent': 'VesperLinksHealth/1.0' }
    })
    let response = await fetch(url, options('HEAD'))
    if ([403, 405, 501].includes(response.status)) response = await fetch(url, options('GET'))
    if (response.body) await response.body.cancel()
    return {
      ok: response.status >= 200 && response.status < 400,
      code: response.status,
      error: response.status >= 400 ? 'HTTP ' + response.status : null
    }
  } catch (error) {
    return { ok: false, code: null, error: String(error?.message ?? error).slice(0, 140) }
  }
}

const result = Array(entries.length)
let position = 0
async function worker() {
  while (position < entries.length) {
    const index = position++
    const entry = entries[index]
    const check = await probe(entry.url)
    const previousFailures = Number(oldByUrl.get(entry.url)?.failures ?? 0)
    const failures = check.ok ? 0 : previousFailures + 1
    result[index] = {
      ...entry,
      state: check.ok ? 'healthy' : failures >= 3 ? 'down' : 'suspect',
      code: check.code,
      failures,
      error: check.error,
      checkedAt: now
    }
  }
}
await Promise.all(Array.from({ length: Math.min(4, entries.length) }, worker))

const summary = {
  healthy: result.filter(item => item.state === 'healthy').length,
  suspect: result.filter(item => item.state === 'suspect').length,
  down: result.filter(item => item.state === 'down').length
}
await writeFile('public/links-status.json', JSON.stringify({ checkedAt: now, summary, links: result }, null, 2) + '\n')
console.log('Checked ' + result.length + ' links: ' + JSON.stringify(summary))
