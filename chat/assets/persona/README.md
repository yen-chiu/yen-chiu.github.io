# 站内人格：念真

`nianzhen.json` 是这个站「念真」的性格模块——她的经历、脾气、说话方式、边界。
改了它，下次打开页面就生效，不需要改代码。

## 谁在用

只有 `persona === 'nianzhen'` 时，`js/ai.js` 才会：

- 拉这个文件，拼进 system 提示词；
- 注入「站里最近写过什么」和这次话题相关的站内文章；
- 注入「她记得的事」（浏览器 localStorage）；
- 在工具模式下多给 `site_search` / `site_read` / `remember` 三个工具。

选「通用助手」或「写代码的」时，上面这些一个都不发生——它们拿到的是几十个字的干净提示词。

## 字段

| 字段 | 作用 |
| --- | --- |
| `avatar` | 头像图片路径（相对 `chat/`），例如 `img/persona/nianzhen.svg`；不填就用文字缩写 |
| `origins` | 经历。花名来历、爱好、手艺，写成事实，别写成形容词 |
| `traits` | 性子。写成会表现在对话里的倾向，不要"善良可爱"这种空话 |
| `voice.rhythm` | 句子长短和节奏 |
| `voice.signature` | 口头禅，提示词里会原样列出 |
| `voice.pacing` | 先说什么、后说什么 |
| `voice.avoid` | 明确不要的东西（列表、客服腔、编造细节） |
| `boundaries` | 硬边界：不冒充全知、承认是模型、不泄露 Key、不替站主许诺 |
| `memorySeeds` | 预留：以后如果要"出厂自带"的记忆，放这里（现在没用到） |

## 记忆怎么工作

- 存在 `localStorage` 的 `wd.ai.memory`，按条存 `{text, ts}`，上限 120 条。
- 每次对话取「最近 8 条」+「和这次问题相关的老记忆」塞进提示词，最多 12 条。
- 模型只有在工具模式下才会主动调 `remember` 记东西；不记就不会长。
- 设置面板里能看到条数和最近两条，也能一键清空。

## 站内资料怎么来
- 索引：`/assets/js/data/search.json`，由 Jekyll 从全部文章生成（标题、链接、分类、摘要、正文）。
- 检索：中文按二元组切词，按词的稀有度加权（"AI"这种满站都是的词会被压低）。
- `site_read` 只允许读本站页面，正文截断到 2400 字。
- `site_query` 做统计：按月份/标签/分类汇总篇数与字数，或按标签、分类、日期区间列文章明细。问「一共几篇」「哪个月写得多」这类问题走它，数字都从索引里算，不靠模型估。

## 联网搜索与读网页

`web_search` 按「自建接口 → 维基百科 → DuckDuckGo 摘要」的顺序降级：

- 自建接口：设置里的「联网搜索接口」，SearXNG 或 `tools/worker` 的 `/search` 都行；
- 维基百科：`origin=*` 允许浏览器跨域，不用配任何东西就能用；
- DuckDuckGo：`api.duckduckgo.com` 的即时摘要，作为最后的兜底。

`web_read` 需要一个读取代理，把网页转成纯文本（默认 `https://r.jina.ai/`）：
浏览器直接抓别家网页会被 CORS 挡住，这一步绕不开。自建就用 `tools/worker` 的 `/read?url=`。

每一家的失败原因都会带回结果里（例如「维基百科：HTTP 429」），方便看清是哪一层不通。

## 技能库（能力库）

技能清单在 [`skills/skills.json`](../../skills/skills.json)，不写在代码里。每条长这样：

```json
{
  "id": "site_query",
  "name": "站内统计",
  "icon": "📊",
  "summary": "一句话说明，会显示在设置面板",
  "description": "给模型看的说明，决定它什么时候调用",
  "personas": ["nianzhen"],
  "parameters": { "type": "object", "properties": {} }
}
```

- `personas` 决定谁能用：填 `["nianzhen"]` 就只有站内人格拿得到，填 `["*"]` 所有人都能用。
- `parameters` 是标准的 JSON Schema，客户端直接把它当工具的 `parameters` 交给模型。
- 加一条就是加一个技能；执行逻辑按 `id` 在 `js/ai.js` 的 `runTool` 里接。
- 设置面板的「能力库」会列出全部技能和当前状态（已启用 / 待开工具 / 不可用）。
- `skills.json` 读不到时，客户端会退回内置的工具清单，功能不至于全丢。
