import FlexSearch, { type DefaultDocumentSearchResults } from 'flexsearch'

import { sitePath } from '@/utils/site-path'

interface ContentDetails {
  slug: string
  aliases?: string[]
  title: string
  content: string
  tags: string[]
  categories?: string[]
  links: string[]
  collection: 'blog' | 'docs'
  publishDate?: string
}

interface ContentIndex {
  [slug: string]: ContentDetails
}

interface Item {
  id: number
  slug: string
  title: string
  content: string
  tags: string[]
  [key: string]: any
}

type SearchType = 'basic' | 'tags'
let searchType: SearchType = 'basic'
let currentSearchTerm: string = ''

// Encoder for CJK and other languages
const encoder = (str: string): string[] => {
  const tokens: string[] = []
  let bufferStart = -1
  let bufferEnd = -1
  const lower = str.toLowerCase()

  let i = 0
  for (const char of lower) {
    const code = char.codePointAt(0)!

    const isCJK =
      (code >= 0x3040 && code <= 0x309f) ||
      (code >= 0x30a0 && code <= 0x30ff) ||
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0xac00 && code <= 0xd7af) ||
      (code >= 0x20000 && code <= 0x2a6df)

    const isWhitespace = code === 32 || code === 9 || code === 10 || code === 13

    if (isCJK) {
      if (bufferStart !== -1) {
        tokens.push(lower.slice(bufferStart, bufferEnd))
        bufferStart = -1
      }
      tokens.push(char)
    } else if (isWhitespace) {
      if (bufferStart !== -1) {
        tokens.push(lower.slice(bufferStart, bufferEnd))
        bufferStart = -1
      }
    } else {
      if (bufferStart === -1) bufferStart = i
      bufferEnd = i + char.length
    }

    i += char.length
  }

  if (bufferStart !== -1) {
    tokens.push(lower.slice(bufferStart))
  }

  return tokens
}

let index = new FlexSearch.Document<Item>({
  encode: encoder,
  document: {
    id: 'id',
    tag: 'tags',
    index: [
      {
        field: 'title',
        tokenize: 'forward'
      },
      {
        field: 'content',
        tokenize: 'forward'
      },
      {
        field: 'tags',
        tokenize: 'forward'
      }
    ]
  }
})

const p = new DOMParser()
const fetchContentCache: Map<string, Element[]> = new Map()
const contextWindowWords = 30
const numSearchResults = 8
const numTagResults = 5

function removeAllChildren(node: HTMLElement) {
  while (node.firstChild) {
    node.removeChild(node.firstChild)
  }
}

const escapePattern = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const tokenizeTerm = (term: string) => {
  const tokens = term.split(/\s+/).filter((t) => t.trim() !== '')
  const tokenLen = tokens.length
  if (tokenLen > 1) {
    for (let i = 1; i < tokenLen; i++) {
      tokens.push(tokens.slice(0, i + 1).join(' '))
    }
  }

  return tokens.sort((a, b) => b.length - a.length) // always highlight longest terms first
}

function highlight(searchTerm: string, text: string, trim?: boolean) {
  const tokenizedTerms = tokenizeTerm(searchTerm)
  let tokenizedText = text.split(/\s+/).filter((t) => t !== '')

  let startIndex = 0
  let endIndex = tokenizedText.length - 1
  if (trim) {
    const includesCheck = (tok: string) =>
      tokenizedTerms.some((term) => tok.toLowerCase().startsWith(term.toLowerCase()))
    const occurrencesIndices = tokenizedText.map(includesCheck)

    let bestSum = 0
    let bestIndex = 0
    for (let i = 0; i < Math.max(tokenizedText.length - contextWindowWords, 0); i++) {
      const window = occurrencesIndices.slice(i, i + contextWindowWords)
      const windowSum = window.reduce((total, cur) => total + (cur ? 1 : 0), 0)
      if (windowSum >= bestSum) {
        bestSum = windowSum
        bestIndex = i
      }
    }

    startIndex = Math.max(bestIndex - contextWindowWords, 0)
    endIndex = Math.min(startIndex + 2 * contextWindowWords, tokenizedText.length - 1)
    tokenizedText = tokenizedText.slice(startIndex, endIndex)
  }

  const slice = tokenizedText
    .map((tok) => {
      // see if this tok is prefixed by any search terms
      for (const searchTok of tokenizedTerms) {
        if (tok.toLowerCase().includes(searchTok.toLowerCase())) {
          const regex = new RegExp(escapePattern(searchTok), 'gi')
          return tok.replace(regex, `<span class="highlight">$&</span>`)
        }
      }
      return tok
    })
    .join(' ')

  return `${startIndex === 0 ? '' : '...'}${slice}${
    endIndex === tokenizedText.length - 1 ? '' : '...'
  }`
}

