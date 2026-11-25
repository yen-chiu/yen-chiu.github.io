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
  license: string
  licenseUrl?: string
  sourceUrl: string
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
    attribution: '录音以 CC0 1.0 发布；演奏版本见来源页。',
    license: 'CC0 1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Nocturne_Op._9_no._2_in_E_flat_major.mp3'
  },
  {
    id: 'debussy-clair-de-lune',
    title: '月光 · Clair de lune',
    artist: 'Claude Debussy · Laurens Goedhart',
    source: 'audio',
    provider: 'Wikimedia Commons',
    url: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Clair_de_lune_(Claude_Debussy)_Suite_bergamasque.ogg',
    attribution: '录音：Laurens Goedhart。',
    license: 'CC BY 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Clair_de_lune_(Claude_Debussy)_Suite_bergamasque.ogg'
  },
  {
    id: 'satie-gymnopedie-guitar',
    title: 'Gymnopédie No. 1 · 吉他改编',
    artist: 'Erik Satie · Michael Laucke',
    source: 'audio',
    provider: 'Wikimedia Commons',
    url: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Satie_Gymnopedie_No_1_performed_by_Michael_Laucke.flac',
    attribution: '录音与改编：Michael Laucke。',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Satie_Gymnopedie_No_1_performed_by_Michael_Laucke.flac'
  },
  {
    id: 'beethoven-moonlight',
    title: '月光奏鸣曲 · Piano Sonata No. 14',
    artist: 'Ludwig van Beethoven · Schwarzer Stern',
    source: 'audio',
    provider: 'Wikimedia Commons',
    url: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Sonate_Clair_de_lune.ogg',
    attribution: '录音：Schwarzer Stern。',
    license: '公有领域贡献',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Sonate_Clair_de_lune.ogg'
  },
]

export const musicSources = [
  { name: 'Spotify', href: 'https://open.spotify.com/', note: '使用官方分享或嵌入链接' },
  { name: 'SoundCloud', href: 'https://soundcloud.com/', note: '使用官方 Widget' },
  { name: 'YouTube Music', href: 'https://music.youtube.com/', note: '优先官方播放页面' },
  { name: '网易云音乐', href: 'https://music.163.com/', note: '官方分享页 / 外部播放' },
  { name: 'QQ 音乐', href: 'https://y.qq.com/', note: '官方分享页 / 外部播放' }
] as const

export const sampleLicenseUrl = 'https://commons.wikimedia.org/wiki/File:Nocturne_Op._9_no._2_in_E_flat_major.mp3'
