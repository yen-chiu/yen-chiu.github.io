/**
 * 写作台文章列表抽屉（移动端）回归测试
 * ---------------------------------------------------------------------------
 * 覆盖 2026-11-03 修掉的三个问题：
 *   1. 点「新建」后抽屉不收起，编辑器被盖住且没有关闭入口
 *   2. 抽屉没有遮罩 / 没有 ✕ 按钮，进去出不来
 *   3. 新建后标题输入框在收起的「文章信息」里，focus 不生效
 *
 * 前置与运行方式同 sanitize-xss.mjs：
 *   npm i puppeteer-core       # 或 PUPPETEER_CORE 指向已有的一份
 *   node tools/test/admin-drawer.mjs http://127.0.0.1:4000
 *
 * 注意：写作台需要能连上 GitHub。本地跑测试时用一个 mock：
 *   ?api=http://127.0.0.1:4020  +  localStorage 里塞 test-token
 * 线上 /admin/ 出于安全**不接受** ?api= 指向外部，这是上一轮加固的结果。
 */

import { pathToFileURL } from 'node:url';

const puppeteerSpec = process.env.PUPPETEER_CORE || 'puppeteer-core';
const puppeteerUrl = /[\\/]/.test(puppeteerSpec) ? pathToFileURL(puppeteerSpec).href : puppeteerSpec;
const { default: puppeteer } = await import(puppeteerUrl);

const EDGE =
  process.env.EDGE_PATH ||
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = process.argv[2] || 'http://127.0.0.1:4000';
const API = process.env.MOCK_API || 'http://127.0.0.1:4020';

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} · ${name}${detail ? ' :: ' + detail : ''}`);
};

// 每个用例开始前重置 mock，避免上一次写入的内容干扰断言
try {
  await fetch(API + '/__reset');
} catch (e) {
  /* mock 没有 __reset 就忽略 */
}

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
await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
await page.setViewport({ width: 320, height: 780, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

await page.goto(`${BASE}/admin/?api=${API}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.evaluate(() => {
  localStorage.setItem(
    'wx-admin-config',
    JSON.stringify({
      token: 'test-token',
      owner: 'yen-chiu',
      repo: 'yen-chiu.github.io',
      branch: 'master',
      source: 'pat'
    })
  );
});
await page.reload({ waitUntil: 'domcontentloaded' });
await new Promise((r) => setTimeout(r, 1800));

const size = await page.evaluate(() => ({
  vw: document.documentElement.clientWidth,
  docW: document.documentElement.scrollWidth
}));
check('320px 下页面无横向溢出', size.docW <= size.vw, JSON.stringify(size));

await page.click('#adm-toggle-list');
await new Promise((r) => setTimeout(r, 400));
const opened = await page.evaluate(() => ({
  open: document.querySelector('#adm-side').classList.contains('is-open'),
  backdrop: !document.querySelector('#adm-backdrop').hidden,
  closeBtn: getComputedStyle(document.querySelector('#adm-close-list')).display !== 'none',
  locked: document.body.classList.contains('adm-drawer-open')
}));
check('点 ☰ 打开抽屉', opened.open === true);
check('抽屉有遮罩', opened.backdrop === true);
check('抽屉有 ✕ 关闭按钮', opened.closeBtn === true);
check('抽屉打开时锁背景滚动', opened.locked === true);

await page.click('#adm-new');
await new Promise((r) => setTimeout(r, 600));
const afterNew = await page.evaluate(() => {
  const save = document.querySelector('#adm-save').getBoundingClientRect();
  return {
    open: document.querySelector('#adm-side').classList.contains('is-open'),
    backdropHidden: document.querySelector('#adm-backdrop').hidden,
    focused: document.activeElement && document.activeElement.id === 'adm-title',
    saveVisible: save.right <= document.documentElement.clientWidth && save.width > 0
  };
});
check('新建后抽屉自动收起', afterNew.open === false && afterNew.backdropHidden === true);
check('新建后焦点在标题输入框', afterNew.focused === true);
check('保存按钮完整可见', afterNew.saveVisible === true);

await page.click('#adm-toggle-list');
await new Promise((r) => setTimeout(r, 350));
await page.click('#adm-close-list');
await new Promise((r) => setTimeout(r, 350));
check(
  '✕ 可关闭抽屉',
  await page.evaluate(() => !document.querySelector('#adm-side').classList.contains('is-open'))
);

await page.click('#adm-toggle-list');
await new Promise((r) => setTimeout(r, 350));
await page.evaluate(() => document.querySelector('#adm-backdrop').click());
await new Promise((r) => setTimeout(r, 350));
check(
  '点遮罩可关闭抽屉',
  await page.evaluate(() => !document.querySelector('#adm-side').classList.contains('is-open'))
);

await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
await new Promise((r) => setTimeout(r, 500));
const desktop = await page.evaluate(() => ({
  backdrop: getComputedStyle(document.querySelector('#adm-backdrop')).display,
  closeBtn: getComputedStyle(document.querySelector('#adm-close-list')).display
}));
check('桌面端无遮罩', desktop.backdrop === 'none');
check('桌面端隐藏 ✕', desktop.closeBtn === 'none');

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} 通过`);
if (failed.length) process.exitCode = 1;
