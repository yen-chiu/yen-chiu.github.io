import { sitePath } from '@/utils/site-path'
// Wikilink popover preview functionality using Tippy.js
// Similar to Quartz's popover previews with multi-layer support

import tippy, { type Instance } from 'tippy.js'

import 'tippy.js/dist/tippy.css'

interface ContentDetails {
  slug: string
  aliases: string[]
  title: string
  content: string
  tags: string[]
  categories: string[]
  links: string[]
  collection: 'blog' | 'docs'
  publishDate?: string
}

interface ContentIndex {
  [slug: string]: ContentDetails
}

interface PreviewInstance {
  instance: Instance
  slug: string
  parentSlug: string | null
  childInstances: Set<Instance>
}

const p = new DOMParser()
let contentIndex: ContentIndex | null = null

// Track all tippy instances by slug
const tippyInstances: Map<string, PreviewInstance> = new Map()
// Track instances by element
const elementToInstance: WeakMap<HTMLElement, Instance> = new WeakMap()

// Load content index
async function loadContentIndex(): Promise<ContentIndex> {
  if (contentIndex) return contentIndex

  const response = await fetch(sitePath('/contentIndex.json'))
  if (!response.ok) {
    throw new Error('Failed to fetch contentIndex.json')
  }

  contentIndex = await response.json()
  return contentIndex as ContentIndex
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

// Fetch content from URL
async function fetchContent(slug: string): Promise<Element[]> {
  const targetUrl = resolveUrl(slug)
  const contents = await fetch(targetUrl)
    .then((res) => res.text())
    .then((contents) => {
      if (contents === undefined) {
        throw new Error(`Could not fetch ${targetUrl}`)
      }
      const html = p.parseFromString(contents ?? '', 'text/html')

      // Astro static redirects generate HTML with a meta refresh tag.
      // fetch() doesn't follow these, so we need to handle them manually.
      const metaRefresh = html.querySelector('meta[http-equiv="refresh"]')
      if (metaRefresh) {
        const contentAttr = metaRefresh.getAttribute('content')
        const match = contentAttr?.match(/url=([^;]*)/i)
        if (match && match[1]) {
          const redirectUrl = match[1].replace(/^['"]|['"]$/g, '').trim()
          return fetchContent(redirectUrl)
        }
      }

      normalizeRelativeURLs(html, targetUrl)
      // Get main content area
      const mainContent =
        html.querySelector('article, #content, .prose, main') || html.body

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
          child.id === 'sidebar' ||
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

  return contents
}

// Create preview content HTML
async function createPreviewContent(slug: string): Promise<HTMLElement> {
  // Get title from content index if available
  let articleTitle = '加载中...'
  try {
    const index = await loadContentIndex()
    const item = index[slug] ?? Object.values(index).find((entry) => entry.aliases?.includes(slug))
    if (item) {
      articleTitle = item.title
    }
  } catch (error) {
    console.error('Error loading from content index:', error)
  }

  // Create container
  const container = document.createElement('div')
  container.className = 'wikilink-preview-content'
  container.style.cssText = `
    max-width: 550px;
    max-height: 500px;
    width: 550px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  `

  // Create header
  const header = document.createElement('div')
  header.className = 'wikilink-preview-header'
  header.style.cssText = `
    padding: 1rem;
    border-bottom: 1px solid hsl(var(--border) / var(--un-border-opacity, 1));
    background: hsl(var(--muted) / var(--un-bg-opacity, 1));
    flex-shrink: 0;
  `

  const title = document.createElement('h3')
  title.className = 'wikilink-preview-title'
  title.style.cssText = `
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: hsl(var(--foreground) / var(--un-text-opacity, 1));
  `
  title.textContent = articleTitle
  header.appendChild(title)

  // Create content area
  const content = document.createElement('div')
  content.className = 'wikilink-preview-content preview-inner prose text-base'
  content.style.cssText = `
    margin: 0 auto;
    width: min(100%, 100%);
    padding: 0 1.5rem;
    overflow-y: auto;
    max-height: 400px;
    font-family: inherit;
    color: hsl(var(--foreground) / var(--un-text-opacity, 1));
    line-height: 1.5em;
    flex: 1;
  `

  container.appendChild(header)
  container.appendChild(content)

  // Fetch full content
  try {
    const contents = await fetchContent(slug)

    // Update title from fetched content if not found in index
    if (articleTitle === '加载中...') {
      // Find H1 anywhere in the contents
      let foundTitle = ''
      for (const el of contents) {
        const h1 = el.tagName === 'H1' ? el : el.querySelector('h1')
        if (h1) {
          foundTitle = h1.textContent || ''
          break
        }
      }

      if (foundTitle) {
        articleTitle = foundTitle
        title.textContent = articleTitle
      }
    }

    // Add all content elements
    contents.forEach((el) => {
      content.appendChild(el.cloneNode(true))
    })
  } catch (error) {
    console.error('Error fetching preview:', error)
    title.textContent = articleTitle !== '加载中...' ? articleTitle : '无法加载预览'
    content.innerHTML = '<p>无法加载此文章的内容</p>'
  }

  return container
}

// Extract slug from href
function extractSlug(href: string): string {
  let slug = href.replace(/^\//, '').replace(/\/$/, '')
  if (!slug.startsWith('blog/') && !slug.startsWith('docs/')) {
    if (!slug.includes('/')) {
      slug = `blog/${slug}`
    }
  }
  return slug
}

// Setup tippy for a wikilink
function setupTippyForLink(link: HTMLAnchorElement, parentSlug: string | null = null) {
  // Skip if already has tippy
  if (elementToInstance.has(link)) {
    return
  }

  const href = link.getAttribute('href')
  if (!href) return

  const slug = extractSlug(href)

  // Skip if already has instance for this slug
  if (tippyInstances.has(slug)) {
    const existing = tippyInstances.get(slug)!
    if (existing.instance.reference === link) {
      return
    }
  }

  // Calculate z-index based on parent level
  let zIndex = 9999
  if (parentSlug) {
    const parentInstance = tippyInstances.get(parentSlug)
    if (parentInstance) {
      // Get parent's z-index and add 10
      const parentZIndex = parseInt(getComputedStyle(parentInstance.instance.popper).zIndex) || 9999
      zIndex = parentZIndex + 10
    }
  }

  // Create tippy instance
  const instance = tippy(link, {
    content: '加载中...',
    allowHTML: true,
    interactive: true,
    delay: [500, 500], // 0.5s show, 0.5s hide
    trigger: 'mouseenter',
    hideOnClick: false,
    placement: 'right-start',
    offset: [8, 8],
    maxWidth: 550,
    theme: 'wikilink-preview',
    zIndex,
    appendTo: () => document.body,
    // Custom hide logic to prevent hiding when moving to another preview
    onTrigger: (instance, event) => {
      // When mouse enters, clear any pending hide
      if (event.type === 'mouseenter') {
        // Cancel any pending hide for this instance
        instance.clearDelayTimeouts()
      }
    },
    onShow: (instance) => {
      // Load content asynchronously
      createPreviewContent(slug).then((content) => {
        instance.setContent(content)

        // Wait for content to be rendered
        setTimeout(() => {
          // Setup tippy for wikilinks in this preview
          const previewContent = content.querySelector('.wikilink-preview-content')
          if (previewContent) {
            const wikilinks = previewContent.querySelectorAll('a.wikilink')
            wikilinks.forEach((linkEl) => {
              // Only setup if not already set up
              if (!elementToInstance.has(linkEl as HTMLElement)) {
                setupTippyForLink(linkEl as HTMLAnchorElement, slug)
              }
            })
          }
        }, 100)
      })
    },
    onHide: (_instance) => {
      // Hide all child instances when hiding parent
      const previewInstance = tippyInstances.get(slug)
      if (previewInstance) {
        previewInstance.childInstances.forEach((childInstance) => {
          childInstance.hide()
          // Clean up after a delay
          setTimeout(() => {
            if (!childInstance.state.isVisible) {
              childInstance.destroy()
            }
          }, 500)
        })
        previewInstance.childInstances.clear()
      }
    },
    getReferenceClientRect: parentSlug
      ? () => {
        // Position relative to parent preview
        const parentInstance = tippyInstances.get(parentSlug)
        if (parentInstance && parentInstance.instance.popper) {
          const parentRect = parentInstance.instance.popper.getBoundingClientRect()
          const previewOffset = 20

          // Try to position to the right of parent
          const viewportWidth = window.innerWidth
          const viewportHeight = window.innerHeight
          const containerWidth = 550
          const containerHeight = 500

          let left = parentRect.right + previewOffset
          let top = parentRect.top

          // Adjust if goes off screen
          if (left + containerWidth > viewportWidth - 10) {
            // Try left side
            if (parentRect.left - containerWidth - previewOffset > 10) {
              left = parentRect.left - containerWidth - previewOffset
            } else {
              // Overlap with offset
              left = parentRect.left + previewOffset
              top = parentRect.top + previewOffset
            }
          }

          if (top + containerHeight > viewportHeight - 10) {
            top = Math.max(10, viewportHeight - containerHeight - 10)
          }

          return {
            width: 0,
            height: 0,
            top,
            left,
            right: left,
            bottom: top,
            x: left,
            y: top,
            toJSON: () => ({})
          } as DOMRect
        }
        // Fallback to link position
        return link.getBoundingClientRect()
      }
      : undefined
  })

  // Store instance
  const previewInstance: PreviewInstance = {
    instance,
    slug,
    parentSlug,
    childInstances: new Set()
  }

  tippyInstances.set(slug, previewInstance)
  elementToInstance.set(link, instance)

  // Update parent's child instances
  if (parentSlug) {
    const parentInstance = tippyInstances.get(parentSlug)
    if (parentInstance) {
      parentInstance.childInstances.add(instance)
    }
  }
}

// Clean up all instances (reserved for future use)
// Exporting to mark as used, even though not currently called
export function cleanupAllInstances() {
  tippyInstances.forEach((previewInstance) => {
    previewInstance.instance.destroy()
    previewInstance.childInstances.forEach((childInstance) => {
      childInstance.destroy()
    })
  })
  tippyInstances.clear()
}

// Find which preview the mouse is currently over
function findPreviewUnderMouse(x: number, y: number): string | null {
  // Check all previews, starting from the topmost (highest z-index)
  const sortedInstances = Array.from(tippyInstances.entries()).sort((a, b) => {
    const zIndexA = parseInt(getComputedStyle(a[1].instance.popper).zIndex) || 0
    const zIndexB = parseInt(getComputedStyle(b[1].instance.popper).zIndex) || 0
    return zIndexB - zIndexA
  })

  for (const [slug, previewInstance] of sortedInstances) {
    if (previewInstance.instance.state.isVisible && previewInstance.instance.popper) {
      const rect = previewInstance.instance.popper.getBoundingClientRect()
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return slug
      }
    }
  }
  return null
}

// Hide all previews from a specific slug onwards
function hidePreviewsFrom(slug: string) {
  const previewInstance = tippyInstances.get(slug)
  if (!previewInstance) return

  // Get all previews that should be hidden (this one and all its children)
  const previewsToHide: string[] = [slug]

  // Add all children recursively
  function addChildren(slug: string) {
    const instance = tippyInstances.get(slug)
    if (instance) {
      instance.childInstances.forEach((childInstance) => {
        const childSlug = Array.from(tippyInstances.entries()).find(
          ([_, pi]) => pi.instance === childInstance
        )?.[0]
        if (childSlug && !previewsToHide.includes(childSlug)) {
          previewsToHide.push(childSlug)
          addChildren(childSlug)
        }
      })
    }
  }
  addChildren(slug)

  // Hide all previews
  previewsToHide.forEach((s) => {
    const instance = tippyInstances.get(s)
    if (instance) {
      instance.instance.hide()
    }
  })
}

// Track cleanup state for re-initialization
let cleanupController: AbortController | null = null
let activeObserver: MutationObserver | null = null

function setupWikilinkPreviews() {
  // Create new abort controller for this session's event listeners
  cleanupController = new AbortController()
  const { signal } = cleanupController

  // Track mouse position and current preview
  let lastMouseX = 0
  let lastMouseY = 0
  let hideTimeout: number | null = null
  let currentPreviewSlug: string | null = null

  document.addEventListener('mousemove', (e) => {
    lastMouseX = e.clientX
    lastMouseY = e.clientY

    // Find which preview the mouse is over
    const previewSlug = findPreviewUnderMouse(lastMouseX, lastMouseY)

    // Clear any pending hide timeout
    if (hideTimeout) {
      clearTimeout(hideTimeout)
      hideTimeout = null
    }

    // If mouse moved to a different preview, set timeout to hide previews above this one
    if (previewSlug && previewSlug !== currentPreviewSlug) {
      currentPreviewSlug = previewSlug

      // Set timeout to hide previews from this one onwards (including this one)
      hideTimeout = window.setTimeout(() => {
        const finalPreviewSlug = findPreviewUnderMouse(lastMouseX, lastMouseY)
        if (finalPreviewSlug === previewSlug) {
          // Mouse is still over this preview, hide it and all above
          hidePreviewsFrom(previewSlug)
        }
        hideTimeout = null
      }, 500)
    } else if (!previewSlug) {
      currentPreviewSlug = null

      // Check if mouse is over any wikilink
      const elementUnderMouse = document.elementFromPoint(lastMouseX, lastMouseY)
      const isOverWikilink = elementUnderMouse?.closest('a.wikilink')

      if (!isOverWikilink) {
        // Not over any preview or link, hide all after delay
        hideTimeout = window.setTimeout(() => {
          const finalPreviewSlug = findPreviewUnderMouse(lastMouseX, lastMouseY)
          const finalElement = document.elementFromPoint(lastMouseX, lastMouseY)
          const finalIsOverWikilink = finalElement?.closest('a.wikilink')

          if (!finalPreviewSlug && !finalIsOverWikilink) {
            // Hide all previews
            tippyInstances.forEach((previewInstance) => {
              previewInstance.instance.hide()
            })
          }
          hideTimeout = null
        }, 500)
      }
    }
  }, { signal })

  // Setup tippy for existing wikilinks
  const wikilinks = document.querySelectorAll('a.wikilink')
  wikilinks.forEach((link) => {
    setupTippyForLink(link as HTMLAnchorElement)
  })

  // Hide on scroll
  window.addEventListener(
    'scroll',
    () => {
      tippyInstances.forEach((previewInstance) => {
        previewInstance.instance.hide()
      })
      if (hideTimeout) {
        clearTimeout(hideTimeout)
        hideTimeout = null
      }
    },
    { passive: true, signal }
  )

  // Use MutationObserver to handle dynamically added wikilinks
  activeObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as HTMLElement

          // Check for new wikilinks
          const newWikilinks = element.querySelectorAll?.('a.wikilink')
          if (newWikilinks && newWikilinks.length > 0) {
            newWikilinks.forEach((link) => {
              if (!elementToInstance.has(link as HTMLElement)) {
                setupTippyForLink(link as HTMLAnchorElement)
              }
            })
          }
        }
      })
    })
  })

  activeObserver.observe(document.body, {
    childList: true,
    subtree: true
  })
}

// Initialize wikilink previews
export function initWikilinkPreviews() {
  // Cleanup previous session
  // 1. Abort old event listeners
  if (cleanupController) {
    cleanupController.abort()
    cleanupController = null
  }
  // 2. Disconnect old MutationObserver
  if (activeObserver) {
    activeObserver.disconnect()
    activeObserver = null
  }
  // 3. Destroy all tippy instances
  for (const [, previewInstance] of tippyInstances) {
    previewInstance.instance.destroy()
    for (const child of previewInstance.childInstances) {
      child.destroy()
    }
  }
  tippyInstances.clear()

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setupWikilinkPreviews()
    })
  } else {
    // Use setTimeout to ensure all content is rendered
    setTimeout(() => {
      setupWikilinkPreviews()
    }, 100)
  }
}

// Auto-initialize when module loads
if (typeof window !== 'undefined') {
  initWikilinkPreviews()
  // Re-initialize on Astro page transitions
  document.addEventListener('astro:page-load', () => {
    initWikilinkPreviews()
  })
}
