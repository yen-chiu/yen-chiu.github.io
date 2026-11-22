import { execFileSync } from 'node:child_process'
import { writeFile } from 'node:fs/promises'

const target = 'public/links.json'
function git(...args) {
  try { return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() }
  catch { return '' }
}
function readRevision(ref) {
  const raw = git('show', ref + ':' + target)
  if (!raw) return { friends: [] }
  try { return JSON.parse(raw) } catch { return { friends: [] } }
}
function entries(doc) {
  return new Map((doc.friends ?? []).flatMap(group => (group.link_list ?? []).map(link => [
    link.link.replace(/\/+$/, ''), { ...link, group: group.id_name }
  ])))
}
const commits = git('log', '--format=%H', '-n', '60', '--', target).split('\n').filter(Boolean)
const changes = []
for (const sha of commits) {
  const next = entries(readRevision(sha))
  const prior = entries(readRevision(sha + '^'))
  const date = git('show', '-s', '--format=%cI', sha)
  const title = git('show', '-s', '--format=%s', sha)
  const all = new Set([...next.keys(), ...prior.keys()])
  for (const url of all) {
    const after = next.get(url), before = prior.get(url)
    let action
    if (!before && after) action = 'added'
    else if (before && !after) action = 'removed'
    else if (JSON.stringify(before) !== JSON.stringify(after)) action = 'updated'
    else continue
    changes.push({ action, name: (after ?? before).name, url: (after ?? before).link, date, commit: sha.slice(0, 7), title })
  }
  if (changes.length >= 30) break
}
await writeFile('public/links-history.json', JSON.stringify(changes.slice(0, 30), null, 2) + '\n')
console.log('Generated ' + Math.min(changes.length, 30) + ' friend-link change entries')
