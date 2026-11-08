// engine.js —— 《生命线》故事 DSL 的解析与求值（不依赖 DOM）
//
// 支持的语法（来自 StoryData_*.txt）：
//   :: 段落名
//   普通文本行（可含 $变量）
//   <<set $var = 值>>   <<if 条件>> <<elseif>> <<else>> <<endif>>
//   <<silently>> ... <<endsilently>>
//   <<choice [[选项文字|目标段落]]>>     （一行多个用 | 分隔）
//   [[目标段落]]        [[delay 30s|目标段落]]   [[delay 30m|目标段落]]
//   <<textinput $var "[[Enter|目标]]">>   （仅中文/西语/韩语版的邮件流程用到）
//   <<netcheck>> / <<sendemail>>          （原包中无处理代码，这里忽略）

export function parseStory(text) {
  const passages = new Map();
  let name = null;
  let lines = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/^\uFEFF/, '');
    const head = line.match(/^::\s*(.+?)\s*$/);
    if (head) {
      if (name !== null) passages.set(name, lines);
      name = head[1];
      lines = [];
    } else if (name !== null) {
      lines.push(line);
    }
  }
  if (name !== null) passages.set(name, lines);
  return passages;
}

export function parseStrings(xml) {
  const out = {};
  const re = /<string\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/string>/g;
  let m;
  while ((m = re.exec(xml))) {
    out[m[1]] = m[2]
      .replace(/\\n/g, '\n')
      .replace(/\\'/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"');
  }
  return out;
}

function tokenValue(tok, vars) {
  if (tok.startsWith('$')) {
    const v = vars[tok.slice(1)];
    return v === undefined ? 0 : v;
  }
  if ((tok.startsWith('"') && tok.endsWith('"')) || (tok.startsWith("'") && tok.endsWith("'"))) {
    return tok.slice(1, -1);
  }
  if (tok === 'true') return true;
  if (tok === 'false') return false;
  if (tok !== '' && !Number.isNaN(Number(tok))) return Number(tok);
  return tok;
}

function numeric(v) {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

function truthy(v) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  const s = String(v).trim().toLowerCase();
  return s !== '' && s !== '0' && s !== 'false' && s !== 'none';
}

function compare(a, op, b) {
  const na = numeric(a);
  const nb = numeric(b);
  const useNum = na !== null && nb !== null;
  switch (op) {
    case '=': case '==': case 'eq': case 'is':
      return useNum ? na === nb : String(a) === String(b);
    case 'gt': case '>':
      return useNum ? na > nb : String(a) > String(b);
    case 'gte': case '>=':
      return useNum ? na >= nb : String(a) >= String(b);
    case 'lt': case '<':
      return useNum ? na < nb : String(a) < String(b);
    case 'lte': case '<=':
      return useNum ? na <= nb : String(a) <= String(b);
    default:
      return false;
  }
}

function evalAtom(expr, vars) {
  const t = expr.trim().split(/\s+/).filter(Boolean);
  if (t.length === 0) return false;
  if (t.length === 1) return truthy(tokenValue(t[0], vars));
  // 形如  $a 操作符 值（值里可能带别的内容，取第 1 个运算符）
  const opIdx = t.findIndex((x, i) => i > 0 && ['=', '==', 'eq', 'is', 'gt', '>', 'gte', '>=', 'lt', '<', 'lte', '<='].includes(x));
  if (opIdx < 1) return truthy(tokenValue(t[0], vars));
  const left = tokenValue(t.slice(0, opIdx).join(' '), vars);
  const right = tokenValue(t.slice(opIdx + 1).join(' '), vars);
  return compare(left, t[opIdx], right);
}

export function evalCondition(expr, vars) {
  if (!expr || !expr.trim()) return false;
  const orParts = expr.split(/\s+(?:\|\||or)\s+/i);
  return orParts.some((p) =>
    p.split(/\s+(?:&&|and)\s+/i).every((q) => evalAtom(q, vars))
  );
}

export function applySet(expr, vars) {
  const m = expr.match(/^\$([A-Za-z_]\w*)\s*=\s*([\s\S]*)$/);
  if (!m) return;
  const name = m[1];
  const rest = m[2].trim();
  const tokens = rest.match(/"[^"]*"|'[^']*'|\S+/g) || [];
  if (tokens.length === 0) { vars[name] = ''; return; }
  if (tokens.length === 1) { vars[name] = tokenValue(tokens[0], vars); return; }
  vars[name] = tokens.map((t) => String(tokenValue(t, vars))).join('');
}

export function substitute(text, vars) {
  return text.replace(/\$([A-Za-z_]\w*)/g, (_, name) => {
    const v = vars[name];
    if (v === undefined) return '0';
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    return String(v);
  });
}

const CHOICE_RE = /<<choice\s*\[\[\s*([\s\S]*?)\s*\|\s*([\s\S]*?)\s*\]\]\s*>>/g;

export function parseChoices(line) {
  const out = [];
  let m;
  CHOICE_RE.lastIndex = 0;
  while ((m = CHOICE_RE.exec(line))) out.push({ text: m[1], target: m[2].trim() });
  return out;
}

export function parseTransition(line) {
  let m = line.match(/^\[\[\s*delay\s+(\d+)\s*([sm])\s*\|\s*([\s\S]+?)\s*\]\]$/i);
  if (m) {
    const unit = m[2].toLowerCase() === 'm' ? 60 : 1;
    return { target: m[3].trim(), delaySec: Number(m[1]) * unit };
  }
  m = line.match(/^\[\[\s*([^\[\]|]+?)\s*\]\]$/);
  if (m) return { target: m[1].trim(), delaySec: 0 };
  return null;
}

export function parseTextInput(line) {
  const m = line.match(/<<textinput\s+\$([A-Za-z_]\w*)\s*"([\s\S]*?)"\s*>>/);
  if (!m) return null;
  const inner = parseTransition(m[2].trim());
  return { name: m[1], target: inner ? inner.target : null, label: inner ? m[2] : '' };
}

export function hasAnyToken(line) {
  return /<<|\[\[/.test(line);
}
