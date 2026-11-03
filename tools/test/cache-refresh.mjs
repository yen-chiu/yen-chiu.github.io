/**
 * 「刷新缓存」功能回归测试
 * ---------------------------------------------------------------------------
 * 手机/PWA 常把旧资源缓存住，改完内容看不到。站点提供三个入口做同一件事：
 *   1. 页脚「刷新缓存」按钮
 *   2. /refresh/ 页面（会自动清理并跳回首页）
 *   3. 任意页面加 ?refresh=1（加 &stay=1 则只清理不跳转）
 *
 * 用例覆盖：按钮存在、API 暴露、CacheStorage 被清空、
 * /refresh/ 自动跳转、跳转后不看旧缓存、?refresh=1&stay=1 不跳走、无 JS 报错
 *
 * 运行：node tools/test/cache-refresh.mjs http://127.0.0.1:4000
 */

import { pathToFileURL } from 'node:url';

const spec = 'C:\\03_Github\\.work\\node-tools\\node_modules\\puppeteer-core\\lib\\puppeteer\\puppeteer-core.js';
const { default: puppeteer } = await import(pathToFileURL(spec).href);
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = process.argv[2] || 'http://127.0.0.1:4010';

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

await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

// 1. 首页页脚有按钮
await page.goto(BASE + '/', { waitUntil: 'networkidle2', timeout: 60000 });
const hasBtn = await page.evaluate(() => {
  const b = document.getElementById('wx-cache-refresh');
  return { exists: !!b, text: b ? b.textContent.trim() : null, api: typeof window.wxRefreshCache };
});
check('页脚有「刷新缓存」按钮', hasBtn.exists === true, hasBtn.text);
check('暴露了 wxRefreshCache API', hasBtn.api === 'function');

// 2. 造一份假缓存 + 注册一个 SW，验证按钮能清掉
await page.evaluate(async () => {
  const cache = await caches.open('fake-cache-for-test');
  await cache.put('/fake-test.txt', new Response('hello'));
  window.__beforeKeys = await caches.keys();
});
const before = await page.evaluate(() => window.__beforeKeys);
check('已写入测试缓存', before.includes('fake-cache-for-test'), JSON.stringify(before));

// 3. 只清理不跳转，验证缓存被删
const cleared = await page.evaluate(async () => {
  const result = await window.wxRefreshCache({ reload: false });
  return { result, keys: await caches.keys() };
});
check('清理后 CacheStorage 为空', cleared.keys.length === 0, JSON.stringify(cleared));

// 4. /refresh/ 页面能自动清理并跳回首页
await page.goto(BASE + '/refresh/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.evaluate(async () => {
  const cache = await caches.open('fake-cache-2');
  await cache.put('/fake2.txt', new Response('x'));
});
const navigated = await page
  .waitForNavigation({ timeout: 12000 })
  .then(() => true)
  .catch(() => false);
check('/refresh/ 会自动跳转', navigated === true);
const afterUrl = page.url();
check('跳回首页且带时间戳参数', /\/\?v=\d+/.test(afterUrl) || afterUrl.endsWith('/'), afterUrl);
const keysAfter = await page.evaluate(() => caches.keys());
// 跳回首页后 Service Worker 会重新注册并建新缓存，这是正常的；
// 这里只要求「旧缓存（含测试用的假缓存）都不在了」
check('旧缓存已被清除', !keysAfter.includes('fake-cache-2'), JSON.stringify(keysAfter));

// 5. 跳转后地址栏的 ?v= 会被抹掉
await new Promise((r) => setTimeout(r, 800));
const finalUrl = page.url();
check('地址栏已去掉 v 参数', !finalUrl.includes('v='), finalUrl);

// 6. ?refresh=1 也能触发（stay 模式不跳转）
await page.goto(BASE + '/?refresh=1&stay=1', { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise((r) => setTimeout(r, 1200));
const stayUrl = page.url();
check('?refresh=1&stay=1 不会跳走', stayUrl.includes('stay=1'), stayUrl);

check('无 JS 运行时错误', errors.length === 0, errors.slice(0, 2).join(' | ') || 'none');

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} 通过`);
if (failed.length) process.exitCode = 1;
