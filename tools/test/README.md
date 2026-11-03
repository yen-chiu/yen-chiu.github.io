# 前端回归测试

写作台没有框架、也没有测试运行器，这两个脚本用 **Puppeteer 驱动本机 Edge** 直接打真实页面，
覆盖单测够不到的地方（DOM 解析、事件、localStorage 生命周期）。

| 脚本 | 覆盖 |
| --- | --- |
| `sanitize-xss.mjs` | 预览净化的 13 条 XSS payload（含曾真实绕过的 `java&#9;script:`） |
| `ui-smoke.mjs` | GFM 任务列表渲染、令牌过期不清本地草稿 |

## 运行

```bash
# 1. 构建并起一个静态服务
bundle exec jekyll build
npx serve _site            # 或 python -m http.server 4000 --directory _site

# 2. 装浏览器驱动（不需要下载 Chromium，用本机 Edge）
npm i puppeteer-core

# 3. 跑
node tools/test/sanitize-xss.mjs http://127.0.0.1:4000
node tools/test/ui-smoke.mjs    http://127.0.0.1:4000
```

浏览器路径默认是 Windows 的 Edge，可用环境变量覆盖：

```powershell
$env:EDGE_PATH = "C:\Program Files\Google\Chrome\Application\chrome.exe"
```

如果 `puppeteer-core` 装在别处（例如只想临时借用一份），用 `PUPPETEER_CORE` 指向它的入口文件，
这样仓库里不需要新增依赖：

```powershell
$env:PUPPETEER_CORE = "C:\path\to\node_modules\puppeteer-core\lib\puppeteer\puppeteer-core.js"
```

约定：退出码非 0 表示有用例失败；每个用例打印 `PASS / FAIL · 名称 (xss=… href=…)`。

> 这两个脚本**不**在 CI 里跑（需要浏览器），改到 `assets/js/admin/app.js` 的净化逻辑时请手动跑一次。
