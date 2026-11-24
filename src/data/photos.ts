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
 camera?: string
 caption?: string
}
// Add published derivatives only. Never include private RAW files or GPS EXIF.
export const photos: GalleryPhoto[] = []
