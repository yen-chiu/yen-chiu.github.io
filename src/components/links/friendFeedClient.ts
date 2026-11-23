interface FeedArticle {
  title: string
  url: string
  site: string
  siteUrl: string
  avatar: string
  date: string
  iso: string
  stale: boolean
}
const PAGE_SIZE = 6

export function initFriendFeed() {
  const root = document.querySelector<HTMLElement>('[data-neighbor-feed]')
  if (!root || root.dataset.feedReady === 'true') return
  root.dataset.feedReady = 'true'

  const rows = [...root.querySelectorAll<HTMLElement>('[data-feed-article]')]
  const articles: FeedArticle[] = rows.map(row => ({
    title: row.dataset.articleTitle ?? '',
    url: row.dataset.articleUrl ?? '',
    site: row.dataset.articleSite ?? '',
    siteUrl: row.dataset.articleSiteUrl ?? '',
    avatar: row.dataset.articleAvatar ?? '',
    date: row.dataset.articleDate ?? '日期未知',
    iso: row.dataset.articleIso ?? '',
    stale: row.dataset.articleStale === 'true'
  }))
  const fallbackAvatar = '/favicon/wendell-avatar-192.png'
  root.querySelectorAll<HTMLImageElement>('img[data-feed-fallback]').forEach(image => {
    image.addEventListener('error', () => {
      const fallback = image.dataset.feedFallback || fallbackAvatar
      if (image.src !== new URL(fallback, document.baseURI).href) image.src = fallback
    })
  })

  if (!articles.length) return

  const refresh = root.querySelector<HTMLButtonElement>('[data-feed-refresh]')
  const featureSite = root.querySelector<HTMLElement>('[data-feature-site]')
  const featureLink = root.querySelector<HTMLAnchorElement>('[data-feature-link]')
  const featureAuthor = root.querySelector<HTMLButtonElement>('[data-feature-author]')
  const featureAvatar = root.querySelector<HTMLImageElement>('[data-feature-avatar]')
  const featureBackground = root.querySelector<HTMLImageElement>('[data-feature-bg]')
  const featureDate = root.querySelector<HTMLTimeElement>('[data-feature-date]')
  const featureStale = root.querySelector<HTMLElement>('[data-feature-stale]')
  const more = root.querySelector<HTMLButtonElement>('[data-feed-more]')
  const less = root.querySelector<HTMLButtonElement>('[data-feed-less]')
  const counter = root.querySelector<HTMLElement>('[data-feed-counter]')
  const dialog = root.querySelector<HTMLDialogElement>('[data-feed-dialog]')
  const dialogAuthor = root.querySelector<HTMLElement>('[data-dialog-author]')
  const dialogAvatar = root.querySelector<HTMLImageElement>('[data-dialog-avatar]')
  const dialogList = root.querySelector<HTMLElement>('[data-dialog-list]')
  const dialogSite = root.querySelector<HTMLAnchorElement>('[data-dialog-site]')
  let featured = 0
  let visibleCount = Math.min(PAGE_SIZE, articles.length)
  let opener: HTMLElement | null = null

  function renderFeatured(index: number) {
    const article = articles[index]
    if (!article) return
    featured = index
    if (featureSite) featureSite.textContent = article.site
    if (featureLink) {
      featureLink.textContent = article.title
      featureLink.href = article.url
    }
    if (featureAuthor) {
      featureAuthor.dataset.siteUrl = article.siteUrl
      featureAuthor.setAttribute('aria-label', '查看 ' + article.site + ' 的近期文章')
    }
    if (featureAvatar) featureAvatar.src = article.avatar
    if (featureBackground) featureBackground.src = article.avatar
    if (featureDate) {
      featureDate.textContent = article.date
      if (article.iso) featureDate.dateTime = article.iso
      else featureDate.removeAttribute('datetime')
    }
    if (featureStale) featureStale.hidden = !article.stale
  }
  function randomize() {
    const next = articles.length === 1
      ? 0
      : (featured + 1 + Math.floor(Math.random() * (articles.length - 1))) % articles.length
    renderFeatured(next)
  }
  refresh?.addEventListener('click', randomize)
  renderFeatured(Math.floor(Math.random() * articles.length))

  function renderPagination() {
    rows.forEach((row, index) => { row.hidden = index >= visibleCount })
    if (more) more.hidden = visibleCount >= rows.length
    if (less) less.hidden = visibleCount <= PAGE_SIZE
    if (counter) counter.textContent = '当前显示 ' + visibleCount + ' / ' + rows.length + ' 篇文章'
  }
  more?.addEventListener('click', () => {
    visibleCount = Math.min(rows.length, visibleCount + PAGE_SIZE)
    renderPagination()
  })
  less?.addEventListener('click', () => {
    visibleCount = Math.min(PAGE_SIZE, rows.length)
    renderPagination()
    root.querySelector<HTMLElement>('[data-feed-list]')?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      block: 'start'
    })
  })
  renderPagination()

  function openAuthor(siteUrl: string, target: HTMLElement) {
    if (!dialog || !dialogAuthor || !dialogAvatar || !dialogList || !dialogSite) return
    const matching = articles.filter(item => item.siteUrl === siteUrl)
    if (!matching.length) return
    opener = target
    dialogAuthor.textContent = matching[0].site
    dialogAvatar.src = matching[0].avatar
    dialogSite.href = siteUrl
    dialogList.replaceChildren()

    matching.forEach(article => {
      const item = document.createElement('li')
      const link = document.createElement('a')
      link.href = article.url
      link.textContent = article.title
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      const time = document.createElement('time')
      time.textContent = article.date
      if (article.iso) time.dateTime = article.iso
      item.append(link, time)
      dialogList.appendChild(item)
    })
    if (!dialog.open) dialog.showModal()
  }
  root.querySelectorAll<HTMLButtonElement>('[data-feed-author]').forEach(button => {
    button.addEventListener('click', () => openAuthor(button.dataset.siteUrl ?? '', button))
  })
  featureAuthor?.addEventListener('click', () =>
    openAuthor(featureAuthor.dataset.siteUrl ?? '', featureAuthor)
  )
  root.querySelector<HTMLButtonElement>('[data-dialog-close]')?.addEventListener('click', () => {
    dialog?.close()
  })
  dialog?.addEventListener('click', event => {
    if (event.target === dialog) dialog.close()
  })
  dialog?.addEventListener('close', () => opener?.focus())
}
