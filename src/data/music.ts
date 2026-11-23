/**
 * Vesper Music catalogue.
 * Only put playable URLs in 'audio' entries when you hold web playback rights.
 * Provider entries should use official share/embedding URLs, never scraped MP3 links.
 */
export type MusicTrack = {
  id: string
  title: string
  artist: string
  source: 'audio' | 'external'
  url: string
  provider: string
  attribution: string
  cover?: string
  lyrics?: string
}

export const musicTracks: MusicTrack[] = [
  {
    id: 'chopin-nocturne-9-2',
    title: '夜曲 Op. 9 No. 2',
    artist: 'Frédéric Chopin · 演奏版本见来源页',
    source: 'audio',
    provider: 'Wikimedia Commons',
    url: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Nocturne_Op._9_no._2_in_E_flat_major.mp3',
    attribution: '录音以 CC0 1.0 发布；来源及许可详情：Wikimedia Commons（见下方来源链接）'
  }
]

export const musicSources = [
  { name: 'Spotify', href: 'https://open.spotify.com/', note: '使用官方分享或嵌入链接' },
  { name: 'SoundCloud', href: 'https://soundcloud.com/', note: '使用官方 Widget' },
  { name: 'YouTube Music', href: 'https://music.youtube.com/', note: '优先官方播放页面' },
  { name: '网易云音乐', href: 'https://music.163.com/', note: '官方分享页 / 外部播放' },
  { name: 'QQ 音乐', href: 'https://y.qq.com/', note: '官方分享页 / 外部播放' }
] as const

export const sampleLicenseUrl = 'https://commons.wikimedia.org/wiki/File:Nocturne_Op._9_no._2_in_E_flat_major.mp3'
