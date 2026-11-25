# Vesper 品牌资源与上游遗留资产审计

审计日期：2026-11-25。基线：`origin/main` 的 `b29153fc`。分支：`chore/brand-assets-cleanup`。

## 范围与方法

扫描 Git 跟踪文件及本次新增文件中的图片、源码、配置、文档、静态页面和资源引用。逐文件的大小、SHA-256、文本引用候选和品牌命中文件见 [资源清单](./brand-assets-inventory.json)。图片按字节哈希识别重复；没有字面文件名引用只作为人工复核线索，动态 glob、拼接 URL、旧站公开地址不能据此删除。

Markdown 图片用语法树解析，排除代码块中的教学示例；站点绝对路径按 `public/` 解析。生产产物另检查所有 HTML 中的图片、srcset、脚本、样式表、图标、预载入资源，以及 CSS 和内联样式的 `url()`。外部服务的可用性不属于本地文件存在性检查，旧 QA 文件中指向 `.work/` 的证据路径也不作为当前展示资源。

## 迁移清单

以下文件均保持原始字节，不重画、不转码、不改变归属：

| 原路径 | 新路径 | 理由 |
| --- | --- | --- |
| `function.png` | `migration/upstream-assets/function.png` | Iris 功能截图归档 |
| `index.png` | `migration/upstream-assets/index.png` | Iris 首页截图归档 |
| `logo.png` | `migration/upstream-assets/logo.png` | Iris Logo 归档 |
| `search.png` | `migration/upstream-assets/search.png` | Iris 搜索截图归档 |
| `src/assets/projects/2.avif` | `migration/upstream-assets/projects/2.avif` | 无调用方使用的上游植物演示图 |
| `src/assets/projects/3.avif` | `migration/upstream-assets/projects/3.avif` | 无调用方使用的上游花卉演示图 |
| `src/assets/projects/4.avif` | `migration/upstream-assets/projects/4.avif` | 无调用方使用的上游抽象演示图 |
| `.github/assets/header.webp` | `migration/upstream-assets/pure/header.webp` | 无引用的 Pure 品牌横幅 |
| `.github/assets/body.webp` | `migration/upstream-assets/pure/body.webp` | 无引用的 Pure 演示拼图 |
| `.github/assets/lighthouse-score.png` | `migration/upstream-assets/pure/lighthouse-score.png` | 上游历史跑分，不能作为 Vesper 当前结果 |

另将 `.github/FUNDING.yml` 移至 `migration/upstream-assets/upstream-FUNDING.yml`，保留原上游赞助配置作为历史资料，移除当前仓库指向上游个人赞助入口的默认配置。

`migration/upstream-README.md` 的四张图片改指归档目录；中文说明链接指向上游中文 README，许可证链接修正为 GitHub 文件地址。原说明、作者归属和许可文字保留。

## 替换与新增清单

双语 README 新增与现有灰紫色徽章、居中标题、表格和折叠区域一致的实景展示。图片来自本地生产预览的真实页面，不使用演示内容或合成界面；现有头像、月夜封面和品牌标识保持原样。对外使用 Wendell / YenChiu，没有新增中文真实姓名。

| 新文件（均在 `docs/assets/showcase/`） | 实景 | 视口 | 大小 |
| --- | --- | --- | --- |
| `home-desktop.webp` | 首页 | 1440 × 1000 | 37,868 B |
| `search-desktop.webp` | 搜索 Vesper，结果与正文预览 | 1440 × 1000 | 55,024 B |
| `archives-desktop.webp` | 时光机、文章日历与统计 | 1440 × 1000 | 42,570 B |
| `home-mobile.webp` | 首页 | 390 × 844 | 19,636 B |
| `search-mobile.webp` | 搜索 Vesper，窄屏结果列表 | 390 × 844 | 8,812 B |
| `archives-mobile.webp` | 时光机、写作年份概览 | 390 × 844 | 15,566 B |

六张共 179,476 B，约 175 KiB。WebP 质量 82，1× 像素比；禁用系统动效并跳过已有开场动画以稳定捕获。视口、资源大小及浏览器检查结果见 [截图记录](./assets/showcase/capture-report.json)。

资源检查中同时修复：

- `public/links-avatars.json` 的七条头像 URL 从 `/public/avatars/…` 改为 `/avatars/…`，并修正 `scripts/discover-link-avatars.mjs`，避免再次生成错误路径。
- `scripts/postbuild-report.mjs` 原先删除 TTF/WOFF 后留下 CSS 悬空引用；现在先清理已有 WOFF2 的字体回退引用，再删除对应旧格式，保留没有 WOFF2 替代的字体。

