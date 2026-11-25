# Gallery Studio · 本地摄影发布工作台

本文描述 main 当前实现（参数识别升级已合并）。独立 2.0 三栏工作台仍在 [feat/gallery-studio-editorial](https://github.com/yen-chiu/yen-chiu.github.io/blob/feat/gallery-studio-editorial/docs/gallery-studio/README.md)，不要将开发版本的主题、缩放、队列与阶段进度当作 main 已有功能。

## 快速开始

Node.js 24，实际发布与读取连接测试需要 AWS CLI v2。在仓库根目录：

```bash
npm ci
node scripts/gallery-studio-server.mjs
```

打开 http://127.0.0.1:4783 。导入 JPEG/PNG/WebP/TIFF（32 MiB、8000 万像素限制）；NEF 等 RAW 先导出。填写标题、替代文字、相册、日期，参数与说明选填，选择精选和是否备份。查看 WebP 预览后确认发布。完成后审查 `src/data/gallery-photos.json`，提交照片索引并通过 PR 部署；仅上传 R2 不会更新网站。

## 参数填写

导入时尝试读取 EXIF 白名单；手工输入支持乱序、缺项及常见标点，实时预览和可复制的说明位于参数框下方。

```text
147mm F5.6 1/250s ISO1000
ISO400 · 0.5s
相机: Nikon D750 · 镜头: 70-200mm f/2.8 · 147mm · F5.6
```

设备名称显式加标签，以中点或分号分隔。不要把示例当作真实拍摄值；不识别的内容或冲突值保留原文，不猜测。切换队列照片保存会话内草稿；重新选择文件可能替换队列，关闭页面会丢失未发布草稿。

## 技术与安全

`scripts/gallery-studio.html` 是界面；server.mjs 为回环服务并限制 Host、Origin 与令牌；config.mjs 管理本地凭据；gallery-exif.mjs 提取允许的 EXIF；`src/lib/gallery-camera.mjs` 是共用解析器；gallery-studio.mjs 执行压缩、上传及索引写入。完整 R2 说明、CLI 和验证见 [摄影集维护指南](../gallery.md)。

配置仅在本机处理。记住配置会明文存入用户主目录 .yenchiu-gallery/config.json，并非加密保险库。备份的是实际导入文件而非自动查找 RAW。不要公开本地端口、提交凭据或原图。

## 故障排查

启动失败检查工作目录、Node 版本、依赖、端口。上传失败检查 AWS CLI、对应桶权限和终端错误；已上传对象可能残留，索引未成功时可复查后重试。发布后页面未更新检查 Git 索引及部署。运行 `npm test`、`npm run build` 与 Gallery validation；自动化模拟存储不代表真实 R2 已联调。
