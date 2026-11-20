// Behavior informed by Fuwari's setting-utils and Mizuki's SettingsPanel.
// One implementation runs before paint and serves the settings controls.
(() => {
  if (window.wendellAppearance) { window.wendellAppearance.apply(); return }
  const key = 'wendell-appearance-v1'
  const defaults = { hue:267, theme:'system', wallpaper:'banner', cover:true, layout:'list', title:true, waves:false, motion:'system' }
  const normalize = value => {
    const v = value && typeof value === 'object' ? value : {}
    return {
      hue:typeof v.hue === 'number' && Number.isFinite(v.hue) ? Math.max(0,Math.min(360,Math.round(v.hue))) : defaults.hue,
      theme:['system','light','dark'].includes(v.theme) ? v.theme : defaults.theme,
      wallpaper:['banner','fullscreen','overlay'].includes(v.wallpaper) ? v.wallpaper : defaults.wallpaper,
      cover:typeof v.cover === 'boolean' ? v.cover : v.wallpaper==='hidden' ? false : defaults.cover,
      layout:['list','grid'].includes(v.layout) ? v.layout : defaults.layout,
      title:typeof v.title === 'boolean' ? v.title : defaults.title,
      waves:typeof v.waves === 'boolean' ? v.waves : defaults.waves,
      motion:['system','always','reduced'].includes(v.motion) ? v.motion : defaults.motion
    }
  }
  let settings = {...defaults}
  try {
    const saved = localStorage.getItem(key)
    settings = normalize(saved ? JSON.parse(saved) : {...defaults,theme:localStorage.getItem('theme') || 'system'})
  } catch { /* Unavailable or corrupt storage keeps readable defaults. */ }
  const luminance = (h,l) => {
    const s=.52, a=s*Math.min(l,1-l)
    const rgb=[0,8,4].map(n => {
      const k=(n+h/30)%12, v=l-a*Math.max(-1,Math.min(k-3,9-k,1))
      return v<=.04045 ? v/12.92 : ((v+.055)/1.055)**2.4
    })
    return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722
  }
  const apply = () => {
    const root=document.documentElement, h=settings.hue
    let lightness=46
    while (lightness>22 && 1.05/(luminance(h,lightness/100)+.05)<5.2) lightness-=1
    root.style.setProperty('--brand-hue',String(h))
    root.style.setProperty('--primary-light',`${h} 52% ${lightness}%`)
    root.style.setProperty('--primary-dark',`${h} 68% 78%`)
    root.classList.toggle('dark',settings.theme==='dark'||(settings.theme==='system'&&matchMedia('(prefers-color-scheme: dark)').matches))
    root.dataset.wallpaper=settings.wallpaper
    root.dataset.homeCover=String(settings.cover)
    root.dataset.postLayout=settings.layout
    root.dataset.bannerTitle=String(settings.title)
    root.dataset.bannerWaves=String(settings.waves)
    root.dataset.motion=settings.motion
    root.classList.toggle('motion-always',settings.motion==='always')
    root.classList.toggle('motion-off',settings.motion==='reduced')
    window.dispatchEvent(new CustomEvent('wendell:appearance'))
  }
  // 站点自己的「动画效果」选择优先于系统偏好：只有「跟随系统」才去问操作系统
  const reduceMotion = () => settings.motion==='reduced' || (settings.motion==='system' && matchMedia('(prefers-reduced-motion: reduce)').matches)
  window.wendellMotion = { reduce: reduceMotion }
  const set = value => {
    settings=normalize({...settings,...value})
    try {localStorage.setItem(key,JSON.stringify(settings));localStorage.setItem('theme',settings.theme)} catch { /* In-memory settings still work. */ }
    apply()
  }
  window.wendellAppearance={get:()=>({...settings}),set,reset:()=>set({...defaults}),apply}
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change',apply)
  document.addEventListener('astro:page-load',apply)
  apply()
})()
