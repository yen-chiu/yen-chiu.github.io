# GitHub 登录代理（Cloudflare Worker）

写作台 `/admin/` 默认用 Fine-grained Token 登录。想改成「点一下就用 GitHub 登录」，需要这个
**无状态 CORS 代理**：浏览器的设备码请求会被 GitHub 的 CORS 策略拦截，Worker 只做转发，不保存任何用户数据。

```
浏览器 ──POST /device/code──▶ Worker ──▶ github.com/login/device/code
浏览器 ──POST /device/token─▶ Worker ──▶ github.com/login/oauth/access_token
```

## 一、创建 GitHub App（约 3 分钟，全程在网页上点）

1. 打开 <https://github.com/settings/apps/new>（个人）或组织下的 Settings → Developer settings → GitHub Apps → New GitHub App
2. 填写：
   - **GitHub App name**：`wendell-blog-auth`（任意，不能和别人的重名）
   - **Homepage URL**：`https://yenchiu.com`
   - **Webhook**：取消勾选 **Active**（不需要 webhook）
3. **Repository permissions** 只给两项：
   - `Contents` → **Read and write**
   - `Metadata` → **Read-only**（自动带上，勾不了）
4. 页面下方 **Where can this GitHub App be installed?** → 选 **Only on this account**
5. 点 **Create GitHub App**
6. 创建后进入设置页：
   - 记下 **Client ID**（形如 `Iv1.xxxxxxxx`，公开信息，可以贴在配置里）
   - 找到 **Enable Device Flow** → **勾选并保存**（这一步不做，登录会一直失败）
7. 左侧 **Install App** → 安装到自己账号 → **Only select repositories** → 只勾 `yen-chiu/yen-chiu.github.io`

> **不需要** Client secret：本 Worker 不配置它，也就不存在长期密钥泄露面（详见第四节）。

## 二、部署 Worker（约 2 分钟）

```bash
cd tools/worker
# 1. 把 Client ID 填进 wrangler.toml 的 GITHUB_CLIENT_ID
# 2. 登录 Cloudflare（会打开浏览器授权，只需一次）
npx wrangler login
# 3. 部署
npx wrangler deploy
```

部署成功会打印一个地址，形如：

```
https://yenchiu-api.<你的账号>.workers.dev
```

打开 `https://yenchiu-api.<账号>.workers.dev/health` 应返回 `{"ok":true}`。

> 也可以在 Cloudflare 控制台 → Workers & Pages → Create Worker，把 `src/index.js` 整个粘进去，
> 然后在 Settings → Variables 里加 `GITHUB_CLIENT_ID`、`ALLOWED_ORIGIN=https://yenchiu.com`。

## 三、让站点用上它

把地址填进 `_config.yml`：

```yaml
admin_auth_endpoint: "https://wendell-auth.<你的账号>.workers.dev"
```

推送后 `/admin/` 就会出现「使用 GitHub 登录」按钮；留空则只显示令牌登录。

## 四、关于「静默续期」

**没有做。** GitHub App 的用户令牌 8 小时过期，要静默续期必须把 Client Secret 放进服务端。
为了少一个长期密钥，这里主动放弃了续期：过期后重新点一次「使用 GitHub 登录」（约 15 秒）即可。
写作台会在令牌过期时自动回到登录页并提示，不会留下半死不活的状态。

同理，`/refresh` 端点已下线——它只会扩大攻击面，而没有任何调用方。

## 五、同一份 Worker 也能当「上网代理」

站内人格念真需要联网时，浏览器直连搜索和网页会被 CORS 挡住，这个 Worker 顺手提供了两条路由：

| 路由 | 说明 |
| --- | --- |
| `GET /search?q=关键词` | DuckDuckGo HTML + 维基百科并行；中文查询额外并行问一次 Bing HTML（结果做相关性过滤）；DDG 空壳时换 Lite，仍不通再用 Yahoo。按来源配额合并、去重，最多 6 条。返回 `{results:[{title,url,snippet,source}]}` |
| `GET /read?url=完整地址` | 只允许公网 http/https，抓回页面剥掉标签后返回纯文本（标题 + 最多 8000 字） |

聊天页已经默认走这两条路由（`api.yenchiu.com`），不用手填。要换成自己的部署，在设置里改：

- **联网搜索接口** → `https://yenchiu-api.<你的账号>.workers.dev/search`
- **网页读取代理** → `https://yenchiu-api.<你的账号>.workers.dev/read?url={url}`

注意 `ALLOWED_ORIGIN` 必须包含实际打开的站点来源（`https://yenchiu.com`、`https://www.yenchiu.com`，本地调试再加 `http://127.0.0.1:4000`），否则会被 403 挡掉。

浏览器直连 DuckDuckGo 的接口拿不到 `Access-Control-Allow-Origin`，维基百科在部分网络环境又不可达，所以“搜索”和“读网页”都以 Worker 为主；两个接口都留空时只退回维基百科直连。

搜索还有两层保护：

