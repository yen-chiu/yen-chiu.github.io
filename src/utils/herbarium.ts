import type { CollectionEntry } from 'astro:content'
import { execFileSync } from 'node:child_process'
import { getPostPath } from './content-paths'
import { sitePath } from './site-path'

export const FIRST_YEAR = 2023
export const TIME_ZONE = 'Asia/Shanghai'
export type ArchiveStatus = 'open' | 'pending' | 'sealed' | 'revised'
export type Completeness = 'available' | 'partial' | 'missing' | 'unverified'
export type ArchivedWork = {
  id: string
  type: 'article' | 'folio'
  title: string
  url: string
  publishedAt: string | null
  updatedAt: string | null
  tags: string[]
  dateSource: string
}
export type Milestone = {
  id: string
  date: string
  type: 'launch' | 'release' | 'redesign' | 'publication' | 'migration' | 'personal' | 'other'
  title: string
  description?: string
  sourceUrls: string[]
  verification: 'verified' | 'manual' | 'unverified'
}
export type AnnualLetter = { title: string; writtenAt: string; content: string; visibility: 'public' | 'private'; status: 'draft' | 'published' }
export type AnnualRecord = { year: number; title: string | null; milestones: Milestone[]; letter: AnnualLetter | null }
export type CommitArchive = { counts: Map<number, number>; head: string | null; generatedAt: string | null; limitation: string | null }

const shanghaiDate = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })
export function localDay(value: Date): string {
  const parts = shanghaiDate.formatToParts(value)
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}
export function anniversaryYear(day: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  const date = new Date(day + 'T00:00:00Z')
  if (!Number.isFinite(date.valueOf()) || date.toISOString().slice(0, 10) !== day || day < '2023-03-12') return null
  const y = Number(day.slice(0, 4))
  return day.slice(5) >= '03-12' ? y : y - 1
}
export function period(year: number) {
  return { start: `${year}-03-12`, endExclusive: `${year + 1}-03-12`, timezone: TIME_ZONE }
}
export function currentAnniversaryYear(now = new Date()) {
  return anniversaryYear(localDay(now)) ?? FIRST_YEAR
}
export function getPublicArticles(posts: CollectionEntry<'blog'>[]): ArchivedWork[] {
  return posts.filter(post => !post.data.draft).map(post => ({
    id: post.id, type: 'article', title: post.data.title, url: sitePath(getPostPath(post)),
    publishedAt: localDay(post.data.publishDate), updatedAt: post.data.updatedDate ? localDay(post.data.updatedDate) : null,
    tags: post.data.tags, dateSource: 'blog.publishDate'
  }))
}
// Folio is a separate repository. Entries require an independently verified publication date.
export function getFolioWorks(): ArchivedWork[] { return [] }

export function readGitArchive(): CommitArchive {
  const missing = (limitation: string): CommitArchive => ({ counts: new Map(), head: null, generatedAt: null, limitation })
  try {
    const shallow = execFileSync('git', ['rev-parse', '--is-shallow-repository'], { encoding: 'utf8' }).trim()
    if (shallow !== 'false') return missing('当前构建使用浅克隆，无法核验完整 Git 历史。')
    // On PR builds HEAD is the feature branch; count only the main branch history.
    let mainRef: string | null = null
    for (const candidate of ['refs/remotes/origin/main', 'refs/heads/main']) {
      try {
        execFileSync('git', ['rev-parse', '--verify', candidate], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
        mainRef = candidate
        break
      } catch { /* try the next verified main ref */ }
    }
    if (!mainRef) return missing('无法核验 main 分支引用，未生成提交统计。')
    const head = execFileSync('git', ['rev-parse', mainRef], { encoding: 'utf8' }).trim()
    const raw = execFileSync('git', ['log', mainRef, '--format=%H%x09%cI'], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 })
    const counts = new Map<number, number>()
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue
      const [sha, date] = line.split('\t')
      if (!/^[a-f0-9]{40}$/.test(sha ?? '')) continue
      const instant = new Date(date)
      if (!Number.isFinite(instant.valueOf())) continue
      const year = anniversaryYear(localDay(instant))
      if (year !== null) counts.set(year, (counts.get(year) ?? 0) + 1)
    }
    return { counts, head, generatedAt: new Date().toISOString(), limitation: null }
  } catch {
    return missing('构建环境无法访问完整 Git 历史，提交统计暂不提供。')
  }
}
export function statusForYear(year: number, now = new Date()): ArchiveStatus {
  return year === currentAnniversaryYear(now) ? 'open' : 'pending'
}
export function visibleLetter(record: AnnualRecord): AnnualLetter | null {
  return record.letter?.visibility === 'public' && record.letter.status === 'published' ? record.letter : null
}
