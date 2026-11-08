# 生命线 · Lifeline（网页版）

《生命线》（Lifeline, 3 Minute Games / Big Fish Games）的非商业同人网页移植：把原作的
“消息式叙事”还原成浏览器里的聊天界面，用消息节奏推进剧情，而不是一次性读完。

- 线上：<https://yenchiu.com/chat/apps/lifeline-web/>
- 入口：<https://yenchiu.com/chat/play.html?a=lifeline>
- 原作：Lifeline v2.3.3（Android, `com.threeminutegames.lifeline.google`）

## 功能

- **故事引擎**：解析原作 `StoryData_*.txt` 的 Twine 风格 DSL（段落、`<<set>>`、`<<if>>`/`<<elseif>>`/`<<else>>`、
  `<<choice>>`、`[[delay 30s|目标]]`、`<<silently>>`、`<<textinput>>`）。
- **逐字输出**：泰勒的消息逐字出现，等待时显示“正在输入”。点击正文、按空格或回车可跳过。
- **键盘操作**：数字键 `1`–`9` 选择对应选项；`Esc` 关闭弹窗；空格/回车跳过打字。
- **多语言**：中文、English、Español、Français、日本語、한국어、Deutsch、Русский（剧情与文案来自原包 assets）。
  切换语言会重新载入故事，进度按段落名迁移；新语言里缺该段落时回到开头。
- **选择点回溯**：每个选择点都会记下当时的变量与位置，可在“更多 → 回溯”里回到任意一个选择点重选。
- **词典**：正文里的专有名词（泰勒、瓦里亚号、黑烟……）带虚线下划线，点开看释义；“更多 → 词典”可搜索。
  词条数据在 `data/glossary_cn.json`，释义取自剧情原文。
- **存档**：自动存档 + 3 个手动槽位 + 文件导入/导出 + 进度码（`LL2z.` 开头，压缩后约 500 字符，
  不含聊天记录，适合跨设备继续）。
- **云存档（可选）**：把存档传到自己的 GitHub Gist（私密），或生成带 `?gist=<id>` 的分享链接。
  需要自备 Personal Access Token（只需 `gist` 权限），令牌默认不落盘，勾选“记住”才保存在本机。
- **系统通知**：页面在后台时，新消息与“等待结束”会弹一条本地通知（需授权，不上传）。
- **离线可安装**：PWA。首次打开后核心资源缓存到本机，断网也能继续；支持“安装到桌面”。
- **本机统计**：游玩次数、收到消息、选择数、到访段落、结局数，只存在本机，可一键清除。

## 操作

| 操作 | 方式 |
| --- | --- |
| 选择回复 | 点击选项，或按数字键 |
| 跳过逐字 | 点击正文 / 空格 / 回车 |
| 快进 | 顶栏“快进”：压缩等待时间（最长 4 秒） |
| 存档 | 顶栏“存档”：槽位、文件、进度码 |
| 语言 / 回溯 / 词典 / 通知 / 云存档 / 统计 | 顶栏“更多” |
| 重开 | 顶栏“重开”（会清空自动存档） |

## 目录

```
index.html            页面骨架（开场、聊天、存档弹窗、更多弹窗）
css/app.css           深空主题、气泡、弹窗、响应式
js/engine.js          DSL 解析与求值（纯函数，无 DOM）
js/app.js             执行器、界面、存档、回溯、词典、通知、Gist、统计
js/save.js            存档格式、校验、进度码编解码、文件读写
sw.js                 Service Worker：代码网络优先，数据/素材缓存优先
manifest.webmanifest  PWA 清单
data/story_*.txt      8 种语言的剧本（原包 assets 抽取）
data/strings_*.xml    8 种语言的文案表
data/glossary_cn.json 中文词典
assets/               字体、背景、按钮与音频（取自原包）
```

## 本地运行

页面用 ES module + `fetch` 读取数据，**不能直接双击 `index.html`**，需要起一个静态服务器：

```powershell
cd chat/apps/lifeline-web
python -m http.server 8100 --bind 127.0.0.1
# 打开 http://127.0.0.1:8100/
```

改代码后普通刷新即可（Service Worker 对 html/js/css 走网络优先）；如果刚更新过 `sw.js`，
可能需要再刷新一次让新版本接管。

## 存档位置

全部在浏览器 `localStorage`（同源）：

| 键 | 内容 |
| --- | --- |
| `lifeline.web.save.v2` | 自动存档 |
| `lifeline.web.slot.v2.1` … `.3` | 三个手动槽位 |
| `lifeline.web.prefs.v1` | 快进 / 声音 / 通知偏好 |
| `lifeline.web.lang.v1` | 语言 |
| `lifeline.web.stats.v1` | 本机统计 |
| `lifeline.web.gist.v1` | 仅当勾选“记住令牌”时保存 |

## 隐私

- 剧情、存档、统计全部在浏览器本地，不上传。
- 系统通知由页面本地触发，不经过服务器。
- 云存档只在你主动点击时调用 GitHub Gist API；令牌只用于该请求。
- 站点不使用第三方分析脚本。

## 已知限制

- 界面文案目前只有中文与英文两套；选择其他语言时，剧情是该语言，界面回落到英文。
- 词典目前只收中文词条；其他语言下不显示词条下划线。
- 原作的 Wear 手表端、后台闹钟与通知排程没有移植；网页版的“等待”在页面打开时计时。
- 移动端浏览器通常要求先有一次点击才允许播放音频，开场按钮即用于此。

## 版权

剧情与美术版权归 3 Minute Games / Big Fish Games 所有。本页为非商业同人移植，供学习与个人游玩，
不含破解、去广告或内购绕过。若权利方要求，会立即下线。
