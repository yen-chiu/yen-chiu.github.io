// A single Audio instance survives Astro ClientRouter page swaps.
export type MusicTrack = { id:string; title:string; artist:string; source:'audio'|'external'; url:string; provider:string; attribution:string }
export type MusicSnapshot = { id:string; volume:number; playing:boolean; currentTime:number; duration:number; status:string; repeat:'off'|'all'|'one'; shuffle:boolean }
const STORAGE_KEY = 'vesper-music-v1'
class MusicEngine {
  readonly audio:HTMLAudioElement
  private listeners = new Set<(snapshot:MusicSnapshot)=>void>()
  private tracks:MusicTrack[] = []
  private id = ''
  private repeat:'off'|'all'|'one' = 'off'
  private shuffle = false
  private transitionToken = 0
  private status = '点击播放开始收听 · 不会自动播放'
  constructor() {
    this.audio = new Audio()
    this.audio.preload = 'none'
    this.audio.volume = .7
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
      if (typeof saved.id === 'string') this.id = saved.id
      if (saved.repeat === 'all' || saved.repeat === 'one') this.repeat = saved.repeat
      this.shuffle = saved.shuffle === true
      if (typeof saved.volume === 'number' && Number.isFinite(saved.volume)) this.audio.volume = Math.min(1,Math.max(0,saved.volume))
    } catch {}
    for (const event of ['play','pause','timeupdate','durationchange','loadedmetadata','ended','error','volumechange']) {
      this.audio.addEventListener(event, () => {
        if (event === 'ended') { this.status = '播放结束'; void this.onEnded() }
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
    return { id:this.id, volume:this.audio.volume, playing:!this.audio.paused, currentTime:this.audio.currentTime || 0, duration:Number.isFinite(this.audio.duration)?this.audio.duration:0, status:this.status, repeat:this.repeat, shuffle:this.shuffle }
  }
  subscribe(listener:(snapshot:MusicSnapshot)=>void) {
    this.listeners.add(listener)
    listener(this.snapshot)
    return () => { this.listeners.delete(listener) }
  }
  private emit() { const snapshot=this.snapshot; for (const listener of this.listeners) listener(snapshot) }
  private persist() { try { localStorage.setItem(STORAGE_KEY,JSON.stringify({id:this.id,volume:this.audio.volume,repeat:this.repeat,shuffle:this.shuffle})) } catch {} }
  select(id:string) {
    const track=this.tracks.find(track=>track.id===id && track.source==='audio')
    if (!track || track.id===this.id) return
    this.transitionToken++
    this.audio.pause()
    this.audio.removeAttribute('src')
    this.audio.load()
    this.id=track.id
    this.status='点击播放开始收听 · 不会自动播放'
    this.persist()
    this.emit()
  }
  private playable() { return this.tracks.filter(track => track.source === 'audio') }
  private neighbor(direction:1|-1, wrap:boolean) {
    const list=this.playable()
    if (!list.length) return null
    const index=list.findIndex(track=>track.id===this.id)
    if (direction===1 && this.shuffle && list.length>1) {
      const choices=list.filter(track=>track.id!==this.id)
      return choices[Math.floor(Math.random()*choices.length)].id
    }
    const next=index+direction
    if (!wrap && (next<0 || next>=list.length)) return null
    return list[(next+list.length)%list.length].id
  }
  private async jump(direction:1|-1, forcePlay=false, wrap=true) {
    const next=this.neighbor(direction,wrap)
    if (!next) return
    const resume=forcePlay || !this.audio.paused
    this.select(next)
    if (resume) await this.playSelected()
  }
  async next() { await this.jump(1) }
  async previous() {
    if (this.audio.currentTime>3) { this.audio.currentTime=0; return }
    await this.jump(-1)
  }
  private async onEnded() {
    if (this.repeat==='one') { this.audio.currentTime=0; await this.playSelected(); return }
    if (this.repeat==='all') await this.jump(1,true)
  }
  cycleRepeat() {
    this.repeat=this.repeat==='off'?'all':this.repeat==='all'?'one':'off'
    this.persist();this.emit()
  }
  toggleShuffle() { this.shuffle=!this.shuffle;this.persist();this.emit() }
  private async playSelected() {
    const track=this.tracks.find(track=>track.id===this.id && track.source==='audio')
    if (!track) return
    if (!this.audio.getAttribute('src')) this.audio.src=track.url
    this.status='正在连接音源…'
    this.emit()
    try { await this.audio.play(); this.status='正在播放 · '+track.provider }
    catch { this.status='播放失败：音源暂不可用，或浏览器阻止了播放。' }
    this.emit()
  }
  async toggle() {
    if (!this.audio.paused) { this.audio.pause(); this.status='已暂停'; this.emit(); return }
    await this.playSelected()
  }
  seek(fraction:number) { if (Number.isFinite(this.audio.duration) && this.audio.duration>0) this.audio.currentTime=Math.max(0,Math.min(1,fraction))*this.audio.duration }
  setVolume(value:number) { this.audio.volume=Math.max(0,Math.min(1,value));this.persist();this.emit() }
}
export const musicEngine = new MusicEngine()