function highlightHTML(searchTerm: string, el: HTMLElement) {
  const tokenizedTerms = tokenizeTerm(searchTerm)
  const html = p.parseFromString(el.innerHTML, 'text/html')

  const createHighlightSpan = (text: string) => {
    const span = document.createElement('span')
    span.className = 'highlight'
    span.textContent = text
    return span
  }

  const highlightTextNodes = (node: Node, term: string) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const nodeText = node.nodeValue ?? ''
      const regex = new RegExp(escapePattern(term), 'gi')
      const matches = nodeText.match(regex)
      if (!matches || matches.length === 0) return
      const spanContainer = document.createElement('span')
      let lastIndex = 0
      for (const match of matches) {
        const matchIndex = nodeText.toLowerCase().indexOf(match.toLowerCase(), lastIndex)
        spanContainer.appendChild(document.createTextNode(nodeText.slice(lastIndex, matchIndex)))
        spanContainer.appendChild(createHighlightSpan(match))
        lastIndex = matchIndex + match.length
      }
      spanContainer.appendChild(document.createTextNode(nodeText.slice(lastIndex)))
      node.parentNode?.replaceChild(spanContainer, node)
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      if ((node as HTMLElement).classList.contains('highlight')) return
      Array.from(node.childNodes).forEach((child) => highlightTextNodes(child, term))
    }
  }

  for (const term of tokenizedTerms) {
    highlightTextNodes(html.body, term)
  }

  return html.body
}

