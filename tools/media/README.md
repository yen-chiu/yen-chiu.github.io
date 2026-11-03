# 大文件托管（Cloudflare R2）

站点里目前只有一个大文件：`assets/media/marxism-micro-lesson.mp4`（72MB）。
建议搬到 Cloudflare R2：**10GB 存储免费、出网流量免费**（[定价](https://developers.cloudflare.com/r2/pricing/)），
以后音频、大图也可以放这里，不再让仓库变胖。

## 一、建 bucket + 开公开访问

1. Cloudflare 控制台 → **R2** → **Create bucket**，名字填 `wendell-media`
2. 进入 bucket → **Settings**：
   - **Public access** → 开启（会得到一个 `https://pub-<hash>.r2.dev` 域名，最快）
   - 想更专业：**Custom domains** → **Connect domain** → 填 `media.yenchiu.com`
     （域名已在 Cloudflare，会自动加 CNAME 并签证书，约 1 分钟）
3. 记下最终的公开地址，例如 `https://media.yenchiu.com` 或 `https://pub-xxxx.r2.dev`

## 二、上传文件

```bash
# 一次性登录（浏览器授权）
npx wrangler login

# 上传（在仓库根目录执行）
npx wrangler r2 object put wendell-media/videos/marxism-micro-lesson.mp4 \
  --file assets/media/marxism-micro-lesson.mp4 \
  --content-type video/mp4 \
  --remote
```

> 文件超过 300MB 时改用 `--file` 之外的分片上传，或直接在控制台拖拽。

验证：

```bash
curl -I https://media.yenchiu.com/videos/marxism-micro-lesson.mp4
# 期望 200，content-type: video/mp4，accept-ranges: bytes
```

## 三、改文章引用（我来做）

上传完成后把公开地址发我，我会：

1. 在 `_config.yml` 加一项 `media_base: https://media.yenchiu.com`（方便以后换 CDN）
2. 把 3 篇文章里的 7 处引用改成 `{{ site.media_base }}/videos/marxism-micro-lesson.mp4`
3. 删掉仓库里的 `assets/media/marxism-micro-lesson.mp4`
4. 本地构建 + 线上验证（视频能播放、能拖动进度）

## 四、注意

- 删掉仓库里的文件**不会**减小 `.git` 体积（历史里还有一份）。真要瘦身需要重写历史，
  那是另一项需要你单独确认的操作。
- R2 的 `r2.dev` 域名有速率限制，长期用建议绑自定义域（`media.yenchiu.com`）。
- 视频以后如果要用播放器组件，可以直接引用同一个地址，不需要再改。
