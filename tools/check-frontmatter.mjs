#!/usr/bin/env node
/**
 * 文章 front matter 预检查
 * ---------------------------------------------------------------------------
 * 背景：写作台是把 Markdown 直接提交到仓库，写错格式 Jekyll 不一定报错，
 * 而是**静默地**把文章放到奇怪的地方。真实踩过的坑：
 *
 *   categories: [杂技，综合]     ← 全角逗号，YAML 只认半角 ,
 *   → 结果不是两个分类，而是一个名叫「杂技，综合」的分类
 *
 * 这个脚本在 CI 里跑（也能本地跑），把能静态判断的格式问题提前暴露。
 *
 * 用法：
 *   node tools/check-frontmatter.mjs          # 检查 _posts/ 与 _drafts/
 *   node tools/check-frontmatter.mjs --strict # 把警告也当作失败
 *
 * 退出码：0 = 通过（可能有警告），1 = 有错误
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIRS = ['_posts', '_drafts'].map((d) => path.join(ROOT, d)).filter((d) => fs.existsSync(d));
const STRICT = process.argv.includes('--strict');

const errors = [];
const warnings = [];

const err = (file, msg) => errors.push({ file, msg });
const warn = (file, msg) => warnings.push({ file, msg });

/** 极简 front matter 解析：够用即可，不引第三方 YAML（CI 里没有 node_modules 保证） */
function parseFrontMatter(text) {
  const m = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!m) return null;
  const raw = m[1];
  const data = {};
  let currentKey = null;
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim() || /^\s*#/.test(line)) continue;
    const nested = /^\s+([\w-]+):\s*(.*)$/.exec(line);
    if (nested && currentKey) {
      if (typeof data[currentKey] !== 'object' || Array.isArray(data[currentKey])) data[currentKey] = {};
      data[currentKey][nested[1]] = nested[2].trim();
      continue;
    }
    const kv = /^([\w-]+):\s*(.*)$/.exec(line);
    if (!kv) continue;
    currentKey = kv[1];
    data[currentKey] = kv[2].trim();
  }
  return { data, raw, body: text.slice(m[0].length) };
}

/** 把 flow 序列 [a, b] 拆成数组（只按半角逗号，模拟 YAML 的行为） */
function parseFlowArray(value) {
  const m = /^\[(.*)\]$/.exec(String(value || '').trim());
  if (!m) return null;
  return m[1]
    .split(',')
    .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
}

/** 全角/中文分隔符：出现在数组里就说明作者以为 YAML 会切分，其实不会 */
const FULLWIDTH_SEP = /[，、；｜｜]/;

const seenDates = new Map();
let checked = 0;

