---
title: GitHub App 设备码：让写作台「点一下」就登录
date: 2026-11-03 07:40:00 +0800
categories: [Blogging, Tutorial]
tags: [GitHub, Cloudflare, OAuth, 写作台]
description: 浏览器直连 GitHub 的 token 接口会被 CORS 拦掉。用 Cloudflare Worker 做一层无状态代理，配上 GitHub App 的设备码流程，就能不手动创建 Token 直接登录。
image:
  path: /assets/img/posts/device-login/cover.png
  alt: GitHub 设备码登录
---

上一篇讲到，写作台用 Fine-grained Token 登录，能跑，但每次换设备都得去 GitHub 设置里翻一遍，令牌过期还得重来。这篇记录把它换成「点一下就用 GitHub 登录」的过程——中间踩了两个坑，值得写下来。

## 坑一：浏览器根本调不通 GitHub 的 token 接口

第一反应是纯前端做：页面直接请求 `https://github.com/login/device/code` 拿设备码，再轮询 `/login/oauth/access_token`。

写完发现请求全部失败。抓包一看：

```text
OPTIONS https://github.com/login/device/code
-> 404，且没有 Access-Control-Allow-Origin
```

GitHub 这两个端点不是给浏览器跨域用的，服务端调用没问题，浏览器里就必须经过一层代理。这也解释了为什么所有 GitHub CMS 都要配一个「OAuth 代理」或「Netlify Function」。

## 坑二：OAuth App 的权限太宽

GitHub 有两条路：

| | OAuth App | GitHub App |
| --- | --- | --- |
| 权限范围 | 经典 scope，`repo` = **你所有仓库**读写 | 安装时选仓库 + 细粒度权限 |
| 令牌时长 | 长期有效 | 用户令牌 8 小时 |
| 适合 | 早期工具 | 现在推荐 |

写作台只需要「一个仓库的 Contents 读写」。用 OAuth App 等于把所有仓库的钥匙都交出去，不划算。所以选 **GitHub App**。

## 设备码流程长什么样

这是给「没有浏览器回调地址」的客户端准备的授权方式，正好适合纯静态站：

```text
1. 页面 → POST /login/device/code { client_id }
   ← { device_code, user_code: "ABCD-1234", verification_uri, interval: 5 }

2. 页面把 user_code 显示出来，用户去 github.com/login/device 输入并授权

3. 页面每 interval 秒 POST /login/oauth/access_token
   { client_id, device_code, grant_type: urn:ietf:params:oauth:grant-type:device_code }
   ← { error: "authorization_pending" }   // 还没点
   ← { access_token, expires_in, refresh_token }  // 授权完成
```

几个容易踩的点：

- GitHub App 必须在设置里勾上 **Enable Device Flow**，否则第 1 步直接失败；
- 轮询间隔小于 `interval` 会返回 `slow_down`，要退避加长；
- `expires_in` 是 28800（8 小时），过期得重新授权——**刷新令牌需要 client_secret**，纯前端拿不到。

## 代理只做转发，不存东西

Worker 的逻辑非常薄：校验来源 → 转发 → 原样返回。

```js
async function githubPost(path, form) {
  const res = await fetch('https://github.com' + path, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'wendell-blog-auth-worker'
    },
    body: new URLSearchParams(form).toString()
  });
  return { status: res.status, body: await res.json() };
}

// POST /device/code
const { body } = await githubPost('/login/device/code', {
  client_id: env.GITHUB_CLIENT_ID
});
return json(body, 200, origin, env);
```

需要的环境变量只有一个 `GITHUB_CLIENT_ID`——它是公开信息，写进 `wrangler.toml` 也没关系。Worker 里**没有任何密钥**，也不落库、不打日志，挂了最多是登录不可用，不会泄露什么。

来源白名单也写死在 Worker 里：只允许 `https://yenchiu.com` 调用，别的站点请求一律 403，免得变成公开的免费代理。

## 页面侧：状态机比接口麻烦

接口三步就完了，真正啰嗦的是页面上的状态：

```text
未配置代理  → 隐藏「GitHub 登录」，只显示令牌登录
点登录      → 显示验证码 + 复制按钮 + 开始轮询
polling     → 授权中：等待 / 退避 / 过期 / 被拒绝
拿到令牌    → 存 { token, expires_at, source: "oauth" } → 连接仓库
过期或 401  → 清掉本地状态，回登录页并提示
```

其中「过期自动登出」是最容易漏的一环：令牌存下来了，但 8 小时后接口开始 401，如果不在统一的请求封装里处理，用户会看到一堆莫名其妙的报错。所以我在 `api()` 里加了一处判断：

```js
if (res.status === 401 && state.tokenSource === 'oauth') onAuthExpired();
```

## 怎么验证它真的能用

这类登录流程最怕「看起来对」。所以我在本地做了两套东西：

1. 一个 mock 代理，按真实节奏返回 `authorization_pending` → `access_token`；
2. 一个 mock GitHub API，接受这个令牌并返回文章列表。

然后用真实浏览器（Puppeteer 驱动 Edge）跑完整流程：点登录 → 校验验证码格式 → 等轮询 → 进入工作台 → 检查 `localStorage` 里记录的是 `source: oauth` 和正确的过期时间 → 手动把过期时间改成过去 → 刷新页面 → 确认又回到登录页。

11 项断言全过。Worker 本身另有 10 项单元测试（CORS 预检、来源拒绝、缺 client_id、各种错误透传）。

## 代价与取舍

- **多了一个 Worker 要维护**。好消息是它只有一百多行、没有状态，删掉也不影响已有数据。
- **令牌 8 小时过期**。想静默续期就得把 `client_secret` 放进 Worker（`wrangler secret put`），我暂时没配——重新点一次登录大约 15 秒，能接受。
- **GitHub App 要手动装一次**。这是账号级操作，脚本代替不了。

换来的是：手机、平板、公司电脑，任何一台设备打开 `/admin/`，点一下、输 6 位码，就能开始写。

搭好之后回头再看，所谓「OAuth 登录」对静态站来说，难点从来不在协议，而在「谁来保管那个 secret」。把边界收窄到一个只能读写单个仓库的 App、一个不存任何东西的代理，剩下的就只是状态机的耐心问题了。
