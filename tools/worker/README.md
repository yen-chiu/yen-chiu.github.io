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

> Client secret 只有想「静默续期（8 小时后不用重新登录）」时才需要，可先不配。

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
https://wendell-auth.<你的账号>.workers.dev
```

打开 `https://wendell-auth.<账号>.workers.dev/health` 应返回 `{"ok":true,"refresh":false,...}`。

> 也可以在 Cloudflare 控制台 → Workers & Pages → Create Worker，把 `src/index.js` 整个粘进去，
> 然后在 Settings → Variables 里加 `GITHUB_CLIENT_ID`、`ALLOWED_ORIGIN=https://yenchiu.com`。

## 三、让站点用上它

把地址填进 `_config.yml`：

```yaml
admin_auth_endpoint: "https://wendell-auth.<你的账号>.workers.dev"
```

推送后 `/admin/` 就会出现「使用 GitHub 登录」按钮；留空则只显示令牌登录。

## 四、（可选）静默续期

```bash
cd tools/worker
npx wrangler secret put GITHUB_CLIENT_SECRET   # 粘贴 App 的 Client Secret
npx wrangler deploy
```

配了之后 `/health` 会返回 `"refresh":true`，写作台可以在令牌过期时自动续期。
如果不配，令牌 8 小时后过期，重新点一次「使用 GitHub 登录」（约 15 秒）即可。

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

覆盖：CORS 预检、来源白名单、缺 client_id、设备码透传、轮询错误透传、refresh 未配置/已配置、404。

## 安全说明

- Worker 不存令牌，日志里也没有敏感信息；`/device/token` 只是把 GitHub 的响应原样返回。
- 来源白名单默认只允许 `https://yenchiu.com`，其它站点调用会 403。
- 权限边界由 GitHub App 决定：只能访问被安装的那个仓库，且只有 Contents 读写。
- 想彻底停用：Cloudflare 里删掉 Worker，或把 `admin_auth_endpoint` 清空。
