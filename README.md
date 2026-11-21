# Wendell 的站点

https://yenchiu.com — 个人博客、文档与期刊《余白》，基于自制主题 **Vesper（暮星）** 的 Astro 站点。

## 主题

- 名称：Vesper（暮星），包名 `astro-theme-vesper`
- 派生自：Astro Theme Iris（上游 README 存档于 `migration/upstream-README.md`），遵循 Apache-2.0，保留上游 LICENSE 与署名
- 版本：v0.1.0（`theme-v0.1.0`）
- 版面：博客按刊物体例组织，首页、文档页、期刊封面共用一套排版语言

## 站点

- 根域：https://yenchiu.com
- 仓库：https://github.com/yen-chiu/yen-chiu.github.io（原名 `yen-chiu-astro`，已改名，旧链接由 GitHub 重定向）
- 部署：`push` 到 `main` 后由 GitHub Actions 构建并发布 GitHub Pages
- 沿革：blog-v1（Jekyll · huxpro，2023-03—2023-10）→ yenchiu.com（Jekyll · Chirpy，2023-10—2026-11）→ 本站（Astro · Vesper，2026-11 起），详见 https://yenchiu.com/changelog/

## 本地运行

Node.js 24：`npm ci`，然后 `npm run dev -- --host 127.0.0.1`。
`.npmrc` 固定 legacy-peer-deps；Windows 如默认临时目录触发 esbuild 权限错误，请将 TEMP、TMP 指向工作区内专用可写目录后运行 `npm run build`。

## 内容结构

- `src/content/blog`：博客文章，按分类归档
- `src/content/docs`：文档（含《暮星》的来处、版本号约定等）
- `src/pages/journal.astro`：期刊《余白》封面页
- `src/pages/persona.astro`、`src/migration-persona.html`：念真页面
- `migration/content-manifest.json`：迁移来源哈希、原始元数据和目标地址
- `migration/upstream-examples`：保留但不参与内容生成的模板示例
- `scripts/`：迁移与校验脚本（需要同级原博客目录时才有意义）

## 许可

- 主题及相关代码：Apache-2.0，保留 LICENSE、原作者归属及第三方许可。
- 除另有说明的原创博客文章与展示文档：CC BY-NC-SA 4.0，https://creativecommons.org/licenses/by-nc-sa/4.0/ 。署名 Wendell，附原文与许可链接，注明修改。
- 《余白》原创文章：以各期声明为准，当前为 CC BY 4.0，https://creativecommons.org/licenses/by/4.0/ 。
- 独立摄影、插画等素材以各自声明为准；第三方素材不自动纳入本站授权。
- 已有授权不会被本声明追溯撤回；商业授权及勘误联系 yenchiu.he@gmail.com。
- 完整说明： https://yenchiu.com/terms/copyright/

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=yen-chiu/yen-chiu.github.io&type=Date)](https://star-history.com/#yen-chiu/yen-chiu.github.io&Date)
