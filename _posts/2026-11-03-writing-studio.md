---
title: 给自己的博客装一个「写作台」
date: 2026-11-03 07:10:00 +0800
categories: [Blogging, Tutorial]
tags: [Jekyll, GitHub, 写作台, 自动化]
description: 用纯前端加 GitHub API 做一个手机和电脑都能用的在线编辑器：改文章、传图片、提交到草稿分支，不用开电脑，也不用装环境。
image:
  path: /assets/img/posts/writing-studio/cover.png
  alt: 写作台
---

写博客最麻烦的从来不是写，而是「想改一个字」的那一下。

以前改错别字要走完整套流程：开电脑 → 打开仓库 → 找文件 → 改 → 提交 → 等构建。手机上更难受，GitHub 的网页编辑器在小屏幕上一点也不好用，传图片更是没法弄。于是这次改造，我干脆给博客装了一个自己的「写作台」——打开 `/admin/`，登录，选文章，改，保存。

## 三条路，先排除两条

想在线写 Jekyll 博客，大概有三类方案：

1. **直接用 GitHub 网页编辑**：零成本，但手机体验差，图片要先传到别处再贴链接。
2. **现成的 CMS**（Decap、Pages CMS 之类）：功能齐全，但要装 GitHub App、写配置文件，而且编辑界面是它定义的，跟我这个小站的气质不太搭。
3. **自己做一个**：工作量最大，但能完全按自己的习惯来。

最后选了第三条。原因很简单：我并不需要一个「内容管理系统」，我只需要一个「能改 Markdown 和传图片的输入框」。

## 核心只有一个接口

写作台没有后端。所有操作都是浏览器直接调 GitHub 的 REST API，用 Contents API 读写文件：

```js
// 读：拿到 base64 内容和当前 sha
GET /repos/{owner}/{repo}/contents/_posts/2026-11-03-foo.md?ref=master

// 写：带上 sha 提交，sha 不匹配就是 409，说明别人改过了
PUT /repos/{owner}/{repo}/contents/_posts/2026-11-03-foo.md
{
  "message": "post: 更新 xx（写作台）",
  "content": "<base64>",
  "sha": "<上一次的 sha>",
  "branch": "master"
}
```

列表用 Git Trees API 一次拿全：

```js
GET /repos/{owner}/{repo}/git/trees/master?recursive=1
```

比逐个目录请求快得多，也省掉了翻页逻辑。

`sha` 这个字段值得单独说一句：它是天然的乐观锁。两个标签页同时改同一篇，后提交的那个会拿到 409，我只要提示「远端已被修改，请重载」就行，不会悄悄覆盖。

## 图片是重点

在手机上写东西，图片永远是最大的痛点。写作台的处理是：

1. 拖拽、粘贴、或者从相册选图；
2. 浏览器里用 `canvas` 等比缩到最长边 1600px，重新编码（PNG 保透明、其余转 JPEG q≈0.86）；
3. 提交到 `assets/img/uploads/YYYY/MM/`；
4. 在光标处插入 `![](/assets/img/uploads/...)`。

压缩这一步很关键。一张手机直出的照片动辄 5–8MB，直接传上去既慢又拖累页面；压到 1600px 之后通常只有 200–400KB。

提交图片和提交文章的接口是同一个，只是 `content` 换成了图片的 base64。

## 两个「不那么显眼但很重要」的细节

**草稿分支。** 写作台默认可以勾选「提交到 drafts 分支」，这时改动不会触发线上构建。想发出来再合并到 `master`。第一次使用时如果 `drafts` 不存在，会自动从默认分支的 HEAD 创建。

**本地草稿。** 编辑过程中每敲几下就把内容存进 `localStorage`。手滑关掉标签页、地铁里断网，回来还能一键恢复。这个功能我原本觉得可有可无，直到真的手滑关掉过一次。

## 安全上做了什么

把写权限放进浏览器，听起来吓人，实际边界可以划得很清楚：

- 用 **Fine-grained Token**，只授予这一个仓库的 `Contents: Read and write`，其它仓库一概碰不到；
- 令牌只存在浏览器本地（`localStorage` 或 `sessionStorage`），不经过任何服务器；
- `/admin/` 加了 `noindex`，`robots.txt` 里也屏蔽了；
- 预览用白名单净化，避免手滑粘贴进来的 HTML 执行脚本。

后来还是觉得每次粘贴令牌太麻烦，于是又加了 GitHub 登录。那部分涉及 CORS 和 GitHub App，坑比较多，单独写在[下一篇](/posts/device-login/)里。

## 用起来是什么感觉

手机上把 `/admin/` 添加到主屏幕，打开就像个 App：选文章、改两行、传张图、点保存。剩下的构建和部署交给 GitHub Actions，一两分钟后线上就更新了。

改造前后的差别，大概就是「想写点什么」和「算了下次吧」之间的差别。
