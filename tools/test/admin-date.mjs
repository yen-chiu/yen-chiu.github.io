/**
 * 写作台「日期 / 时间」字段回归测试
 * ---------------------------------------------------------------------------
 * 背景：原来用 <input type="datetime-local">，在不支持该类型的浏览器上会退化成
 * 普通文本框——显示成 "2023-10-11T21:14" 且点不出选择器。现在拆成原生
 * date + time 两个控件，这个用例锁住：回填、可点击、可改写、保存后能读回。
 *
 * 运行方式同 sanitize-xss.mjs：
 *   npm i puppeteer-core
 *   node tools/test/admin-date.mjs http://127.0.0.1:4000
 * 需要一个 mock GitHub API（默认 http://127.0.0.1:4020，可用 MOCK_API 覆盖）。
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

// 载入一篇文章
await page.evaluate(() => {
  const btn = document.querySelector('#adm-list button');
  if (btn) btn.click();
});
await new Promise((r) => setTimeout(r, 1200));

const prefill = await page.evaluate(() => {
  const d = document.querySelector('#adm-date');
  const t = document.querySelector('#adm-time');
  const db = d.getBoundingClientRect();
  return {
    dateType: d.type,
    timeType: t.type,
    date: d.value,
    time: t.value,
    overflow: Math.round(db.right - document.documentElement.clientWidth),
    docW: document.documentElement.scrollWidth,
    vw: document.documentElement.clientWidth
  };
});
check('日期是原生 date 控件', prefill.dateType === 'date', prefill.date);
check('时间是原生 time 控件', prefill.timeType === 'time', prefill.time);
check('回填日期合法', /^\d{4}-\d{2}-\d{2}$/.test(prefill.date), prefill.date);
check('回填时间合法', /^\d{2}:\d{2}$/.test(prefill.time), prefill.time);
check('320px 下不越界', prefill.overflow <= 0 && prefill.docW <= prefill.vw);

// 移动端「文章信息」默认收起：展开后再点
await page.evaluate(() => {
  const d = document.querySelector('#adm-details');
  if (d) d.open = true;
});
await new Promise((r) => setTimeout(r, 350));

const hit = await page.evaluate(() => {
  const d = document.querySelector('#adm-date');
  const r = d.getBoundingClientRect();
  const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return at ? at.id || at.tagName : null;
});
check('日期框无遮挡、可命中', hit === 'adm-date', String(hit));

const edit = await page.evaluate(() => {
  const d = document.querySelector('#adm-date');
  const t = document.querySelector('#adm-time');
  d.focus();
  d.value = '2030-01-02';
  d.dispatchEvent(new Event('input', { bubbles: true }));
  d.dispatchEvent(new Event('change', { bubbles: true }));
  t.value = '03:04';
  t.dispatchEvent(new Event('input', { bubbles: true }));
  t.dispatchEvent(new Event('change', { bubbles: true }));
  return {
    focused: document.activeElement === d,
    date: d.value,
    time: t.value,
    valid: d.checkValidity() && t.checkValidity()
  };
});
check('日期框可聚焦编辑', edit.focused === true);
check('改写后取值合法', edit.date === '2030-01-02' && edit.time === '03:04' && edit.valid, JSON.stringify(edit));

// 保存 → 重新载入，验证 front matter 里的 date 被正确写出并读回
await page.click('#adm-save');
await new Promise((r) => setTimeout(r, 1500));
await page.reload({ waitUntil: 'domcontentloaded' });
await new Promise((r) => setTimeout(r, 1800));
await page.evaluate(() => {
  const btn = document.querySelector('#adm-list button');
  if (btn) btn.click();
});
await new Promise((r) => setTimeout(r, 1200));
const roundtrip = await page.evaluate(() => ({
  date: document.querySelector('#adm-date').value,
  time: document.querySelector('#adm-time').value
}));
check(
  '保存后重新载入，日期时间一致',
  roundtrip.date === '2030-01-02' && roundtrip.time === '03:04',
  JSON.stringify(roundtrip)
);

check('无 JS 运行时错误', errors.length === 0, errors.slice(0, 2).join(' | ') || 'none');

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} 通过`);
if (failed.length) process.exitCode = 1;
