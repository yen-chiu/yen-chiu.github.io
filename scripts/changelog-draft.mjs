#!/usr/bin/env node
/**
 * 从 git log 里抄一份更新日志草稿。
 *
 *   node scripts/changelog-draft.mjs --repo ../yen-chiu-astro --since 2026-11-19 --gen 3 --site main
 *   node scripts/changelog-draft.mjs --repo . --since 2026-11-18 --until 2026-11-19 --author '念真' --author 'Wendell'
 *
 * 只输出 JSON 草稿（版本、日期、items），标题和一句话摘要还得自己写。
 * 提交信息乱的部分（老式 "Update xxx"）会被标成「调整」，人工再改。
 */
import { execFileSync } from 'node:child_process'

const USAGE = `用法: node scripts/changelog-draft.mjs --since YYYY-MM-DD [选项]

  --repo <路径>      仓库目录，默认当前目录
  --since <日期>     起始日期（含），按提交日期筛选
  --until <日期>     结束日期（含），默认与 since 相同
  --gen <n>          代次，默认 3
  --site <id>        站点，默认 main（main / chat / manual / folio）
  --author <正则>    只收该作者的提交，可重复；不给则全收（会混进模板作者的提交）
  --title <标题>     预填标题
  --summary <摘要>   预填一句话摘要

输出一段可直接粘进 src/data/changelog.json 的草稿。`

const opts = { repo: process.cwd(), since: '', until: '', gen: '3', site: 'main', authors: [], title: '', summary: '' }
const argv = process.argv.slice(2)
for (let i = 0; i < argv.length; i++) {
  const flag = argv[i]
  const value = argv[i + 1]
  switch (flag) {
    case '--repo': opts.repo = value; i++; break
    case '--since': opts.since = value; i++; break
    case '--until': opts.until = value; i++; break
    case '--gen': opts.gen = value; i++; break
    case '--site': opts.site = value; i++; break
    case '--author': opts.authors.push(value); i++; break
    case '--title': opts.title = value; i++; break
    case '--summary': opts.summary = value; i++; break
    case '-h':
    case '--help': console.log(USAGE); process.exit(0)
    default: console.error(`未知参数 ${flag}\n\n${USAGE}`); process.exit(1)
  }
}
if (!opts.since || !/^\d{4}-\d{2}-\d{2}$/.test(opts.since)) {
  console.error(`需要 --since YYYY-MM-DD\n\n${USAGE}`)
  process.exit(1)
}
if (!opts.until) opts.until = opts.since

const git = (...args) => execFileSync('git', args, { cwd: opts.repo, encoding: 'utf8' })

const log = git('log', `--since=${opts.since} 00:00:00`, `--until=${opts.until} 23:59:59`, '--date=short', '--pretty=format:%h\t%ad\t%an\t%s')

const rows = log.split('\n').filter(Boolean).map(line => {
  const [hash, date, author, ...rest] = line.split('\t')
  return { hash, date, author, subject: rest.join('\t') }
})

const authorRe = opts.authors.map(pattern => new RegExp(pattern, 'i'))
const mine = authorRe.length ? rows.filter(row => authorRe.some(re => re.test(row.author))) : rows
const bots = /dependabot|github-actions\[bot\]|renovate/i

const classify = subject => {
  const s = subject.toLowerCase()
  if (/^(feat|feature)\b|新增|加入/.test(s)) return { change: 'added', area: 'feature' }
  if (/^fix\b|修复|修正|bug/.test(s)) return { change: 'fixed', area: 'feature' }
  if (/^docs?\b|文档|readme|注释/.test(s)) return { change: 'changed', area: 'docs' }
  if (/^style\b|样式|配色|排版/.test(s)) return { change: 'changed', area: 'style' }
  if (/^refactor\b|^chore\b|^ci\b|^build\b|依赖|升级|迁移|部署/.test(s)) return { change: 'changed', area: 'infra' }
  return { change: 'changed', area: 'feature' }
}

const items = mine
  .filter(row => !bots.test(row.author))
  .map(row => ({
    ...classify(row.subject),
    scope: opts.site === 'main' ? '主站' : opts.site === 'chat' ? '子站' : opts.site,
    title: row.subject,
    commit: row.hash,
  }))

const dates = items.map(item => item.commit && rows.find(row => row.hash === item.commit)?.date).filter(Boolean)
const date = dates.sort().at(-1) ?? opts.since

const draft = {
  gen: Number(opts.gen),
  site: opts.site,
  date,
  title: opts.title || '（一句话概括这一天）',
  summary: opts.summary || '',
  items: items.length ? items : [{ change: 'changed', area: 'feature', scope: '主站', title: '（这一天没有匹配的提交）' }],
}

console.log(JSON.stringify(draft, null, 2))
console.error(`\n共 ${rows.length} 条提交，其中 ${items.length} 条进了草稿（${opts.since} ~ ${opts.until}，${opts.repo}）。`)
console.error('提醒：模板作者的历史也在同一个仓库里，记得用 --author 过滤。')
