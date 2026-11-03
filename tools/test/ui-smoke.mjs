/**
 * 写作台 UI 冒烟测试
 * ---------------------------------------------------------------------------
 * 覆盖两个曾经出过问题、且单测覆盖不到的点：
 *   1. GFM 任务列表在预览里要渲染成 ☑ / ☐ 文本（而不是留下可点击的 input）
 *   2. OAuth 令牌过期（onAuthExpired）不能顺手清掉本地草稿——
 *      早先 clearConfig() 把草稿一起删了，等于用户在 8 小时后丢稿
 *
 * 前置与运行方式同 sanitize-xss.mjs：
 *   npm i puppeteer-core
 *   node tools/test/ui-smoke.mjs http://127.0.0.1:4000
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
await page.evaluate(() => {
  document.querySelector('#adm-body').dataset.view = 'preview';
});

// 1) 任务列表
await page.evaluate(() => {
  const t = document.getElementById('adm-content');
  t.value = '- [x] 已完成\n- [ ] 未完成\n';
  t.dispatchEvent(new Event('input', { bubbles: true }));
});
await new Promise((r) => setTimeout(r, 150));
const task = await page.evaluate(() => {
  const box = document.getElementById('adm-preview-inner');
  return { text: box.textContent.trim(), inputs: box.querySelectorAll('input').length };
});
const taskOk = task.text.includes('☑') && task.text.includes('☐') && task.inputs === 0;
console.log(`${taskOk ? 'PASS' : 'FAIL'} · 任务列表渲染为符号 (inputs=${task.inputs})`);

// 2) 过期不清草稿
await page.evaluate(() => {
  localStorage.setItem(
    'wx-admin-draft:_posts/test.md',
    JSON.stringify({ body: 'draft body', ts: Date.now() })
  );
  localStorage.setItem(
    'wx-admin-config',
    JSON.stringify({
      token: 'ghu_x',
      owner: 'yen-chiu',
      repo: 'yen-chiu.github.io',
      branch: 'master',
      source: 'oauth',
      expires_at: Date.now() - 1000
    })
  );
});
await page.reload({ waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 400));
const drafts = await page.evaluate(() =>
  Object.keys(localStorage).filter((k) => k.startsWith('wx-admin-draft:'))
);
console.log(`${drafts.length === 1 ? 'PASS' : 'FAIL'} · 令牌过期后草稿仍在 (${drafts.length})`);

await browser.close();
process.exitCode = taskOk && drafts.length === 1 ? 0 : 1;
