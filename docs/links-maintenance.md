# Vesper 友情链接维护指南

页面：<https://yenchiu.com/links/>。源数据：`public/links.json`（`friends` 数组）。

## 申请和人工审核

1. 访客使用仓库的「申请友链」Issue 模板，提供首页、回链页面、头像和描述。
2. `friend-link-checker.yml` 通过 Playwright 检查公共 HTTP(S) 页面、回链以及头像是否能跨站加载。
3. 技术检查通过后只标记 `friend-link: awaiting-review`。维护者在 Issue 评论：
   - `/approve`：重新检查并写入；
   - `/reject 原因`：拒绝并关闭；
   - `/force-approve`：跳过联网检查，仅在确认误判时使用。
4. 通过后机器人写入 `public/links.json` 的 `friends` 分组并部署。请勿对不熟悉的申请使用强制通过。

## 健康检查

`links-maintenance.yml` 每天 04:23 UTC 以及手动触发时运行。`scripts/check-friend-links.mjs` 检查所有收录链接并写入 `public/links-status.json`：

- `healthy`：HTTP 2xx 或 3xx；
- `suspect`：连续失败 1–2 次，待复核；
- `down`：连续失败至少 3 次。

检查状态不触发自动删除。部分网站可能限制 HEAD 请求；脚本对 403/405/501 回退 GET。异常仍需人工复核。

## 邻站 RSS / Atom

仅在 `friends` 分组聚合。为一个友链添加可选属性：

```json
{
  "name": "示例站点",
  "intro": "简介",
  "link": "https://example.org/",
  "avatar": "https://example.org/avatar.png",
  "rss": "https://example.org/feed.xml"
}
```

RSS 地址可以由维护者审核后显式填写（优先使用）；未填写时，`scripts/aggregate-friend-feeds.mjs` 会读取友链首页公开的 `<link rel="alternate" type="application/rss+xml">` / Atom 声明，并试探站点根路径下的常见订阅地址。**候选地址必须返回可解析的 RSS/Atom 文章才会收录**，不会将猜测链接当作订阅结果，也不会改写 `links.json`。每个站点最多采集 12 篇，汇总最多存储 120 篇；实际文章数仍由对方 RSS 提供的内容决定。无法找到有效订阅源时保持空态。网络读取失败不会影响其他站点，并对失败站点暂时保留上次成功的文章快照（标记 `stale`，不计入本轮活跃订阅源）。每日定时任务负责刷新 `public/links-feed.json`；仅提交代码不会立即填充旧快照。

`public/links-feed.json` 包含 `updatedAt`、`feeds`（本轮尝试抓取数）、`activeFeeds`（本轮成功数）、`totalFriends`、`articleCount`、`items` 与 `errors`。这些是 **RSS 抓取统计**，不能与链接健康检查的正常数混用，也不是全网文章总量。只使用本博客的友好邻居数据，不调用其他博客的 FriendCircleLite 接口。

前端 `src/components/links/FriendFeed.astro` 与 `friendFeedClient.ts` 提供随机漫游、换一篇、点击作者查看当前快照里的文章、每次显示更多 6 篇、收起和统计/更新时间。已收录文章不足 7 篇时不会出现无意义的「显示更多」按钮。

## 变更记录

`scripts/build-links-history.mjs` 在 `npm run build` 时解析完整 Git 历史，比较 `public/links.json` 的相邻版本并生成新增、修改、移除记录。GitHub Pages 构建使用 `fetch-depth: 0`。浅克隆或非 Git 环境下可能没有历史。

## 验证与回滚

使用 Node.js 24：

```bash
node --test scripts/links-feature.test.mjs
npm ci
npm run build
```

首次合并后，维护者可从 GitHub Actions 手动执行 `Maintain Vesper links` 生成第一次健康快照。若自动申请有问题，可禁用 `friend-link-checker.yml` 工作流，保留人工维护 `links.json` 的方式。
