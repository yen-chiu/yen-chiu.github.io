# Gallery Studio 2.0

**YenChiu · 本地摄影作品发布工作台**

[光影档案](https://yenchiu.com/gallery/) · [Vesper 主项目](../../README-zh-CN.md)

Gallery Studio 将导出的摄影照片转换为 WebP 衍生图、上传至 Cloudflare R2，并更新 Astro 摄影集的 Git 索引。它是本地管理工具，不是网站访客可访问的后台。

> 本文与 Gallery Studio 2.0 代码同步维护。Studio 仅在本机运行；合并后需更新本地仓库并重新启动。

## 01 · 快速启动

环境要求：Node.js 24、npm；实际上传或测试 R2 连接还需要 AWS CLI v2，并确保 `aws --version` 可正常运行。建议使用较新的 Chrome 或 Edge。

在仓库根目录运行：

```bash
npm ci
node scripts/gallery-studio-server.mjs
```

打开 **http://127.0.0.1:4783**，仅在启动服务的电脑上访问。结束工作后在终端按 Ctrl+C 停止服务。

如果已有本地仓库，先执行 `git status`，确认未提交的工作已妥善保存。正式版合并后，从 main 更新：

```bash
git switch main
git pull --ff-only origin main
npm ci
```

如需验证尚未合并的 PR，可检出其开发分支；不要强制覆盖本地照片索引。

## 02 · 工作区

| 区域 | 功能 |
| --- | --- |
| 左侧 · 照片队列 | 批量选择、拖拽、追加导入、切换照片、清空队列 |
| 中间 · 作品预览 | WebP 压缩预览、实际尺寸及大小、缩放、适应窗口、支持时切换原图 |
| 右侧 · 作品属性 | 标题、替代文字、相册、日期、摄影参数、说明及发布选项 |
| 顶部 · 设置 | 专业暗房、纸质档案、跟随系统；R2 存储设置 |

队列缩略图在首次打开对应照片后生成；切换照片保留当前会话内的草稿。刷新或关闭页面会丢失未保存草稿及队列，主题选择也不跨会话保存。清空队列不会删除已经发布的对象。

支持 JPEG、PNG、WebP、TIFF，单文件不超过 32 MiB，服务端像素上限 8000 万。NEF 等 RAW 请先在摄影软件中导出。TIFF 使用 WebP 预览，不提供浏览器原图切换。缩放仅影响显示，不修改作品内容。

## 03 · R2 存储设置

点击顶部 **R2 存储设置**，填写 Cloudflare Account ID 和对应桶的 Access Key ID / Secret Access Key。

| 用途 | 存储桶 | 权限建议 |
| --- | --- | --- |
| 公开衍生图片 | `yenchiu-gallery` | 仅该桶的对象读写 |
| 私有导入文件备份 | `yenchiu-gallery-originals` | 独立凭据，仅该桶的对象读写 |

公开 CDN：`https://gallery-cdn.yenchiu.com`。私有桶不应启用公开 r2.dev 或公开自定义域名。

先测试读取连接，再保存配置。读取测试不代表已经验证写权限或公开访问策略；真实发布需另行检查。公开桶是发布必需项，私有桶仅在勾选备份时必需。

默认凭据仅保留在本次服务内存中。勾选“在本机记住配置”会将凭据明文保存到用户主目录的 `.yenchiu-gallery/config.json`；依赖操作系统文件权限，并非加密保险库。取消勾选后保存可移除已记住的配置，停止服务清除本次内存状态。已配置的密钥留空表示保留，不表示删除；更换账户时应同步填写相应的密钥。

不要将凭据、私有原图或本地配置提交至 Git，不要将本机端口开放到公网。

## 04 · 摄影参数录入

摄影参数为选填。导入时会尝试读取 EXIF 白名单字段；后期导出丢失 EXIF 时可手工填写。输入框下方提供录入示例、复制及实时解析预览。

```text
147mm F5.6 1/250s ISO1000
ISO800 · 1/500s · 85mm · F1.8
ISO400 · 0.5s
相机: Nikon D750 · 镜头: 70-200mm f/2.8 · 147mm · F5.6 · 1/250s · ISO1000
```

焦距用 mm，光圈用 F 或 f/，快门用 s 或 秒，感光度用 ISO。支持乱序、缺项及常见标点。设备名称建议显式加标签，并以中点或分号隔开，避免将镜头规格误认为拍摄参数。未知及冲突值保留为原文，不凭空补全。示例不是实际拍摄信息。

## 05 · 发布流程

1. 导入照片并确认构图、压缩预览。
2. 填写必填的标题、替代文字、相册、日期；检查参数与说明。
3. 按需勾选精选作品和私有桶备份。
4. 点击“发布作品 · 上传并更新索引”并确认。
5. 检查进度、CDN 图片和本地 Git 差异。

输出规格为最长边上限 480 / 960 / 1920 / 3840 px，WebP quality 85，不放大小图。Sharp 默认移除输出图片的 EXIF 等元数据；公开索引只保存选定的文字信息和公开衍生图片 URL。备份的是实际导入的文件，不会自动寻找对应的 NEF。

发布进度依据已完成事件：验证 1 次、生成 4 次、上传 4 次、可选备份 1 次、写入索引 1 次。总计 10 或 11 个节点，不是网络字节传输百分比。失败可能留下已上传的对象，但不会把失败的照片写入成功索引；可检查终端错误后重试。

发布完成后仍需人工审查 Git 差异：

```bash
git status
git diff -- src/data/gallery-photos.json
git add src/data/gallery-photos.json
git commit -m "content(gallery): add photography works"
```

将照片索引提交到计划发布的分支，通过 PR、构建与人工审批后再合并 main。R2 上传本身不会自动更新线上相册。

## 06 · 文件结构与维护

| 文件 | 用途 |
| --- | --- |
| [gallery-studio.html](../../scripts/gallery-studio.html) | 本地工作台 |
| [gallery-studio-server.mjs](../../scripts/gallery-studio-server.mjs) | 回环 HTTP 服务、认证与进度 |
| [gallery-studio-config.mjs](../../scripts/gallery-studio-config.mjs) | 本地凭据配置 |
| [gallery-studio.mjs](../../scripts/gallery-studio.mjs) | 压缩、R2 上传与索引写入 |
| [gallery-exif.mjs](../../scripts/gallery-exif.mjs) | EXIF 白名单读取 |
| [gallery-camera.mjs](../../src/lib/gallery-camera.mjs) | 共用参数解析器 |
| [gallery-photos.json](../../src/data/gallery-photos.json) | 公开作品索引 |
| `.gallery-studio-output/` | 本地衍生图输出，禁止提交 |

基础验证：

```bash
node --test scripts/gallery-exif.test.mjs scripts/gallery-camera.test.mjs scripts/gallery-pipeline.test.mjs
npm test
npm run build
```

浏览器回归测试由 [Gallery validation](../../.github/workflows/gallery-check.yml) 执行，采用合成照片和模拟 AWS CLI，不访问真实存储桶。原 2.0 功能提交 `626d907` 的两套 CI 均通过；迁移到最新 main 后必须重新运行测试，实际设备和真实 R2 仍需验收。

## 07 · 常见问题

- **无法启动**：确认从仓库根目录运行、Node.js 版本、依赖安装及 4783 端口是否被占用。
- **不能上传**：检查 AWS CLI、桶权限及本机 R2 配置；勾选私有备份时检查独立私有桶凭据。
- **相册没有新作品**：确认索引已提交并部署，而非只上传了 R2 图片。
- **没有识别到参数**：确认源图是否带 EXIF，或参考录入指南手动填写。
- **页面仍是旧界面**：确认当前分支、停止旧 Studio 服务后重新启动，再刷新浏览器。

代码沿用仓库 [LICENSE](../../LICENSE)；摄影作品及其他素材遵循各自版权声明。

