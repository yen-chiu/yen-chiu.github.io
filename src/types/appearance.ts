export interface AppearanceSettings {
  hue: number
  theme: 'system' | 'light' | 'dark'
  wallpaper: 'banner' | 'fullscreen' | 'overlay' | 'hidden'
  layout: 'list' | 'grid'
  title: boolean
  waves: boolean
}
declare global {
  interface Window {
    wendellAppearance?: {
      get(): AppearanceSettings
      set(value: Partial<AppearanceSettings>): void
      reset(): void
      apply(): void
    }
  }
}
