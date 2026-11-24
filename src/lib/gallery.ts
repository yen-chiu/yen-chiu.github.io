import { createHash } from 'node:crypto'
import { photos } from '@/data/photos'
export const albumId=(name:string)=>createHash('sha256').update(name).digest('hex').slice(0,20)
export const orderedPhotos=[...photos].sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id))
export const galleryAlbums=[...new Set(orderedPhotos.map(p=>p.album))].map(name=>({name,id:albumId(name),photos:orderedPhotos.filter(p=>p.album===name)}))
