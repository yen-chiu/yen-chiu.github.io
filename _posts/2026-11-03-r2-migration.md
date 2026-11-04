---
title: 把 72MB 视频搬进 Cloudflare R2，顺手吊销了一张泄露的证书
date: 2026-11-03 10:20:00 +0800
description: 站点瘦身之后还剩一个 72MB 的视频卡在仓库里。用 Cloudflare API 建 R2 桶、绑自定义域名、上传、改引用，再用真实浏览器验证可拖动播放；顺便把历史里泄露过的 Origin 证书吊销掉。
categories: [技术, 运维]
tags: [Cloudflare, R2, 部署, 安全]
image: /assets/img/posts/r2-migration/cover.png
---

上一轮「站点瘦身」把仓库从 390MB 压到了 179MB，图片从 167MB 砍到 3.5MB。
但还剩一个 72MB 的视频——GitHub 单文件 100MB 的限制就在头顶上，而且它躺在 git 历史里永远无法通过「删文件」瘦掉。

这篇文章记录把它搬去 Cloudflare R2 的完整过程，以及路上踩的三个坑。

## 一、先搞清楚「账号 ID」和「访问密钥」不是一回事

R2 的 S3 兼容端点是这个形式：

```
https://<ACCOUNT_ID>.r2.cloudflarestorage.com
```

看到 `82dcaec385f4599232711f5e7e48d3d8` 这种 32 位十六进制，很容易误以为是 Access Key ID。
实际上它是**账户 ID**，S3 访问还需要配对的 Secret Access Key。
而且就算有 S3 密钥，**公开访问（r2.dev 子域 / 自定义域）也不在 S3 API 里**，必须走 Cloudflare API 或面板。

所以正确的做法是要一个 **Cloudflare API Token**（不是 S3 密钥），权限给：

| 类型 | 权限 | 用途 |
| --- | --- | --- |
| Account | Workers R2 Storage → Edit | 建桶、绑域名 |
| Account | Workers Scripts → Edit | 部署登录代理 Worker |
| Zone | SSL and Certificates → Edit | 吊销 Origin 证书 |
| Zone | DNS → Edit | 自动添加 CNAME |

一个 token 就把四件事全覆盖了。

## 二、建桶 + 开公开访问 + 绑自定义域

```bash
# 建桶
POST /accounts/{acc}/r2/buckets            {"name": "yenchiu-media"}

# 开启 r2.dev 公开子域（兜底用）
PUT  /accounts/{acc}/r2/buckets/yenchiu-media/domains/managed   {"enabled": true}
# → https://pub-268edce3f97543bcbc959e0001310230.r2.dev

# 绑自定义域（会自动在你的 DNS 里加 CNAME，不用手动配）
POST /accounts/{acc}/r2/buckets/yenchiu-media/domains/custom
     {"domain": "media.yenchiu.com", "zoneId": "...", "enabled": true}
```

自定义域这条特别值：**它会自己签证书、自己加 CNAME**，比 `r2.dev` 的子域名体面得多，
而且没有速率限制（`r2.dev` 官方只建议测试用）。

## 三、上传：npx 不在 PATH 怎么办

```bash
npx wrangler r2 object put yenchiu-media/videos/xxx.mp4 \
  --file assets/media/xxx.mp4 --content-type video/mp4 --remote
```

在我这个环境里 `npx` 不在 PATH 上（只有独立的 node 和 pnpm），
于是绕了一下：用 pnpm 把 wrangler 装进临时目录，直接跑它的入口文件。

```bash
node .work/wrangler-tools/node_modules/wrangler/bin/wrangler.js r2 object put ...
# 前提：export CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID
```

有 API Token 就不需要 `wrangler login`（浏览器 OAuth），适合自动化。

## 四、改引用：抽一个 `media_base`

媒体地址散落在文章里是最难维护的写法。所以我加了一项配置：

```yaml
# _config.yml
media_base: https://media.yenchiu.com
```

文章里统一写成：

```markdown
<source src="{{ site.media_base }}/videos/xxx.mp4" type="video/mp4">
```

以后换 CDN 只改一行，不用再翻十篇文章。本次一共改了 3 篇 7 处引用，
然后把 `assets/media/xxx.mp4` 从仓库里删掉。

## 五、验证：不能只看 curl 200

`HEAD` 请求只能证明文件在，不能证明「播放器能拖进度」。
所以我用真实浏览器加载线上文章，读 `<video>` 的状态：

```json
{
  "src": "https://media.yenchiu.com/videos/marxism-micro-lesson.mp4",
  "duration": 199,
  "readyState": 4,
  "seeked": true,
  "currentTime": 30,
  "videoWidth": 1920
}
```

`readyState: 4` 表示数据足够播放；把 `currentTime` 设成 30 秒后确实跳过去了（`seeked: true`），
说明服务端支持 `Range` 请求——**这一步很关键**，不支持 Range 的视频在网页里没法拖动。
R2 默认支持，但验证过才算数。

## 六、顺手吊销一张泄露的证书

这也是本轮的安全收尾。之前有一次配置把 Cloudflare Origin CA 的私钥提交进了仓库，
虽然已经从 git 历史里清掉了，但**证书本身还有效到 2041 年**——只在本地删密钥等于没删。

用 API 吊销：

```bash
# 注意：列表必须带 zone_id，否则返回 400 且响应体为空（很容易误判成权限不足）
GET    /certificates?zone_id=...
# → id: 4018608…877179, hostnames: [*.yenchiu.com, yenchiu.com], expires: 2041-04-05

# 删除 = 吊销；注意不要带 zone_id
DELETE /certificates/4018608…877179
# → {"success":true,"revoked_at":"2026-11-03T02:49:41Z"}
```

吊销后复测：首页、写作台、R2 视频全部 200，站点没有受到任何影响。

> 这条也有个教训：`/certificates` 这个接口，**带 `zone_id` 才返回列表，带 `zone_id` 去 DELETE 反而报错**。
> 一个是「查询要限定范围」，一个是「删除按 ID 唯一确定」。文档里不写，只能靠试。

## 七、结果

| 项 | 之前 | 之后 |
| --- | --- | --- |
| 仓库内视频 | 72.1 MB | 0（走 CDN） |
| 站点引用 | 硬编码 `/assets/media/...` | `{{ site.media_base }}/videos/...` |
| 泄露证书 | 有效期到 2041 | 已吊销 |
| 播放验证 | — | readyState 4 / 可拖动 / 1920×1080 |

CI 和 Deploy 均通过。这次迁移之后，仓库里再没有「删不掉的大文件」了——
以后音频、大图、录屏都往 R2 丢，文章里只写路径。

**最后一个提醒**：`git rm` 只是让新提交不含这个文件，`.git` 里仍然躺着那 72MB 的历史副本。
真要瘦身得重写历史（`git filter-repo`），那会改变所有 commit hash，
属于「必须单独确认、并且先备份」的操作。这次没做，记录在此备查。
