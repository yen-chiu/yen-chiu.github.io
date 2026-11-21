import { rehypeHeadingIds } from '@astrojs/markdown-remark'
//import vercel from '@astrojs/vercel'
import AstroPureIntegration from 'astro-pure'
import { defineConfig } from 'astro/config'
import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'
import mermaid from 'astro-mermaid'

// Local integrations
import rehypeAutolinkHeadings from './src/plugins/rehype-auto-link-headings.ts'
import remarkWikilinks from './src/plugins/remark-wikilinks.ts'
// Shiki
import {
  addCollapse,
  addCopyButton,
  addLanguage,
  addTitle,
  updateStyle
} from './src/plugins/shiki-custom-transformers.ts'
import {
  transformerNotationDiff,
  transformerNotationHighlight,
  transformerRemoveNotationEscape
} from './src/plugins/shiki-official/transformers.ts'
import config from './src/site.config.ts'
import { categoryRedirects } from './src/data/category-taxonomy.ts'

// https://astro.build/config
export default defineConfig({
  // [Performance]
  compressHTML: true,

  // [Basic]
  site: 'https://yenchiu.com',
  // 2026-11 起博客迁到根域（GitHub Pages 用户站 yen-chiu.github.io），不再使用子路径
  base: '/',
  // Deploy to a sub path
  // https://astro-pure.js.org/docs/setup/deployment#platform-with-base-path
  // base: '/astro-pure/',
  trailingSlash: 'never',
  // 根域部署，静态跳转目标不再需要前缀
  redirects: Object.fromEntries(
    Object.entries(categoryRedirects).map(([from, to]) => [from, to])
  ),
  // root: './my-project-directory',
  server: { host: true },
  // https://docs.astro.build/en/guides/prefetch/
  prefetch: {
    defaultStrategy: 'hover'
  },

  // [Adapter]
  // https://docs.astro.build/en/guides/deploy/
  // GitHub Pages 使用静态输出
  // adapter: vercel(),
  // output: 'server',
  output: 'static',
  // Local (standalone)
  // adapter: node({ mode: 'standalone' }),
  // output: 'server',

  // [Assets]
  image: {
    responsiveStyles: true,
    service: { entrypoint: 'astro/assets/services/sharp' },
    // domains: ['ghchart.rshah.org'],
    remotePatterns: [{ protocol: 'https' }]
  },
  // Enable font preloading and optimization
  // https://docs.astro.build/en/guides/fonts/
  // [Markdown]
  markdown: {
    remarkPlugins: [
      remarkMath,
      [remarkWikilinks, { basePath: '/blog' }]
    ],
    rehypePlugins: [
      [rehypeKatex, {}],
      rehypeHeadingIds,
      [
        rehypeAutolinkHeadings,
        {
          behavior: 'append',
          properties: { className: ['anchor'] },
          content: { type: 'text', value: '#' }
        }
      ]
    ],
    // https://docs.astro.build/en/guides/syntax-highlighting/
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark'
      },
      transformers: [
        // Two copies of @shikijs/types (one under node_modules
        // and another nested under @astrojs/markdown-remark → shiki).
        // Use type assertion to work around version mismatch
        // Official transformers
        // @ts-ignore this happens due to multiple versions of shiki types
        transformerNotationDiff(),
        // @ts-ignore this happens due to multiple versions of shiki types
        transformerNotationHighlight(),
        // @ts-ignore this happens due to multiple versions of shiki types
        transformerRemoveNotationEscape(),
        // Custom transformers
        // @ts-ignore this happens due to multiple versions of shiki types
        updateStyle(),
        // @ts-ignore this happens due to multiple versions of shiki types
        addTitle(),
        // @ts-ignore this happens due to multiple versions of shiki types
        addLanguage(),
        // @ts-ignore this happens due to multiple versions of shiki types
        addCopyButton(2000), // timeout in ms
        // @ts-ignore this happens due to multiple versions of shiki types
        addCollapse(15) // max lines that needs to collapse
      ]
    }
  },

  // [Integrations]
  integrations: [
    // astro-pure will automatically add sitemap, mdx & unocss
    // sitemap(),
    // mdx(),
    mermaid(),

    AstroPureIntegration(config)
  ],

  // [Experimental]
  experimental: {
    // Allow compatible editors to support intellisense features for content collection entries
    // https://docs.astro.build/en/reference/experimental-flags/content-intellisense/
    contentIntellisense: true,
    // Enable SVGO optimization for SVG assets
    // https://docs.astro.build/en/reference/experimental-flags/svg-optimization/
    svgo: true,
    // Enables using the new Rust-based compiler for Astro files.
    // https://docs.astro.build/en/reference/experimental-flags/rust-compiler/
    rustCompiler: false,
    // https://docs.astro.build/en/reference/experimental-flags/queued-rendering/
    queuedRendering: {
      enabled: true
    }
  },
  vite: {
    build: {
      minify: 'esbuild',
      cssMinify: 'esbuild',
      cssTarget: 'chrome99',
      rollupOptions: {
        output: {
        }
      }
    },
    ssr: {
      external: ['@myriaddreamin/typst-ts-node-compiler']
    }
  }
})


