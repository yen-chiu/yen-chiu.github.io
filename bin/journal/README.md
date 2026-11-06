# bin/journal —— 《余白》期刊的排版流水线

期刊文章有一个硬约束：**PDF 与网页必须逐字一致**。做到这一点的方式不是“两边各写一份、事后人工比对”，
而是**只有一份正文**（排版母版），PDF 与网页都是它的渲染产物。

```
bin/journal/src/<slug>.src.html      ← 排版母版（唯一正文来源，自带 <style>：A4 / 12.2 cm 版心 / 10 pt）
        │
        ├─ make-paper.py   →  _journal/<slug>.html   （Jekyll collection 文档，页面见 /journal/<slug>/）
        └─ print-pdf.py    →  bin/journal/out/<slug>.pdf （发布用 PDF，另存到 WendellManual 仓库）
                     │
                     └─ verify-parity.py  →  逐字复核 PDF 与站上页面
```

## 改一篇论文的正确顺序

1. 改 **母版** `bin/journal/src/<slug>.src.html`（不要直接改 `_journal/<slug>.html`，它会被覆盖）。
2. 若改了标题/摘要/关键词/页码等元数据，同时改 `make-paper.py` 里 `PAPERS[<slug>]`。
3. `python bin/journal/make-paper.py` —— 重新生成 collection 文档。
4. `python bin/journal/print-pdf.py` —— 重新打印 PDF。
5. `bundle exec jekyll build`，然后
   `python bin/journal/verify-parity.py bin/journal/out/<slug>.pdf` —— 必须 `verdict = PASS`。
6. 把 `bin/journal/out/<slug>.pdf` 复制到 WendellManual 仓库的 `assets/files/yubai/<slug>.pdf`
   （站点通过 `_data/journal.yml` 的 `docs_base` 指向那里；两个仓库要一起推，否则 PDF 按钮 404）。

## verify-parity.py 判什么

- 两侧去掉空白/不可见字符后**字符数相等**；
- **字符多重集相等**（顺序差异不计）；
- 之所以允许顺序差异：公式编号、图注等是绝对定位块，Chrome 的 PDF 文本流会把它们排到段落后，
  而 DOM 顺序里在原位。脚本会打印最多 3 处差异位置，供人工确认。
- 已知字形等价：公式里的 `‖`(U+2016) 用数学字体排版后，PDF 的 ToUnicode 会映射成 `ǁ`(U+01C1)，
  同一个字形两种码位，脚本里按别名处理。

依赖：`pip install pypdf`（只读 PDF 文本，不用 pymupdf）。

## 排版约定（改母版前先看一眼）

- 版心 12.2 cm = 345.75 pt。六张图都是 `viewBox="0 0 345 …"`，**1 用户单位 = 1 pt**，
  所以图内 `font-size="8"` 印出来就是 8 pt。
- 图与「表题 + 表格」各自包成**原子块**（`display: inline-block; width: 100%`），保证不跨页断裂；
  代价是页数会涨。改了图数/图高之后必须重打 PDF 并核对页码，刊头 `pages:` 与刊头里的 `pp.` 同步改。
- 图内字号≥8 pt 是交接包的验收线，重绘图后跑一次 `nature-figure` 的
  `scripts/audit_svg_schematic.py --min-pt 8 --max-pt 10 --max-width-mm 125`。
- 正文引用：图/表/公式/文献必须全部在正文里被引用，四类编号都要连续。
