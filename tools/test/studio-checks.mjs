/**
 * 写作台「格式预检查 + 撤销重做」回归测试
 * ---------------------------------------------------------------------------
 * 覆盖：
 *   1. 写作台隐藏了失效的站点汉堡/搜索按钮（它不加载主题 JS）
 *   2. 撤销 / 重做按钮与快捷键栈
 *   3. 分类/标签里的全角逗号、顿号被归一化成半角（否则 YAML 会当成一个分类）
 *   4. 空标题等格式问题在保存前被拦下，且保存按钮不会卡死
 *
 * 运行方式同 sanitize-xss.mjs：
 *   node tools/test/studio-checks.mjs http://127.0.0.1:4000
 * 需要 mock GitHub API（默认 4020，可用 MOCK_API 覆盖）。
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
const check = (n, ok, d) => {
  results.push({ n, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} · ${n}${d ? ' :: ' + d : ''}`);
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
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('dialog', async (d) => {
  try {
    await d.accept();
  } catch (e) {
    /* ignore */
  }
});
await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
await page.setViewport({ width: 390, height: 800, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

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

const dead = await page.evaluate(() => ({
  sidebar: getComputedStyle(document.querySelector('#sidebar-trigger')).display,
  search: getComputedStyle(document.querySelector('#search-trigger')).display
}));
check('隐藏失效的站点汉堡按钮', dead.sidebar === 'none', dead.sidebar);
check('隐藏失效的站点搜索按钮', dead.search === 'none', dead.search);

await page.evaluate(() => {
  const b = document.querySelector('#adm-list button');
  if (b) b.click();
});
await new Promise((r) => setTimeout(r, 1200));

const initial = await page.evaluate(() => ({
  hasUndo: !!document.querySelector('#adm-undo'),
  hasRedo: !!document.querySelector('#adm-redo'),
  undoDisabled: document.querySelector('#adm-undo').disabled
}));
check('工具栏有撤销/重做按钮', initial.hasUndo && initial.hasRedo);
check('初始撤销按钮不可用', initial.undoDisabled === true);

await page.click('#adm-content');
await page.keyboard.type(' 追加测试文字');
await new Promise((r) => setTimeout(r, 700));
check(
  '输入后撤销可用',
  (await page.evaluate(() => document.querySelector('#adm-undo').disabled)) === false
);

await page.click('#adm-undo');
await new Promise((r) => setTimeout(r, 400));
const undone = await page.evaluate(() => ({
  body: document.querySelector('#adm-content').value,
  redoDisabled: document.querySelector('#adm-redo').disabled
}));
check('撤销生效', !undone.body.includes('追加测试文字'));
check('撤销后重做可用', undone.redoDisabled === false);

await page.click('#adm-redo');
await new Promise((r) => setTimeout(r, 400));
check(
  '重做生效',
  await page.evaluate(() => document.querySelector('#adm-content').value.includes('追加测试文字'))
);

await page.evaluate(() => {
  document.querySelector('#adm-details').open = true;
});
await new Promise((r) => setTimeout(r, 300));
await page.evaluate(() => {
  const el = document.querySelector('#adm-categories');
  el.value = '杂技，综合、测试';
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
await page.click('#adm-save');
await new Promise((r) => setTimeout(r, 1600));
check(
  '全角逗号/顿号归一化为半角',
  (await page.evaluate(() => document.querySelector('#adm-categories').value)) === '杂技, 综合, 测试'
);

const saved = await page.evaluate(async () => {
  const res = await fetch(
    'http://127.0.0.1:4020/repos/yen-chiu/yen-chiu.github.io/contents/_posts/2023-10-11-MyBlog.md',
    { headers: { Authorization: 'Bearer test-token' } }
  );
  const j = await res.json();
  const text = decodeURIComponent(escape(atob(j.content.replace(/\n/g, ''))));
  return text.split('\n').filter((l) => l.startsWith('categories:')).join('|');
});
check('写出的 front matter 是半角数组', /categories: \[杂技, 综合, 测试\]/.test(saved), saved);

await page.evaluate(() => {
  const el = document.querySelector('#adm-title');
  el.value = '';
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
await page.click('#adm-save');
await new Promise((r) => setTimeout(r, 700));
const blocked = await page.evaluate(() => {
  const t = document.querySelector('#adm-toast');
  return { text: t ? t.textContent : '', enabled: !document.querySelector('#adm-save').disabled };
});
check('空标题被预检查拦截', /格式检查没通过/.test(blocked.text), blocked.text.slice(0, 40));
check('拦截后保存按钮未卡死', blocked.enabled === true);
check('无 JS 运行时错误', errors.length === 0, errors.slice(0, 2).join(' | ') || 'none');

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} 通过`);
if (failed.length) process.exitCode = 1;
