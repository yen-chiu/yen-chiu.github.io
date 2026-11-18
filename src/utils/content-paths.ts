import type { CollectionEntry } from 'astro:content'
import { canonicalCategory } from '../data/category-taxonomy.ts'

type BlogPost = CollectionEntry<'blog'>

export interface CategorySegment {
  name: string
  path: string
}

function normalizePath(value: string): string {
  return value
    .replaceAll('\\', '/')
    .replace(/^\/+|\/+$/g, '')
    .replace(/\/+/g, '/')
}

export function getPostSlug(post: BlogPost): string {
  if (post.data.slug) return normalizePath(post.data.slug)

  return normalizePath(post.id).replace(/\.(md|mdx)$/, '').replace(/\/index$/, '')
}

export function getPostPath(post: BlogPost): string {
  return `/blog/${getPostSlug(post)}`
}

export function getPostSourceId(post: BlogPost): string {
  if (!post.filePath) return normalizePath(post.id)

  return normalizePath(post.filePath)
    .replace(/^src\/content\/blog\//, '')
    .replace(/\.(md|mdx)$/, '')
}

export function getPostCategory(post: BlogPost): string | undefined {
  const sourceId = getPostSourceId(post)
  const separator = sourceId.lastIndexOf('/')
  return separator === -1 ? undefined : canonicalCategory(sourceId.slice(0, separator))
}

export function getCategorySegments(category?: string): CategorySegment[] {
  if (!category) return []

  return normalizePath(category)
    .split('/')
    .filter(Boolean)
    .map((name, index, parts) => ({
      name,
      path: parts.slice(0, index + 1).join('/')
    }))
}

export function getPostCategorySegments(post: BlogPost): CategorySegment[] {
  return getCategorySegments(getPostCategory(post))
}

export function getCategoryLabel(category: string): string {
  return category
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function getAllCategories(posts: BlogPost[]): Map<string, BlogPost[]> {
  const categories = new Map<string, BlogPost[]>()

  for (const post of posts) {
    const category = getPostCategory(post)
    if (!category) continue

    const segments = getCategorySegments(category)
    for (const segment of segments) {
      const categoryPosts = categories.get(segment.path) ?? []
      categoryPosts.push(post)
      categories.set(segment.path, categoryPosts)
    }
  }

  return categories
}
