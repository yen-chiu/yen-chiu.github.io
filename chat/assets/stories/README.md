# 剧本格式

`night-radio.json` 是「凌晨两点十七分」的全部内容。改这个文件就能改故事，不需要构建、不需要重新编译。

想加一个新故事：复制一份 JSON，在 `game.html` 里把 `STORY_URL` 指过去（或者用 `?story=` 的思路做个选择页），再跑一遍 `node tools/check-story.mjs 新文件.json`。

## 结构

```json
{
  "meta": {
    "id": "night-radio",
    "title": "凌晨两点十七分",
    "subtitle": "……",
    "start": "n0",
    "minutes": 12,
    "endingCount": 4
  },
  "vars": { "close": 0, "truth": false },
  "endings": {
    "e_dawn": { "title": "天亮之前", "summary": "…", "quote": "…", "hint": "怎么走到这里" }
  },
  "nodes": {
    "n0": {
      "time": "02:17",
      "messages": [
        { "who": "system", "text": "柚子 上线了" },
        { "who": "them", "text": "还醒着吗？" }
      ],
      "choices": [
        { "text": "在的，怎么了？", "goto": "n1", "set": { "close": "+=1" } },
        { "text": "……", "goto": "n3", "silent": true }
      ]
    }
  }
}
```

## 节点里能写什么

| 字段 | 说明 |
| --- | --- |
| `messages` | 这个节点依次弹出的消息。字符串等于「对方说了一句」。 |
| `time` | 可选，给这个节点打时间戳（界面会在第一条消息前插一行时间）。 |
| `choices` | 选项。没有选项时用 `next` 自动往下走。 |
| `next` | 自动跳转的下一个节点。 |
| `branch` | 条件跳转数组，按顺序取第一个满足的：`[{ "when": "close >= 3", "goto": "n9" }, { "goto": "n10" }]`。 |
| `set` | 进入节点时结算：`{ "close": "+=1", "truth": true }`。 |
| `end` | 这个节点就是结局，值是 `endings` 里的 key。 |

## 消息里能写什么

```json
{ "who": "them", "text": "还醒着吗？", "typing": 900 }
{ "who": "them", "image": "img/photo-1.jpg", "caption": "2016 · 天台" }
```

- `who`：`them`（对方）/ `me`（我，一般不用手写，选项会自动变成我的话）/ `system`（居中灰字）
- `typing`：可选，覆盖默认的「对方正在输入」时长（毫秒）
- `image` + `caption`：发一张图。路径相对站点根目录。

## 选项里能写什么

| 字段 | 说明 |
| --- | --- |
| `text` | 按钮上显示的那句话。默认也会作为「我」的气泡发出去。 |
| `line` | 可选，想显示得和按钮不一样时用。 |
| `goto` / `next` | 跳到哪个节点。 |
| `set` | 选完结算变量。 |
| `when` | 条件表达式，不满足就不显示这个选项。 |
| `silent` | `true` 表示这句话不算「我」说的（用于「……」这种）。 |

## 表达式

条件是一个安全的小解析器（不 `eval`），支持：

```
close >= 3
truth && close >= 4
!photo || close == 0
(close + 1) > 2
```

变量只能写数字、字符串、`true` / `false`。变量不存在的比较会得到 `false`。

## 变量写法

`set` 里可以直接给值，也可以写增量：

```json
{ "close": "+=1" }
{ "close": "-=1" }
{ "truth": true }
{ "name": "=柚子" }
```

## 自动检查

```bash
node tools/check-story.mjs
node tools/check-story.mjs assets/stories/别的剧本.json
```

会检查：跳转目标是否存在、条件能否解析、有哪些节点从开头走不到、随机试玩几百次能走到几个结局。
