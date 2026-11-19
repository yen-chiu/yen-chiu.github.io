# Wendell Astro 迁移工作区

基于 Astro Theme Iris 的公开临时迁移库。原站 https://yenchiu.com 仍是线上版本。

## 本地运行

Node.js 24：`npm ci`，然后 `npm run dev -- --host 127.0.0.1`。
`.npmrc` 固定 legacy-peer-deps；Windows 如默认临时目录触发 esbuild 权限错误，请将 TEMP、TMP 指向工作区内专用可写目录后运行 `npm run build`。

## 内容

- `src/content/blog`：17 篇文章，按原分类归档。
- `src/pages/persona.astro`、`src/migration-persona.html`：念真页面。
- `migration/content-manifest.json`：来源哈希、原始元数据和目标地址。
- `migration/upstream-examples`：保留但不参与内容生成的模板示例。
- `scripts/verify-migration.py`：需要同级原博客目录，检查来源哈希与念真资源。
- `scripts/migrate-jekyll.py`：批量转换，需要 Python PyYAML；重新导入会覆盖对应迁移文章，手改前先备份。

GitHub Pages 自动部署已启用，预览地址为 https://yenchiu.com/yen-chiu-astro/ 。友链自动写入 workflow 仍停用；不切换根站域名，不开启评论，暂禁止搜索引擎抓取。聊天和项目入口暂链接原站。

完整工作记录与已知问题位于 WendellManual 的“建站笔记 → Astro 迁移记录”。搜索面板、旧链接重定向、移动端和完整聊天迁移仍待处理，不是生产就绪版本。

Iris / Pure 原主题使用 Apache-2.0；保留 LICENSE 与原主题归属。原模板 README 保存在 migration/upstream-README.md。

## 公开预览验证

CI 使用 Node 24、npm ci、npm run build 与 node scripts/pages-paths.mjs。路径适配回归检查：node scripts/pages-paths.test.mjs。独立搜索页位于 /search，浮层加载失败时自动回退。

## 版权与内容授权

- 主题及相关代码：Apache-2.0，保留 LICENSE、原作者归属及第三方许可。
- 除另有说明的原创博客文章与展示文档：CC BY-NC-SA 4.0，https://creativecommons.org/licenses/by-nc-sa/4.0/ 。署名 Wendell，附原文与许可链接，注明修改。
- 《余白》原创文章：以各期声明为准，当前为 CC BY 4.0，https://creativecommons.org/licenses/by/4.0/ 。
- 独立摄影、插画等素材以各自声明为准；第三方素材不自动纳入本站授权。
- 已有授权不会被本声明追溯撤回；商业授权及勘误联系 yenchiu.he@gmail.com。
- 网站详细说明： https://yenchiu.com/yen-chiu-astro/terms/copyright/ 。
