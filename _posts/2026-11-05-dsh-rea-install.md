---
title: 给 AI 装一双逆向之眼：REA 接入 DeepSeek Harness
date: 2026-11-05 19:40:00 +0800
description: 一张海报把我带进 REA。从补装 Node、绕开 npm 同名包陷阱，到一条 rea setup 注册 MCP 并装好技能，再接上 Ghidra 跑通原生伪代码。附 229 个工具的验证、能力清单与 Windows 踩坑。
categories: [技术, 折腾]
tags: [DSH, REA, MCP, 逆向工程, Windows]
image: /assets/img/posts/rea-install/cover.png
---

起因是一张海报。

黑底、像素字、写着 **REA × OPUS 5.5**，副标题是「REVERSE ENGINEER ANYTHING」。卡片上甚至贴心地写好了安装命令、四个提问模板和一套 `REA-TASK.md` 工作流。

我照着做了一遍——然后发现海报上有三个字是错的。

这篇文章记录把 REA 真正接进 DeepSeek Harness 的完整过程：补装 Node、绕过 npm 的同名包陷阱、一条命令完成 MCP 注册与技能安装，以及最后那份「这台机器上到底能干什么」的诚实清单。

## 一、先纠正海报上的三个错

| 海报写的 | 实际是 | 说明 |
| --- | --- | --- |
| `npx -y rea@latest bootstrap` | `npx rea-agents@latest setup` | 包名不同 |
| `github.com/noruto/rea` | `github.com/morluto/rea` | 一个字母 |
| `--client claude-code` | `--client dsh` | 原生支持 |

第一行的坑最值钱：npm 上的 `rea` 是 2011 年的无关包（描述是 "a fancy wrapper over connect.router"），真正的包叫 `rea-agents`。

顺手记一下 npm 查询方式，避免再被同名包骗：

```powershell
Invoke-RestMethod https://registry.npmjs.org/rea/latest | Select-Object name,version,description
# name: rea / version: 0.0.1 / Rea is a fancy wrapper over connect.router   ← 不是它

Invoke-RestMethod https://registry.npmjs.org/rea-agents/latest | Select-Object name,version
# name: rea-agents / version: 6.8.0   ← 是它
```

## 二、REA 到底是什么

不是 DSH 插件包，所以 `dsh plugin add` 那套用不上。它由两部分组成：

1. **一个本地 MCP 服务**：`rea mcp` 通过 stdio 暴露 229 个工具，覆盖原生二进制、.NET、JavaScript/Electron、浏览器 CDP、抓包、SQLite 等；
2. **一份技能（skill）**：告诉 agent「先问清楚目标、再取证、别猜」的调查方法论，装在 `~/.agents/skills/` 下由宿主自动发现。

接进 DSH 之后，整条链路是这样的：

```text
DSH Web GUI
   └─ dsh-mcp-client（宿主插件）
        └─ stdio ──► node.exe rea.mjs mcp        ← 229 个 mcp__rea__* 工具
             ├─ Ghidra / IDA / Hopper（原生反编译，可选）
             ├─ 静态解析器（JS、.NET、PE/ELF、Go/Rust/IL2CPP…）
             └─ 浏览器 CDP / Frida / GDB（运行时观察，可选）
```

分析全部在本机完成，不上传目标文件。这一点在动手之前最好先确认——涉及别人的软件时，合规边界比工具本身重要。

## 三、前置检查：这台机器差在哪

先盘点环境，不急着敲命令：

| 项目 | 实际情况 | 结论 |
| --- | --- | --- |
| DSH | `0.2.1-rc.5` | 满足 |
| `DSH_HOME` | `C:\Users\YanQiu\.dsh` | 注册落点 |
| Node | 无 | 缺 |
| npm / npx | 无 | 缺 |
| DSH 自带 Node | `v24.21.0` | 不够 |
| REA 要求 | 22.23.4+ / 24.22.1+ / 26.12.1+ | 差一格 |

DSH 自带的那份 Node 藏在 `resources\runtime\primary-runtime\dependencies\node\bin\node.exe`，但它没有 npm，版本也刚好卡在门槛下面一格。所以第一步不是装 REA，是装一个合格的 Node。

## 四、第一步：装一个够新的 Node（不动 PATH）

选官方 zip 便携版，解压到用户目录，全程不碰系统 PATH——这样不会影响机器上其他依赖 Node 的东西，出问题也只需要删一个文件夹。

