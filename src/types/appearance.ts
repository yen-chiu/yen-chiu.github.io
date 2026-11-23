export interface AppearanceSettings {
  hue: number
  theme: 'system' | 'light' | 'dark'
  wallpaper: 'banner' | 'fullscreen' | 'overlay'
  /** A curated same-origin URL, an HTTPS image URL, or the saved "uploaded" image. */
  wallpaperSource: string
  wallpaperOpacity: number
  cover: boolean
  layout: 'list' | 'grid'
  title: boolean
  waves: boolean
  motion: 'system' | 'always' | 'reduced'
  silverInk: boolean
}
declare global {
  interface Window {
    wendellAppearance?: {
      get(): AppearanceSettings
      set(value: Partial<AppearanceSettings>): void
      reset(): void
      apply(): void
      upload(file: File): Promise<void>
      useUpload(): Promise<void>
      hasUpload(): Promise<boolean>
      clearUpload(): Promise<void>
    }
    /** 站点级「动画效果」开关：settings 里选的值优先于系统偏好 */
    wendellMotion?: {
      reduce(): boolean
    }
  }
}
