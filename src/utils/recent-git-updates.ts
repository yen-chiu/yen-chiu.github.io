import { execFileSync } from 'node:child_process'

/**
 * Automatic, build-time summary of main-branch commits for the About page.
 * Editorial versions still live in src/data/changelog.json; this is a separate
 * "recent changes" layer, not a replacement for reviewed release notes.
 */
export interface RecentUpdateItem {
  change: 'added' | 'changed' | 'fixed' | 'improved'
  area: 'feature' | 'style' | 'infra' | 'docs'
  scope: string
  title: string
  note: string
  links: { label: string; url: string }[]
}
export interface RecentUpdate {
  status: 'released'
  site: 'main'
  date: string
  title: string
  summary: string
  items: RecentUpdateItem[]
}
interface Commit {
  sha: string
  day: string
  subject: string
  category: string
}

const REPO = 'https://github.com/yen-chiu/yen-chiu.github.io'
const dayFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit'
})
const localDay = (value: Date): string => {
  const parts = dayFormatter.formatToParts(value)
  const part = (key: string) => parts.find(item => item.type === key)?.value ?? ''
  return [part('year'), part('month'), part('day')].join('-')
}

const TYPES = {
  ui: { label: '页面说明与交互提示', area: 'style', change: 'changed' },
  posts: { label: '文章内容', area: 'docs', change: 'changed' },
  links: { label: '友情链接与邻站动态', area: 'feature', change: 'improved' },
  branding: { label: '站点名称与标识', area: 'style', change: 'changed' },
  docs: { label: '文档与使用说明', area: 'docs', change: 'changed' },
  fixes: { label: '问题修复', area: 'feature', change: 'fixed' },
  features: { label: '网站功能', area: 'feature', change: 'added' },
  styles: { label: '界面与布局', area: 'style', change: 'improved' },
  infra: { label: '构建与维护', area: 'infra', change: 'changed' }
} as const

type Category = keyof typeof TYPES
const classify = (subject: string): Category => {
  const text = subject.toLowerCase().trim()
  if (/^(?:copy|edit)\(ui\)|^copy:/.test(text)) return 'ui'
  if (/^(?:edit|copy)\((?:posts?|review|blog)\)/.test(text)) return 'posts'
  if (/^[a-z-]+\((?:links?|friend-feed|rss)\)/.test(text)) return 'links'
  if (/^[a-z-]+\((?:branding|brand)\)/.test(text)) return 'branding'
  if (/^(?:docs?)(?:\(|:)|^edit\((?:docs?|readme)\)/.test(text)) return 'docs'
  if (/^(?:fix|hotfix)(?:\(|:|!)/.test(text)) return 'fixes'
  if (/^(?:feat|feature)(?:\(|:|!)/.test(text)) return 'features'
  if (/^(?:style|design)(?:\(|:|!)/.test(text)) return 'styles'
  return 'infra'
}

/**
 * Input is the NUL-terminated git log format:
 * %H%x09%cI%x09%an%x09%s%x00
 *
 * Keep parser pure so build-time extraction can be tested without a git checkout.
 */
export function parseRecentGitLog(raw: string, afterDay: string, maxDays = 3): RecentUpdate[] {
  const byDay = new Map<string, Commit[]>()
  const seen = new Set<string>()
  for (const entry of raw.split('\0')) {
    if (!entry.trim()) continue
    const [sha, when, author, ...subjectParts] = entry.trim().split('\t')
    if (!/^[0-9a-f]{40}$/i.test(sha ?? '') || seen.has(sha)) continue
    seen.add(sha)
    if (/dependabot|github-actions\[bot\]|renovate/i.test(author ?? '')) continue
    const instant = new Date(when)
    if (!Number.isFinite(instant.valueOf())) continue
    const day = localDay(instant)
    if (day <= afterDay) continue
    const subject = subjectParts.join('\t').trim()
    if (!subject || /^(?:merge\b|revert\b)/i.test(subject)) continue
    const group = byDay.get(day) ?? []
    group.push({ sha, day, subject, category: classify(subject) })
    byDay.set(day, group)
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, maxDays)
    .map(([date, commits]): RecentUpdate => {
      const grouped = new Map<Category, Commit[]>()
      for (const commit of commits) {
        const category = commit.category as Category
        const group = grouped.get(category) ?? []
        group.push(commit)
        grouped.set(category, group)
      }
      const sorted = [...grouped.entries()]
        .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
      const items: RecentUpdateItem[] = sorted.map(([key, changes]) => {
        const kind = TYPES[key]
        return {
          change: kind.change,
          area: kind.area,
          scope: '主站',
          title: kind.label,
          note: changes.length + ' 次提交；点击查看最近一笔相关改动',
          links: [{ label: '查看对应提交', url: REPO + '/commit/' + changes[0].sha }]
        }
      })
      const labels = sorted.slice(0, 3).map(([key]) => TYPES[key].label)
      return {
        status: 'released',
        site: 'main',
        date,
        title: labels.join('、') + (sorted.length > 3 ? '等更新' : ''),
        summary: '根据 main 分支的 ' + commits.length + ' 次提交自动整理；正式版本说明仍以更新日志为准。',
        items
      }
    })
}

/** Returns [] rather than inventing updates if Git history is unavailable. */
export function getRecentGitUpdates(afterDay: string, maxDays = 3): RecentUpdate[] {
  try {
    // PR builds use the actual main history, not unmerged feature commits.
    const ref = process.env.GITHUB_EVENT_NAME === 'pull_request' ? 'origin/main' : 'HEAD'
    const raw = execFileSync('git', [
      'log', ref, '--no-merges',
      '--since=' + afterDay + 'T00:00:00+08:00',
      '--max-count=300',
      '--format=%H%x09%cI%x09%an%x09%s%x00'
    ], {
      encoding: 'utf8',
      maxBuffer: 4 * 1024 * 1024,
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore']
    })
    return parseRecentGitLog(raw, afterDay, maxDays)
  } catch {
    return []
  }
}
