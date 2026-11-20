import { sitePath } from '@/utils/site-path'
import { isDirectCategory } from '@/utils/category-membership'
type ContentEntry = {
  slug: string
  title: string
  description?: string
  content?: string
  tags?: string[]
  categories?: string[]
  links?: string[]
  collection?: string
  publishDate?: string
}

type ContentIndexResponse = Record<string, ContentEntry> | ContentEntry[]

type FolderItem = {
  type: 'folder'
  path: string
  name: string
}

type PostItem = {
  type: 'post'
  path: string
  name: string
  entry: ContentEntry
}

type BrowserItem = FolderItem | PostItem
type SortMode = 'name-asc' | 'name-desc' | 'date-desc' | 'date-asc' | 'type'

const selector = '[data-category-browser-overlay]'
const stateKey = 'category-browser-overlay-state'
let activeDialog: HTMLDialogElement | null = null
let overlayController: AbortController | undefined

type PersistedState = {
  currentPath?: string
  selectedIndex?: number
  sortMode?: SortMode
}

const readPersistedState = (): PersistedState => {
  try {
    return JSON.parse(sessionStorage.getItem(stateKey) || '{}') as PersistedState
  } catch {
    sessionStorage.removeItem(stateKey)
    return {}
  }
}

const normalizePath = (value = '') =>
  value
    .replace(/^\/+|\/+$/g, '')
    .split('/')
    .map((part) => decodeURIComponent(part))
    .filter(Boolean)
    .join('/')

const categoryUrl = (path: string) =>
  path ? `/categories/${path.split('/').map(encodeURIComponent).join('/')}` : '/categories'

const entryUrl = (entry: ContentEntry) => sitePath(entry.slug)

const basename = (path: string) => path.split('/').filter(Boolean).at(-1) || '/'