- **5 分钟结果缓存**：用 Cloudflare Cache API 按查询词缓存非空结果，命中时响应头是 `X-Search-Cache: HIT`。查询词会以缓存键的形式在边缘节点保留最多 5 分钟，不落数据库。
- **失败分类 + 冷却**：`bot-wall` / 超时等短失败冷却 60 秒，`auth` / `quota` 冷却到当前 isolate 结束；冷却中的引擎直接跳过，失败原因会写进 `debug=1` 的 trace。**Bing 失败不冷却**，它只是中文补充源。
- **Bing 的现实情况**：从 Cloudflare 机房访问 Bing 时，它偶尔返回空页或与查询无关的默认结果。Worker 会做一次查询词相关性过滤，过滤后为空就静默跳过，不会污染结果；所以 Bing 是“有机会就补”，不保证每次都有产出。

`/read` 加了 SSRF 防护：拒绝回环、内网网段、link-local（含 `169.254.169.254`）和 IPv6 字面量；
按 IP 限流（`RATE_LIMIT_SEARCH` 默认 30 次/分、`RATE_LIMIT_READ` 默认 20 次/分）。

## 六、`/chat`：给网页版游戏用的角色对话

`miko-web`（《异次元通讯》网页版）的「后日谈」需要一个能替角色说话的接口。人设、模型、密钥全放在 Worker 里，
前端只发「谁 + 最近几轮 + 这句话」，拿回一句回复。

| 项 | 值 |
| --- | --- |
| 路由 | `POST /chat` |
| 请求体 | `{"persona":"miko\|iris\|lily","text":"…","history":[{"role":"me\|her","text":"…"}]}` |
| 响应 | `{"reply":"…","persona":"miko"}` |
| 未配密钥 | `503 {"error":"chat_not_configured"}`（前端据此退回「只记录不回复」） |
| 超长 | `413`（`text` ≤ 300 字、上下文 ≤ 12 条 / 合计 ≤ 3000 字） |
| 限流 | 每 IP 每分钟 `RATE_LIMIT_CHAT` 次（默认 12），超了 `429` + `Retry-After: 60` |
| 上游失败 | `502 {"error":"upstream_failed"}`；不会把上游响应体透给前端 |

人设写在 `src/index.js` 的 `CHAT_PERSONAS`（miko / iris / lily），每个都是一段中文 system prompt——
改性格改这里，不用碰前端。模型默认 `deepseek-chat`，可用 `CHAT_MODEL` 覆盖；`CHAT_MAX_TOKENS` 默认 220。

### 部署

```bash
cd tools/worker
npx wrangler secret put DEEPSEEK_API_KEY   # 只需一次；密钥只存在 Cloudflare
npx wrangler deploy
```

不配密钥也能部署，`/chat` 会一直返回 503，游戏里自动退回「只记录不回复」，不会报错。

### 为什么密钥不放前端

前端代码人人可读，放进去等于公开。Worker 是唯一持有密钥的地方，并且：
`Origin` 白名单（`https://yenchiu.com` 等）+ 按 IP 限流 + 文本/上下文长度上限 + 单次 `max_tokens` 上限。
主线 14,401 行剧情仍走本地 CSV，只有「后日谈」这一处会打网络。

## 本地开发

```bash
cd tools/worker
npx wrangler dev          # 默认 http://127.0.0.1:8787
```

把 `wrangler.toml` 的 `ALLOWED_ORIGIN` 临时加上 `http://127.0.0.1:4000`（`jekyll serve` 的地址）就能本地联调。

## 测试

```bash
cd tools/worker
node --test test/worker.test.mjs
```

覆盖 27 个用例（含 `/chat` 的 6 条）：CORS 预检、来源白名单、缺 client_id、设备码透传、轮询错误透传、按 IP 限流、`/refresh` 已下线、404，
`/search` 的合并去重、Bing 补充与不冷却、DDG bot-wall 冷却、Yahoo 401 会话冷却、5 分钟缓存命中，
以及 `/read` 的 SSRF 防护与正文抽取，以及 `/chat` 的未配置回落、方法校验、长度校验、人设注入、上游失败与按 IP 限流。

## 安全说明

- Worker 不存令牌、不存 Client Secret，日志里也没有敏感信息；`/device/token` 只是把 GitHub 的响应原样返回。
- 来源白名单默认只允许 `https://yenchiu.com`，其它网站的前端调用会 403。
  注意 `Origin` 是客户端自填的，白名单挡不住 curl/脚本——防滥用靠限流。
- 按 IP 的滑动窗口限流（`RATE_LIMIT_CODE` 默认 10 次/分、`RATE_LIMIT_TOKEN` 默认 120 次/分）是
  Worker 实例内的近似值。**生产环境请在 Cloudflare 控制台给这个 Worker 加 Rate limiting 规则**
  （例如：`/device/code` 每 IP 每分钟 5 次），那才是全局生效的。
- `/health` 只返回 `{"ok":true}`，不回显白名单或任何配置。
- 搜索结果缓存键包含查询词，边缘节点最多保留 5 分钟；不要用它搜索敏感信息。
- 权限边界由 GitHub App 决定：只能访问被安装的那个仓库，且只有 Contents 读写。
- 想彻底停用：Cloudflare 里删掉 Worker，或把 `admin_auth_endpoint` 清空。
