import catalogue from './gallery-photos.json'
export interface GalleryPhoto {
 id: string
 title: string
 alt: string
 album: string
 date: string
 width: number
 height: number
 thumbnail: string
 preview: string
 variants?: Record<string,string>
 featured?: boolean
 camera?: string
 caption?: string
}
// Add published derivatives only. Never include private RAW files or GPS EXIF.
export const photos: GalleryPhoto[] = catalogue as GalleryPhoto[]