const stripText = (value = '') =>
  value
    .replace(/^\s*---\r?\n[\s\S]*?\r?\n---\r?\n/, '') // Remove frontmatter
    .replace(/^import\s+[\s\S]*?from\s+['"].*?['"];?\s*$/gm, '') // Remove imports
    .replace(/^export\s+.*$/gm, '') // Remove exports
    .replace(/```[\s\S]*?```/g, ' ') // Remove code blocks
    .replace(/`[^`]*`/g, ' ') // Remove inline code
    .replace(/<[^>]+>/g, ' ') // Remove HTML/JSX tags
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Extract text from links
    .replace(/[#*~_]/g, '') // Remove basic markdown formatting chars
    .replace(/^[-+]\s/gm, '') // Remove list bullets
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim()

const initialize = () => {
  const dialog = document.querySelector<HTMLDialogElement>(selector)
  if (!dialog || dialog === activeDialog) return

  overlayController?.abort()
  overlayController = new AbortController()
  const { signal } = overlayController
  activeDialog = dialog
  dialog.dataset.initialized = 'true'

  const closeButton = dialog.querySelector<HTMLElement>('[data-category-browser-close]')
  const upButton = dialog.querySelector<HTMLButtonElement>('[data-category-up]')
  const contextList = dialog.querySelector<HTMLElement>('[data-category-context]')
  const contentsList = dialog.querySelector<HTMLElement>('[data-category-contents]')
  const contentsTitleLabel = dialog.querySelector<HTMLElement>('[data-category-contents-title]')
  const preview = dialog.querySelector<HTMLElement>('[data-category-preview]')
  const pathLabel = dialog.querySelector<HTMLElement>('[data-category-path]')
  const windowPathLabel = dialog.querySelector<HTMLElement>('[data-category-window-path]')
  const countLabel = dialog.querySelector<HTMLElement>('[data-category-count]')
  const command = dialog.querySelector<HTMLElement>('[data-category-command]')
  const commandTitle = dialog.querySelector<HTMLElement>('[data-category-command-title]')
  const commandKey = dialog.querySelector<HTMLElement>('[data-category-command-key]')
  const commandInput = dialog.querySelector<HTMLInputElement>('[data-category-command-input]')
  const commandOptions = dialog.querySelector<HTMLElement>('[data-category-command-options]')
  const hintsList = dialog.querySelector<HTMLElement>('[data-category-hints-list]')
  if (
    !contextList ||
    !contentsList ||
    !contentsTitleLabel ||
    !preview ||
    !pathLabel ||
    !windowPathLabel ||
    !countLabel ||
    !command ||
    !commandTitle ||
    !commandKey ||
    !commandInput ||
    !commandOptions ||
    !hintsList
  )
    return

  let entries: ContentEntry[] = []
  let backlinksMap: Record<string, ContentEntry[]> = {}
  const persistedState = readPersistedState()
  let currentPath = normalizePath(persistedState.currentPath)
  let selectedIndex = Math.max(0, persistedState.selectedIndex || 0)
  let selected: BrowserItem | null = null
  let visibleItems: BrowserItem[] = []
  let sortMode: SortMode = persistedState.sortMode || 'type'
  let commandActions: Array<() => void | Promise<void>> = []
  let commandIndex = 0
  let hasLoaded = false
  let searchMode = false
  let searchResults: BrowserItem[] = []

  const updateHints = (
    hints: Array<{ key: string; label: string }>,
    isPrefix = false,
    prefixText = ''
  ) => {
    hintsList.replaceChildren()
    if (isPrefix) {
      const prefix = document.createElement('span')
      prefix.style.color = 'hsl(var(--primary))'
      prefix.style.fontWeight = '600'
      prefix.textContent = `${prefixText} `
      hintsList.append(prefix)
    }
    hints.forEach((hint) => {
      const span = document.createElement('span')
      const kbd = document.createElement('kbd')
      kbd.textContent = hint.key
      const label = document.createElement('span')
      label.textContent = hint.label
      span.append(kbd, label)
      hintsList.append(span)
    })
  }

  const resetHints = () => {
    updateHints([
      { key: '?', label: 'Help' },
      { key: 'i', label: 'In' },
      { key: 'o', label: 'Out' },
      { key: '/', label: 'Find' },
      { key: 's', label: 'Search' },
      { key: 'c', label: 'Copy' },
      { key: ',', label: 'Sort' },
      { key: 'Esc', label: 'Back' },
      { key: 'q', label: 'Quit' }
    ])
  }

  const buildBacklinksMap = () => {
    backlinksMap = {}
    for (const entry of entries) {
      for (const link of entry.links || []) {
        const normalizedTarget = link.replace(/^\/+/, '').replace(/\/+$/, '')
        if (!backlinksMap[normalizedTarget]) backlinksMap[normalizedTarget] = []
        // Avoid duplicates
        if (!backlinksMap[normalizedTarget].some((e) => e.slug === entry.slug)) {
          backlinksMap[normalizedTarget].push(entry)
        }
      }
    }
  }

  const saveState = () => {
    sessionStorage.setItem(
      stateKey,
      JSON.stringify({
        currentPath,
        selectedIndex,
        sortMode
      } satisfies PersistedState)
    )
  }

  const cloneIcon = (type: BrowserItem['type']) => {
    const name = type === 'folder' ? 'folder' : 'document'
    const template = document.querySelector<HTMLTemplateElement>(
      `template[data-category-icon="${name}"]`
    )
    const icon = document.createElement('span')
    icon.className = 'row-icon'
    if (template) icon.append(template.content.cloneNode(true))
    return icon
  }

  const folderPaths = () => {
    const paths = new Set<string>()
    for (const entry of entries) {
      for (const category of entry.categories || []) {
        const parts = normalizePath(category).split('/').filter(Boolean)
        for (let index = 1; index <= parts.length; index += 1) {
          paths.add(parts.slice(0, index).join('/'))
        }
      }
    }
    return paths
  }

  const entryCategories = (entry: ContentEntry) =>
    (entry.categories || []).map(normalizePath).filter(Boolean)

  const entriesInFolder = (path: string, direct = false) =>
    entries.filter((entry) =>
      direct
        ? isDirectCategory(entryCategories(entry), path)
        : entryCategories(entry).some(category => !path || category === path || category.startsWith(`${path}/`))
    )

  const childFolders = (path: string) => {
    const prefix = path ? `${path}/` : ''
    const children = new Set<string>()
    for (const folder of folderPaths()) {
      if (!folder.startsWith(prefix) || folder === path) continue
      const remainder = folder.slice(prefix.length)
      if (!remainder.includes('/')) children.add(folder)
    }
    return [...children]
  }

  const itemDate = (item: BrowserItem) =>
    item.type === 'post' ? Date.parse(item.entry.publishDate || '') || 0 : 0

  const sortItems = (items: BrowserItem[]) =>
    [...items].sort((left, right) => {
      if (sortMode === 'type' && left.type !== right.type) return left.type === 'folder' ? -1 : 1
      if (sortMode === 'date-desc')
        return itemDate(right) - itemDate(left) || left.name.localeCompare(right.name)
      if (sortMode === 'date-asc')
        return itemDate(left) - itemDate(right) || left.name.localeCompare(right.name)
      const comparison = left.name.localeCompare(right.name, 'zh-CN', { numeric: true })
      return sortMode === 'name-desc' ? -comparison : comparison
    })

  const itemsForCurrentPath = () => {
    const folders: FolderItem[] = childFolders(currentPath).map((path) => ({
      type: 'folder',
      path,
      name: basename(path)
    }))
    const posts: PostItem[] = entriesInFolder(currentPath, true).map((entry) => ({
      type: 'post',
      path: entryUrl(entry),
      name: entry.title || basename(entry.slug),
      entry
    }))
    return sortItems([...folders, ...posts])
  }

  let lastMouseX = -1
  let lastMouseY = -1

  // On narrow screens the panes stack vertically. Move only their scroll host,
  // so selection never scrolls the page behind the modal.
  const revealMobilePane = (target: Element | null) => {
    if (!target || !window.matchMedia('(max-width: 640px)').matches) return
    requestAnimationFrame(() => {
      const host = dialog.querySelector<HTMLElement>('.browser-columns')
      if (!host || !dialog.open || !target.isConnected) return
      host.scrollTo({
        top: Math.max(0, host.scrollTop + target.getBoundingClientRect().top - host.getBoundingClientRect().top - 8),
        behavior: ((globalThis as any).wendellMotion?.reduce?.() ?? matchMedia('(prefers-reduced-motion: reduce)').matches) ? 'auto' : 'smooth'
      })
    })
  }

  const makeRow = (item: BrowserItem, index: number, highlightedTitle?: string) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'browser-row'
    button.dataset.index = String(index)
    button.append(cloneIcon(item.type))

    const copy = document.createElement('span')
    const title = document.createElement('strong')
    if (highlightedTitle) {
      title.innerHTML = highlightedTitle
    } else {
      title.textContent = item.name
    }
    const meta = document.createElement('small')
    meta.textContent =
      item.type === 'folder'
        ? `${entriesInFolder(item.path).length} 篇 · ${childFolders(item.path).length} 个子目录`
        : item.entry.publishDate?.slice(0, 10) || item.entry.collection || '文章'
    copy.append(title, meta)
    button.append(copy)

    const count = document.createElement('span')
    count.className = 'row-count'
    count.textContent = item.type === 'folder' ? '›' : ''
    button.append(count)

    button.addEventListener('click', () => {
      if (index < 0) return
      if (window.matchMedia('(max-width: 640px)').matches && item.type === 'folder') {
        enterFolder(item.path)
      } else {
        selectIndex(index)
        revealMobilePane(preview.closest('.browser-column'))
      }
    })
    button.addEventListener('focus', () => selectIndex(index, false))
    button.addEventListener('mousemove', (e) => {
      if (e.clientX === lastMouseX && e.clientY === lastMouseY) return
      lastMouseX = e.clientX
      lastMouseY = e.clientY
      if (document.activeElement === commandInput) return
      button.focus({ preventScroll: true })
    })
    button.addEventListener('dblclick', () => activate(item))
    button.addEventListener('contextmenu', (e) => e.preventDefault())
    return button
  }

  const renderContext = () => {
    contextList.replaceChildren()
    if (!currentPath) {
      const row = makeRow({ type: 'folder', path: '', name: '全部分类' }, -1)
      row.classList.add('is-current')
      row.querySelector('small')!.textContent = '根目录'
      contextList.append(row)
      return
    }

    const parentPath = currentPath.split('/').slice(0, -1).join('/')
    
    // Add "Go up" button
    const upRow = makeRow({ type: 'folder', path: parentPath, name: '返回上级目录' }, -1)
    upRow.querySelector('small')!.textContent = '..'
    upRow.classList.add('is-up-dir')
    upRow.addEventListener('click', () => enterFolder(parentPath))
    contextList.append(upRow)

    const parentItems = sortItems([
      ...childFolders(parentPath).map((path) => ({
        type: 'folder' as const,
        path,
        name: basename(path)
      })),
      ...entriesInFolder(parentPath, true).map((entry) => ({
        type: 'post' as const,
        path: entryUrl(entry),
        name: entry.title || basename(entry.slug),
        entry
      }))
    ])

    parentItems.forEach((item) => {
      const row = makeRow(item, -1)
      if (item.type === 'folder' && item.path === currentPath) {
        row.classList.add('is-current')
        row.querySelector('small')!.textContent = '当前目录'
      } else {
        row.querySelector('small')!.textContent = item.type === 'folder' ? '同级目录' : '同级文章'
      }
      
      row.addEventListener('click', () => {
        if (item.type === 'folder') enterFolder(item.path)
        else window.location.href = entryUrl(item.entry)
      })
      contextList.append(row)
    })
  }

  const renderContents = (focus = false) => {
    if (upButton) upButton.disabled = !currentPath
    visibleItems = searchMode ? searchResults : itemsForCurrentPath()
    const folderCount = visibleItems.filter((item) => item.type === 'folder').length
    const postCount = visibleItems.length - folderCount
    selectedIndex = Math.min(Math.max(selectedIndex, 0), Math.max(visibleItems.length - 1, 0))
    contentsList.replaceChildren()
    countLabel.textContent = `${folderCount} 目录 · ${postCount} 文章`
    
    if (searchMode) {
      contentsTitleLabel.innerHTML = '<span class="row-icon"></span>搜索结果'
      const icon = cloneIcon('search' as any)
      contentsTitleLabel.querySelector('.row-icon')!.replaceWith(icon)
      pathLabel.textContent = `包含 "${commandInput.value}"`
    } else {
      contentsTitleLabel.textContent = '内容'
      pathLabel.textContent = currentPath ? `/${currentPath}` : '/'
    }
    windowPathLabel.textContent = currentPath ? `/${currentPath}` : '/'

    if (!visibleItems.length) {
      const empty = document.createElement('p')
      empty.className = 'browser-empty'
      empty.textContent = searchMode ? '没有找到匹配项。' : '当前目录没有直接内容。'
      contentsList.append(empty)
      selected = { type: 'folder', path: currentPath, name: basename(currentPath) }
      renderPreview(selected)
      if (focus) dialog.focus()
      return
    }

    visibleItems.forEach((item, index) => {
      let highlightedTitle = undefined
      if (commandTitle.textContent === '查找本地' && commandInput.value) {
        const query = commandInput.value.toLowerCase()
        const lowerName = item.name.toLowerCase()
        const idx = lowerName.indexOf(query)
        if (idx !== -1) {
          highlightedTitle = item.name.slice(0, idx) + 
            `<mark style="background: hsl(var(--primary) / 0.3); color: inherit; border-radius: 2px;">` + 
            item.name.slice(idx, idx + query.length) + `</mark>` + 
            item.name.slice(idx + query.length)
        }
      }
      contentsList.append(makeRow(item, index, highlightedTitle))
    })
    selectIndex(selectedIndex, focus)
  }

  const stat = (label: string, value: string | number) => {
    const wrapper = document.createElement('div')
    const term = document.createElement('dt')
    const description = document.createElement('dd')
    term.textContent = label
    description.textContent = String(value)
    wrapper.append(term, description)
    return wrapper
  }

  const previewSection = (
    title: string,
    items: any[],
    type: 'tag' | 'link' | 'list' = 'tag',
    collapsible = false
  ) => {
    if (!items.length) return null

    const container = collapsible ? document.createElement('details') : document.createElement('section')
    container.className = 'preview-section'
    
    if (collapsible) {
      const summary = document.createElement('summary')
      const heading = document.createElement('h3')
      heading.textContent = title
      summary.append(heading)
      container.append(summary)
    } else {
      const heading = document.createElement('h3')
      heading.textContent = title
      container.append(heading)
    }

    if (type === 'list') {
      const list = document.createElement('ul')
      list.className = 'preview-list'
      for (const item of items.slice(0, 15)) {
        const listItem = document.createElement('li')
        listItem.className = 'preview-list-item'
        const link = document.createElement('a')
        link.className = 'preview-list-link'
        link.href = item.href

        const info = document.createElement('span')
        const strong = document.createElement('strong')
        strong.textContent = item.title
        const small = document.createElement('small')
        small.textContent = item.description
        info.append(strong, small)

        const label = document.createElement('span')
        label.className = 'locate-label'
        label.textContent = item.label || '查看 ↗'

        link.append(info, label)
        listItem.append(link)
        list.append(listItem)
      }
      container.append(list)
    } else {
      const cloud = document.createElement('div')
      cloud.className = 'tag-cloud'
      for (const value of items.slice(0, 12)) {
        const chip = document.createElement('a')
        chip.href = type === 'tag' ? `/tags/${encodeURIComponent(value)}` : value
        chip.textContent = type === 'tag' ? `#${value}` : value
        cloud.append(chip)
      }
      container.append(cloud)
    }
    return container
  }

  const openLinksCommand = (type: 'in' | 'out') => {
    if (!selected) return
    const isFolder = selected.type === 'folder'
    const title = type === 'in' ? (isFolder ? '目录入链文章' : '文章入链列表') : (isFolder ? '目录出链文章' : '文章出链列表')
    const key = type === 'in' ? 'i' : 'o'
    
    let links: Array<{ title: string; meta: string; action: () => void }> = []
    
    if (type === 'in') {
      const backlinks = isFolder
        ? [...new Set(entriesInFolder(selected.path).flatMap(e => backlinksMap[e.slug] || []))]
        : backlinksMap[(selected as PostItem).entry.slug] || []

      links = backlinks.map(entry => ({
        title: entry.title,
        meta: entry.publishDate?.slice(0, 10) || '文章',
        action: () => window.location.href = entryUrl(entry)
      }))
    } else {
      const outbound = isFolder
        ? entriesInFolder(selected.path).flatMap(e => (e.links || []).map(l => ({ source: e, target: l })))
        : ((selected as PostItem).entry.links || []).map(l => ({ source: (selected as PostItem).entry, target: l }))

      links = outbound.map((link: any) => {
        const targetSlug = typeof link === 'string' ? link : link.target
        const normalized = targetSlug.replace(/^\/+/, '').replace(/\/+$/, '')
        const targetEntry = entries.find(e => e.slug === normalized)
        return {
          title: targetEntry?.title || targetSlug,
          meta: targetEntry ? '站内文章' : '外部链接',
          action: () => window.location.href = targetSlug
        }
      })
    }
    
    if (!links.length) return
    openCommand(title, key)
    setCommandOptions(links.map(l => ({
      label: l.title,
      meta: l.meta,
      action: l.action
    })))
  }

  const renderPreview = (item: BrowserItem) => {
    selected = item
    const panel = document.createElement('article')
    panel.className = 'preview-panel'
    const heading = document.createElement('div')
    heading.className = 'preview-heading'
    heading.append(cloneIcon(item.type))
    const headingCopy = document.createElement('div')
    const kind = document.createElement('small')
    const collectionName = item.type === 'folder' 
      ? '目录' 
      : item.entry.collection === 'blog' ? '博客' 
      : item.entry.collection === 'docs' ? '文档' : '文章'
    kind.textContent = collectionName
    const title = document.createElement('h2')
    title.textContent = item.name
    headingCopy.append(kind, title)
    heading.append(headingCopy)
    panel.append(heading)

    const stats = document.createElement('dl')
    stats.className = 'stats-grid'

    if (item.type === 'folder') {
      const folderEntries = entriesInFolder(item.path)
      const directEntries = entriesInFolder(item.path, true)
      const tags = [...new Set(folderEntries.flatMap((entry) => entry.tags || []))]
      const outbound = folderEntries.reduce((total, entry) => total + (entry.links?.length || 0), 0)

      const folderBacklinks = new Set<string>()
      for (const entry of folderEntries) {
        const bls = backlinksMap[entry.slug] || []
        bls.forEach((bl) => folderBacklinks.add(bl.slug))
      }

      const inStat = stat('入链', folderBacklinks.size)
      inStat.style.cursor = 'pointer'
      inStat.addEventListener('click', () => openLinksCommand('in'))
      
      const outStat = stat('出链', outbound)
      outStat.style.cursor = 'pointer'
      outStat.addEventListener('click', () => openLinksCommand('out'))

      stats.append(
        stat('全部文章', folderEntries.length),
        stat('直接文章', directEntries.length),
        inStat,
        outStat
      )
      panel.append(stats)
      const section = previewSection('主要标签', tags)
      if (section) panel.append(section)

      if (folderEntries.length) {
        const recent = [...folderEntries]
          .sort(
            (left, right) =>
              Date.parse(right.publishDate || '') - Date.parse(left.publishDate || '')
          )
          .slice(0, 5)
        const recentSection = previewSection(
          '最近更新',
          recent.map((e) => ({
            title: e.title,
            description: e.publishDate?.slice(0, 10) || '',
            href: entryUrl(e)
          })),
          'list'
        )
        if (recentSection) panel.append(recentSection)
      }
      
      if (folderBacklinks.size) {
        const bls = [...new Set(folderEntries.flatMap(e => backlinksMap[e.slug] || []))]
        const blSection = previewSection(
          '目录入链',
          bls.map(e => ({
            title: e.title,
            description: e.publishDate?.slice(0, 10) || '文章',
            href: entryUrl(e),
            label: '定位 ↗'
          })),
          'list',
          true
        )
        if (blSection) panel.append(blSection)
      }
    } else {
      const description = document.createElement('p')
      description.className = 'post-description'
      
      if (item.entry.description) {
        description.textContent = item.entry.description
      } else {
        const plain = stripText(item.entry.content)
        description.textContent = plain
          ? `${plain.slice(0, 180)}${plain.length > 180 ? '…' : ''}`
          : '暂无摘要'
      }
      
      panel.append(description)

      const backlinks = backlinksMap[item.entry.slug] || []

      const inStat = stat('入链', backlinks.length)
      inStat.style.cursor = 'pointer'
      inStat.addEventListener('click', () => openLinksCommand('in'))
      
      const outStat = stat('出链', item.entry.links?.length || 0)
      outStat.style.cursor = 'pointer'
      outStat.addEventListener('click', () => openLinksCommand('out'))

      stats.append(
        inStat,
        outStat,
        stat('更新时间', item.entry.publishDate ? item.entry.publishDate.slice(0, 10) : '—')
      )
      stats.lastElementChild?.classList.add('wide-stat')
      panel.append(stats)

      if (backlinks.length) {
        const blSection = previewSection(
          '入链文章',
          backlinks.map((e) => ({
            title: e.title,
            description: e.publishDate?.slice(0, 10) || '文章',
            href: entryUrl(e),
            label: '定位 ↗'
          })),
          'list',
          true
        )
        if (blSection) panel.append(blSection)
      }

      if (item.entry.links?.length) {
        const linkSection = previewSection(
          '出链详情',
          item.entry.links.map((link) => {
            const normalizedLink = link.replace(/^\/+/, '').replace(/\/+$/, '')
            const target = entries.find((e) => e.slug === normalizedLink)
            return {
              title: target?.title || link,
              description: target ? '站内文章' : '外部链接',
              href: link,
              label: '访问 ↗'
            }
          }),
          'list',
          true
        )
        if (linkSection) panel.append(linkSection)
      }

      const tags = previewSection('标签', item.entry.tags || [])
      if (tags) panel.append(tags)
    }

    const open = document.createElement('a')
    open.className = 'open-entry'
    open.href = item.type === 'folder' ? categoryUrl(item.path) : entryUrl(item.entry)
    open.textContent = item.type === 'folder' ? '打开分类页面 →' : '阅读全文 →'
    panel.append(open)
    preview.replaceChildren(panel)
  }
  const selectIndex = (index: number, focus = true) => {
    if (index < 0 || index >= visibleItems.length) return
    selectedIndex = index
    const rows = [...contentsList.querySelectorAll<HTMLElement>('.browser-row')]
    rows.forEach((row, rowIndex) => row.classList.toggle('is-previewing', rowIndex === index))
    
    if (focus) {
      const target = rows[index]
      if (target) {
        target.focus({ preventScroll: true })
        target.scrollIntoView({ block: 'nearest' })
      }
    }
    renderPreview(visibleItems[index])
    saveState()
  }

  const enterFolder = (path: string) => {
    currentPath = normalizePath(path)
    searchMode = false
    selectedIndex = 0
    renderContext()
    renderContents(true)
    saveState()
    revealMobilePane(contentsList.closest('.browser-column'))
  }

  const activate = (item = selected) => {
    if (!item) return
    if (item.type === 'folder') enterFolder(item.path)
    else window.location.href = entryUrl(item.entry)
  }

  const closeCommand = (submitSearch = false) => {
    command.hidden = true
    commandInput.hidden = true
    const wasFilteringOrSearching = commandTitle.textContent === '查找本地' || commandTitle.textContent === '全局搜索' || searchMode
    commandInput.value = ''
    commandOptions.replaceChildren()
    commandActions = []
    commandIndex = 0
    dialog.focus()
    resetHints()
    
    // If not submitting search, or if we were just filtering locally, reset view
    if (wasFilteringOrSearching && (!submitSearch || commandTitle.textContent === '查找本地')) {
      searchMode = false
      renderContents()
    }
  }

  const selectCommandOption = (index: number) => {
    const options = [...commandOptions.querySelectorAll<HTMLElement>('.category-command-option')]
    if (!options.length) return
    commandIndex = (index + options.length) % options.length
    options.forEach((option, optionIndex) =>
      option.classList.toggle('is-active', optionIndex === commandIndex)
    )
    options[commandIndex]?.scrollIntoView({ block: 'nearest' })
  }

  const setCommandOptions = (
    options: Array<{ label: string; meta?: string; action: () => void | Promise<void> }>
  ) => {
    commandOptions.replaceChildren()
    commandActions = options.map((option) => option.action)
    options.forEach((option, index) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'category-command-option'
      const label = document.createElement('span')
      label.textContent = option.label
      const meta = document.createElement('small')
      meta.textContent = option.meta || ''
      button.append(label, meta)
      button.addEventListener('mousemove', (e) => {
        if (e.clientX === lastMouseX && e.clientY === lastMouseY) return
        lastMouseX = e.clientX
        lastMouseY = e.clientY
        if (document.activeElement === commandInput) return
        selectCommandOption(index)
      })
      button.addEventListener('click', async () => {
        await option.action()
        closeCommand()
      })
      commandOptions.append(button)
    })
    commandIndex = 0
    selectCommandOption(0)
  }

  const openCommand = (title: string, key: string, withInput = false) => {
    command.hidden = false
    commandTitle.textContent = title
    commandKey.textContent = key
    commandInput.hidden = !withInput
    commandInput.placeholder = title
    commandOptions.replaceChildren()
    commandActions = []
    if (withInput) requestAnimationFrame(() => commandInput.focus())
  }

  const filterLocal = (query: string) => {
    const normalized = query.trim().toLocaleLowerCase()
    if (!normalized) {
      renderContents()
      return
    }
    
    // Auto jump to first match
    for (let index = 0; index < visibleItems.length; index += 1) {
      if (visibleItems[index].name.toLocaleLowerCase().includes(normalized)) {
        selectIndex(index)
        break
      }
    }
    // Re-render to show highlights
    renderContents()
  }

  const globalSearch = (query: string) => {
    const normalized = query.trim().toLocaleLowerCase()
    if (!normalized) {
      searchMode = false
      renderContents()
      return
    }
    
    // Search recursively downwards from currentPath
    const prefix = currentPath ? `${currentPath}/` : ''
    const folders: BrowserItem[] = [...folderPaths()]
      .filter(p => !currentPath || p.startsWith(prefix))
      .map((path) => ({
        type: 'folder' as const,
        path,
        name: basename(path)
      }))
    const posts: BrowserItem[] = entries
      .filter(e => !currentPath || entryCategories(e).some(c => c === currentPath || c.startsWith(prefix)))
      .map((entry) => ({
        type: 'post' as const,
        path: entryUrl(entry),
        name: entry.title || basename(entry.slug),
        entry
      }))
      
    searchResults = [...folders, ...posts]
      .filter((item) => `${item.name} ${item.path}`.toLocaleLowerCase().includes(normalized))
      
    searchMode = true
    renderContents()
  }

  const copyText = async (value: string) => {
    await navigator.clipboard.writeText(value)
  }

  const openCopy = () => {
    const filename = selected
      ? selected.type === 'post'
        ? basename(selected.entry.slug)
        : basename(selected.path)
      : '/'
    
    const url = selected
      ? selected.type === 'post'
        ? entryUrl(selected.entry)
        : categoryUrl(selected.path)
      : categoryUrl(currentPath)

    openCommand('复制选项', 'c')
    setCommandOptions([
      {
        label: '复制访问链接 (URL)',
        meta: url,
        action: () => copyText(new URL(url, window.location.origin).href)
      },
      {
        label: '复制文件名称',
        meta: filename,
        action: () => copyText(filename)
      },
      {
        label: '复制目录链接 (URL)',
        meta: categoryUrl(currentPath),
        action: () => copyText(new URL(categoryUrl(currentPath), window.location.origin).href)
      }
    ])
  }

  const openSort = () => {
    openCommand('Sort by', ',')
    const options: Array<{ mode: SortMode; label: string }> = [
      { mode: 'type', label: 'Type' },
      { mode: 'name-asc', label: 'Name (A → Z)' },
      { mode: 'name-desc', label: 'Name (Z → A)' },
      { mode: 'date-desc', label: 'Date (newest first)' },
      { mode: 'date-asc', label: 'Date (oldest first)' }
    ]
    setCommandOptions(
      options.map(({ mode, label }) => ({
        label,
        meta: sortMode === mode ? 'Current' : '',
        action: () => {
          sortMode = mode
          renderContents()
          saveState()
        }
      }))
    )
  }

  commandInput.addEventListener(
    'input',
    () => {
      if (commandTitle.textContent === '全局搜索') globalSearch(commandInput.value)
      else if (commandTitle.textContent === '查找本地') filterLocal(commandInput.value)
    },
    { signal }
  )

  commandInput.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Enter' || event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        closeCommand(event.key === 'Enter')
      }
    },
    { signal }
  )

  const showHelp = () => {
    openCommand('可用快捷键', '?')
    const options: Array<{ label: string; meta: string; action: () => void }> = [
      { label: '向下移动', meta: 'j / ↓', action: () => {} },
      { label: '向上移动', meta: 'k / ↑', action: () => {} },
      { label: '进入父目录', meta: 'h / ← / Esc', action: () => {} },
      { label: '进入目录 / 打开文章', meta: 'l / → / Enter', action: () => {} },
      { label: '跳转到顶部', meta: 'g', action: () => {} },
      { label: '跳转到底部', meta: 'G', action: () => {} },
      { label: '显示本帮助', meta: '?', action: () => {} },
      { label: '过滤当前列表', meta: '/', action: () => {} },
      { label: '全局搜索', meta: 's', action: () => {} },
      { label: '复制选项', meta: 'c', action: () => {} },
      { label: '排序方式', meta: ',', action: () => {} },
      { label: '入链列表', meta: 'i', action: () => {} },
      { label: '出链列表', meta: 'o', action: () => {} },
      { label: '关闭弹窗', meta: 'Esc (弹窗内)', action: () => closeCommand() },
      { label: '退出管理器', meta: 'q', action: () => dialog.close() }
    ]
    setCommandOptions(options)
  }

  dialog.addEventListener(
    'keydown',
    async (event) => {
      // Allow browser shortcuts like Ctrl+C, Cmd+C, etc. to pass through
      if (event.ctrlKey || event.metaKey || event.altKey) return

      if (!command.hidden) {
        if (event.key === 'Escape') {
          event.preventDefault()
          closeCommand()
        } else if (
          event.key === 'ArrowDown' ||
          (event.key === 'j' && document.activeElement !== commandInput)
        ) {
          event.preventDefault()
          selectCommandOption(commandIndex + 1)
        } else if (
          event.key === 'ArrowUp' ||
          (event.key === 'k' && document.activeElement !== commandInput)
        ) {
          event.preventDefault()
          selectCommandOption(commandIndex - 1)
        } else if (event.key === 'Enter' && commandActions[commandIndex]) {
          event.preventDefault()
          await commandActions[commandIndex]()
          closeCommand()
        }
        return
      }

      if (event.key === '/') {
        event.preventDefault()
        openCommand('查找本地', '/', true)
      } else if (event.key === '?') {
        event.preventDefault()
        showHelp()
      } else if (event.key === 'i') {
        event.preventDefault()
        openLinksCommand('in')
      } else if (event.key === 'o') {
        event.preventDefault()
        openLinksCommand('out')
      } else if (event.key === 's') {
        event.preventDefault()
        openCommand('全局搜索', 's', true)
      } else if (event.key === 'c') {
        event.preventDefault()
        openCopy()
      } else if (event.key === ',') {
        event.preventDefault()
        openSort()
      } else if (event.key === 'ArrowDown' || event.key === 'j') {
        event.preventDefault()
        selectIndex(Math.min(selectedIndex + 1, visibleItems.length - 1))
      } else if (event.key === 'ArrowUp' || event.key === 'k') {
        event.preventDefault()
        selectIndex(Math.max(selectedIndex - 1, 0))
      } else if (event.key === 'Enter') {
        event.preventDefault()
        activate()
      } else if (event.key === 'ArrowRight' || event.key === 'l') {
        event.preventDefault()
        if (selected?.type === 'folder') activate()
      } else if (event.key === 'ArrowLeft' || event.key === 'h') {
        event.preventDefault()
        const parent = currentPath.split('/').slice(0, -1).join('/')
        enterFolder(parent)
      } else if (event.key === 'g') {
        event.preventDefault()
        selectIndex(0)
      } else if (event.key === 'G') {
        event.preventDefault()
        selectIndex(visibleItems.length - 1)
      } else if (event.key === 'q') {
        event.preventDefault()
        dialog.close()
      } else if (event.key === 'Escape') {
        event.preventDefault()
        if (searchMode) {
          searchMode = false
          renderContents(true)
        } else if (currentPath) {
          const parent = currentPath.split('/').slice(0, -1).join('/')
          enterFolder(parent)
          // enterFolder calls renderContents(true) which handles focus.
          // Double-check focus is on a content row after DOM settles.
          requestAnimationFrame(() => {
            const rows = [...contentsList.querySelectorAll<HTMLElement>('.browser-row')]
            const focusedRow = rows[Math.min(selectedIndex, rows.length - 1)]
            if (focusedRow) {
              focusedRow.focus({ preventScroll: false })
            } else {
              dialog.focus()
            }
          })
        } else {
          // At root level, keep focus on dialog
          dialog.focus()
        }
      }
    },
    { signal }
  )

  // Prevent right-click from closing/opening things in the browser
  dialog.addEventListener('contextmenu', (e) => e.preventDefault(), { signal })
  dialog.addEventListener('click', event => {
    if (event.target instanceof Element && event.target.closest('a[href]')) dialog.close()
  }, { signal })
  document.addEventListener('astro:before-swap', () => { if (dialog.open) dialog.close() }, { signal })

  // Blur trigger on close to remove focus outline/decorations
  dialog.addEventListener('close', () => {
    (document.activeElement as HTMLElement)?.blur()
    resetHints()
  }, { signal })

  closeButton?.addEventListener('click', () => dialog.close(), { signal })
  upButton?.addEventListener('click', () => enterFolder(currentPath.split('/').slice(0,-1).join('/')), { signal })
  dialog.addEventListener(
    'click',
    (event) => {
      if (event.target === dialog) dialog.close()
    },
    { signal }
  )

  const openOverlay = async () => {
    if (!dialog.open) dialog.showModal()
    dialog.focus()
    resetHints()

    if (!entries.length) {
      contextList.innerHTML = '<p class="browser-empty">正在读取分类目录...</p>'
      contentsList.innerHTML = '<p class="browser-empty">正在加载内容索引...</p>'
      preview.innerHTML = '<p class="browser-empty">加载完成后显示预览。</p>'
      try {
        const response = await fetch(sitePath('/contentIndex.json'))
        if (!response.ok) throw new Error(`content index: ${response.status}`)
        const data = (await response.json()) as ContentIndexResponse
        entries = Array.isArray(data) ? data : Object.values(data)
        buildBacklinksMap()
      } catch (error) {
        console.error('[category-browser]', error)
        contentsList.innerHTML = '<p class="browser-empty">分类内容加载失败，请稍后重试。</p>'
        return
      }
    }

    if (!hasLoaded && !currentPath) {
      currentPath = normalizePath(window.location.pathname.replace(/^\/categories\/?/, ''))
    }
    if (currentPath && !folderPaths().has(currentPath)) currentPath = ''
    renderContext()
    renderContents()
    hasLoaded = true
    saveState()
  }

  document.addEventListener(
    'click',
    (event) => {
      const trigger = (event.target as Element | null)?.closest<HTMLAnchorElement>(
        '[data-category-open], a[href="#category-browser"]'
      )
      if (!trigger) return
      // Check if it's a right-click (button 2)
      if ((event as MouseEvent).button === 2) return
      event.preventDefault()
      void openOverlay()
    },
    { capture: true, signal }
  )
}

initialize()
document.addEventListener('astro:page-load', initialize)