for (const dir of DIRS) {
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.md')) continue;
    const file = path.join(dir, name);
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    checked += 1;

    const text = fs.readFileSync(file, 'utf8');
    const fm = parseFrontMatter(text);
    if (!fm) {
      err(rel, '缺少 front matter（文件必须以 --- 开头，并且用 --- 结束）');
      continue;
    }
    const { data, body } = fm;

    // 1. 文件名与日期
    const fileDate = /^(\d{4})-(\d{2})-(\d{2})-/.exec(name);
    if (!fileDate && dir.endsWith('_posts')) {
      err(rel, '文件名必须以 YYYY-MM-DD- 开头，否则 Jekyll 不会把它当作文章');
    }

    // 2. 必填字段
    if (!data.title) err(rel, '缺少 title');

    // 3. date 格式
    const dateStr = String(data.date || '');
    if (!dateStr) {
      err(rel, '缺少 date');
    } else if (!/^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?(\s*[+-]\d{4})?$/.test(dateStr.replace(/^['"]|['"]$/g, '').trim())) {
      err(rel, `date 格式不认识：${dateStr}（应为 "YYYY-MM-DD HH:MM:SS +0800"）`);
    } else {
      const d = new Date(dateStr.replace(' ', 'T').replace(/\s*([+-]\d{2})(\d{2})$/, '$1:$2'));
      if (!isNaN(d.getTime()) && d.getTime() > Date.now() + 60 * 1000) {
        warn(rel, `date 在未来（${dateStr}）：站点配置了 future: false，这篇文章不会立即发布`);
      }
      const key = dateStr.slice(0, 16);
      if (seenDates.has(key)) warn(rel, `与 ${seenDates.get(key)} 的 date 相同，首页排序可能不稳定`);
      else seenDates.set(key, rel);
    }

    // 4. categories / tags：全角分隔符是最常见的隐性错误
    for (const field of ['categories', 'tags']) {
      const value = data[field];
      if (value == null) continue;
      const arr = parseFlowArray(value);
      const list = arr || String(value).split(',');
      if (arr) {
        for (const item of arr) {
          if (FULLWIDTH_SEP.test(item)) {
            err(
              rel,
              `${field} 里用了全角分隔符，YAML 不会拆开：「${item}」会被当成一整个分类。请改成半角逗号`
            );
          }
        }
      } else if (FULLWIDTH_SEP.test(String(value))) {
        err(rel, `${field} 里出现了全角分隔符「，」或「、」，YAML 不识别，请改成半角逗号`);
      }
      if (list.some((s) => !s.trim())) warn(rel, `${field} 里有空项`);
    }

    // 5. 本地图片引用必须真的存在
    const refs = new Set();
    const imgField = typeof data.image === 'object' && data.image ? data.image.path : data.image;
    if (imgField) refs.add(String(imgField).trim());
    // 先剥掉围栏代码块和行内代码：示例里的路径不是真实引用
    const prose = body
      .replace(/```[\s\S]*?```/g, '')
      .replace(/~~~[\s\S]*?~~~/g, '')
      .replace(/`[^`\n]*`/g, '');
    for (const m of prose.matchAll(/!\[[^\]]*\]\((\/[^)\s]+)/g)) refs.add(m[1]);
    for (const m of prose.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)) refs.add(m[1]);
    for (const ref of refs) {
      const clean = ref.replace(/[?#].*$/, '');
      if (!clean.startsWith('/assets/')) continue;
      const disk = path.join(ROOT, decodeURIComponent(clean).replace(/^\//, ''));
      if (!fs.existsSync(disk)) err(rel, `引用的文件不存在：${clean}`);
    }

    // 6. 正文里出现裸的全角括号数组写法（常见的手滑）
    if (/^\s*\[\s*$/m.test(body) && /^\s*\]\s*$/m.test(body)) {
      warn(rel, '正文里有孤立的 [ 或 ]，如果是想写 YAML 列表请放进 front matter');
    }
  }
}

/* ---------------------------------------------------------------------------
 * 更新日志（_data/changelog.yml）的轻量校验
 * 只认 kind/scope 的枚举，以及 date 必须是 YYYY-MM-DD，防止手滑写错标签
 * ------------------------------------------------------------------------- */

const KINDS = ['feature', 'fix', 'content', 'style', 'infra'];
const SCOPES = ['主站', '写作台', '子站'];

const changelogPath = path.join(ROOT, '_data', 'changelog.yml');
if (fs.existsSync(changelogPath)) {
  const raw = fs.readFileSync(changelogPath, 'utf8');
  const blocks = raw.split(/\n(?=- date:)/).filter((b) => b.includes('date:'));

  blocks.forEach((block, i) => {
    const field = (name) => {
      const m = new RegExp('^\\s*(?:-\\s*)?' + name + ':\\s*(.+)$', 'm').exec(block);
      return m ? m[1].trim().replace(/^['"]|['"]$/g, '') : '';
    };
    const date = field('date');
    const kind = field('kind');
    const scope = field('scope');
    const title = field('title');
    const label = `_data/changelog.yml 第 ${i + 1} 条`;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) err(label, `date 必须是 YYYY-MM-DD，现在是「${date}」`);
    if (!KINDS.includes(kind)) err(label, `kind 只能是 ${KINDS.join('/')}，现在是「${kind}」`);
    if (scope && !SCOPES.includes(scope)) warn(label, `scope 建议用 ${SCOPES.join('/')}，现在是「${scope}」`);
    if (!title) err(label, '缺少 title');
    if (title.length > 40) warn(label, 'title 偏长（建议 ≤ 40 字），写不下可以考虑写成文章');
    const note = field('note');
    if (note.length > 60) warn(label, 'note 偏长，建议一句话说完');
  });

  console.log(`另外检查了 ${blocks.length} 条更新日志`);
}

const show = (list, label) => {
  if (!list.length) return;
  console.log(`\n${label}（${list.length}）：`);
  for (const e of list) console.log(`  ${e.file}\n    → ${e.msg}`);
};

console.log(`检查了 ${checked} 篇文章（${DIRS.map((d) => path.basename(d)).join(' + ')}）`);
show(errors, '错误');
show(warnings, '警告');

const failed = errors.length > 0 || (STRICT && warnings.length > 0);
console.log(
  `\n${failed ? 'FAIL' : 'OK'} · 错误 ${errors.length} · 警告 ${warnings.length}`
);
process.exit(failed ? 1 : 0);
