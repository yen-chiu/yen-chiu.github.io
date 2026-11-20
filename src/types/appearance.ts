export interface AppearanceSettings {
  hue: number
  theme: 'system' | 'light' | 'dark'
  wallpaper: 'banner' | 'fullscreen' | 'overlay'
  cover: boolean
  layout: 'list' | 'grid'
  title: boolean
  waves: boolean
  motion: 'system' | 'always' | 'reduced'
}
declare global {
  interface Window {
    wendellAppearance?: {
      get(): AppearanceSettings
      set(value: Partial<AppearanceSettings>): void
      reset(): void
      apply(): void
    }
    /** 站点级「动画效果」开关：settings 里选的值优先于系统偏好 */
    wendellMotion?: {
      reduce(): boolean
    }
  }
}
