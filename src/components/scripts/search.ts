import { sitePath } from '@/utils/site-path'
import FlexSearch, { type DefaultDocumentSearchResults } from 'flexsearch'

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

function registerEscapeHandler(outsideContainer: HTMLElement | null, cb: () => void) {
  if (!outsideContainer) return
  function click(this: HTMLElement, e: MouseEvent) {
    if (e.target !== this) return
    e.preventDefault()
    e.stopPropagation()
    cb()
  }

  function esc(e: KeyboardEvent) {
    const isInput = document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA'
    if (e.key === 'Escape' || (e.key === 'q' && !isInput)) {
      e.preventDefault()
      // Blur active element to remove navigation focus artifacts
      ;(document.activeElement as HTMLElement)?.blur()
      cb()
    }
  }

  outsideContainer?.addEventListener('click', click)
  document.addEventListener('keydown', esc)

  // Cleanup function
  return () => {
    outsideContainer?.removeEventListener('click', click)
    document.removeEventListener('keydown', esc)
  }
}

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
          const regex = new RegExp(searchTok.toLowerCase(), 'gi')
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
      const regex = new RegExp(term.toLowerCase(), 'gi')
      const matches = nodeText.match(regex)
      if (!matches || matches.length === 0) return
      const spanContainer = document.createElement('span')
      let lastIndex = 0
      for (const match of matches) {
        const matchIndex = nodeText.indexOf(match, lastIndex)
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
function resolveUrl(slug: string): string { return new URL(sitePath(slug), window.location.origin).href }

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

  const container = searchElement.querySelector('.search-container') as HTMLElement
  if (!container) return

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
      // Close other multiselects
      if (typeMultiselect) {
        typeMultiselect.classList.remove('open')
      }
    })

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!tagsMultiselect.contains(e.target as Node)) {
        tagsMultiselect.classList.remove('open')
      }
    })
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
    typeButton.addEventListener('click', (e) => {
      e.stopPropagation()
      typeMultiselect.classList.toggle('open')
      // Close other multiselects
      if (tagsMultiselect) {
        tagsMultiselect.classList.remove('open')
      }
    })

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!typeMultiselect.contains(e.target as Node)) {
        typeMultiselect.classList.remove('open')
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
  let markersContainer: HTMLDivElement | undefined = undefined
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

    // Create markers container as separate column
    markersContainer = document.createElement('div')
    markersContainer.className = 'markers-container'
    appendLayout(markersContainer)

    // Save scroll position when user scrolls
    preview.addEventListener('scroll', () => {
      if (currentPreviewSlug && preview) {
        scrollPositions.set(currentPreviewSlug, preview.scrollTop)
      }
    })
  }

  function hideSearch() {
    container.classList.remove('active')
    // Close all multiselect dropdowns
    if (tagsMultiselect) {
      tagsMultiselect.classList.remove('open')
    }
    if (typeMultiselect) {
      typeMultiselect.classList.remove('open')
    }
    requestAnimationFrame(() => {
      container.style.visibility = 'hidden'
      container.style.opacity = '0'
      container.style.pointerEvents = 'none'
    })
    searchBar.value = ''
    removeAllChildren(results)
    if (preview) {
      removeAllChildren(preview)
    }
    if (markersContainer) {
      removeAllChildren(markersContainer)
    }
    // Clean up markers
    if (scrollbarMarkersContainer) {
      scrollbarMarkersContainer.remove()
      scrollbarMarkersContainer = null
    }
    viewportIndicatorEl = null
    if (scrollHandler && preview) {
      preview.removeEventListener('scroll', scrollHandler)
      scrollHandler = null
    }
    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    }
    scrollbarMarkers = []
    highlightElements = []
    searchLayout.classList.remove('display-results')
    searchType = 'basic'
    // Reset to centered state - find searchSpace from container (which may be in body)
    const searchSpace = container.querySelector('.search-space') as HTMLElement
    if (searchSpace) {
      searchSpace.classList.add('centered')
    }
    searchButton.focus()
  }

  function showSearch(searchTypeNew: SearchType) {
    searchType = searchTypeNew
    // Keep the modal outside the persisted header. Astro view transitions replace
    // the body, so reattach it if a previous navigation detached the node.
    if (container.parentElement !== document.body) {
      document.body.appendChild(container)
    }

    // Use requestAnimationFrame to ensure visibility applies smoothly
    requestAnimationFrame(() => {
      container.classList.add('active')
      container.style.visibility = 'visible'
      container.style.opacity = '1'
      container.style.pointerEvents = 'auto'
    })
    // Start in centered state - find searchSpace from container (which may be in body)
    const searchSpace = container.querySelector('.search-space') as HTMLElement
    if (searchSpace) {
      searchSpace.classList.add('centered')
    }
    searchBar.focus()
  }

  let currentHover: HTMLElement | null = null
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
      return
    }

    if (currentHover) {
      currentHover.classList.remove('focus')
    }

    if (!container.classList.contains('active')) return
    if (e.key === 'Enter' && !e.isComposing) {
      if (results.contains(document.activeElement)) {
        const active = document.activeElement as HTMLElement
        if (active.classList.contains('no-match')) return
        await displayPreview(active)
        active.click()
      } else {
        const anchor = document.getElementsByClassName('result-card')[0] as HTMLElement | null
        if (!anchor || anchor.classList.contains('no-match')) return
        await displayPreview(anchor)
        anchor.click()
      }
    } else if (e.key === 'ArrowUp' || (e.shiftKey && e.key === 'Tab')) {
      e.preventDefault()
      if (results.contains(document.activeElement)) {
        const currentResult = currentHover || (document.activeElement as HTMLElement | null)
        const prevResult = currentResult?.previousElementSibling as HTMLElement | null
        if (prevResult) {
          prevResult.focus()
          await displayPreview(prevResult)
        }
      }
    } else if (e.key === 'ArrowDown' || e.key === 'Tab') {
      e.preventDefault()
      if (document.activeElement === searchBar || currentHover !== null) {
        const firstResult =
          currentHover || (document.getElementsByClassName('result-card')[0] as HTMLElement | null)
        const nextResult = firstResult?.nextElementSibling as HTMLElement | null
        if (nextResult) {
          nextResult.focus()
          await displayPreview(nextResult)
        } else if (!currentHover && firstResult) {
          // If no current hover and we have a first result, focus it
          firstResult.focus()
          await displayPreview(firstResult)
        }
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
      hideSearch()
    })

    async function onMouseEnter(ev: MouseEvent) {
      if (!ev.target) return
      const target = (ev.target as HTMLElement).closest('.result-card') as HTMLElement
      if (!target) return
      updateActiveHighlight(target)
      await displayPreview(target)
    }

    itemTile.addEventListener('mouseenter', onMouseEnter)
    return itemTile
  }

  async function displayResults(finalResults: Item[]) {
    removeAllChildren(results)
    if (finalResults.length === 0) {
      results.innerHTML = `<a class="result-card no-match">
          <h3>没有找到结果</h3>
          <p>试试其他搜索词？</p>
      </a>`
    } else {
      results.append(...finalResults.map(resultToHTML))
    }

    if (finalResults.length === 0 && preview) {
      removeAllChildren(preview)
    } else {
      const firstChild = results.firstElementChild as HTMLElement
      if (firstChild) {
        currentHover = firstChild
        await displayPreview(firstChild)
      }
    }
  }

  // Update highlight for the active preview
  function updateActiveHighlight(activeElement: HTMLElement | null) {
    // Remove focus from all result cards
    const allCards = results.querySelectorAll('.result-card')
    allCards.forEach((card) => card.classList.remove('focus'))

    // Add focus to the active element
    if (activeElement && activeElement.classList.contains('result-card')) {
      activeElement.classList.add('focus')
      currentHover = activeElement
    }
  }

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
    if (currentSearchTerm || searchLayout.classList.contains('display-results')) {
      const event = new Event('input', { bubbles: true })
      searchBar.dispatchEvent(event)
    }
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

  // Scrollbar markers
  let scrollbarMarkersContainer: HTMLElement | null = null
  let scrollbarMarkers: HTMLElement[] = []
  let highlightElements: HTMLElement[] = []
  let scrollHandler: (() => void) | null = null
  let resizeObserver: ResizeObserver | null = null

  function createScrollbarMarkers() {
    if (!preview || !previewInner || !markersContainer) return

    // Remove existing markers and event listener
    if (scrollbarMarkersContainer) {
      scrollbarMarkersContainer.remove()
    }
    if (scrollHandler && preview) {
      preview.removeEventListener('scroll', scrollHandler)
      scrollHandler = null
    }
    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    }

    // Find all highlight elements
    highlightElements = Array.from(preview.querySelectorAll('.highlight')) as HTMLElement[]

    if (highlightElements.length === 0) {
      // Clear markers container if no highlights
      removeAllChildren(markersContainer)
      return
    }

    // Create markers container inside the separate markers column
    scrollbarMarkersContainer = document.createElement('div')
    scrollbarMarkersContainer.className = 'scrollbar-markers'
    removeAllChildren(markersContainer)
    markersContainer.appendChild(scrollbarMarkersContainer)

    // Create markers for each highlight
    scrollbarMarkers = highlightElements.map((highlight, index) => {
      const marker = document.createElement('div')
      marker.className = 'scrollbar-marker'
      marker.dataset.index = String(index)
      marker.title = `匹配项 ${index + 1}`

      // Calculate position
      const position = calculateMarkerPosition(highlight)
      marker.style.top = `${position}%`

      // Click handler to scroll to highlight and flash it
      marker.addEventListener('click', () => {
        highlight.scrollIntoView({ block: 'center', behavior: 'smooth' })
        // Flash the highlight after scroll completes
        setTimeout(() => {
          highlight.classList.remove('flash-highlight')
          // Force reflow so re-adding the class restarts the animation
          void highlight.offsetWidth
          highlight.classList.add('flash-highlight')
          highlight.addEventListener(
            'animationend',
            () => {
              highlight.classList.remove('flash-highlight')
            },
            { once: true }
          )
        }, 300)
      })

      scrollbarMarkersContainer!.appendChild(marker)
      return marker
    })

    // Create viewport indicator (custom scrollbar thumb replacement)
    createViewportIndicator()

    // Update markers on scroll
    scrollHandler = () => {
      updateScrollbarMarkers()
      updateViewportIndicator()
    }
    preview.addEventListener('scroll', scrollHandler, { passive: true })

    // Update marker positions on resize
    resizeObserver = new ResizeObserver(() => {
      // Recalculate all marker positions when content or viewport changes
      highlightElements.forEach((highlight, index) => {
        const marker = scrollbarMarkers[index]
        if (marker) {
          const position = calculateMarkerPosition(highlight)
          marker.style.top = `${position}%`
        }
      })
      updateScrollbarMarkers()
      updateViewportIndicator()
    })

    // Observe both preview container (for viewport size) and previewInner (for content size)
    if (preview) {
      resizeObserver.observe(preview)
    }
    if (previewInner) {
      resizeObserver.observe(previewInner)
    }

    // Initial update
    updateScrollbarMarkers()
    updateViewportIndicator()
  }

  function calculateMarkerPosition(element: HTMLElement): number {
    if (!preview || !previewInner || !markersContainer) return 0

    // Get element's position relative to previewInner in document coordinates
    let offsetTop = 0
    let currentElement: HTMLElement | null = element

    // Calculate offset from previewInner
    while (currentElement && currentElement !== previewInner && currentElement !== preview) {
      offsetTop += currentElement.offsetTop
      currentElement = currentElement.offsetParent as HTMLElement | null
    }

    // Calculate position as percentage of total scrollable height
    const scrollHeight = preview.scrollHeight

    // Map document position to markers container position
    // Markers container height equals viewport height (clientHeight)
    // So we map: document position -> markers container position
    const position = scrollHeight > 0 ? (offsetTop / scrollHeight) * 100 : 0

    return Math.max(0, Math.min(100, position))
  }

  function updateScrollbarMarkers() {
    if (!preview || !previewInner || highlightElements.length === 0) return

    const viewportTop = preview.scrollTop
    const viewportBottom = preview.scrollTop + preview.clientHeight
    const previewInnerRect = previewInner.getBoundingClientRect()

    highlightElements.forEach((highlight, index) => {
      const marker = scrollbarMarkers[index]
      if (!marker) return

      // Calculate highlight position relative to previewInner
      const highlightRect = highlight.getBoundingClientRect()
      const highlightTop = highlightRect.top - previewInnerRect.top + preview.scrollTop
      const highlightBottom = highlightTop + highlight.offsetHeight

      // Check if highlight is visible in viewport
      const isVisible = highlightBottom >= viewportTop && highlightTop <= viewportBottom

      if (isVisible) {
        marker.classList.add('active')
      } else {
        marker.classList.remove('active')
      }
    })
  }

  let viewportIndicatorEl: HTMLElement | null = null

  function createViewportIndicator() {
    if (!preview || !scrollbarMarkersContainer) return

    // Remove existing indicator
    if (viewportIndicatorEl) {
      viewportIndicatorEl.remove()
      viewportIndicatorEl = null
    }

    // Create viewport indicator element
    viewportIndicatorEl = document.createElement('div')
    viewportIndicatorEl.className = 'viewport-indicator'

    // Create red center line
    const line = document.createElement('div')
    line.className = 'viewport-indicator-line'
    viewportIndicatorEl.appendChild(line)

    scrollbarMarkersContainer.appendChild(viewportIndicatorEl)

    // Make it draggable
    let isDragging = false
    let dragStartY = 0
    let dragStartScrollTop = 0

    viewportIndicatorEl.addEventListener('mousedown', (e: MouseEvent) => {
      e.preventDefault()
      isDragging = true
      dragStartY = e.clientY
      dragStartScrollTop = preview!.scrollTop
      viewportIndicatorEl!.classList.add('dragging')

      const onMouseMove = (e: MouseEvent) => {
        if (!isDragging || !preview || !scrollbarMarkersContainer) return
        const containerHeight = scrollbarMarkersContainer.clientHeight
        const scrollHeight = preview.scrollHeight
        const clientHeight = preview.clientHeight
        const maxScrollTop = scrollHeight - clientHeight

        // How many pixels of scroll per pixel of drag
        const scrollRatio =
          maxScrollTop / (containerHeight - containerHeight * (clientHeight / scrollHeight))
        const deltaY = e.clientY - dragStartY
        const newScrollTop = Math.max(
          0,
          Math.min(maxScrollTop, dragStartScrollTop + deltaY * scrollRatio)
        )

        preview.scrollTop = newScrollTop
      }

      const onMouseUp = () => {
        isDragging = false
        viewportIndicatorEl?.classList.remove('dragging')
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    })

    // Also support clicking on the markers container track to jump
    scrollbarMarkersContainer.addEventListener('mousedown', (e: MouseEvent) => {
      if (e.target !== scrollbarMarkersContainer) return
      if (!preview) return
      const rect = scrollbarMarkersContainer!.getBoundingClientRect()
      const clickY = e.clientY - rect.top
      const clickRatio = clickY / rect.height
      const scrollHeight = preview.scrollHeight
      const clientHeight = preview.clientHeight
      const maxScrollTop = scrollHeight - clientHeight
      preview.scrollTo({
        top: maxScrollTop * clickRatio,
        behavior: 'smooth'
      })
    })

    // Enable pointer events on the container for track clicking
    scrollbarMarkersContainer.style.pointerEvents = 'auto'
  }

  function updateViewportIndicator() {
    if (!preview || !viewportIndicatorEl || !scrollbarMarkersContainer) return

    const scrollHeight = preview.scrollHeight
    const clientHeight = preview.clientHeight
    const scrollTop = preview.scrollTop
    const containerHeight = scrollbarMarkersContainer.clientHeight

    if (scrollHeight <= clientHeight) {
      // Content fits, indicator covers everything
      viewportIndicatorEl.style.top = '0px'
      viewportIndicatorEl.style.height = '100%'
      return
    }

    // Calculate indicator size and position
    const viewportRatio = clientHeight / scrollHeight
    const indicatorHeight = Math.max(20, containerHeight * viewportRatio)
    const maxIndicatorTop = containerHeight - indicatorHeight
    const scrollRatio = scrollTop / (scrollHeight - clientHeight)
    const indicatorTop = maxIndicatorTop * scrollRatio

    viewportIndicatorEl.style.top = `${indicatorTop}px`
    viewportIndicatorEl.style.height = `${indicatorHeight}px`
  }

  async function displayPreview(el: HTMLElement | null) {
    if (!searchLayout || !enablePreview || !el || !preview) return
    const slug = el.id
    if (!slug) return

    // Save current scroll position before switching
    if (currentPreviewSlug && currentPreviewSlug !== slug) {
      scrollPositions.set(currentPreviewSlug, preview.scrollTop)
    }

    // Update highlight before fetching content
    updateActiveHighlight(el)

    // Check if we have a saved scroll position for this article
    const savedScrollPosition = scrollPositions.get(slug)
    const isReturningToArticle = savedScrollPosition !== undefined

    try {
      const innerDiv = await fetchContent(slug).then((contents) =>
        contents.flatMap((el) => [...highlightHTML(currentSearchTerm, el as HTMLElement).children])
      )
      previewInner = document.createElement('div')
      previewInner.classList.add('preview-inner')

      // Add breadcrumb for docs
      const breadcrumb = generateBreadcrumb(slug, data[slug]?.title || '')
      if (breadcrumb) {
        previewInner.appendChild(breadcrumb)
      }

      previewInner.append(...innerDiv)
      preview.replaceChildren(previewInner)

      // Update current preview slug
      currentPreviewSlug = slug

      // Create scrollbar markers after content is loaded and layout is complete
      requestAnimationFrame(() => {
        // Wait for layout to settle
        setTimeout(() => {
          createScrollbarMarkers()

          // Restore scroll position if returning to this article, otherwise scroll to highlight
          if (isReturningToArticle && savedScrollPosition !== undefined) {
            if (preview) {
              preview.scrollTop = savedScrollPosition
              updateScrollbarMarkers()
            }
          } else {
            // scroll to longest highlight for new articles
            const highlights = [...preview.getElementsByClassName('highlight')].sort(
              (a, b) => b.innerHTML.length - a.innerHTML.length
            )
            if (highlights[0]) {
              highlights[0].scrollIntoView({ block: 'start' })
              // Update markers after scroll
              setTimeout(() => {
                updateScrollbarMarkers()
              }, 100)
            }
          }
        }, 50)
      })
    } catch (error) {
      console.error('Error fetching preview:', error)
      previewInner = document.createElement('div')
      previewInner.classList.add('preview-inner')
      previewInner.textContent = '无法加载预览'
      preview.replaceChildren(previewInner)
      currentPreviewSlug = null
    }
  }

  async function onType(e: Event) {
    if (!searchLayout || !index) return
    currentSearchTerm = (e.target as HTMLInputElement).value
    const hasSearchTerm = currentSearchTerm.trim() !== ''
    const hasActiveFilters =
      currentFilters.date !== 'all' ||
      currentFilters.tags.length > 0 ||
      currentFilters.types.length > 0

    // Animate search space when user starts typing - find searchSpace from container (which may be in body)
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

    // Apply filters
    const filteredIds = applyFilters(searching ? allIds : [])
    const finalResults = filteredIds.map((id) => formatForDisplay(currentSearchTerm || '', id))
    await displayResults(finalResults)
  }

  document.addEventListener('keydown', shortcutHandler)
  searchButton.addEventListener('click', () => showSearch('basic'))
  let timeout: ReturnType<typeof setTimeout> | null = null
  function onTypeLazy(e: Event) {
    if (timeout !== null) clearTimeout(timeout)
    const value = (e.target as HTMLInputElement).value
    // If first char or empty, search immediately
    if (value.length <= 1) {
      onType(e)
    } else {
      timeout = setTimeout(() => onType(e), 150)
    }
  }
  searchBar.addEventListener('input', onTypeLazy)
  registerEscapeHandler(container, hideSearch)

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

  const data = await contentIndexPromise.catch(error => { contentIndexPromise = undefined; throw error })
  const searchElements = document.getElementsByClassName('search')

  for (const element of searchElements) {
    await setupSearch(element, currentSlug, data)
  }
}
