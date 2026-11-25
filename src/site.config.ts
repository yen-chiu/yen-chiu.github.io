import type { CardListData, Config, IntegrationUserConfig, ThemeUserConfig } from 'astro-pure/types'

export const theme: ThemeUserConfig = {
  // [Basic]
  /** Title for your website. Will be used in metadata and as browser tab title. */
  title: 'YenChiu',
  /** Will be used in index page & copyright declaration */
  author: 'Wendell',
  /** Description metadata for your website. Can be used in page metadata. */
  description: '读书，买花，长大。',
  /** The default favicon for your site which should be a path to an image in the `public/` directory. */
  favicon: '/favicon/wendell-avatar-192.png',
  /** The default social card image for your site which should be a path to an image in the `public/` directory. */
  socialCard: '/images/wendell-avatar-card.png',
  /** Specify the default language for this site. */
  locale: {
    lang: 'zh-CN',
    attrs: 'zh_CN',
    // Date locale
    dateLocale: 'zh-CN',
    dateOptions: {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }
  },
  /** Set a logo image to show in the homepage. */
  logo: {
    src: '/src/assets/avatar.png',
    alt: 'Avatar'
  },

  titleDelimiter: '•',
  prerender: true,
  npmCDN: 'https://cdn.jsdelivr.net/npm',

  head: [],
  customCss: [],

  /** Configure the header of your site. */
  header: {
    menu: [
      { title: 'Vesper · 博客', link: '/blog' },
      { title: '念真', link: '/persona' },
      { title: '分类', link: '/categories' },
      { title: '标签', link: '/tags' },
      { title: '时光机', link: '/archives' },
      { title: '站内文档', link: '/docs' },
      { title: 'Folio · 文档库', link: 'https://yenchiu.com/folio/' },
      { title: 'Echora · 聊天', link: 'https://yenchiu.com/echora/' },
      { title: '链接', link: '/links' },
      { title: '项目', link: '/projects' },
      { title: '关于', link: '/about' }
    ]
  },

  /** Configure the footer of your site. */
  footer: {
    // Year format
    year: `© ${new Date().getFullYear()}`,
    // year: `© 2019 - ${new Date().getFullYear()}`,
    links: [
      // Registration link
      // Privacy Policy link
      {
        title: '版权声明',
        link: '/terms/copyright',
        pos: 2 // position set to 2 will be appended to copyright line
      }
    ],
    /** Enable displaying a "Astro & Pure theme powered" link in your site's footer. */
    credits: true,
    /** Optional details about the social media accounts for this site. */
    social: [
      { icon: 'github', label: 'GitHub', href: 'https://github.com/yen-chiu' },
      { icon: 'rss', label: 'RSS', href: '/rss.xml' }
    ]
  },

  // [Content]
  content: {
    /** External links configuration */
    externalLinks: {
      content: ' ↗',
      /** Properties for the external links element */
      properties: { style: 'user-select:none' }
    },
    /** Blog page size for pagination (optional) */
    blogPageSize: 8,
    /** Share buttons to show */
    // Currently support weibo, x, bluesky
    share: ['weibo', 'x', 'bluesky'],
    /** Enable image captions (default false) */
    // 有 alt 的图片自动包成 <figure><figcaption>，省得手写图注。
    imageCaption: true
  }
}

export const integ: IntegrationUserConfig = {
  // [Links]
  // https://astro-pure.js.org/docs/integrations/links
  links: {
    // Friend logbook
    logbook: [
      { date: '2025-03-16', content: 'Is there a leakage?' },
      { date: '2025-03-16', content: 'A leakage of what?' },
      { date: '2025-03-16', content: 'I have a full seat of water, like, full of water!' },
      { date: '2025-03-16', content: 'Must be the water.' },
      { date: '2025-03-16', content: "Let's add that to the words of wisdom." }
    ],
    // Yourself link info
    applyTip: [
      { name: 'Name', val: theme.title },
      { name: 'Desc', val: theme.description || 'Null' },
      { name: 'Link', val: 'https://yenchiu.com/' },
      { name: 'Avatar', val: 'https://yenchiu.com/favicon/wendell-avatar-192.png' }
    ],
    // Cache avatars in `public/avatars/` to improve user experience.
    cacheAvatar: false
  },
  // [Search]
  // Using flexsearch instead of pagefind
  // Add a random quote to the footer (default on homepage footer)
  // See: https://astro-pure.js.org/docs/integrations/advanced#web-content-render
  // [Quote]
  quote: {
    // - Hitokoto
    // https://developer.hitokoto.cn/sentence/#%E8%AF%B7%E6%B1%82%E5%9C%B0%E5%9D%80
    // server: 'https://v1.hitokoto.cn/?c=i',
    // target: `(data) => (data.hitokoto || 'Error')`
    // - Quotable
    // https://github.com/lukePeavey/quotable
    // server: 'http://api.quotable.io/quotes/random?maxLength=60',
    // target: `(data) => data[0].content || 'Error'`
    // - DummyJSON
    server: 'https://dummyjson.com/quotes/random',
    target: `(data) => (data.quote.length > 80 ? \`\${data.quote.slice(0, 80)}...\` : data.quote || 'Error')`
  },
  // [Typography]
  // https://unocss.dev/presets/typography
  typography: {
    class: 'prose text-base',
    // The style of blockquote font `normal` / `italic` (default to italic in typography)
    blockquoteStyle: 'italic',
    // The style of inline code block `code` / `modern` (default to code in typography)
    inlineCodeBlockStyle: 'modern'
  },
  // [Lightbox]
  // A lightbox library that can add zoom effect
  // https://astro-pure.js.org/docs/integrations/others#medium-zoom
  mediumZoom: {
    enable: true, // disable it will not load the whole library
    // 只认 .zoomable 的话，手写 HTML 的 <figure><img> 点不开；
    // 放宽到正文里所有图片，需要禁用的单个图片自己加 .no-zoom。
    selector: '.prose img:not(.no-zoom)',
    options: {
      className: 'zoomable'
    }
  },
  // Comment system - Using Giscus instead of Waline
  waline: {
    enable: false // Disabled, using Giscus instead
    // Server service link
    //server: 'https://astro-theme-pure-waline.arthals.ink/',
    // Show meta info for comments
    //showMeta: false,
    // Refer https://waline.js.org/en/guide/features/emoji.html
    //emoji: ['bmoji', 'weibo'],
    // Refer https://waline.js.org/en/reference/client/props.html
    //additionalConfigs: {
    // search: false,
    //pageview: true,
    //comment: true,
    //locale: {
    //reaction0: 'Like',
    //placeholder: 'Welcome to comment. (Email to receive replies. Login is unnecessary)'
    //},
    //imageUploader: false
  },
  // Giscus comment system configuration
  // 仓库改名后：老站（现 blog-v2）保留原有 Discussions，repoId 不随改名变化，
  // 因此这里指向 blog-v2，历史评论仍可挂回原仓库。
  giscus: {
    enable: true,
    repo: 'yen-chiu/blog-v2',
    repoId: 'R_kgDOKhSzCA',
    category: 'Announcements',
    categoryId: 'DIC_kwDOKhSzCM4CaNBZ'
  }
}

export const terms: CardListData = {
  title: '站点条款',
  list: [
    {
      title: '隐私政策',
      link: '/terms/privacy-policy'
    },
    {
      title: '使用条款',
      link: '/terms/terms-and-conditions'
    },
    {
      title: '版权与许可',
      link: '/terms/copyright'
    },
    {
      title: '免责声明',
      link: '/terms/disclaimer'
    }
  ]
}

const config = { ...theme, integ } as Config
export default config
