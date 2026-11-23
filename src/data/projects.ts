export const projects = [
  {
    id: 'nianzhen',
    group: 'interactive',
    name: '念真',
    kind: '个人 AI 对话',
    status: '原站体验',
    description: '在浏览器里和念真聊天；需要时，也能让她查找公开网页。',
    tags: ['AI 对话', '静态站', '联网检索'],
    primary: { label: '进入聊天', href: 'https://yenchiu.com/echora/' },
    secondary: { label: '认识念真', href: '/persona' }
  },
  {
    id: 'miko',
    group: 'interactive',
    name: '异次元通讯 · 网页版',
    kind: '互动剧情复现',
    status: '原站体验',
    description: '把停服后的文字聊天游戏搬进浏览器，重新体验打字、分支选择、词典与图鉴。',
    tags: ['互动剧情', '纯静态', '怀旧复现'],
    cover: '/images/projects/miko-cover.webp',
    coverWidth:1280,coverHeight:720,
    primary: { label: '开始体验', href: 'https://yenchiu.com/echora/play.html?a=miko' },
    secondary: { label: '制作记录', href: '/blog/miko-web' }
  },
  {
    id: 'lifeline',
    group: 'interactive',
    name: '生命线 · 网页版',
    kind: '文字冒险复现',
    status: '原站体验',
    description: '跟随泰勒的消息推进故事，在等待与选择之间决定接下来发生什么；支持多语言与存档。',
    tags: ['消息叙事', '分支选择', '多语言存档'],
    primary: { label: '开始体验', href: 'https://yenchiu.com/echora/play.html?a=lifeline' },
    secondary: null
  },
  {
    id: 'inhuman',
    group: 'interactive',
    name: 'Inhuman · 整活网页合集',
    kind: '开源小游戏维护',
    status: '在线体验',
    description: '八个不按常理出牌的小游戏：验证码、假网盘、抽奖转盘……基于 CS-LX 的开源项目维护。',
    tags: ['整活小游戏', '纯静态', '开源维护'],
    cover: '/images/projects/inhuman-cover.svg',
    coverWidth: 1280,
    coverHeight: 720,
    primary: { label: '开始整活', href: 'https://yenchiu.com/Inhuman/' },
    secondary: { label: '查看源码', href: 'https://github.com/yen-chiu/Inhuman' }
  },
  {
    id: 'astro',
    group: 'building',
    name: 'YenChiu · Vesper',
    kind: '网站与写作',
    status: '持续维护',
    description: '从 Jekyll 搬到 Astro 之后，继续折腾目录、阅读界面和那些看着不起眼的小细节。',
    tags: ['Astro', 'Vesper', 'GitHub Pages'],
    primary: { label: '查看源码', href: 'https://github.com/yen-chiu/yen-chiu.github.io' },
    secondary: {
      label: '迁移记录',
      href: 'https://yenchiu.com/folio/building/astro-migration/'
    }
  },
  {
    id: 'manual',
    group: 'building',
    name: 'Folio',
    kind: '文档与知识整理',
    status: '文档库',
    description: '建站笔记、工具备忘和踩坑记录。下次忘了，来这里翻一翻。',
    tags: ['建站笔记', '工具备忘', '工作记录'],
    primary: { label: '阅读文档', href: 'https://yenchiu.com/folio/' },
    secondary: null
  }
] as const
