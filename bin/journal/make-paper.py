#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""期刊排版流水线：把排版母版（bin/journal/src/*.src.html）转成 Jekyll collection 文档。

母版是唯一的正文来源：
  * 母版 -> _journal/<slug>.html            本脚本
  * 母版 -> 发布用 PDF（print-pdf.ps1，Chrome 无头打印）
两条产物都只是母版的渲染，因此「PDF 与 HTML 逐字一致」由来源唯一保证，
再由 verify-parity.py 做逐字复核。

用法（在仓库根目录）：
    python bin/journal/make-paper.py                     # 处理全部母版
    python bin/journal/make-paper.py 2026-01-multimodal-vision
"""
import io
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SRC_DIR = os.path.join(ROOT, "bin", "journal", "src")
OUT_DIR = os.path.join(ROOT, "_journal")

# 每篇母版的 front matter。母版本身不带 front matter（它是排版母版，不是页面）。
PAPERS = {
    "2026-01-multimodal-vision": {
        "title": "多模态视觉的机制、边界与前沿：从图像表示到统一 token 空间的综述",
        "title_en": "Mechanisms, Limits and Frontiers of Multimodal Vision: A Survey from Image "
                    "Representation to a Unified Token Space",
        "authors": "Wendell",
        "affiliation": "独立研究者 · yenchiu.com",
        "date": "2026-11-06",
        "received": "2026-11-06",
        "accepted": "2026-11-06",
        "volume": 1,
        "issue": 1,
        "year": 2026,
        "pages": "1–13",
        "issue_key": "multimodal-vision",
        "permalink": "/journal/2026-01-multimodal-vision/",
        "topic": "多模态视觉",
        "pdf": "yubai/2026-01-multimodal-vision.pdf",
        "license": "CC BY 4.0",
        "summary": "用四条线索拆开“模型长出了眼睛”这句话：图像如何变成 token、"
                   "对齐空间付了什么代价、三种连接范式如何把“看”变成“读上下文”，"
                   "以及为何编辑能力的天花板由理解而非生成决定。",
        "description": "综述多模态大模型中的图像 token 化、视觉—语言对齐与三种连接范式，"
                       "分析能力边界与评测失真。",
        "comments": True,
    }
}

TITLE = "{{ site.data.journal.title }}"


def convert(slug: str, meta: dict) -> str:
    path = os.path.join(SRC_DIR, slug + ".src.html")
    src = io.open(path, encoding="utf-8").read()

    body = src.split("<body>")[1].split("</body>")[0].strip()
    if "{{" in body or "{%" in body:
        sys.exit("母版正文里出现 Liquid token，拒绝继续：" + path)

    # 刊头：卷期页码改成 Liquid，改刊名/卷期只需改 _data/journal.yml 与 front matter
    mh = re.search(r'<div class="masthead">[\s\S]*?</div>', body)
    if not mh:
        sys.exit("masthead not found in " + path)
    body = body.replace(mh.group(0),
                        '<div class="masthead">\n'
                        '  <span>' + TITLE + ' · 第 {{ page.volume }} 卷 第 {{ page.issue }} 期'
                        '（{{ page.year }}）· pp. {{ page.pages }}</span>\n'
                        '  <span>开放获取 · {{ site.data.journal.license }}</span>\n'
                        '</div>')

    # 页脚：刊名/卷期同样 Liquid 化
    fn = re.search(r'<div class="footer-note">([\s\S]*?)</div>', body)
    if not fn:
        sys.exit("footer-note not found in " + path)
    inner = fn.group(1)
    new_inner = inner.replace("《余白》Margin · 卷 1 · 期 1",
                              TITLE + " · 卷 {{ page.volume }} · 期 {{ page.issue }}")
    if new_inner == inner:
        new_inner = inner.replace("《余白》Margin", TITLE)
    body = body.replace(inner, new_inner)

    abstract = re.search(r'<p class="abstract"><b class="lbl">摘要　</b>([\s\S]*?)</p>', body)
    kw = re.search(r'<p class="kw"><b>关键词　</b>([\s\S]*?)</p>', body)
    if not abstract or not kw:
        sys.exit("abstract/keywords not found in " + path)

    fm = [
        "---",
        "layout: paper",
        "title: " + meta["title"],
        'title_en: "%s"' % meta["title_en"],
        "authors: " + meta["authors"],
        "affiliation: " + meta["affiliation"],
        "date: " + meta["date"],
        "received: " + meta["received"],
        "accepted: " + meta["accepted"],
        "volume: %d" % meta["volume"],
        "issue: %d" % meta["issue"],
        "year: %d" % meta["year"],
        "pages: " + meta["pages"],
        "issue_key: " + meta["issue_key"],
        "permalink: " + meta["permalink"],
        "topic: " + meta["topic"],
        "pdf: " + meta["pdf"],
        "license: " + meta["license"],
        "summary: " + meta["summary"],
        "abstract: >-",
        "  " + re.sub(r"\s+", " ", abstract.group(1)).strip(),
        'keywords: "%s"' % kw.group(1).strip(),
        "description: " + meta["description"],
        "hide_panel: true",
    ]
    if meta.get("comments"):
        fm.append("comments: true")
    fm.append("---")
    return "\n".join(fm) + "\n\n" + body + "\n"


def main(argv):
    slugs = argv[1:] or list(PAPERS)
    os.makedirs(OUT_DIR, exist_ok=True)
    for slug in slugs:
        if slug not in PAPERS:
            sys.exit("unknown paper: " + slug)
        out = convert(slug, PAPERS[slug])
        dest = os.path.join(OUT_DIR, slug + ".html")
        io.open(dest, "w", encoding="utf-8", newline="\n").write(out)
        print("written %s  %d bytes" % (dest, len(out.encode("utf-8"))))


if __name__ == "__main__":
    main(sys.argv)