```powershell
$ProgressPreference = 'SilentlyContinue'
$url  = 'https://nodejs.org/dist/v24.22.2/node-v24.22.2-win-x64.zip'
$zip  = "$env:TEMP\node-v24.22.2-win-x64.zip"
$dest = "$env:LOCALAPPDATA\Programs\nodejs"

Invoke-WebRequest $url -OutFile $zip -TimeoutSec 300
Expand-Archive $zip -DestinationPath "$env:TEMP\node-extract" -Force
New-Item -ItemType Directory -Force -Path $dest | Out-Null
Copy-Item "$env:TEMP\node-extract\node-v24.22.2-win-x64\*" $dest -Recurse -Force

& "$dest\node.exe" -v    # v24.22.2
& "$dest\npm.cmd"  -v    # 11.19.1
```

为什么是 24.22.2 而不是「最新的 26」：REA 对 26.x 要求 ≥ 26.12.1，而 24.22.2 是当时最新的 24 LTS 补丁版，刚好越过 24.22.1 的门槛，也最省心。

## 五、第二步：全局装 rea-agents，别用 npx

```powershell
$node = "$env:LOCALAPPDATA\Programs\nodejs"
& "$node\npm.cmd" install -g rea-agents --no-fund
# added 150 packages in 3m

& "$node\rea.cmd" --version
# 6.8.0
```

这里有个小细节：这个便携版 Node 的全局 prefix 就是 Node 目录本身（`npm prefix -g` 会输出 `...\Programs\nodejs`），所以 `rea.cmd` 直接落在 `...\nodejs\` 下，入口脚本是 `node_modules\rea-agents\scripts\rea.mjs`。后面注册 MCP 时，REA 会把这两个绝对路径写进配置，完全不依赖 PATH。

至于为什么不用 `npx`：REA 文档明确提醒，通过包运行器安装的注册会指向缓存路径，缓存一清、升级一换，服务就起不来了。全局安装有固定的入口，之后还能用 `rea update` 自我升级。

## 六、第三步：一条命令把 REA 接进 DSH

REA 的 setup 是事务式的：先预览，再应用。**先看它打算改什么**：

```powershell
& "$node\rea.cmd" setup --client dsh --dry-run --json
```

输出里有两条动作，正是我们要的：

```json
{
  "status": "planned",
  "plannedActions": [
    {
      "kind": "configure_client",
      "target": "C:\\Users\\YanQiu\\.dsh\\cordis.patch.yml",
      "detail": "Add the REA MCP registration for DeepSeek Harness..."
    },
    {
      "kind": "install_skill",
      "target": "C:\\Users\\YanQiu\\.agents\\skills\\reverse-engineer-anything"
    }
  ]
}
```

确认无误，去掉 `--dry-run`：

```powershell
& "$node\rea.cmd" setup --client dsh --yes --json
# status: ready
# appliedActions: ["configured_dsh", "installed_skill"]
```

它做了两件事。

### 1. 往 home patch 里插一条 MCP 注册

写入 `C:\Users\YanQiu\.dsh\cordis.patch.yml`：

```yaml
- insert:
    - id: rea-mcp
      name: "@deepseek-ai/dsh-mcp-client"
      config:
        serverName: rea
        transport: stdio
        command: C:\Users\YanQiu\AppData\Local\Programs\nodejs\node.exe
        args:
          - C:\Users\YanQiu\AppData\Local\Programs\nodejs\node_modules\rea-agents\scripts\rea.mjs
          - mcp
