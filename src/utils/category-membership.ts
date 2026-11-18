// The index includes ancestors for discovery; only the deepest category in each branch owns an article directly.
export function isDirectCategory(categories: string[], path: string): boolean {
  return categories.includes(path) && !categories.some(category => category.startsWith(`${path}/`))
}
