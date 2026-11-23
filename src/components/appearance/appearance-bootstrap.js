// Vesper appearance settings are applied before first paint.
// Wallpaper choices use the same persisted settings as theme hue and layout.
(() => {
  if (window.wendellAppearance) { window.wendellAppearance.apply(); return }
  const key = 'wendell-appearance-v1'
  const DB_NAME = 'vesper-wallpaper-v1'
  const DEFAULT_SOURCE = '/images/moonlit-cover.svg'
  const defaults = {
    hue: 267, theme: 'system', wallpaper: 'banner',
    wallpaperSource: DEFAULT_SOURCE, wallpaperOpacity: 24,
    homeWallpaperSource: 'inherit',
    cover: true, layout: 'list', title: true, waves: true, motion: 'system', silverInk: false
  }
  const safeSource = value => {
    if (value === 'uploaded') return value
    if (value === 'home-uploaded' || value === 'inherit') return null
    if (typeof value !== 'string' || value.length > 2048) return null
    if (/^\/images\/(?:moonlit-cover\.svg|wallpapers\/[a-z0-9-]+\.svg)$/.test(value)) return value
    try {
      const url = new URL(value)
      if (url.protocol !== 'https:' || url.username || url.password) return null
      return url.href
    } catch { return null }
  }
  const normalize = value => {
    const v = value && typeof value === 'object' ? value : {}
    return {
      hue: typeof v.hue === 'number' && Number.isFinite(v.hue)
        ? Math.max(0, Math.min(360, Math.round(v.hue))) : defaults.hue,
      theme: ['system', 'light', 'dark'].includes(v.theme) ? v.theme : defaults.theme,
      wallpaper: ['banner', 'fullscreen', 'overlay'].includes(v.wallpaper) ? v.wallpaper : defaults.wallpaper,
      wallpaperSource: safeSource(v.wallpaperSource) || DEFAULT_SOURCE,
      homeWallpaperSource: v.homeWallpaperSource === 'inherit' || v.homeWallpaperSource == null
        ? 'inherit'
        : v.homeWallpaperSource === 'home-uploaded' ? 'home-uploaded'
        : safeSource(v.homeWallpaperSource) || 'inherit',
      wallpaperOpacity: typeof v.wallpaperOpacity === 'number' && Number.isFinite(v.wallpaperOpacity)
        ? Math.max(8, Math.min(75, Math.round(v.wallpaperOpacity))) : defaults.wallpaperOpacity,
      cover: typeof v.cover === 'boolean' ? v.cover : v.wallpaper === 'hidden' ? false : defaults.cover,
      layout: ['list', 'grid'].includes(v.layout) ? v.layout : defaults.layout,
      title: typeof v.title === 'boolean' ? v.title : defaults.title,
      waves: typeof v.waves === 'boolean' ? v.waves : defaults.waves,
      motion: ['system', 'always', 'reduced'].includes(v.motion) ? v.motion : defaults.motion,
      silverInk: typeof v.silverInk === 'boolean' ? v.silverInk : defaults.silverInk
    }
  }
  let settings = { ...defaults }
  let uploadedObjectUrl = null
  let homeUploadedObjectUrl = null
  try {
    const saved = localStorage.getItem(key)
    settings = normalize(saved ? JSON.parse(saved) : { ...defaults, theme: localStorage.getItem('theme') || 'system' })
  } catch { /* Incognito/private mode may prevent persistence. */ }

  const luminance = (h, l) => {
    const s = .52, a = s * Math.min(l, 1 - l)
    const rgb = [0, 8, 4].map(n => {
      const k = (n + h / 30) % 12
      const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
      return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4
    })
    return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722
  }

  const apply = () => {
    const root = document.documentElement, h = settings.hue
    let lightness = 46
    while (lightness > 22 && 1.05 / (luminance(h, lightness / 100) + .05) < 5.2) lightness -= 1
    root.style.setProperty('--brand-hue', String(h))
    root.style.setProperty('--primary-light', h + ' 52% ' + lightness + '%')
    root.style.setProperty('--primary-dark', h + ' 68% 78%')
    root.classList.toggle('dark',
      settings.theme === 'dark' ||
      (settings.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches))
    root.dataset.wallpaper = settings.wallpaper
    // A custom local image is an object URL, restored asynchronously from IndexedDB.
    const source = settings.wallpaperSource === 'uploaded'
      ? uploadedObjectUrl : settings.wallpaperSource
    root.style.setProperty('--site-wallpaper-image', source ? 'url(' + JSON.stringify(source) + ')' : 'none')
    root.style.setProperty('--site-wallpaper-opacity', String(settings.wallpaperOpacity / 100))
    // Home cover follows the selected image by default, even if inner pages use
    // the plain background mode. A separate image can override that choice.
    const homeSelection = settings.homeWallpaperSource === 'inherit'
      ? settings.wallpaperSource : settings.homeWallpaperSource
    const homeImage = homeSelection === 'uploaded' ? uploadedObjectUrl
      : homeSelection === 'home-uploaded' ? homeUploadedObjectUrl : homeSelection
    root.style.setProperty('--home-wallpaper-image',
      'url(' + JSON.stringify(homeImage || DEFAULT_SOURCE) + ')')
    root.dataset.homeWallpaperCustom = String(homeSelection !== DEFAULT_SOURCE)
    root.dataset.homeCover = String(settings.cover)
    root.dataset.postLayout = settings.layout
    root.dataset.bannerTitle = String(settings.title)
    root.dataset.bannerWaves = String(settings.waves)
    root.dataset.motion = settings.motion
    root.classList.toggle('motion-always', settings.motion === 'always')
    root.classList.toggle('motion-off', settings.motion === 'reduced')
    window.dispatchEvent(new CustomEvent('wendell:appearance'))
  }
  const reduceMotion = () => settings.motion === 'reduced' ||
    (settings.motion === 'system' && matchMedia('(prefers-reduced-motion: reduce)').matches)
  window.wendellMotion = { reduce: reduceMotion }
  const set = value => {
    settings = normalize({ ...settings, ...value })
    try {
      localStorage.setItem(key, JSON.stringify(settings))
      localStorage.setItem('theme', settings.theme)
    } catch { /* Settings still work until the page is closed. */ }
    apply()
  }

  const openDB = () => new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) { reject(new Error('此浏览器不支持本地图片存储')); return }
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore('images')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('无法访问本地图片存储'))
    request.onblocked = () => reject(new Error('图片存储被其他页面占用'))
  })
  const readUpload = async (slot = 'current') => {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('images', 'readonly')
      const request = tx.objectStore('images').get(slot)
      request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null)
      request.onerror = () => reject(request.error || new Error('读取本地图片失败'))
      tx.oncomplete = () => db.close()
      tx.onerror = () => { db.close(); reject(tx.error) }
    })
  }
  const writeUpload = async (blob, slot = 'current') => {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('images', 'readwrite')
      if (blob) tx.objectStore('images').put(blob, slot)
      else tx.objectStore('images').delete(slot)
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onerror = () => { db.close(); reject(tx.error || new Error('保存本地图片失败')) }
    })
  }
  const useBlob = (blob, slot = 'current') => {
    const nextUrl = URL.createObjectURL(blob)
    if (slot === 'home') {
      if (homeUploadedObjectUrl) URL.revokeObjectURL(homeUploadedObjectUrl)
      homeUploadedObjectUrl = nextUrl
      document.documentElement.style.setProperty('--home-uploaded-wallpaper-image',
        'url(' + JSON.stringify(nextUrl) + ')')
      return
    }
    if (uploadedObjectUrl) URL.revokeObjectURL(uploadedObjectUrl)
    uploadedObjectUrl = nextUrl
    document.documentElement.style.setProperty('--site-uploaded-wallpaper-image',
      'url(' + JSON.stringify(nextUrl) + ')')
  }
  const validateImage = file => new Promise((resolve, reject) => {
    if (!(file instanceof Blob) || !['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type))
      { reject(new Error('请选择 JPG、PNG、WebP 或 AVIF 图片')); return }
    if (file.size === 0 || file.size > 8 * 1024 * 1024)
      { reject(new Error('图片大小须在 8 MB 以内')); return }
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => { URL.revokeObjectURL(url); resolve() }
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('图片无法读取，请换一张')) }
    image.src = url
  })
  const upload = async file => {
    await validateImage(file)
    await writeUpload(file)
    useBlob(file)
    set({ wallpaperSource: 'uploaded', wallpaper: 'fullscreen' })
  }
  const uploadHome = async file => {
    await validateImage(file)
    await writeUpload(file, 'home')
    useBlob(file, 'home')
    set({ homeWallpaperSource: 'home-uploaded' })
  }
  const useHomeUpload = async () => {
    const blob = await readUpload('home')
    if (!blob) throw new Error('没有找到保存的首页图片，请重新上传')
    useBlob(blob, 'home')
    set({ homeWallpaperSource: 'home-uploaded' })
  }
  const clearHomeUpload = async () => {
    await writeUpload(null, 'home')
    if (homeUploadedObjectUrl) URL.revokeObjectURL(homeUploadedObjectUrl)
    homeUploadedObjectUrl = null
    document.documentElement.style.removeProperty('--home-uploaded-wallpaper-image')
    if (settings.homeWallpaperSource === 'home-uploaded') set({ homeWallpaperSource: 'inherit' })
  }
  const useUpload = async () => {
    const blob = await readUpload()
    if (!blob) throw new Error('没有找到保存的图片，请重新上传')
    useBlob(blob)
    set({ wallpaperSource: 'uploaded', wallpaper: 'fullscreen' })
  }
  const clearUpload = async () => {
    await writeUpload(null)
    if (uploadedObjectUrl) URL.revokeObjectURL(uploadedObjectUrl)
    uploadedObjectUrl = null
    document.documentElement.style.removeProperty('--site-uploaded-wallpaper-image')
    if (settings.wallpaperSource === 'uploaded') set({ wallpaperSource: DEFAULT_SOURCE })
  }
  window.wendellAppearance = {
    get: () => ({ ...settings }), set, reset: () => set({ ...defaults }), apply,
    upload, useUpload, clearUpload,
    uploadHome, useHomeUpload, clearHomeUpload,
    hasHomeUpload: async () => {
      const blob = await readUpload('home')
      if (blob && !homeUploadedObjectUrl) useBlob(blob, 'home')
      return Boolean(blob)
    },
    hasUpload: async () => {
      const blob = await readUpload()
      if (blob && !uploadedObjectUrl) useBlob(blob)
      return Boolean(blob)
    }
  }
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', apply)
  document.addEventListener('astro:page-load', apply)
  apply()
  if (settings.wallpaperSource === 'uploaded' ||
      (settings.homeWallpaperSource === 'inherit' && settings.wallpaperSource === 'uploaded') ||
      settings.homeWallpaperSource === 'uploaded') {
    readUpload().then(blob => {
      if (blob) { useBlob(blob); apply() }
      else {
        const next = { wallpaperSource: DEFAULT_SOURCE }
        if (settings.homeWallpaperSource === 'uploaded') next.homeWallpaperSource = 'inherit'
        set(next)
      }
    }).catch(() => {
      const next = { wallpaperSource: DEFAULT_SOURCE }
      if (settings.homeWallpaperSource === 'uploaded') next.homeWallpaperSource = 'inherit'
      set(next)
    })
  }
  if (settings.homeWallpaperSource === 'home-uploaded') {
    readUpload('home').then(blob => {
      if (blob) { useBlob(blob, 'home'); apply() }
      else set({ homeWallpaperSource: 'inherit' })
    }).catch(() => set({ homeWallpaperSource: 'inherit' }))
  }
})()
