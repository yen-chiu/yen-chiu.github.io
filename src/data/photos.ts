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
 variantWidths?: Record<string,number>
 variants?: Record<string,string>
 featured?: boolean
 camera?: string
 caption?: string
}
// Add published derivatives only. Never include private RAW files or GPS EXIF.
const ids=new Set<string>()
const publicUrl=(value:unknown)=>typeof value==='string'&&/^https:\/\/gallery-cdn\.yenchiu\.com\/photos\/[a-f0-9]{24}\/(?:v1\/)?(?:480|960|1920|3840)\.webp$/.test(value)
export const photos: GalleryPhoto[] = (catalogue as unknown as GalleryPhoto[]).map(p=>{
 if(!p||!(/^[a-f0-9]{24}$/).test(p.id)||ids.has(p.id))throw Error('Invalid or duplicate gallery ID')
 ids.add(p.id)
 for(const key of ['title','alt','album','date'] as const)if(typeof p[key]!=='string'||!p[key].trim())throw Error('Missing gallery '+key)
 if(!/^\d{4}-\d{2}-\d{2}$/.test(p.date)||!Number.isInteger(p.width)||!Number.isInteger(p.height)||p.width<=0||p.height<=0)throw Error('Invalid gallery dimensions or date')
 if(!publicUrl(p.thumbnail)||!publicUrl(p.preview))throw Error('Invalid public gallery URL')
 if(p.variants)for(const size of [480,960,1920,3840])if(!publicUrl(p.variants[size])||!Number.isInteger(p.variantWidths?.[size])||p.variantWidths![size]<=0)throw Error('Invalid gallery variant')
 return p
})