```

注意这是 **home patch**（`$DSH_HOME/cordis.patch.yml`），不是某个 profile 的 patch。DSH 的规则是 home patch 对所有 profile 生效，所以一次注册，tui / web / desktop 全都有 REA。

如果哪天手滑改成「绝对路径 + `npx`」的写法，就会出现「终端里 doctor 全绿、客户端里 server is disconnected」的经典事故——REA 的 doctor 只看配置文件，不看客户端实际拿到的启动环境。

### 2. 装技能

落点是 `C:\Users\YanQiu\.agents\skills\reverse-engineer-anything\`：

```text
SKILL.md                      35 KB
references/android-applications.md
references/connection-and-recovery.md
references/environments.md
references/evidence-workflows.md
references/javascript-applications.md
references/native-and-artifacts.md
references/runtime-observation.md
```

这是 DSH 的共享技能目录（`DSH_AGENTS_HOME`，默认 `~/.agents`），宿主会自己扫出来。技能本身不提供能力，提供的是纪律：先问清楚要逆向什么、证据在哪里、哪些结论只能算推断。

## 七、第四步：验证到看见「229」

先跑官方体检：

```powershell
& "$node\rea.cmd" doctor --client dsh --json
```

关键两行：

```text
node              True   24.22.2
registration:dsh  True   C:\Users\YanQiu\.dsh\cordis.patch.yml
```

再回到 DSH 会话里看：工具列表里已经出现 `mcp__rea__*`。随手调一个无目标的 `binary_session`，它会把服务端身份、协议版本、工具清单一并报回来：

```json
{
  "server_identity": {
    "package": { "name": "rea-agents", "version": "6.8.0" },
    "server":  { "name": "rea", "version": "6.8.0" },
    "client":  { "name": "dsh-mcp-client" },
    "negotiated_protocol_version": "2026-07-28"
  },
  "catalog": { "counts": { "cli_commands": 175, "mcp_tools": 229, "mcp_prompts": 6 } }
}
```

229 个工具、6 个 prompt、协议协商成功——到这里才算真的接通了，而不只是「配置写对了」。

顺带说一句：这次是**热生效**的。写完 patch 后没有重启 DSH，工具就直接出现在会话里了。官方文档仍然建议重启 Harness，所以如果工具没出现，先重启一次再排查。

## 八、能干什么：Windows 下的诚实清单

「229 个工具」听着唬人，但很多在 Windows 上是用不了的。按 `binary_session` 自己的能力报告整理如下：

| 能力 | 状态 | 备注 |
| --- | --- | --- |
| JavaScript / Electron 静态分析 | ✅ | 含 ASAR，零引擎 |
| .NET / PE 元数据与 CIL | ✅ | 纯静态 |
| PE / ELF / Go / Rust / Python 制品 | ✅ | 结构级 |
| 浏览器 / Electron 运行时（CDP） | ✅ | 需调试端口 |
| HAR / pcap / SQLite | ✅ | 离线 |
| Frida / GDB / Rizin | ✅ | 需自备工具 |
| x86/x64 伪代码反编译 | ✅ | Ghidra 12.1.4 |
| Android APK 反编译 | ❌ | 需 JADX |
| macOS / Linux 专属工具 | ❌ | 平台不符 |

也就是说：**静态看 JS、看 .NET、看容器结构，开箱就能用；原生伪代码也已经补上了——见下一节。**

## 九、补上 Ghidra：让原生伪代码跑起来

静态分析够应付大多数场景，但真到「这段汇编到底在算什么」，还是得请反编译引擎。REA 支持 Ghidra 12.x，Windows 上走它自己的 P0 通道（只读、仅原生 PE）。补装只多两个组件：

- **Ghidra 12.1.4 PUBLIC**（543 MB，实测版本）
- **Temurin JDK 21**（196 MB）

### 1. 解压并确认三件套

```powershell
$ghidra = "C:\01_SOFTWARE\12_Tool\Ghidra"
$java   = "C:\01_SOFTWARE\12_Tool\Java"
Add-Type -AssemblyName System.IO.Compression.FileSystem
[IO.Compression.ZipFile]::ExtractToDirectory("$env:TEMP\ghidra.zip", $ghidra)
[IO.Compression.ZipFile]::ExtractToDirectory("$env:TEMP\jdk21.zip", $java)
```

先单独体检，确认 Ghidra 版本、headless 启动器、原生反编译器、JDK 四项都在：

```powershell
$env:GHIDRA_INSTALL_DIR = "C:\01_SOFTWARE\12_Tool\Ghidra\ghidra_12.1.4_PUBLIC"
$env:JAVA_HOME          = "C:\01_SOFTWARE\12_Tool\Java\jdk-21.0.13+9"

rea doctor --provider ghidra --json
```

```text
[True] ghidra-version           12.1.4
[True] ghidra-headless          ...\support\analyzeHeadless.bat
[True] ghidra-native_decompiler ...\os\win_x86_64\decompile.exe
[True] ghidra-java              21.0.13; 64-bit; JDK
[True] ghidra-native_authority  Verified Windows native Job Object, private DACL ...
```

### 2. 把环境变量写进 MCP 注册

这是最容易翻车的一步：`rea doctor` 通过**只代表终端里能用**。MCP 服务是 DSH 拉起的另一个进程，环境变量必须写进注册本身。带上三个变量重跑 setup，它会自己合并进 patch：

```powershell
$env:REA_ANALYSIS_PROVIDER = "ghidra"
rea setup --client dsh --yes
```

```yaml
        env:
          GHIDRA_INSTALL_DIR: C:\01_SOFTWARE\12_Tool\Ghidra\ghidra_12.1.4_PUBLIC
          JAVA_HOME: C:\01_SOFTWARE\12_Tool\Java\jdk-21.0.13+9
          REA_ANALYSIS_PROVIDER: ghidra
