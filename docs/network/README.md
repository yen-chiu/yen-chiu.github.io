# Vesper · Network Optimization

目标：在不迁移 GitHub Pages、不破坏功能及 SEO、不购买服务器的前提下，减少大陆访客跨境请求。Cloudflare 全球 CDN 不等于大陆 CDN；中国网络需 Enterprise 附加订阅及 ICP。本站没有承诺某个固定海外机房或大陆速度。下列分阶段验收均需保留真实报告。

## P0 · 三网基线

使用 [ITDOG](https://www.itdog.cn/) 的 HTTP 测试或 [17CE](https://www.17ce.com/site/http/) 的 GET 测试，选中国电信、联通、移动，每网至少三个地域（华北、华东、华南，条件允许加中西部），对相同 URL 在白天和 19–23 时分别测试。至少三轮、保留失败节点。记录节点、运营商、日期（北京时间）、HTTP 状态、DNS、TCP、TLS、TTFB、总耗时、响应大小、响应 IP、CF-Cache-Status 与 CF-Ray（若平台可见）。DNS/TCP/TLS 累积时间不能相加；比较同一节点、同一时段的重复结果。Ping 不能代替 HTTPS 成功率。

测试路径：根域 /、/blog/、/gallery/、/music/、一篇真实含公式文章、一张 gallery-cdn 上实际的 480/960 WebP。图片 URL 取自公开作品索引。冷缓存和热缓存要分开：同一节点重复 GET，不使用随机 query 伪造热命中；不要为测试随意清空整个 CDN。使用浏览器慢网检查 LCP、CLS、交互及瀑布图，HTTP 探针不等于真实浏览器 LCP。

仓库内脚本可以在大陆三网各自可信的电脑或测试机运行（Node.js 24、curl）：

```bash
node scripts/network-probe.mjs --label=湖南电信 --samples=3 --out=network-probe.json
```

报告记录采样值、成功数、中位数及 P95（小样本 P95 仅作参考）。请将真实节点的原始报告留作对比，不要将 GitHub runner 标签写成大陆运营商。Github-hosted 定时探针仅测其实际出口，非大陆实测；在 Actions 的 network-probe artifact 下载结果。未取得国内节点结果时应保留“待测”。

## P0 · 依赖清单

- BaseHead 不再全站预连接 jsDelivr、Giscus、DummyJSON；这些预连接不是已经下载的资源。
- Giscus 保留原讨论仓库，改为手动加载，并有失败提示与讨论区链接。
- Astro 页面预取改为 tap；搜索与知识图谱本就有动态导入，文件管理器现在也首次点击才加载。
- Waline 未启用；KaTeX CSS 从 npm 构建，不用远端字体服务。音乐直接播放仍使用 Wikimedia Commons，外部平台是官方链接；未擅自复制录音。
- R2 摄影资源为站点自有域名，仍跨境；保持响应式 WebP。用户自设远程壁纸、外部媒体及文章资源可能产生第三方请求。

每次构建执行 `node scripts/network-build-audit.mjs`，生成 network-build-audit.json（HTML gzip 大小、显式资源域名、页面）。此静态扫描不包含运行期 JS 请求、CSS url 或 iframe 内部依赖；再用真实浏览器 Network 面板验证。第三方链接本身不等于首屏请求。不要在许可证未知时镜像录音或外站资源。

## P0 · Cloudflare Cache Rules（需要站主操作）

在 Cloudflare → yenchiu.com → DNS 核实主站确实为代理状态、HTTPS 正常；不改变现有 DNS 记录。然后到 Caching → Cache Rules。先查看现有规则，避免重复或覆盖；先对公开根域和博客目录小范围验证。

建议规则（非已应用配置）：

| 作用域 | 设置 |
| --- | --- |
| 主站 /_astro/ 带内容哈希的静态文件 | Eligible for cache；长 Edge TTL（如 1 年），浏览器 TTL 尊重源站 |
| 主站公开 HTML 根页和已知静态目录页 | Eligible；初始 Edge TTL 2 小时（视当前套餐和界面限制），Browser TTL 尊重源站；不强制缓存非 200 状态 |
| 主站普通头像/图片等未版本化资源 | 尊重源站或短 TTL；发布后精确 purge |
| RSS、contentIndex.json、友链 JSON、sw.js | 初始绕过边缘强制缓存，保证独立友链/头像更新不依赖主站部署 purge；实测后再考虑尊重源站的短缓存 |
| gallery-cdn.yenchiu.com/photos/ 下版本化公开 WebP | 尊重原 immutable Cache-Control；不涉及私有桶 |
| studio.yenchiu.com、Folio /folio、Echora /echora、API、登录与鉴权、其他不明服务 | 不应用主站 HTML 规则 |

主站 HTML 规则示例自定义表达式（仅公开、无 query 的根页和已知目录页，Cookie/Authorization 请求排除以保守处理）：

```text
(http.host eq "yenchiu.com" and http.request.method in {"GET" "HEAD"}
 and http.request.uri.query eq ""
 and not any(http.request.headers.names[*] eq "authorization")
 and not any(http.request.headers.names[*] eq "cookie")
 and (http.request.uri.path eq "/" or
      (ends_with(http.request.uri.path, "/") and
       (starts_with(http.request.uri.path, "/blog/") or
        starts_with(http.request.uri.path, "/gallery/") or
        starts_with(http.request.uri.path, "/music/") or
        starts_with(http.request.uri.path, "/docs/")))))
```

先用规则模拟器验证表达式、状态码 TTL 和排除项。不要建立“所有域名、所有路径、忽略所有源站 Cache-Control”的 Cache Everything；不缓存私密响应、不忽略刷新 query。检查 /sw.js、/folio/、/echora/、studio 域名均未命中强制 HTML 规则。不要在不确定时更改 TLS 模式、WAF 或 DNS；Brotli/HTTP3 以控制台实际支持为准。若出现异常停用新规则，不改源站。

验证重复 GET：
```bash
curl -sS -D - -o /dev/null https://yenchiu.com/
curl -sS -D - -o /dev/null https://yenchiu.com/
```
Windows 用 curl.exe 和 NUL 替代 /dev/null。观察 CF-Cache-Status、Age、CF-Ray、Cache-Control。两次请求可能由不同边缘节点处理；单个 HIT 不证明国内访问改善。

官方参考：[Cache Rules](https://developers.cloudflare.com/cache/how-to/cache-rules/)、[Cache Rule settings](https://developers.cloudflare.com/cache/how-to/cache-rules/settings/)、[Purge API](https://developers.cloudflare.com/api/resources/cache/methods/purge/)、[China Network](https://developers.cloudflare.com/china-network/)。

## P1 · 网络适配与缓存刷新

外观设置 → 网络加载：自动、标准、节省流量。auto 依据 navigator.connection 的 saveData、slow-2g/2g/3g 提示（并非测速，部分浏览器不支持）；手动选择优先，设置保存于现有本地偏好。节省流量停止搜索 hover/focus 提前导入，头像降为静态。正常导航、点击搜索、摄影、音乐及正文不被禁用。所有模式采用 tap 预取与主动评论。此迭代不强制改变访客的壁纸、画质或音源，不根据 IP 降级。

部署刷新采用 opt-in。默认不执行任何 Cloudflare 写操作：
1. Cloudflare 创建仅 yenchiu.com zone 的 Cache Purge API token，不授予 DNS、Workers 或 R2 权限。
2. 仓库 Settings → Secrets and variables → Actions，设置 secret CF_CACHE_PURGE_TOKEN；variable CF_ZONE_ID（非密钥）。
3. 确认规则及测试后，将 variable CF_CACHE_PURGE_ENABLED 设为 true。
4. 下一次 main 成功部署后，独立 purge-cache job 读取本次 dist 的 URL 清单，分批 50 个 URL 精确刷新。PR 不读取 secret，未开启时跳过。只处理主站公开文件，排除 /_astro、/folio、/echora、/studio、/api、第三方域名及 R2 对象；不调用 purge_everything。已删除的旧路径不在本次 manifest 内，依靠 TTL 或手工单独清除。每个批次 API 接受不等于已经命中或清除；仍需检查响应。
5. 失败看 Actions 日志，不输出 token。恢复方式：关闭变量；若缓存过期问题，先在控制台手工刷新已确认的 URL。头像独立工作流会触发主站部署；独立 RSS/友链更新无需依赖此 purge。

## P2 · PWA 离线

仅缓存访问过的公开站点顶层导航页面及 /_astro/ 静态资源：HTML 网络优先，网络失败才回退；静态资源缓存优先。页面最多 20 条、每条 512 KiB；资源最多 64 条、每条 2 MiB（解压后），写入队列串行及版本清理。不会预下载全站，不缓存 R2、音乐、评论、第三方、Range、带查询参数、鉴权、私有应用、动态 JSON 或 SW。未知页面的离线访问显示简洁提示。缓存可能过期或被浏览器回收，离线内容不是最新版本保证；Astro 站内路由离线不保证工作，已浏览页面可尝试完整重新打开。首次安装前的页面可能未缓存，刷新按钮的 query 绕过此缓存。

本地 Chrome/Edge DevTools → Application → Service Workers：先在线访问公开文章，确认 worker active，重新访问以建立缓存；切换 Offline，完整打开已访问文章及从未访问页；恢复网络确认 HTML 获取新版本；检查 /folio/、/echora/、含 query 页未被 worker 缓存。用 Network 面板检查所有静态依赖，清空本地缓存可解除离线旧内容。若回滚 worker，必须发布清理旧缓存的新版 worker，不只是删文件。

## P2 · 性能监测与香港 A/B

Actions 每天 UTC 02:17 / 12:17（北京时间 10:17 / 20:17）及手动触发探针，保留 14 天报告。此监控不收集用户 IP、Cookie、阅读行为，不向外部分析平台上报访问者。GitHub runner 网络并非中国三网，也不能据此判定大陆改善。

香港方案先选择实际可用的 HTTPS 测试域名，在同一内容版本和近似缓存策略下运行：
```bash
node scripts/network-probe.mjs --label=香港候选-湖南电信 --base=https://你的实际测试域名 --samples=3 --out=hk-probe.json
```
没有测试域名时不执行、不填写结果。分别从三网对现有站与香港候选做同节点同时间对比，考虑成功率、P95、峰时稳定性、维护成本和备案要求。不要根据地理距离、营销线路或一次 Ping 直接购买。初始目标：首屏无非必要第三方请求；公开 HTML 热缓存可观测；国内成功率不下降；与基线相比 P50/P95 TTFB、页面字节数和 LCP 有实证改善。未测得的数据始终标记待测。

## 验收和回滚

```bash
npm ci
npm test
npm run build
node scripts/network-build-audit.mjs
```

CI 检查缓存范围、弱网模式、评论/预取；需要额外浏览器测试首点打开文件管理器、搜索、评论失败、离线重访、强制刷新、页面切换以及数学公式/摄影/音乐。代码变更用 PR 回滚；Cloudflare 规则与 token 由站主单独撤回。未直接改线上 Cloudflare、未采购香港节点、未取得大陆实测；真实 R2、缓存规则及实际设备验收仍需完成。
