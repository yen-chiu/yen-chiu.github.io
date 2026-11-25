# Nocturne Editorial · 暗夜序章

首页采用品牌封面与杂志式正文。首屏保留头像、名字、标语、轻量月轮与五线谱 SVG；摄影作品位于正文独立栏目，音乐使用紧凑播放器。

## 架构与文件

| 文件 | 职责 |
| --- | --- |
| `src/pages/index.astro` | 首页数据选择、封面、导读、目录、摄影、音乐及滚动交互 |
| `src/utils/hero-motion.ts` | 缓动与弹簧步进数学函数 |
| `src/components/CustomHeader.astro` | 导航与设置入口 |
| `src/components/InteractiveAvatar.astro` | 头像交互 |
| `src/components/appearance/AppearancePanel.astro` | 外观设置 UI |
| `src/components/appearance/appearance-bootstrap.js` | 首次绘制前应用主题、壁纸、动效偏好 |
| `src/assets/styles/global.css` | 全局视觉、性能分级及降级规则 |

## 使用及维护

访客可通过外观设置调整深浅主题、主色、首页封面、壁纸、文章布局、动效及动画头像。内页与首页壁纸支持继承或单独选择。外部地址仅接受有效 HTTPS URL；本地上传接受 JPEG、PNG、WebP、AVIF，最大 8 MiB。设置保存在 localStorage，上传图片保存在本浏览器 IndexedDB，不上传服务器。清除设置或图片时分别使用对应功能。

首页摄影从公开索引选择精选横图优先、其次精选、最后第一张，使用 480/960 WebP 响应式懒加载，保留原图比例，CDN 故障显示占位。首屏不得改为完整相册，不应请求 1920/3840 摄影衍生图。

性能策略：宽度不超过 480px 或逻辑核心数不超过 4 时进入 low 档；显式减少动效或系统偏好进入 static 档。它是保守启发式规则，不是 GPU 基准测试。装饰动画与必要的交互反馈应区分处理；后台标签暂停装饰效果。不要让降级隐藏正文或使导航无法使用。

## 回归检查

```bash
npm test
npm run build
```

重点检查 appearance、wallpaper-settings、hero-motion、performance-delivery 等测试；[Gallery validation](../../.github/workflows/gallery-check.yml) 同时覆盖首页桌面和移动端。人工检查 320–390px 窄屏、宽屏、壁纸切换、导航对比、滚动折叠、反向滚动、减少动效和图像加载失败。真实 LCP/CLS 需通过实际环境测量，不能用构建成功代替。
