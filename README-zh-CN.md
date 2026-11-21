# Vesper（暮星）｜Wendell 的站点

[English](./README.md) | [简体中文](./README-zh-CN.md)

**Vesper（暮星）** 是 [Wendell 的个人站点](https://yenchiu.com) 所使用的 Astro 主题，承载博客、文档与期刊《余白》。

> 这是个人网站仓库，并非 Astro Theme Iris 的官方模板仓库。主题基于 Iris 演化；上游历史说明保存在 [migration/upstream-README.md](./migration/upstream-README.md)。

## 主题信息

- **名称**：Vesper（暮星）
- **包名**：`astro-theme-vesper`
- **主题版本**：v0.1.0（`theme-v0.1.0`）
- **技术基础**：Astro，衍生自 [Astro Theme Iris](https://github.com/LemonAdorable/astro-theme-iris)
- **设计方向**：以刊物式排版统一博客、文档和期刊封面

## 网站与仓库

- **网站**：[yenchiu.com](https://yenchiu.com)
- **源代码**：[yen-chiu/yen-chiu.github.io](https://github.com/yen-chiu/yen-chiu.github.io)
- **部署**：推送至 `main` 后由 GitHub Actions 构建并发布到 GitHub Pages
- **网站沿革**：Jekyll · huxpro（2023-03—2023-10）→ Jekyll · Chirpy（2023-10—2026-11）→ Astro · Vesper（2026-11 起），详见[更新日志](https://yenchiu.com/changelog/)

## 本地开发

使用 Node.js 24：

```bash
npm ci
npm run dev -- --host 127.0.0.1
```

生产构建：

```bash
npm run build
```

项目的 `.npmrc` 设置了 `legacy-peer-deps`。如果 Windows 环境下 esbuild 遇到临时目录权限问题，可将 `TEMP`、`TMP` 指向工作区内可写目录后重新构建。

## 内容结构

| 路径 | 用途 |
| --- | --- |
| `src/content/blog` | 博客文章与分类内容 |
| `src/content/docs` | 文档与主题说明 |
| `src/pages/journal.astro` | 期刊《余白》封面 |
| `src/pages/persona.astro` | 念真页面 |
| `migration/content-manifest.json` | 文章迁移记录与旧地址 |
| `migration/upstream-README.md` | Iris 上游 README 存档 |
| `migration/upstream-examples` | 不参与内容生成的上游示例 |
| `scripts/` | 迁移、构建辅助与校验脚本 |

## 来源与许可

Vesper 由 Astro Theme Iris 演化而来。上游代码的许可和署名应予保留，参见 [LICENSE](./LICENSE) 和 [上游 README 存档](./migration/upstream-README.md)。

- **主题及相关代码**：Apache-2.0，保留上游作者归属及第三方许可。
- **原创博客文章与展示文档**：除另有说明外，采用 [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)。
- **《余白》原创文章**：以各期声明为准，当前为 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)。
- **摄影、插画及第三方素材**：以各自授权声明为准，不自动纳入上述许可。

详情参见[版权与使用说明](https://yenchiu.com/terms/copyright/)。

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=yen-chiu/yen-chiu.github.io&type=Date)](https://star-history.com/#yen-chiu/yen-chiu.github.io&Date)
