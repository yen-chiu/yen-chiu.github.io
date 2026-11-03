/**
 * 预览净化（sanitize）回归测试 —— 12 条 XSS payload
 * ---------------------------------------------------------------------------
 * 背景：2026-11-03 的安全审计发现 `sanitize()` 原先用黑名单拦 URL 方案，
 * `<a href="java&#9;script:...">` 这类控制字符写法可以绕过（浏览器解析 URL 时
 * 会剥离 Tab/换行），点击即执行脚本、读出 localStorage 里的 GitHub 令牌。
 * 修复后本用例锁死这些变形，防止回归。
 *
 * 前置：
 *   1. 站点已构建并可在本地访问（`bundle exec jekyll serve` 或静态服务器）
 *   2. 安装 puppeteer-core：`npm i puppeteer-core`（不需要下载浏览器，用本机 Edge）
 *   3. 设置浏览器路径（默认走 Windows 上的 Edge）：
 *        PowerShell: $env:EDGE_PATH="C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
 *
 * 运行：
 *   node tools/test/sanitize-xss.mjs http://127.0.0.1:4000
 */

import { pathToFileURL } from 'node:url';

// 允许用环境变量指向任意一份 puppeteer-core（仓库本身不声明这个依赖）：
//   PUPPETEER_CORE=C:/path/to/node_modules/puppeteer-core
const puppeteerSpec = process.env.PUPPETEER_CORE || 'puppeteer-core';
const puppeteerUrl = /[\\/]/.test(puppeteerSpec) ? pathToFileURL(puppeteerSpec).href : puppeteerSpec;
const { default: puppeteer } = await import(puppeteerUrl);

const EDGE =
  process.env.EDGE_PATH ||
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = process.argv[2] || 'http://127.0.0.1:4000';

const PAYLOADS = [
  { name: '控制字符绕过（Tab 实体）', md: '<a href="java&#9;script:window.__xss=1">click</a>' },
  { name: '换行实体绕过', md: '<a href="java&#10;script:window.__xss=1">click</a>' },
  { name: '回车实体绕过', md: '<a href="&#13;javascript:window.__xss=1">click</a>' },
  { name: '大写 + 前导空白', md: '<a href="  JaVaScRiPt:window.__xss=1">click</a>' },
  { name: '直接 javascript:', md: '<a href="javascript:window.__xss=1">click</a>' },
  { name: 'img src javascript:', md: '<img src="javascript:window.__xss=1">' },
  { name: 'svg onload', md: '<svg onload="window.__xss=1"></svg>' },
  { name: 'iframe srcdoc', md: '<iframe srcdoc="<script>window.__xss=1</script>"></iframe>' },
  { name: 'onerror 属性', md: '<img src="x" onerror="window.__xss=1">' },
  { name: 'data:text/html 链接', md: '<a href="data:text/html,<script>window.__xss=1</script>">x</a>' },
  { name: 'srcset javascript', md: '<img srcset="javascript:window.__xss=1">' },
  { name: '协议相对 //evil.com', md: '<a href="//evil.example/x">x</a>' },
  { name: '正常站内链接（应保留）', md: '<a href="/posts/writing-studio/">ok</a>', expectKept: true }
];

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  args: ['--no-first-run', '--disable-gpu']
});
const page = await browser.newPage();
page.on('dialog', async (d) => {
  try {
    await d.accept();
  } catch (e) {
    /* ignore */
  }
});
await page.setViewport({ width: 1280, height: 900 });
await page.goto(BASE + '/admin/', { waitUntil: 'networkidle2' });

// 预览区在编辑视图下是 display:none，点击无效，先切到预览
await page.evaluate(() => {
  document.querySelector('#adm-body').dataset.view = 'preview';
});

const results = [];

for (const payload of PAYLOADS) {
  await page.evaluate(() => {
    window.__xss = 0;
    const t = document.getElementById('adm-content');
    t.value = '';
    t.dispatchEvent(new Event('input', { bubbles: true }));
  });

  await page.evaluate((md) => {
    const t = document.getElementById('adm-content');
    t.value = md;
    t.dispatchEvent(new Event('input', { bubbles: true }));
  }, payload.md);

  await new Promise((r) => setTimeout(r, 120));

  const dom = await page.evaluate(() => {
    const box = document.getElementById('adm-preview-inner');
    const a = box.querySelector('a');
    const img = box.querySelector('img');
    return {
      href: a ? a.getAttribute('href') : null,
      hasIframe: !!box.querySelector('iframe'),
      hasSvg: !!box.querySelector('svg')
    };
  });

  const link = await page.$('#adm-preview-inner a');
  if (link) {
    try {
      await link.click();
    } catch (e) {
      /* ignore */
    }
    await new Promise((r) => setTimeout(r, 150));
  }

  const xss = await page.evaluate(() => window.__xss || 0);
  const href = dom.href;
  const dangerous =
    href && /^\s*(javascript|data|vbscript):/i.test(href.replace(/[\u0000-\u0020\u007f]/g, ''));

  let pass;
  if (payload.expectKept) {
    pass = xss === 0 && href === '/posts/writing-studio/';
  } else {
    pass = xss === 0 && !dangerous && !dom.hasIframe && !dom.hasSvg;
  }

  results.push({ name: payload.name, pass });
  console.log(
    `${pass ? 'PASS' : 'FAIL'} · ${payload.name}` +
      `  (xss=${xss} href=${href === null ? 'null' : JSON.stringify(href)})`
  );
}

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} 通过`);
if (failed.length) {
  console.log('未通过：' + failed.map((f) => f.name).join('、'));
  process.exitCode = 1;
}
