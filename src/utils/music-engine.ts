// A single Audio instance survives Astro ClientRouter page swaps.
export type MusicTrack = { id:string; title:string; artist:string; source:'audio'|'external'; url:string; provider:string; attribution:string }
export type MusicSnapshot = { id:string; volume:number; playing:boolean; currentTime:number; duration:number; status:string }
const STORAGE_KEY = 'vesper-music-v1'
class MusicEngine {
  readonly audio:HTMLAudioElement
  private listeners = new Set<(snapshot:MusicSnapshot)=>void>()
  private tracks:MusicTrack[] = []
  private id = ''
  private status = '点击播放开始收听 · 不会自动播放'
  constructor() {
    this.audio = new Audio()
    this.audio.preload = 'none'
    this.audio.volume = .7
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
      if (typeof saved.id === 'string') this.id = saved.id
      if (typeof saved.volume === 'number' && Number.isFinite(saved.volume)) this.audio.volume = Math.min(1,Math.max(0,saved.volume))
    } catch {}
    for (const event of ['play','pause','timeupdate','durationchange','loadedmetadata','ended','error','volumechange']) {
      this.audio.addEventListener(event, () => {
        if (event === 'ended') this.status = '播放结束'
        if (event === 'error') this.status = '音源加载失败，请尝试在来源页收听。'
        this.emit()
      })
    }
    // Do not stop audio on astro:before-swap; the engine is not owned by a page.
  }
  configure(tracks:MusicTrack[]) {
    this.tracks = tracks
    if (!tracks.some(track=>track.id===this.id && track.source==='audio')) this.id = tracks.find(track=>track.source==='audio')?.id || ''
    this.emit()
  }
  get snapshot():MusicSnapshot {
    return { id:this.id, volume:this.audio.volume, playing:!this.audio.paused, currentTime:this.audio.currentTime || 0, duration:Number.isFinite(this.audio.duration)?this.audio.duration:0, status:this.status }
  }
  subscribe(listener:(snapshot:MusicSnapshot)=>void) {
    this.listeners.add(listener)
    listener(this.snapshot)
    return () => { this.listeners.delete(listener) }
  }
  private emit() { const snapshot=this.snapshot; for (const listener of this.listeners) listener(snapshot) }
  private persist() { try { localStorage.setItem(STORAGE_KEY,JSON.stringify({id:this.id,volume:this.audio.volume})) } catch {} }
  select(id:string) {
    const track=this.tracks.find(track=>track.id===id && track.source==='audio')
    if (!track || track.id===this.id) return
    this.audio.pause()
    this.audio.removeAttribute('src')
    this.audio.load()
    this.id=track.id
    this.status='点击播放开始收听 · 不会自动播放'
    this.persist()
    this.emit()
  }
  async toggle() {
    if (!this.audio.paused) { this.audio.pause(); this.status='已暂停'; this.emit(); return }
    const track=this.tracks.find(track=>track.id===this.id && track.source==='audio')
    if (!track) return
    if (!this.audio.getAttribute('src')) this.audio.src=track.url
    this.status='正在连接音源…'
    this.emit()
    try { await this.audio.play(); this.status='正在播放 · '+track.provider }
    catch { this.status='播放失败：音源暂不可用，或浏览器阻止了播放。' }
    this.emit()
  }
  seek(fraction:number) { if (Number.isFinite(this.audio.duration) && this.audio.duration>0) this.audio.currentTime=Math.max(0,Math.min(1,fraction))*this.audio.duration }
  setVolume(value:number) { this.audio.volume=Math.max(0,Math.min(1,value));this.persist();this.emit() }
}
export const musicEngine = new MusicEngine()
