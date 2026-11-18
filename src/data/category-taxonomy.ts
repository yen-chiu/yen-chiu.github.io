// Presentation taxonomy: source folders and article URLs remain unchanged.
export const categoryTopics = [
  { title: '建站笔记', description: '博客搭建、写作发布与性能优化' },
  { title: '技术实践', description: '工具开发、服务部署与逆向安全' },
  { title: '生活记录', description: '学习、观影与日常感受' }
] as const

export const categoryAliases: Record<string, string> = {
  'Blogging': '建站笔记/性能优化',
  'Blogging/Tutorial': '建站笔记/写作发布',
  'Blog/Markdown': '建站笔记/部署配置',
  '技术/安全': '技术实践/逆向与安全',
  '技术/逆向': '技术实践/逆向与安全',
  '技术/折腾': '技术实践/工具与开发',
  '技术/运维': '技术实践/服务部署',
  'Uncategories/Git': '技术实践/工具与开发',
  '杂记/Feeling': '生活记录/学习与日常',
  '杂记/Writing': '生活记录/学习与日常',
  '杂记/影视': '生活记录/阅读观影',
  '杂记/折腾': '建站笔记/写作发布'
}

// Old parent folders now lead to the corresponding topic overview.
const legacyCategories = {
  ...categoryAliases,
  'Blogging': '建站笔记',
  'Blog': '建站笔记',
  '技术': '技术实践',
  'Uncategories': '技术实践',
  '杂记': '生活记录'
}
export const categoryRedirects = Object.fromEntries(
  Object.entries(legacyCategories).map(([from, to]) => [`/categories/${from}`, `/categories/${to}`])
)

export function canonicalCategory(sourceFolder: string): string {
  return categoryAliases[sourceFolder] ?? sourceFolder
}
