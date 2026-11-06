#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""用 Chrome 无头模式把排版母版打成 A4 PDF。

为什么打母版而不是 _journal/*.html：
  _journal 文档只保留 <body> 内容，版面尺寸靠 assets/css/journal.css；
  母版自带 <style>（@page A4 / 12.2 cm 版心 / 10 pt 正文），打印结果就是刊物 PDF。
  两者是同一份正文，所以 PDF 与网页逐字一致——用 verify-parity.py 复核。

用法（仓库根目录）：
    python bin/journal/print-pdf.py
    python bin/journal/print-pdf.py --slug 2026-01-multimodal-vision --out D:\\tmp\\a.pdf
"""
import argparse
import hashlib
import os
import shutil
import subprocess
import sys
import time

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

CHROME_CANDIDATES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
]


def find_chrome():
    for p in CHROME_CANDIDATES:
        if os.path.exists(p):
            return p
    found = shutil.which("chrome") or shutil.which("chrome.exe")
    if found:
        return found
    sys.exit("找不到 Chrome/Edge，请用 --chrome 指定可执行文件路径")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--slug", default="2026-01-multimodal-vision")
    ap.add_argument("--out", default="")
    ap.add_argument("--chrome", default="")
    args = ap.parse_args()

    src = os.path.join(ROOT, "bin", "journal", "src", args.slug + ".src.html")
    if not os.path.exists(src):
        sys.exit("母版不存在: " + src)
    out = args.out or os.path.join(ROOT, "bin", "journal", "out", args.slug + ".pdf")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    if os.path.exists(out):
        os.remove(out)

    chrome = args.chrome or find_chrome()
    url = "file:///" + src.replace("\\", "/")
    cmd = [chrome, "--headless=new", "--disable-gpu", "--no-sandbox",
           "--disable-crash-reporter", "--no-pdf-header-footer",
           "--print-to-pdf=" + out, url]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    for _ in range(40):
        if os.path.exists(out) and os.path.getsize(out) > 0:
            break
        time.sleep(0.25)
    if not os.path.exists(out):
        sys.exit("未生成 PDF（Chrome 可能崩溃，检查 --no-sandbox / 杀毒软件）: " + out)

    data = open(out, "rb").read()
    print("OK %s  %s bytes  sha256=%s"
          % (os.path.basename(out), format(len(data), ","), hashlib.sha256(data).hexdigest()))


if __name__ == "__main__":
    main()
