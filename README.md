# Vesper — Wendell's Website

<p align="right">
  <a href="./README.md"><img alt="English" src="https://img.shields.io/badge/EN-English-374151?style=flat-square&labelColor=111827"></a>
  <a href="./README-zh-CN.md"><img alt="简体中文" src="https://img.shields.io/badge/%E4%B8%AD-%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87-e5e7eb?style=flat-square&labelColor=111827"></a>
</p>

**Vesper (暮星)** is the Astro theme powering [Wendell's personal website](https://yenchiu.com), home to a blog, documentation, and the literary journal *余白*.

> This is a personal website repository, not the official Astro Theme Iris template. Vesper evolved from Iris; its upstream README is archived at [migration/upstream-README.md](./migration/upstream-README.md).

## Theme

- **Name:** Vesper (暮星)
- **Package:** `astro-theme-vesper`
- **Theme release:** v0.1.0 (`theme-v0.1.0`)
- **Foundation:** Astro, derived from [Astro Theme Iris](https://github.com/LemonAdorable/astro-theme-iris)
- **Design:** An editorial visual language shared by the blog, documentation, and journal cover

## Website and repository

- **Website:** [yenchiu.com](https://yenchiu.com)
- **Repository:** [yen-chiu/yen-chiu.github.io](https://github.com/yen-chiu/yen-chiu.github.io)
- **Deployment:** GitHub Actions builds and publishes to GitHub Pages after a push to `main`
- **History:** Jekyll · huxpro (Mar 2023–Oct 2023) → Jekyll · Chirpy (Oct 2023–Nov 2026) → Astro · Vesper (since Nov 2026). See the [changelog](https://yenchiu.com/changelog/).

## Local development

Requires Node.js 24:

```bash
npm ci
npm run dev -- --host 127.0.0.1
```

Production build:

```bash
npm run build
```

The project's `.npmrc` enables `legacy-peer-deps`. On Windows, if esbuild encounters temporary-directory permission errors, point `TEMP` and `TMP` to a writable directory inside the workspace before rebuilding.

## Project structure

| Path | Purpose |
| --- | --- |
| `src/content/blog` | Blog posts and categories |
| `src/content/docs` | Documentation and theme notes |
| `src/pages/journal.astro` | Cover page for the *余白* journal |
| `src/pages/persona.astro` | Nianzhen persona page |
| `migration/content-manifest.json` | Migration records and legacy URLs |
| `migration/upstream-README.md` | Archived upstream Iris README |
| `migration/upstream-examples` | Archived examples excluded from content generation |
| `scripts/` | Migration, build utilities, and validation scripts |

## Attribution and licensing

Vesper evolved from Astro Theme Iris. Upstream licenses and attribution are preserved; see [LICENSE](./LICENSE) and the [archived upstream README](./migration/upstream-README.md).

- **Theme and related code:** Apache-2.0, with upstream author attribution and third-party licenses preserved.
- **Original blog posts and documentation:** [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) unless otherwise stated.
- **Original *余白* journal articles:** Subject to each issue's notice; currently [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- **Photography, illustrations, and third-party materials:** Governed by their respective licenses; not automatically covered by the terms above.

For details, see the [copyright and usage policy](https://yenchiu.com/terms/copyright/).

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=yen-chiu/yen-chiu.github.io&type=Date)](https://star-history.com/#yen-chiu/yen-chiu.github.io&Date)
