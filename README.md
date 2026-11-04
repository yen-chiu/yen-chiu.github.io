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

<p align="center">
  <img src="assets/img/readme-preview.png" alt="博客首页预览" width="100%" />
  <br />
  <sub>首页 · 深浅色自动切换 · 响应式布局</sub>
</p>

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

## 依赖与版本管理

本站是「可部署产物」，因此依赖按**可复现**来管，而不是每次部署解析最新版本：

| 东西 | 怎么固定 | 文件 |
| --- | --- | --- |
| Ruby | 3.3.13（3.3 仍在安全维护窗口内，暂不升 4.0） | `.ruby-version` |
| Ruby gems | 提交 `Gemfile.lock`，同时含 `x64-mingw-ucrt` 与 `x86_64-linux` 两个平台；CI 用 `BUNDLE_FROZEN` 守卫 | `Gemfile` / `Gemfile.lock` |
| Node | 22（LTS），CI 读 `.nvmrc`，安装用 `npm ci` | `.nvmrc` / `package.json` 的 `engines` |
| 前端依赖 | `package-lock.json` | 同上 |
| 依赖升级 | Dependabot：bundler / npm 每周，GitHub Actions 每月；Jekyll、sass-embedded 主版本不自动升 | `.github/dependabot.yml` |
| 内置的 jekyll-archives | vendored 在 `.gems/jekyll-archives`，对应上游 **v2.2.1**；升级时整目录替换并在更新日志记一条 | `.gems/jekyll-archives` |

改完 `Gemfile` 后，本地在 Windows 上必须补 Linux 平台，否则 ubuntu 部署会报平台不匹配：

```bash
bundle install
bundle lock --add-platform x86_64-linux
```

> Dependabot 在 Linux 上更新 lock 时，可能把 `x64-mingw-ucrt` 从 `PLATFORMS` 里去掉；合并后在 Windows 本地跑一次 `bundle install` 会补回来，不影响部署。

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

## 写作约定

**链接一律用 `https://`。** CI（`.github/workflows/ci.yml`）在构建之后会跑一遍 `htmlproofer --disable-external`，任何 `http://` 链接都会被判失败，报错原文是 `is not an HTTPS link`。`--disable-external` 只表示不去访问外网，并不豁免这条规则——公众号、知乎这类默认给 `http` 的地址，粘过来要手动补 `s`。写错不会影响发布（部署是另一个工作流），但 CI 会一直红。

**配图**放 `assets/img/uploads/YYYY/MM/`（写作台上传时会自动压到 1600px 并归档），正文里用 `/assets/img/uploads/...` 绝对路径引用。要图注就写：

```html
<figure class="post-figure">
  <img src="/assets/img/uploads/2026/11/example.png" alt="说明">
  <figcaption>图注文字</figcaption>
</figure>
```

对应样式在 `_sass/custom/_post.scss`。

**本地自检**，和 CI 是同一套：

```bash
node tools/check-frontmatter.mjs   # front matter
bash tools/test.sh                 # 构建 + 链接检查
```

Windows 上 `htmlproofer` 常常因为 ffi 找不到 `libcurl` 直接起不来，仓库里备了一个只替掉网络层的桩（`--disable-external` 下用不到真实请求）：

```powershell
$env:RUBYLIB="$PWD\tools\htmlproofer-stub"
bundle exec jekyll build --quiet
bundle exec htmlproofer "_site" --disable-external --ignore-urls "/^http:\/\/127.0.0.1/,/^http:\/\/0.0.0.0/,/^http:\/\/localhost/"
```

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
