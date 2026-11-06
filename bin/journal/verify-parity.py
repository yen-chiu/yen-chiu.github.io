#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""逐字复核：发布用 PDF 与站上页面是否一字不差。

判定方式
  1) 两侧都去掉空白与不可见字符后，字符数必须相等；
  2) 字符多重集必须相等 —— 顺序差异允许，因为公式编号、图注等是绝对定位块，
     PDF 文本流里会晚于正文出现，而 DOM 顺序里在原位；
  3) 报告最多 3 处顺序差异的位置，便于人工确认它们确实只是块的重排。

用法（仓库根目录，先 `bundle exec jekyll build`）：
    python bin/journal/verify-parity.py <PDF 路径> [页面 HTML 路径]

默认页面路径：_site/journal/<slug>/index.html
依赖：pip install pypdf
"""
import io
import os
import re
import sys
import unicodedata
from collections import Counter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

# Chrome 用数学字体排 ‖ (U+2016) 时，PDF 的 ToUnicode 会映射回 ǁ (U+01C1)。
# 同一个字形两种码位，不是文字差异。
GLYPH_ALIASES = {"\u01c1": "\u2016"}


def squeeze(s):
    s = unicodedata.normalize("NFC", s)
    s = re.sub(r"[\s\u00a0\u200b\ufeff]+", "", s)
    for k, v in GLYPH_ALIASES.items():
        s = s.replace(k, v)
    return s


def main(argv):
    if len(argv) < 2:
        sys.exit(__doc__)
    pdf_path = argv[1]
    page_path = argv[2] if len(argv) > 2 else os.path.join(
        ROOT, "_site", "journal", "2026-01-multimodal-vision", "index.html")

    try:
        from pypdf import PdfReader
    except ImportError:
        sys.exit("需要 pypdf：pip install pypdf")

    if not os.path.exists(pdf_path):
        sys.exit("PDF 不存在: " + pdf_path)
    if not os.path.exists(page_path):
        sys.exit("页面不存在（先构建站点）: " + page_path)

    reader = PdfReader(pdf_path)
    pdf_text = squeeze("".join((p.extract_text() or "") for p in reader.pages))

    html = io.open(page_path, encoding="utf-8").read()
    m = re.search(r'<article class="yb-sheet">([\s\S]*?)</article>', html)
    if not m:
        sys.exit("在页面里找不到 <article class=\"yb-sheet\">: " + page_path)
    sheet = re.sub(r"<style[\s\S]*?</style>", " ", m.group(1))
    sheet = re.sub(r"<script[\s\S]*?</script>", " ", sheet)
    page_text = squeeze(re.sub(r"<[^>]+>", " ", sheet))

    lines = ["PDF  : %s（%d 页）" % (os.path.basename(pdf_path), len(reader.pages)),
             "HTML : %s" % os.path.relpath(page_path, ROOT),
             "",
             "pdf_chars =%d" % len(pdf_text),
             "html_chars=%d" % len(page_text),
             "length_equal   = %s" % (len(pdf_text) == len(page_text))]

    c_pdf, c_page = Counter(pdf_text), Counter(page_text)
    same = c_pdf == c_page
    lines.append("multiset_equal = %s" % same)
    if not same:
        lines.append("  只在 PDF  : %r" % "".join(sorted((c_pdf - c_page).elements()))[:300])
        lines.append("  只在 HTML : %r" % "".join(sorted((c_page - c_pdf).elements()))[:300])

    diffs = []
    i = 0
    n = min(len(pdf_text), len(page_text))
    while i < n and len(diffs) < 3:
        if pdf_text[i] != page_text[i]:
            diffs.append(i)
            i += 40
        else:
            i += 1
    lines.append("")
    lines.append("顺序差异位置（绝对定位块造成，最多 3 处）: %s" % (diffs or "无"))
    for d in diffs:
        lines.append("  @%d  pdf=%r  html=%r"
                     % (d, pdf_text[max(0, d - 12):d + 12], page_text[max(0, d - 12):d + 12]))

    ok = same and len(pdf_text) == len(page_text)
    lines.append("")
    lines.append("verdict = %s" % ("PASS" if ok else "FAIL"))
    print("\n".join(lines))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
