// Read only explicitly allowed TIFF/EXIF tags. Never traverse GPS or MakerNote.
export function safeExif(buffer){
 try{
 if(!buffer)return {}
 const b=Buffer.from(buffer), start=b.subarray(0,6).toString()==='Exif\0\0'?6:0
 const t=b.subarray(start), le=t.toString('ascii',0,2)==='II'
 if(!le&&t.toString('ascii',0,2)!=='MM')return {}
 const u16=o=>le?t.readUInt16LE(o):t.readUInt16BE(o),u32=o=>le?t.readUInt32LE(o):t.readUInt32BE(o)
 if(u16(2)!==42)return {}
 const tags=new Map()
 function read(offset,allowed){
 const n=u16(offset)
 if(n>512||offset+2+n*12>t.length)return
 for(let i=0;i<n;i++){
 const p=offset+2+i*12,tag=u16(p),type=u16(p+2),count=u32(p+4)
 if(!allowed.includes(tag)||count>256)continue
 const size=({2:1,3:2,4:4,5:8})[type]
 if(!size||!count)continue
 const o=size*count<=4?p+8:u32(p+8)
 if(o+size*count>t.length)continue
 let v
 if(type===2)v=t.toString('ascii',o,o+count).replace(/[^ -~]/g,'').trim()
 else if(type===3)v=u16(o)
 else if(type===4)v=u32(o)
 else {const d=u32(o+4);if(d)v=u32(o)/d}
 tags.set(tag,v)
 }
 }
 read(u32(4),[271,272,34665])
 if(Number.isInteger(tags.get(34665)))read(tags.get(34665),[33434,33437,34855,36867,37386,42036])
 const exposure=tags.get(33434),aperture=tags.get(33437),iso=tags.get(34855),focal=tags.get(37386)
 const model=tags.get(272)||tags.get(271),lens=tags.get(42036)
 const equipment=value=>String(value).replace(/[·|;,，；\r\n]/g,' ').trim()
 const camera=[model?'相机: '+equipment(model):'',lens?'镜头: '+equipment(lens):'',focal>0?focal.toFixed(0)+'mm':'',aperture>0?'f/'+aperture.toFixed(1):'',exposure>0?(exposure<1?'1/'+Math.round(1/exposure):exposure)+'s':'',iso>0?'ISO '+iso:''].filter(Boolean).join(' · ')
 const date=String(tags.get(36867)||'').match(/^(\d{4}):(\d{2}):(\d{2})/)
 return {camera,date:date?date.slice(1).join('-'):''}
 }catch{return {}}
}
