# 大文件托管（Cloudflare R2）

> 状态：**已完成**（2026-11-03）。72MB 的视频已经搬到 R2，仓库里不再存大文件。

## 当前配置

| 项 | 值 |
| --- | --- |
| 桶名 | `yenchiu-media`（2026-11-04 从 `wendell-media` 迁移） |
| 自定义域 | `https://media.yenchiu.com`（已绑，CNAME 自动添加） |
| 备用公开域 | `https://pub-268edce3f97543bcbc959e0001310230.r2.dev`（有速率限制，只做兜底） |
| 对象键 | `videos/marxism-micro-lesson.mp4` |
| 站点引用 | `_config.yml` 的 `media_base`，文章里写 `{{ site.media_base }}/videos/...` |

验证：

```bash
curl -I https://media.yenchiu.com/videos/marxism-micro-lesson.mp4
# 200 · video/mp4 · 72.1MB · accept-ranges: bytes
```

## 以后再传大文件

```bash
# 方式一：wrangler（有 Node 环境时）
npx wrangler r2 object put yenchiu-media/videos/<文件名> \
  --file <本地路径> --content-type video/mp4 --remote

# 方式二：控制台拖拽（>300MB 时更省事）
# Cloudflare → R2 → yenchiu-media → Upload
```

上传完在文章里写 `{{ site.media_base }}/videos/<文件名>` 即可，不用改任何配置。

## 注意

- 删掉仓库里的文件**不会**减小 `.git` 体积（历史里还有一份）。真要瘦身需要重写历史
  （`git filter-repo`），那会改变所有 commit hash，属于需要单独确认的操作。
- `r2.dev` 域名的速率限制只适合测试，正式引用请用 `media.yenchiu.com`。
- R2 免费额度：10GB 存储 + 出网流量免费；超过后按量计费。