```

然后手动补一行超时配置——**冷启动时 Ghidra 的导入会超过 MCP 客户端默认的 60 秒**，REA 自己的启动预算是 330 秒，setup 不会替你写这一项：

```yaml
        toolCallTimeoutMs: 300000
```

改完 patch，宿主会热重载 MCP 客户端，不用重启。

### 3. 拿一个 14 KB 的小程序验收

挑 `hostname.exe` 当靶子（复制一份到工作区的临时目录，避免直接动系统目录）：

```text
用 REA 打开 .agent\tmp\rea-test\hostname.exe，反编译 0x140001234
```

这次真出了伪代码：

```c
undefined8 FUN_140001234(undefined4 *param_1, wchar_t *param_2, uint param_3)
{
  int iVar1;

  if (param_3 < 0x4f) {
    iVar1 = _wcsicmp(param_2, L"Unicode");
    if (iVar1 == 0) { return 1; }
    iVar1 = _wcsicmp(param_2, L"Ansi");
    if (iVar1 == 0) { *param_1 = 0; }
    else if (_wcsicmp(param_2, L"UTF8") == 0) { *param_1 = 0xfde9; }
  }
  return 0;
}
```

一个解析代码页参数的小函数，从二进制里被完整还原了出来。`list_procedures` 同时报回了 `entry`、`__security_check_cookie`、`_ValidateImageBase` 这些被 Ghidra 自动识别的函数，说明分析不是「跑通了但没结果」。

两个边界记一下：Windows P0 只认**原生非托管 PE**（x86 / x64 / ARMNT / ARM64）和 6502 镜像，.NET 走单独的静态通道；第一次导入会慢到像卡死，300 秒超时就是给它留的。

## 十、三个立刻能用的姿势

**让 agent 自己选工具**（推荐，技能会约束它先取证再下结论）：

```text
用 REA 分析 C:\path\to\app 这个 Electron 应用，
找出它的自动更新逻辑，把关键函数和证据贴出来。
```

**命令行直接跑静态分析**（不经过 agent，适合脚本化）：

```powershell
& "$node\rea.cmd" analyze-javascript-application "C:\path\to\app" --json
```

**观察运行中的页面**（需要先开 CDP 端口）：

```text
用 REA 连接 127.0.0.1:9222 上的页面，点击「导出」按钮，
记录发出的网络请求和触发的脚本。
```

## 十一、排错清单

按出现频率排：

1. **会话里没有 `mcp__rea__*`** —— 工具注册晚于会话启动。重启 DSH 再试一次。
2. **`server is disconnected`** —— 启动命令路径错，或 node 版本被引擎拒绝。在终端复现：`rea mcp doctor --json`，然后回头检查 patch 里的绝对路径。
3. **工具在，但全报 provider 不可用** —— 没配 Ghidra / IDA / JADX。按第八节补引擎，或改用静态能力。
4. **`rea doctor` 全绿，客户端却连不上** —— doctor 只读配置文件，不重放客户端的启动环境。检查客户端实际拿到的 PATH 与启动命令。
5. **升级后行为变了** —— `rea update` 之后记得重新跑 `rea setup --client dsh --yes` 刷新注册。

## 十二、升级、卸载与回滚

```powershell
# 升级
& "$node\rea.cmd" update

# 刷新 DSH 注册（升级后建议重跑一次）
& "$node\rea.cmd" setup --client dsh --yes

# 卸载 REA 的注册（会扫描所有已支持的客户端）
& "$node\rea.cmd" uninstall
```

`uninstall` 只清理注册，技能目录需要自己确认后删除；我一般留着——里面的 `references/` 是有价值的调查方法论，跟具体版本无关。

回滚很干净：删掉 `~\.dsh\cordis.patch.yml` 里的 `rea-mcp` 条目，删掉 `~\.agents\skills\reverse-engineer-anything`，再删掉 Node、Ghidra、JDK 三个目录，机器就回到没装过的状态。

## 十三、最后：工具的边界

装完之后我最先做的事，是拿它读了一遍自己写的 DSH 插件——当然，那是我自己的代码。

REA 的能力边界其实很清晰：它把「读代码、连调用、看运行时」的脏活变成可调用的工具，但它不替你判断哪段逻辑值得看，也不保证结论正确。所有返回值都标了证据等级和覆盖范围，剩下的推理还是得自己来。

海报上那句「REVERSE ENGINEER ANYTHING」听着像万能钥匙。真实的版本更朴素：

> 它能帮你更快地看见代码，但「看懂」这件事，仍然属于你。

用之前记得看一眼仓库里的 [DISCLAIMER](https://github.com/morluto/rea/blob/main/DISCLAIMER.md)——只分析你拥有或被授权的软件。这条线，比任何工具配置都重要。