// Get current slug from URL
function getCurrentSlug(): string {
  const path = window.location.pathname
  if (path === '/' || path === '') return 'index'
  return path.replace(/^\//, '').replace(/\/$/, '') || 'index'
}

// Resolve relative URL
function resolveUrl(slug: string): string {
  return new URL(sitePath(slug), window.location.origin).href
}

// Normalize relative URLs in HTML
function normalizeRelativeURLs(el: Element | Document, destination: string | URL) {
  const base = typeof destination === 'string' ? new URL(destination) : destination
  el.querySelectorAll('[href=""], [href^="./"], [href^="../"]').forEach((item) => {
    const href = item.getAttribute('href')
    if (href) {
      const rebased = new URL(href, base)
      item.setAttribute('href', rebased.pathname + rebased.hash)
    }
  })
  el.querySelectorAll('[src=""], [src^="./"], [src^="../"]').forEach((item) => {
    const src = item.getAttribute('src')
    if (src) {
      const rebased = new URL(src, base)
      item.setAttribute('src', rebased.pathname + rebased.hash)
    }
  })
}

async function setupSearch(searchElement: Element, _currentSlug: string, data: ContentIndex) {
  const searchRoot = searchElement as HTMLElement
  if (searchRoot.dataset.searchReady === 'true') return

  const container = searchElement.querySelector('.search-container') as HTMLDialogElement
  if (!container) return

  const controller = new AbortController()
  const signal = controller.signal
  // Ensure container is completely hidden on initial load
  container.style.visibility = 'hidden'
  container.style.opacity = '0'

  const searchButton = searchElement.querySelector('.search-button') as HTMLButtonElement
  if (!searchButton) return

  const searchBar = searchElement.querySelector('.search-bar') as HTMLInputElement
  if (!searchBar) return

  const searchLayout = searchElement.querySelector('.search-layout') as HTMLElement
  if (!searchLayout) return

  // Initialize filters
  const filtersContainer = searchElement.querySelector('.search-filters') as HTMLElement
  const dateSelect = filtersContainer?.querySelector('[data-filter="date"]') as HTMLSelectElement
  const tagsMultiselect = filtersContainer?.querySelector('[data-filter="tags"]') as HTMLElement
  const typeMultiselect = filtersContainer?.querySelector('[data-filter="type"]') as HTMLElement

  // Extract all unique tags from data
  const allTags = new Set<string>()
  for (const item of Object.values(data)) {
    if (item.tags) {
      item.tags.forEach((tag) => allTags.add(tag))
    }
  }
  const sortedTags = Array.from(allTags).sort()

  // Filter state
  interface FilterState {
    date: 'all' | 'year' | '6months' | '3months' | 'month'
    tags: string[]
    types: string[]
  }

  let currentFilters: FilterState = {
    date: 'all',
    tags: [],
    types: []
  }

  // Initialize date select
  if (dateSelect) {
    dateSelect.addEventListener('change', () => {
      currentFilters.date = dateSelect.value as FilterState['date']
      triggerSearch()
    })
  }

  // Initialize tags multiselect
  if (tagsMultiselect) {
    const tagsButton = tagsMultiselect.querySelector('.filter-multiselect-button') as HTMLElement
    const tagsDropdown = tagsMultiselect.querySelector(
      '.filter-multiselect-dropdown'
    ) as HTMLElement
    const tagsText = tagsMultiselect.querySelector('.filter-multiselect-text') as HTMLElement

    // Generate tag options
    const allOption = document.createElement('div')
    allOption.className = 'filter-multiselect-option'
    const allCheckbox = document.createElement('input')
    allCheckbox.type = 'checkbox'
    allCheckbox.id = 'tags-all'
    allCheckbox.value = 'all'
    allCheckbox.checked = true
    const allLabel = document.createElement('label')
    allLabel.htmlFor = 'tags-all'
    allLabel.textContent = '全部'
    allOption.appendChild(allCheckbox)
    allOption.appendChild(allLabel)
    tagsDropdown.appendChild(allOption)

    sortedTags.forEach((tag) => {
      const option = document.createElement('div')
      option.className = 'filter-multiselect-option'
      const checkbox = document.createElement('input')
      checkbox.type = 'checkbox'
      checkbox.id = `tags-${tag}`
      checkbox.value = tag
      const label = document.createElement('label')
      label.htmlFor = `tags-${tag}`
      label.textContent = tag
      option.appendChild(checkbox)
      option.appendChild(label)
      tagsDropdown.appendChild(option)
    })

    // Handle "全部" checkbox
    allCheckbox.addEventListener('change', (e) => {
      const checked = (e.target as HTMLInputElement).checked
      if (checked) {
        // Uncheck all other tags
        tagsDropdown
          .querySelectorAll<HTMLInputElement>('input[type="checkbox"]:not(#tags-all)')
          .forEach((cb) => {
            cb.checked = false
          })
        currentFilters.tags = []
        tagsText.textContent = '全部'
      }
      triggerSearch()
    })

    // Handle individual tag checkboxes
    tagsDropdown
      .querySelectorAll<HTMLInputElement>('input[type="checkbox"]:not(#tags-all)')
      .forEach((checkbox) => {
        checkbox.addEventListener('change', () => {
          // Uncheck "全部" if any tag is selected
          if (checkbox.checked) {
            allCheckbox.checked = false
          }

          // Update selected tags
          const selectedTags = Array.from(
            tagsDropdown.querySelectorAll<HTMLInputElement>(
              'input[type="checkbox"]:not(#tags-all):checked'
            )
          ).map((cb) => cb.value)
          currentFilters.tags = selectedTags

          // Update button text
          if (selectedTags.length === 0) {
            allCheckbox.checked = true
            tagsText.textContent = '全部'
          } else if (selectedTags.length === 1) {
            tagsText.textContent = selectedTags[0]
          } else {
            tagsText.textContent = `已选择 ${selectedTags.length} 项`
          }

          triggerSearch()
        })
      })

    // Toggle dropdown
    tagsButton.addEventListener('click', (e) => {
      e.stopPropagation()
      tagsMultiselect.classList.toggle('open')
      tagsButton.setAttribute('aria-expanded', String(tagsMultiselect.classList.contains('open')))
      // Close other multiselects
      if (typeMultiselect) {
        typeMultiselect.classList.remove('open')
        typeMultiselect.querySelector('button')?.setAttribute('aria-expanded', 'false')
      }
    })

    // Close dropdown when clicking outside
    document.addEventListener(
      'click',
      (e) => {
        if (!tagsMultiselect.contains(e.target as Node)) {
          tagsMultiselect.classList.remove('open')
          tagsMultiselect.querySelector('button')?.setAttribute('aria-expanded', 'false')
        }
      },
      { signal }
    )
  }

  // Initialize type multiselect
  if (typeMultiselect) {
    const typeButton = typeMultiselect.querySelector('.filter-multiselect-button') as HTMLElement
    const typeDropdown = typeMultiselect.querySelector(
      '.filter-multiselect-dropdown'
    ) as HTMLElement
    const typeText = typeMultiselect.querySelector('.filter-multiselect-text') as HTMLElement
    const typeAllCheckbox = typeDropdown.querySelector('#type-all') as HTMLInputElement

    // Handle "全部" checkbox
    typeAllCheckbox.addEventListener('change', (e) => {
      const checked = (e.target as HTMLInputElement).checked
      if (checked) {
        // Uncheck all other types
        typeDropdown
          .querySelectorAll<HTMLInputElement>('input[type="checkbox"]:not(#type-all)')
          .forEach((cb) => {
            cb.checked = false
          })
        currentFilters.types = []
        typeText.textContent = '全部'
      }
      triggerSearch()
    })

    // Handle individual type checkboxes
    typeDropdown
      .querySelectorAll<HTMLInputElement>('input[type="checkbox"]:not(#type-all)')
      .forEach((checkbox) => {
        checkbox.addEventListener('change', () => {
          // Uncheck "全部" if any type is selected
          if (checkbox.checked) {
            typeAllCheckbox.checked = false
          }

          // Update selected types
          const selectedTypes = Array.from(
            typeDropdown.querySelectorAll<HTMLInputElement>(
              'input[type="checkbox"]:not(#type-all):checked'
            )
          ).map((cb) => cb.value)
          currentFilters.types = selectedTypes

          // Update button text
          if (selectedTypes.length === 0) {
            typeAllCheckbox.checked = true
            typeText.textContent = '全部'
          } else if (selectedTypes.length === 1) {
            typeText.textContent = checkbox.nextElementSibling?.textContent || '全部'
          } else {
            typeText.textContent = `已选择 ${selectedTypes.length} 项`
          }

          triggerSearch()
        })
      })

    // Toggle dropdown
    typeButton.addEventListener(
      'click',
      (e) => {
        e.stopPropagation()
        typeMultiselect.classList.toggle('open')
        typeButton.setAttribute('aria-expanded', String(typeMultiselect.classList.contains('open')))
        // Close other multiselects
        if (tagsMultiselect) {
          tagsMultiselect.classList.remove('open')
          tagsMultiselect.querySelector('button')?.setAttribute('aria-expanded', 'false')
        }
      },
      { signal }
    )

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!typeMultiselect.contains(e.target as Node)) {
        typeMultiselect.classList.remove('open')
        typeMultiselect.querySelector('button')?.setAttribute('aria-expanded', 'false')
      }
    })
  }

  const idDataMap = Object.keys(data)
  const appendLayout = (el: HTMLElement) => {
    searchLayout.appendChild(el)
  }

  const enablePreview = searchLayout.dataset.preview === 'true'
  let preview: HTMLDivElement | undefined = undefined
  let previewInner: HTMLDivElement | undefined = undefined
  const previewMedia = matchMedia('(min-width:768px)')
  let previewRequest = 0
  let searchRequest = 0
  const results = document.createElement('div')
  results.className = 'results-container'
  appendLayout(results)

  // Store scroll positions for each article
  const scrollPositions = new Map<string, number>()
  let currentPreviewSlug: string | null = null

  if (enablePreview) {
    preview = document.createElement('div')
    preview.className = 'preview-container'
    appendLayout(preview)

    // Save scroll position when user scrolls
    preview.addEventListener('scroll', () => {
      if (currentPreviewSlug && preview) {
        scrollPositions.set(currentPreviewSlug, preview.scrollTop)
      }
    })
  }

  function closeDropdowns() {
    for (const element of [tagsMultiselect, typeMultiselect]) {
      element?.classList.remove('open')
      element?.querySelector('button')?.setAttribute('aria-expanded', 'false')
    }
  }
  function hideSearch(returnFocus = true) {
    previewRequest++
    searchRequest++
    if (timeout !== null) clearTimeout(timeout)
    container.classList.remove('active')
    document.documentElement.classList.remove('search-overlay-open')
    closeDropdowns()
    if (container.open) container.close()
    container.style.visibility = 'hidden'
    container.style.opacity = '0'
    container.style.pointerEvents = 'none'
    searchBar.value = ''
    currentSearchTerm = ''
    results.replaceChildren()
    preview?.replaceChildren()
    searchLayout.classList.remove('display-results')
    container.querySelector('.search-space')?.classList.add('centered')
    const status = container.querySelector<HTMLElement>('[data-search-status]')
    if (status) status.textContent = '输入关键词开始搜索'
    if (returnFocus) searchButton.focus()
  }
  function showSearch(searchTypeNew: SearchType) {
    searchType = searchTypeNew
    // Native dialog renders in the top layer while staying inside the persistent header.
    container.classList.add('active')
    container.style.visibility = 'visible'
    container.style.opacity = '1'
    container.style.pointerEvents = 'auto'
    if (!container.open) container.showModal()
    document.documentElement.classList.add('search-overlay-open')
    searchBar.focus()
    triggerSearch()
  }
  container.querySelector('[data-search-close]')?.addEventListener('click', () => hideSearch())
  container.addEventListener('click', (event) => {
    if (event.target === container) hideSearch()
  })
  container.addEventListener('cancel', (event) => {
    event.preventDefault()
    if (container.querySelector('.filter-multiselect.open')) closeDropdowns()
    else hideSearch()
  })
  // Chrome's <input type="search"> clears itself on the first Escape and swallows the
  // dialog's cancel event, so one press used to only empty the keyword. Intercepting at
  // the capture phase makes a single Escape dismiss the search dialog; an in-flight IME
  // composition still keeps its own Escape handling.
  container.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Escape' || event.isComposing) return
      event.preventDefault()
      event.stopPropagation()
      if (container.querySelector('.filter-multiselect.open')) closeDropdowns()
      else hideSearch()
    },
    { capture: true, signal }
  )
  container.addEventListener('close', () => {
    if (container.classList.contains('active')) hideSearch()
  })
  // The dialog stays inside the persistent header, sharing its lifecycle.
  document.addEventListener('astro:before-swap', () => hideSearch(false), { signal })
  container.querySelector('[data-search-reset]')?.addEventListener('click', () => {
    currentFilters = { date: 'all', tags: [], types: [] }
    dateSelect.value = 'all'
    for (const element of [tagsMultiselect, typeMultiselect]) {
      element
        ?.querySelectorAll<HTMLInputElement>('input[type=checkbox]')
        .forEach((input) => (input.checked = input.value === 'all'))
      const label = element?.querySelector('.filter-multiselect-text')
      if (label) label.textContent = '全部'
    }
    closeDropdowns()
    triggerSearch()
  })
  async function shortcutHandler(e: KeyboardEvent) {
    if (e.key === 'k' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
      e.preventDefault()
      const searchBarOpen = container.classList.contains('active')
      searchBarOpen ? hideSearch() : showSearch('basic')
      return
    } else if (e.shiftKey && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      const searchBarOpen = container.classList.contains('active')
      searchBarOpen ? hideSearch() : showSearch('tags')
      searchBar.value = '#'
      triggerSearch()
      return
    }

    if (!container.open) return
    const active = document.activeElement
    if (e.key === 'Enter' && !e.isComposing && active === searchBar) {
      e.preventDefault()
      results.querySelector<HTMLAnchorElement>('a.result-card[href]')?.click()
      return
    }
    if (
      (e.key === 'ArrowDown' || e.key === 'ArrowUp') &&
      (active === searchBar || results.contains(active))
    ) {
      e.preventDefault()
      const cards = [...results.querySelectorAll<HTMLAnchorElement>('a.result-card[href]')]
      const index = cards.indexOf(active as HTMLAnchorElement)
      const next =
        index < 0
          ? e.key === 'ArrowDown'
            ? 0
            : cards.length - 1
          : Math.max(0, Math.min(cards.length - 1, index + (e.key === 'ArrowDown' ? 1 : -1)))
      const card = cards[next]
      if (card) {
        card.focus({ preventScroll: true })
        card.scrollIntoView({ block: 'nearest' })
        await displayPreview(card)
      }
    }
  }

  const formatForDisplay = (term: string, id: number) => {
    const slug = idDataMap[id]
    return {
      id,
      slug,
      title: searchType === 'tags' ? data[slug].title : highlight(term, data[slug].title ?? ''),
      content: highlight(term, data[slug].content ?? '', true),
      tags: highlightTags(term.substring(1), data[slug].tags)
    }
  }

  function highlightTags(term: string, tags: string[]) {
    if (!tags || searchType !== 'tags') {
      return []
    }

    return tags
      .map((tag) => {
        if (tag.toLowerCase().includes(term.toLowerCase())) {
          return `<li><p class="match-tag">#${tag}</p></li>`
        } else {
          return `<li><p>#${tag}</p></li>`
        }
      })
      .slice(0, numTagResults)
  }

  const resultToHTML = ({ slug, title, tags }: Item) => {
    const htmlTags = tags.length > 0 ? `<ul class="tags">${tags.join('')}</ul>` : ``
    const itemTile = document.createElement('a')
    itemTile.classList.add('result-card')
    itemTile.id = slug
    itemTile.href = resolveUrl(slug)
    itemTile.innerHTML = `
      <h3 class="card-title">${title}</h3>
      ${htmlTags}
    `
    itemTile.addEventListener('click', (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      event.preventDefault()
      const destination = itemTile.href
      hideSearch(false)
      window.location.assign(destination)
    })

    async function onMouseEnter(ev: MouseEvent) {
      if (!ev.target) return
      const target = (ev.target as HTMLElement).closest('.result-card') as HTMLElement
      if (!target) return
      if (previewMedia.matches) {
        updateActiveHighlight(target)
        await displayPreview(target)
      }
    }

    itemTile.addEventListener('mouseenter', onMouseEnter)
    return itemTile
  }

  async function displayResults(finalResults: Item[]) {
    removeAllChildren(results)
    if (finalResults.length === 0) {
      results.innerHTML = `<div class="result-card no-match">
          <h3>没有找到结果</h3>
          <p>试试其他搜索词，或清除筛选条件。</p>
      </div>`
    } else {
      results.append(...finalResults.map(resultToHTML))
    }

    const searching = searchLayout.classList.contains('display-results')
    const status = container.querySelector<HTMLElement>('[data-search-status]')
    if (status)
      status.textContent = searching
        ? `${finalResults.length} 条结果 · 点选打开文章`
        : '输入关键词开始搜索'

    if (!finalResults.length) preview?.replaceChildren()
    else if (previewMedia.matches) {
      const first = results.querySelector<HTMLElement>('a.result-card[href]')
      if (first) await displayPreview(first)
    }
  }

  function updateActiveHighlight(activeElement: HTMLElement | null) {
    results.querySelectorAll('.result-card').forEach((card) => {
      card.classList.remove('focus')
      card.removeAttribute('aria-current')
    })
    if (activeElement && previewMedia.matches) {
      activeElement.classList.add('focus')
      activeElement.setAttribute('aria-current', 'true')
    }
  }
  previewMedia.addEventListener(
    'change',
    () => {
      previewRequest++
      if (!previewMedia.matches) {
        updateActiveHighlight(null)
      } else if (container.open) {
        const card = results.querySelector<HTMLElement>('a.result-card[href]')
        if (card) void displayPreview(card)
      }
    },
    { signal }
  )

  // Apply filters to results
  function applyFilters(resultIds: number[]): number[] {
    return resultIds.filter((id) => {
      const slug = idDataMap[id]
      const item = data[slug]
      if (!item) return false

      // Date filter
      if (currentFilters.date !== 'all' && item.publishDate) {
        const publishDate = new Date(item.publishDate)
        const now = new Date()
        let cutoffDate: Date

        switch (currentFilters.date) {
          case 'year':
            cutoffDate = new Date(now.getFullYear(), 0, 1)
            break
          case '6months':
            cutoffDate = new Date(now.getTime() - 6 * 30 * 24 * 60 * 60 * 1000)
            break
          case '3months':
            cutoffDate = new Date(now.getTime() - 3 * 30 * 24 * 60 * 60 * 1000)
            break
          case 'month':
            cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
            break
          default:
            return true
        }

        if (publishDate < cutoffDate) return false
      }

      // Tags filter
      if (currentFilters.tags.length > 0) {
        const itemTags = item.tags || []
        const hasMatchingTag = currentFilters.tags.some((selectedTag) =>
          itemTags.some((tag) => tag.toLowerCase() === selectedTag.toLowerCase())
        )
        if (!hasMatchingTag) return false
      }

      // Type filter
      if (currentFilters.types.length > 0) {
        if (!currentFilters.types.includes(item.collection)) return false
      }

      return true
    })
  }

  // Trigger search update
  function triggerSearch() {
    searchBar.dispatchEvent(new Event('input', { bubbles: true }))
  }

  async function fetchContent(slug: string): Promise<Element[]> {
    if (fetchContentCache.has(slug)) {
      return fetchContentCache.get(slug) as Element[]
    }

    const targetUrl = resolveUrl(slug)
    const contents = await fetch(targetUrl)
      .then((res) => res.text())
      .then((contents) => {
        if (contents === undefined) {
          throw new Error(`Could not fetch ${targetUrl}`)
        }
        const html = p.parseFromString(contents ?? '', 'text/html')
        normalizeRelativeURLs(html, targetUrl)
        // Get main content area - adjust selector based on your HTML structure
        const mainContent =
          html.querySelector('#content, article .prose, article, main article, main') || html.body

        // Remove TOC and sidebar elements
        const elementsToRemove = mainContent.querySelectorAll(
          'aside, #sidebar, toc-heading, .toc, [class*="toc"], [id*="toc"], [class*="sidebar"], [id*="sidebar"], nav[class*="toc"]'
        )
        elementsToRemove.forEach((el) => el.remove())

        // Filter out TOC-related elements from children
        const contentElements: Element[] = []
        for (const child of Array.from(mainContent.children)) {
          // Skip TOC, sidebar, and other navigation elements
          if (
            child.id === 'content-header' ||
            child.classList.contains('toc') ||
            child.classList.contains('sidebar') ||
            child.tagName === 'ASIDE' ||
            (child.tagName === 'NAV' &&
              (child.classList.contains('toc') || child.id?.includes('toc')))
          ) {
            continue
          }
          contentElements.push(child)
        }

        return contentElements
      })

    fetchContentCache.set(slug, contents)
    return contents
  }

  // Generate breadcrumb for docs
  function generateBreadcrumb(slug: string, title: string): HTMLElement | null {
    if (!slug.startsWith('docs/')) return null

    const pathParts = slug.replace('docs/', '').split('/')
    const breadcrumb = document.createElement('nav')
    breadcrumb.className = 'preview-breadcrumb'
    breadcrumb.setAttribute('aria-label', '路径导航')

    // Category mapping
    const categoryMap: Record<string, string> = {
      setup: 'Setup',
      integrations: 'Integrations',
      advanced: 'Advanced'
    }

    // Add "Docs" as first breadcrumb
    const docsLink = document.createElement('a')
    docsLink.href = resolveUrl('docs')
    docsLink.className = 'breadcrumb-link'
    docsLink.textContent = 'Docs'
    breadcrumb.appendChild(docsLink)

    // Add category if exists
    if (pathParts.length > 0 && pathParts[0]) {
      const separator1 = document.createElement('span')
      separator1.className = 'breadcrumb-separator'
      separator1.textContent = ' / '
      breadcrumb.appendChild(separator1)

      const category = pathParts[0]
      const categoryTitle =
        categoryMap[category] || category.charAt(0).toUpperCase() + category.slice(1)
      const categoryLink = document.createElement('a')
      categoryLink.href = resolveUrl(`docs/${category}`)
      categoryLink.className = 'breadcrumb-link'
      categoryLink.textContent = categoryTitle
      breadcrumb.appendChild(categoryLink)
    }

    // Add current page (only if it's not the same as category)
    if (
      pathParts.length > 1 ||
      (pathParts.length === 1 && pathParts[0] !== title.toLowerCase().replace(/\s+/g, '-'))
    ) {
      const separator2 = document.createElement('span')
      separator2.className = 'breadcrumb-separator'
      separator2.textContent = ' / '
      breadcrumb.appendChild(separator2)

      const currentPage = document.createElement('span')
      currentPage.className = 'breadcrumb-current'
      currentPage.textContent = title
      breadcrumb.appendChild(currentPage)
    }

    return breadcrumb
  }

  async function displayPreview(el: HTMLElement | null) {
    if (!enablePreview || !previewMedia.matches || !el || !preview) return
    const slug = el.id
    if (!slug) return
    const request = ++previewRequest
    if (currentPreviewSlug && currentPreviewSlug !== slug)
      scrollPositions.set(currentPreviewSlug, preview.scrollTop)
    updateActiveHighlight(el)
    try {
      const contents = await fetchContent(slug)
      if (request !== previewRequest || !container.open || !previewMedia.matches) return
      const innerDiv = contents.flatMap((item) => [
        ...highlightHTML(currentSearchTerm, item as HTMLElement).children
      ])
      previewInner = document.createElement('div')
      previewInner.className = 'preview-inner'
      const heading = document.createElement('header')
      heading.className = 'preview-heading'
      const title = document.createElement('strong')
      title.textContent = data[slug]?.title ?? ''
      const open = document.createElement('a')
      open.href = resolveUrl(slug)
      open.textContent = '阅读全文 ↗'
      open.addEventListener('click', (event) => {
        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
        event.preventDefault()
        const destination = open.href
        hideSearch(false)
        window.location.assign(destination)
      })
      heading.append(title, open)
      previewInner.append(heading)
      const breadcrumb = generateBreadcrumb(slug, data[slug]?.title ?? '')
      if (breadcrumb) previewInner.append(breadcrumb)
      previewInner.append(...innerDiv)
      preview.replaceChildren(previewInner)
      currentPreviewSlug = slug
      requestAnimationFrame(() => {
        if (request !== previewRequest || !preview) return
        const saved = scrollPositions.get(slug)
        const match = preview.querySelector<HTMLElement>('.highlight')
        preview.scrollTop =
          saved ??
          (match
            ? Math.max(
                0,
                preview.scrollTop +
                  match.getBoundingClientRect().top -
                  preview.getBoundingClientRect().top -
                  heading.offsetHeight -
                  12
              )
            : 0)
      })
    } catch (error) {
      if (request !== previewRequest || !container.open) return
      console.error('Error fetching preview:', error)
      preview.textContent = '无法加载预览，可从左侧直接打开文章。'
      currentPreviewSlug = null
    }
  }

  async function onType(e: Event) {
    if (!searchLayout || !index) return
    previewRequest++
    const request = ++searchRequest
    currentSearchTerm = (e.target as HTMLInputElement).value
    const hasSearchTerm = currentSearchTerm.trim() !== ''
    const hasActiveFilters =
      currentFilters.date !== 'all' ||
      currentFilters.tags.length > 0 ||
      currentFilters.types.length > 0

    const activeCount =
      Number(currentFilters.date !== 'all') +
      Number(currentFilters.tags.length > 0) +
      Number(currentFilters.types.length > 0)
    const summary = container.querySelector<HTMLElement>('[data-filter-summary]')
    if (summary) {
      summary.textContent = activeCount ? `已启用 ${activeCount} 项` : '未设置'
      summary.dataset.active = String(activeCount > 0)
    }
    // Update search space when user starts typing - find searchSpace from container (which may be in body)
    const searchSpace = container.querySelector('.search-space') as HTMLElement
    let searching = searchSpace && (hasSearchTerm || hasActiveFilters)
    if (searching) {
      searchSpace.classList.remove('centered')
    } else if (searchSpace && !hasSearchTerm && !hasActiveFilters) {
      searchSpace.classList.add('centered')
    }

    searchLayout.classList.toggle('display-results', hasSearchTerm || hasActiveFilters)
    searchType = currentSearchTerm.startsWith('#') ? 'tags' : 'basic'

    let allIds: number[] = []

    if (hasSearchTerm) {
      let searchResults: DefaultDocumentSearchResults<Item>
      if (searchType === 'tags') {
        currentSearchTerm = currentSearchTerm.substring(1).trim()
        const separatorIndex = currentSearchTerm.indexOf(' ')
        if (separatorIndex != -1) {
          const tag = currentSearchTerm.substring(0, separatorIndex)
          const query = currentSearchTerm.substring(separatorIndex + 1).trim()
          searchResults = await index.searchAsync({
            query: query,
            limit: Math.max(numSearchResults, 10000),
            index: ['title', 'content'],
            tag: { tags: tag }
          })
          if (request !== searchRequest || !container.open) return
          for (const searchResult of searchResults) {
            searchResult.result = searchResult.result.slice(0, numSearchResults)
          }
          searchType = 'basic'
          currentSearchTerm = query
        } else {
          searchResults = await index.searchAsync({
            query: currentSearchTerm,
            limit: numSearchResults,
            index: ['tags']
          })
        }
      } else if (searchType === 'basic') {
        searchResults = await index.searchAsync({
          query: currentSearchTerm,
          limit: numSearchResults,
          index: ['title', 'content']
        })
      } else {
        return
      }

      const getByField = (field: string): number[] => {
        const results = searchResults.filter((x) => x.field === field)
        return results.length === 0 ? [] : ([...results[0].result] as number[])
      }

      // order titles ahead of content
      allIds = [
        ...new Set([...getByField('title'), ...getByField('content'), ...getByField('tags')])
      ]
    } else {
      // If no search term, show all items (will be filtered by filters)
      allIds = Array.from({ length: idDataMap.length }, (_, i) => i)
    }

    if (request !== searchRequest || !container.open) return
    // Apply filters
    const filteredIds = applyFilters(searching ? allIds : [])
    const finalResults = filteredIds.map((id) => formatForDisplay(currentSearchTerm || '', id))
    await displayResults(finalResults)
  }

  document.addEventListener('keydown', shortcutHandler, { signal })
  searchButton.addEventListener('click', () => showSearch('basic'))
  let timeout: ReturnType<typeof setTimeout> | null = null
  function onTypeLazy(e: Event) {
    if (timeout !== null) clearTimeout(timeout)
    searchRequest++
    previewRequest++
    const value = (e.target as HTMLInputElement).value
    // If first char or empty, search immediately
    if (value.length <= 1) {
      onType(e)
    } else {
      timeout = setTimeout(() => onType(e), 150)
    }
  }
  searchBar.addEventListener('input', onTypeLazy)

  await fillDocument(data)
  searchRoot.dataset.searchReady = 'true'
}

let indexPopulated = false
let contentIndexPromise: Promise<ContentIndex> | undefined

async function fillDocument(data: ContentIndex) {
  if (indexPopulated) return
  let id = 0
  const promises: Array<Promise<unknown>> = []
  for (const [slug, fileData] of Object.entries<ContentDetails>(data)) {
    promises.push(
      index.addAsync({
        id: id++,
        slug: slug,
        title: fileData.title,
        content: fileData.content,
        tags: fileData.tags
      })
    )
  }

  await Promise.all(promises)
  indexPopulated = true
}

// Initialize search when DOM is ready
export async function initSearch() {
  const currentSlug = getCurrentSlug()

  contentIndexPromise ??= fetch(sitePath('contentIndex.json')).then((response) => {
    if (!response.ok) throw new Error('Failed to fetch contentIndex.json')
    return response.json() as Promise<ContentIndex>
  })

  const data = await contentIndexPromise.catch((error) => {
    contentIndexPromise = undefined
    throw error
  })
  const searchElements = document.getElementsByClassName('search')

  for (const element of searchElements) {
    await setupSearch(element, currentSlug, data)
  }
}
