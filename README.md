<div align="center">

<img src="assets/img/readme-banner.svg" alt="Wendell's Blog — 读书，买花，长大。" width="100%" />

<p>
  <a href="https://yenchiu.com"><img src="https://img.shields.io/badge/%E5%8D%9A%E5%AE%A2-yenchiu.com-6366f1?style=flat-square&logo=googlechrome&logoColor=white" alt="Blog" /></a>
  <a href="https://yenchiu.com/feed.xml"><img src="https://img.shields.io/badge/RSS-%E8%AE%A2%E9%98%85-orange?style=flat-square&logo=rss&logoColor=white" alt="RSS" /></a>
  <a href="https://yenchiu.com/admin/"><img src="https://img.shields.io/badge/%E5%86%99%E4%BD%9C%E5%8F%B0-%E5%9C%A8%E7%BA%BF%E7%BC%96%E8%BE%91-a855f7?style=flat-square&logo=markdown&logoColor=white" alt="写作台" /></a>
  <img src="https://img.shields.io/badge/Jekyll-4.3-CC0000?style=flat-square&logo=jekyll&logoColor=white" alt="Jekyll" />
  <img src="https://img.shields.io/badge/Theme-Chirpy-2bbc8a?style=flat-square" alt="Chirpy" />
  <img src="https://img.shields.io/badge/License-MIT-blue?style=flat-square" alt="MIT" />
</p>

</div>

## 关于本站

这里是我的个人博客，记录技术笔记、读书与生活。

- **内容**：Markdown 写作，支持目录、代码高亮、数学公式、图片灯箱与脚注
- **体验**：深浅色自动切换、阅读进度条、PWA 离线缓存、站内搜索、Giscus 评论
- **写作**：既可以在本地写 Markdown 提交，也可以直接用 [/admin/](https://yenchiu.com/admin/) 在线写作台上传图片并发布（手机、平板、电脑通用）
- **部署**：推送到 `master` 由 GitHub Actions 自动构建并发布到 GitHub Pages

## 技术栈

| 层次 | 选型 |
| --- | --- |
| 静态站点 | Jekyll 4.3 + Liquid |
| 主题 | [Chirpy](https://github.com/cotes2020/jekyll-theme-chirpy) 7.x（本地 fork，可自由改造） |
| 样式 | SCSS + Bootstrap 5，自定义设计层在 `_sass/custom/` |
| 交互 | 原生 ES Module + Rollup 打包（`_javascript/`） |
| 评论 | Giscus（GitHub Discussions） |
| 部署 | GitHub Actions → GitHub Pages |

## 目录结构

```text
.
├── _posts/             # 文章（Markdown + front matter）
├── _drafts/            # 未发布草稿
├── _tabs/              # 侧边栏页面：关于 / 归档 / 分类 / 标签
├── _includes/          # 可复用片段（head、sidebar、页脚、写作台增强等）
├── _layouts/           # 布局模板
├── _sass/
│   ├── layout/         # 主题自带布局样式
│   └── custom/         # 本站自定义设计层（令牌 / 动效 / 侧边栏 / 首页 / 文章 / 通用）
├── _javascript/        # 前端源码，Rollup 打包到 assets/js/dist
├── _app/               # PWA 构建产物（app.min.js、sw.min.js）
├── assets/
│   ├── css/            # 样式入口（含 admin.scss）
│   ├── img/posts/      # 文章配图（按文章归档）
│   ├── img/uploads/    # 写作台上传的图片（按年月归档）
│   ├── js/admin/       # 写作台前端逻辑
│   └── media/          # 音视频等大文件
├── admin.html          # /admin/ 在线写作台
├── _config.yml         # 全站配置
└── .github/workflows/  # CI / 部署工作流
```

## 本地开发

需要 Ruby 3.3 与 Node.js 18+。

```bash
# 1. 安装依赖
bundle install
npm install

# 2. 构建前端资源（改了 _javascript/ 才需要）
npm run build

# 3. 本地预览
bundle exec jekyll serve --livereload
# 打开 http://127.0.0.1:4000
```

只改样式或文章时，第 2 步可以跳过：`_sass/` 由 Jekyll 直接编译。

## 写作与发布

1. **本地写**：在 `_posts/` 新建 `YYYY-MM-DD-标题.md`，写好 front matter 后 `git push`。
2. **网页写**：GitHub 网页端直接编辑 Markdown 文件。
3. **在线写作台**：打开 `/admin/`，两种登录方式：
   - **GitHub 登录**（配置了 `admin_auth_endpoint` 后可用）：点一下 → 在 GitHub 输入 8 位验证码即可，令牌 8 小时有效
   - **访问令牌**：填一个只授予本仓库 `Contents: Read and write` 权限的 Fine-grained Token

   登录后可以：
   - 浏览 / 搜索 / 新建 / 编辑文章
   - 拖拽、粘贴或从相册选择图片，自动压缩到 1600px 后上传到 `assets/img/uploads/YYYY/MM/`
   - 实时预览，可选提交到 `drafts` 草稿分支，不影响线上
   - 断网或误关页面后从本地草稿恢复

> 令牌/登录态只保存在浏览器本地，不会经过任何第三方服务器。写作台页面已加入 `noindex` 与 `robots` 屏蔽。
> GitHub 登录需要一个 Cloudflare Worker 做 CORS 代理，搭建步骤见 [`tools/worker/README.md`](tools/worker/README.md)。

## 部署

推送到 `master` 即触发 `.github/workflows/jekyll.yml`：安装 Ruby → `bundle exec jekyll build` → 发布到 GitHub Pages。

回滚很简单：`git revert` 对应提交，或从备份分支 / tag 重新部署。

## 分支与备份约定

| 分支 / 标签 | 用途 |
| --- | --- |
| `master` | 线上分支，推送即部署 |
| `backup/pre-auto-*` | 大改前的完整快照 |
| `pre-auto-*`（tag） | 同上，带说明的版本锚点 |
| `drafts` | 写作台提交草稿用（可选） |

## 致谢

感谢 [cotes2020](https://github.com/cotes2020)（Chirpy 主题）、[Ovilia](https://github.com/Ovilia)、[NichtsHsu](https://github.com/NichtsHsu)、[Rootjhon](https://github.com/Rootjhon) 在本站搭建过程中提供的支持与参考。

## License

遵循 MIT 许可证，详见 [LICENSE](LICENSE)。
