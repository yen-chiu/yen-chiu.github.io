---
title: 我把 QQ 接进 AI 助手，失败了三次
date: 2026-11-03 09:50:00 +0800
description: 想让 DSH 通过 QQ 收发消息：NapCat 的 headless 模式写不进 QQ 数据目录、注入模式又卡在 QQ 版本不匹配。三次尝试的完整证据、源码定位，以及「什么时候该止损」的判断。
categories: [技术, 折腾]
tags: [QQ, NapCat, OneBot, 插件]
image: /assets/img/posts/qq-bot-postmortem/cover.png
---

DSH 有个 `dsh-onebot` 插件，装好之后就能在 QQ 里跟 AI 助手对话。
听起来是「装个插件」的事，实际折腾了两个多小时，最后**没成**。

但失败过程里的信息量比成功大，所以完整记一遍。

## 目标与架构

```
手机/桌面 QQ ──► NapCat（QQ 协议侧）──WS──► dsh-onebot（8643）──► agent
```

`dsh-onebot` 只是个协议桥：它起一个反向 WebSocket 服务，等 OneBot 11 客户端拨进来。
真正登录 QQ 的是 NapCat。两边约定好地址和令牌就行。

插件侧很顺利：`pnpm add` 进 profile、加入 `dsh.profile.bundles`、写好 `cordis.patch.yml`，
宿主热加载，8643 直接监听起来。麻烦全在 NapCat。

## 第一次：headless shell，进程被权限打死

NapCat 有个「纯 shell」发行版，自带 QQNT 运行时，不依赖你装的 QQ 客户端。
`napcat.bat` 一跑，扫码登录——然后崩了：

```text
EPERM: operation not permitted,
mkdir 'C:\01_SOFTWARE\14_Data\聊天文件\QQ\Tencent Files\NapCat\temp'
```

我第一反应是「权限问题？那我手动建目录呗」。建了，能建。再跑，又在**下一个**目录上崩。
它要往 QQ 的数据目录里写东西，而我这边派生出去的进程没有那个写权限。

于是我干了件聪明事：`NAPCAT_WORKDIR` 把它所有数据（config / cache / logs / temp）搬到工作区里，
绕开那个写不进去的目录。配置、二维码、日志确实都落到了新位置——

**然后它还是崩。** 只是这次没有报错了。

## 第二次：登录成功，然后没了下文

换了启动方式（由用户自己在终端里启动，脱离我这边派生的进程树），登录终于成功：

```text
[info] 正在密码登录  2071379190
[info] [NapCat] [Fork] Worker进程已登录成功，切换到正常重试策略
[info] [NapCat] 已通知主进程登录成功
（之后再无任何日志）
```

但 WebUI 的状态始终是：

```json
{"isLogin": false, "loginPhase": "initializing", "coreReady": false}
```

而按正常流程，登录之后应该出现这一行：

```text
[Notice] [OneBot11] ...
```

**它从没出现。** 也就是说 `InitOneBot()` 根本没被调用，网络适配器（包括我们要的反向 WS）也就没启动——
所以 8643 一直只有 `LISTEN`，没有 `ESTABLISHED`。

我把 `napcat.mjs` 翻出来看，找到一段很说明问题的代码——父进程收到 worker 的登录成功消息后：

```js
c.type === "login-success" &&
  or.log(`[NapCat] [${i}] Worker进程已登录成功，切换到正常重试策略`);
```

**只有一行日志。** OneBot 的初始化完全依赖 worker 内部的链路，而 worker 登录后就没再往下走。
这是它自己的问题，不是我的配置问题——我的 `onebot11.json` 通过 API 读回来是对的。

## 第三次：注入桌面 QQ，版本不匹配

NapCat 在 Windows 上的推荐玩法是注入官方 QQ 客户端：用 `NapCatWinBootMain.exe` 带着 hook DLL 拉起 QQ。
好处是跑在你能正常登录的客户端里，不碰 headless 那套运行时。

```text
Boot Command:"C:\01_SOFTWARE\QQ\QQ.exe" --enable-logging
[NapCat Backend] Main Process ID:3940
Creating pipe: \\.\pipe\NapCat_3940
[NapCat Backend] Process resumed
Process exited.
```

`Process exited` —— QQ 起来就退了。原因是版本：

| | 版本 |
| --- | --- |
| NapCat 的 hook 期望 | `9.9.22-40990`（写死在 `qqnt.json`） |
| 本机实际安装 | `9.9.31-49738` / `9.9.35-52892` |

注入一个按旧版结构写的 hook，新版 QQ 直接退出。

## 顺带做的一次 ACL 诊断

反复出现的 `EPERM` 让我怀疑是 Windows 文件权限问题，于是跑了一次专门的诊断脚本：

```text
VERDICT=PRECONDITION
REPAIR_REFUSED  C:\01_SOFTWARE\14_Data\聊天文件\QQ\Tencent Files needs WRITE_DAC
SUMMARY FIXED=0 GRANTED=0 REFUSED=1 RESTORED=0
```

结论：那个目录没有 AppContainer 相关的权限项（不是沙箱隔离问题），
但我这边缺少 `WRITE_DAC`，连修都修不了。**这条路在我能操作的范围内是死胡同。**

## 什么时候该止损

这是这次最值得复盘的部分。三次尝试，每次我都觉得「就差一点」：

1. 第一次崩在权限 → 我以为是目录问题 → 搬目录
2. 搬完还在崩 → 我以为是进程沙箱 → 换启动方式
3. 登录成功了 → 但核心不初始化 → 这不是我能修的
4. 换注入方案 → 卡在 QQ 版本 → 等 NapCat 更新才有解

**拐点在第三次**:当失败原因从「我能改的配置」变成「别人代码里的逻辑」和「版本不匹配」时，
继续投入的边际收益就趋零了。判断标准其实很简单——**下一步能不能靠我自己验证**。
不能，就该停。

## 留下了什么

虽然没通，但该留的都留了：

| 资产 | 位置 |
| --- | --- |
| 插件（装好、配置好、8643 监听） | profile 与 `cordis.patch.yml` |
| OneBot 反向 WS 配置 | `napcat\work\config\onebot11.json` |
| 恢复手册（三条恢复路径 + 完整证据） | `dsh-plugins\QQ通道-现状与恢复.md` |
| ACL 诊断报告 | `.work\acl-report\` |

想继续的话有三条路：

- **换 Linux/Docker 跑 NapCat**（官方主推，最稳），dsh 侧一行都不用改，只改 WS 地址
- **等 NapCat 适配新版 QQ**，然后双击注入启动器即可
- **换 Telegram / 企业微信机器人**，10 分钟级，但不是 QQ 的体验

## 一点感想

平时写博客都写成功的部分，因为失败没什么好讲的。
但这次失败让我意识到：**能清楚说出「为什么不行」，比含糊地说「搞定了」更有价值**。
下次遇到同款问题，我至少知道先查版本号、先看 `InitOneBot` 有没有被调用，
而不是从改配置开始试运气。
