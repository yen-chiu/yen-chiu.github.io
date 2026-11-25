export interface AppearanceSettings {
  hue: number
  theme: 'system' | 'light' | 'dark'
  wallpaper: 'banner' | 'fullscreen' | 'overlay'
  /** A curated same-origin URL, an HTTPS image URL, or the saved "uploaded" image. */
  wallpaperSource: string
  wallpaperOpacity: number
  /** 'inherit' uses the inner-page image; a separate source affects only the homepage. */
  homeWallpaperSource: string
  cover: boolean
  layout: 'list' | 'grid'
  title: boolean
  waves: boolean
  motion: 'system' | 'always' | 'reduced'
  network: 'auto' | 'standard' | 'saving'
  silverInk: boolean
  animatedAvatar: boolean
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
      uploadHome(file: File): Promise<void>
      useHomeUpload(): Promise<void>
      hasHomeUpload(): Promise<boolean>
      clearHomeUpload(): Promise<void>
    }
    /** 站点级「动画效果」开关：settings 里选的值优先于系统偏好 */
    wendellMotion?: {
      reduce(): boolean
    }
  }
}
