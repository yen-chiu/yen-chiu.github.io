# Gallery · 光影档案

[公开摄影集](https://yenchiu.com/gallery/) · [Gallery Studio 使用手册](gallery-studio/README.md)

## 架构

摄影集使用 Astro 静态生成，Git 管理作品索引，Cloudflare R2 存储图片对象，不使用在线关系数据库。网站访客不需要访问本地管理服务。

| 位置 | 职责 |
| --- | --- |
| `src/data/gallery-photos.json` | 已发布作品元数据与公开衍生图地址 |
| `src/data/photos.ts` | 索引字段及公开 URL 校验 |
| `src/lib/gallery.ts` | 排序、相册分组及相册 ID |
| `src/lib/gallery-camera.mjs` | 作品页与 Studio 共用摄影参数解析 |
| `src/pages/gallery/index.astro` | 总览、相册筛选及预览 |
| `src/pages/gallery/album/[id].astro` | 相册 |
| `src/pages/gallery/photo/[id].astro` | 作品详情、高清链接及拍摄参数 |

每个作品的 ID 来自导入文件 SHA-256 的前 24 个十六进制字符；相册 ID 由名称生成，重命名相册会改变其地址。相同导入字节再次发布会更新同一记录，修改源文件字节可能生成新 ID。

## 存储与发布

| 用途 | 存储桶 |
| --- | --- |
| 公开 WebP 衍生图 | `yenchiu-gallery`，CDN `https://gallery-cdn.yenchiu.com` |
| 可选私有导入文件备份 | `yenchiu-gallery-originals` |

公开对象路径为 `photos/<id>/v1/<size>.webp`，最长边上限 480、960、1920、3840px，质量 85，不放大。索引记录实际尺寸。Sharp 自动旋转并默认去除衍生图元数据，公开索引仅包含选定的文字拍摄信息，不写入私有备份路径或 GPS。备份的是导入文件，NEF 等 RAW 需要在外部先导出，不能把备份 JPEG 当作 RAW 备份。

用 Studio 导入、填资料、预览并确认上传。R2 成功后还要审查并提交本地照片索引，由 PR 合并部署更新公开页面。不要直接删除 CDN 对象：先确认所有索引、旧版本链接及缓存使用情况。对象使用长期 immutable 缓存，修改编码策略时应考虑版本路径及缓存更新。

## 本机 R2 配置与安全

从仓库根目录运行 `npm ci` 和 `node scripts/gallery-studio-server.mjs`，打开 http://127.0.0.1:4783。使用 R2 存储设置填写 Account ID 和每个桶独立的读写凭据。读取测试依赖 AWS CLI v2，只证明读取认证，不证明写入或私有访问策略。

默认凭据保留在服务内存；勾选记住配置后明文存入用户主目录 .yenchiu-gallery/config.json，依赖文件权限而非加密。取消勾选并保存可删除已记住的配置，停止服务清除内存凭据。支持 --env-file 启动，已保存 GUI 配置优先。禁止提交凭据、私有原图、清单或本地输出，不要暴露回环服务端口。私有桶应关闭 r2.dev 和公开自定义域名。

## CLI（可选）

复制 `scripts/gallery-manifest.example.json` 到仓库外私有位置，按实际照片填写。先运行本地衍生图预览，不上传：

```bash
node scripts/gallery-studio.mjs /path/to/manifest.json
```

确认环境变量后再使用 `--publish`；需要备份时再加 `--backup-originals`。CLI 使用当前进程环境，不会自动读取 GUI 记住的配置。变量名：

```text
R2_ACCOUNT_ID
R2_PUBLIC_BUCKET
R2_PUBLIC_URL
R2_PUBLIC_ACCESS_KEY_ID
R2_PUBLIC_SECRET_ACCESS_KEY
R2_PRIVATE_BUCKET
R2_PRIVATE_ACCESS_KEY_ID
R2_PRIVATE_SECRET_ACCESS_KEY
```

公开配置必需，私有配置仅备份需要。审查 .gallery-studio-output/ 与 src/data/gallery-photos.json，失败可能留下部分上传对象；索引在最终写入时原子替换。不要手动复制密钥到聊天或版本库。

## 测试、验收与回滚

```bash
node --test scripts/gallery-exif.test.mjs scripts/gallery-camera.test.mjs scripts/gallery-pipeline.test.mjs
npm test
npm run build
```

[Gallery validation](../.github/workflows/gallery-check.yml) 使用临时合成图、模拟 AWS CLI 和 Chromium 测试本地 Studio、失败重试、公开作品页与首页。测试不能替代真实 R2 写入、CDN 读取和私有桶配置检查。真实验收应验证四个衍生图、索引尺寸、无 EXIF、私有备份及未授权访问限制，并检查手机与桌面布局。

回滚通过新 PR 恢复所需索引版本，保留其引用的对象。不要为了回滚网页直接批量删除 R2 图片。

设计参考：Frud's Blog、astro-gallery、PicImpact、PhotoSwipe。当前为独立实现，使用原生 dialog；摄影作品遵循各自许可。