## 删除清单

仅删除 GitHub 图标包的 macOS 解压元数据，共 5 个文件、1,360 B；正常 GitHub 图标文件保留：

- `public/assets/img/external_links/github-mark/__MACOSX/._github-mark`
- `public/assets/img/external_links/github-mark/__MACOSX/github-mark/._github-mark-white.png`
- `public/assets/img/external_links/github-mark/__MACOSX/github-mark/._github-mark-white.svg`
- `public/assets/img/external_links/github-mark/__MACOSX/github-mark/._github-mark.png`
- `public/assets/img/external_links/github-mark/__MACOSX/github-mark/._github-mark.svg`

另移除 `src/site.config.ts` 中未启用的上游 Telegram 示例账号注释，`head` 仍为空，不改变运行行为。

## 保留清单与品牌残留分类

| 保留项目 | 理由 |
| --- | --- |
| `LICENSE`、Pure 包 README / 作者元数据、源码归属注释、上游 README、行为准则 | 上游许可、作者和项目来源说明，不作为当前品牌宣传 |
| 页脚、版权页、使用条款、主题命名文章中的 Iris / Pure | 必要归属与来源说明 |
| `src/data/changelog.json`、`site-generations.json`、迁移历史与旧 QA 记录 | 历史当时使用 Iris；不改写历史 |
| `migration/upstream-examples/` | 已归档，不参与当前内容生成 |
| 友链、友链动态中的 LemonAdorable / Iris | 真实网络邻居及其文章内容，不是本站品牌 |
| 与主题无关的文章中 Iris 角色名 | 语义不同，不替换 |
| `src/assets/avatar.png`、`public/favicon/wendell-*`、`public/images/` 当前头像及封面 | 现有运行时品牌资源，原样保留 |
| `public/favicon/moon-stars-*` 及 `NOTICE.md` | 历史图标和明确第三方署名；保留兼容路径 |
| `src/assets/projects/1.avif` | `ProjectWidget.astro` 仍引用，不能按无用图删除 |
| 旧站 `public/assets/` 中图标、文章图片、README 预览等 | 内容、历史公开路径或第三方素材；没有充分证据可安全移除 |
| 工具、社交图标及其多种格式 | 可能由动态 glob、配置或组件使用，不按单一文本引用删除 |
| `public/verify/images/` JPG / WebP | 验证页面运行时动态生成图片路径；格式变体不算字节重复 |

哈希相同的四组运行时图片保留：`bailu_2.jpg` / `bailu_4.jpg`、`bailu_2.webp` / `bailu_4.webp`、`haiou_1.jpg` / `haiou_4.jpg`、`haiou_1.webp` / `haiou_4.webp`，均位于 `public/verify/images/`。这些文件名属于验证页的图片集合；本次不改其分配算法或公开 URL。

## 验收与复现

```sh
npm run build
npm test
node scripts/audit-brand-assets.mjs --write
node scripts/check-built-assets.mjs
node --test scripts/postbuild-fonts.test.mjs
npm run preview -- --host 127.0.0.1 --port 4321
# 另一个终端：指向已安装的 Playwright，不修改项目依赖
PLAYWRIGHT_PACKAGE=/path/to/playwright/package.json node scripts/capture-showcase.mjs
```

`npm run build` 包含主题配置检查、`astro check`、静态构建及构建后资源处理。截图检查桌面和移动端首页、全文搜索及归档页，验证搜索返回真实内容、搜索弹窗可关闭、无横向溢出、无可见破图、无浏览器脚本错误。字体回退清理另有回归测试，覆盖 WOFF2 保留、旧格式删除、单独 WOFF 保留及重复运行。

本次不直接合并 main；通过独立 PR 审阅。

`npm test` 全量测试 78 项通过、0 失败。归档的 10 张图片已与基线 Git blob 逐字节比对，内容一致；赞助配置同样保留原始内容。双语 README 使用 GFM 渲染后检查桌面及 390px 窄屏，本地展示图均正常加载。

最终生产构建生成 159 个页面；类型检查 0 错误、0 警告、8 条既有提示。构建期间第三方嵌入抓取 `https://yenchiu.com/links/` 曾输出网络失败提示，但构建完成并返回 0；另有既有大体积 JS chunk 提示。站内本地资源检查结果见 [构建资源检查](./built-assets-check.json)，缺失项为 0。浏览器验收使用桌面 Chrome 的移动视口模拟，未覆盖实体手机或全部外部服务。
