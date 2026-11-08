// app.js —— 界面、DSL 逐 token 执行、存档、回溯、词典、通知、Gist 与统计
import {
  parseStory, parseStrings, evalCondition, applySet, substitute,
  parseChoices, parseTransition, parseTextInput
} from './engine.js';
import {
  capture, validate, toCode, fromCode, download, readFile,
  slotKey, AUTO_KEY, LEGACY_KEY
} from './save.js';

const PREFS = 'lifeline.web.prefs.v1';
const LANG_KEY = 'lifeline.web.lang.v1';
const STATS_KEY = 'lifeline.web.stats.v1';
const GIST_KEY = 'lifeline.web.gist.v1';
const CHROME = {
  cn: {
    title: '生命线',
    speedOn: '快进 · 开', speedOff: '快进 · 关',
    soundOn: '声音 · 开', soundOff: '声音 · 关',
    save: '存档', more: '更多', restart: '重开',
    hint: '信号已接入 · 回复会传回地面',
    credit: '同人网页移植 · 原作 © 3 Minute Games',
    kicker: 'SOS · 一条来自未知星球的信号',
    intro: '一艘飞船坠毁在陌生的星球上。通讯器另一头，一个叫泰勒的人还活着。<br>你收到的每一条消息都来自他——回复，或者等一等。',
    cont: '继续上次的故事', start: '开始新故事',
    disclaimer: '本页为非商业同人移植，剧情与美术版权归 3 Minute Games / Big Fish Games 所有。',
    respond: '回复……',
  },
  en: {
    title: 'Lifeline',
    speedOn: 'Fast · On', speedOff: 'Fast · Off',
    soundOn: 'Sound · On', soundOff: 'Sound · Off',
    save: 'Save', more: 'More', restart: 'Restart',
    hint: 'Signal connected · your replies go back to the ground',
    credit: 'Fan web port · original © 3 Minute Games',
    kicker: 'SOS · a signal from an unknown planet',
    intro: 'A ship has crashed on an unfamiliar planet. On the other end of the comms, a man named Taylor is still alive.<br>Every message you receive comes from him — reply, or just wait.',
    cont: 'Continue last story', start: 'Start a new story',
    disclaimer: 'Non-commercial fan port. Story and art © 3 Minute Games / Big Fish Games.',
    respond: 'Reply…',
  },
};

const chrome = () => CHROME[lang] || CHROME.en;
const hint = () => chrome().hint;

function applyChrome() {
  const t = chrome();
  document.title = t.title === 'Lifeline' ? 'Lifeline' : `${t.title} · Lifeline`;
  const brandCn = document.querySelector('.brand-cn');
  if (brandCn) brandCn.textContent = t.title;
  btnSpeed.textContent = fast ? t.speedOn : t.speedOff;
  btnSound.textContent = soundOn ? t.soundOn : t.soundOff;
  el('btn-save').textContent = t.save;
  el('btn-more').textContent = t.more;
  btnRestart.textContent = t.restart;
  const kicker = document.querySelector('.kicker');
  if (kicker) kicker.textContent = t.kicker;
  const h1 = document.querySelector('#splash h1');
  if (h1) h1.textContent = t.title;
  const intro = document.querySelector('.intro');
  if (intro) intro.innerHTML = t.intro;
  el('btn-continue').textContent = t.cont;
  el('btn-start').textContent = t.start;
  const disc = document.querySelector('.disclaimer');
  if (disc) disc.textContent = t.disclaimer;
  const credit = document.querySelector('.credit');
  if (credit) credit.textContent = t.credit;
  el('foot-hint').textContent = t.hint;
  freeInput.placeholder = t.respond;
}
const TOKEN_RE = /<<[^>]*>>|\[\[[^\]]*\]\]/g;
const LANGS = ['cn', 'en', 'es', 'fr', 'ja', 'ko', 'de', 'ru'];

const el = (id) => document.getElementById(id);
const chat = el('chat');
const typing = el('typing');
const choicesBox = el('choices');
const inputRow = el('inputRow');
const freeInput = el('freeInput');
const inputSend = el('inputSend');
const btnSpeed = el('btn-speed');
const btnSound = el('btn-sound');
const btnRestart = el('btn-restart');
const footHint = el('foot-hint');
const saveModal = el('saveModal');
const moreModal = el('moreModal');

let story = null;        // Map<段落名, token[]>
let strings = {};
let vars = {};
let log = [];
let gen = 0;
let fast = true;
let soundOn = true;
let lang = 'cn';
let checkpoints = [];    // 选择点回溯
let glossary = [];       // 中文词条
let termRe = null;
let stats = null;
let notifyOn = false;
let skipTyping = false;
let installPrompt = null;
let gistInfo = null;

let choiceCancel = null;
let inputCancel = null;
let ambience = null;
let blips = [];
let tap = null;

/* ---------------- 基础工具 ---------------- */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

function fmtDur(sec) {
  if (sec >= 3600) return `${Math.round(sec / 3600)} 小时`;
  if (sec >= 60) return `${Math.round(sec / 60)} 分钟`;
  return `${sec} 秒`;
}

function fmtTime(ts) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('zh-CN', {
    hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

const scrollBottom = () => { chat.scrollTop = chat.scrollHeight; };

function speaker() {
  const mel = String(vars.inBridgeContent) === '1';
  if (mel) return strings.mel || (lang === 'cn' ? '梅兰妮' : 'Melanie');
  return strings.taylor || (lang === 'cn' ? '泰勒' : 'Taylor');
}

function pickLang() {
  const q = new URLSearchParams(location.search).get('lang');
  if (q && LANGS.includes(q)) { try { localStorage.setItem(LANG_KEY, q); } catch (_) {} return q; }
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved && LANGS.includes(saved)) return saved;
  } catch (_) {}
  return 'cn';
}

/* ---------------- 词条：正文里的可点词 ---------------- */

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function buildTermRe() {
  if (lang !== 'cn' || !glossary.length) { termRe = null; return; }
  const words = [];
  for (const t of glossary) {
    words.push(t.k);
    for (const a of t.a || []) words.push(a);
  }
  const uniq = [...new Set(words)].filter(Boolean).sort((a, b) => b.length - a.length);
  termRe = uniq.length ? new RegExp(uniq.map(escapeRe).join('|'), 'g') : null;
}

function termDef(word) {
  const t = glossary.find((x) => x.k === word || (x.a || []).includes(word));
  return t ? t.d : '';
}

function appendRich(parent, text) {
  if (!termRe) { parent.appendChild(document.createTextNode(text)); return; }
  termRe.lastIndex = 0;
  let last = 0;
  let m;
  while ((m = termRe.exec(text))) {
    if (m.index > last) parent.appendChild(document.createTextNode(text.slice(last, m.index)));
    const word = m[0];
    const span = document.createElement('span');
    span.className = 'term';
    span.textContent = word;
    span.title = termDef(word);
    span.addEventListener('click', (e) => { e.stopPropagation(); showTerm(word); });
    parent.appendChild(span);
    last = m.index + word.length;
  }
  if (last < text.length) parent.appendChild(document.createTextNode(text.slice(last)));
}

/* ---------------- 段落 token 化 ---------------- */

function tokenizePassage(lines) {
  const tokens = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const tr = parseTransition(line);
    if (tr) { tokens.push({ type: 'link', target: tr.target, delay: tr.delaySec }); continue; }

    if (line.includes('<<choice')) {
      const opts = parseChoices(line);
      if (opts.length) {
        const prefix = line
          .replace(/<<choice\s*\[\[\s*[\s\S]*?\]\]\s*>>/g, ' ')
          .replace(/[|｜]/g, ' ')
          .trim();
        tokens.push({ type: 'choices', opts, prefix });
        continue;
      }
    }

    if (line.includes('<<textinput')) {
      const ti = parseTextInput(line);
      if (ti) {
        const prefix = line.replace(/<<textinput[\s\S]*?>>/g, ' ').trim();
        tokens.push({ type: 'input', ...ti, prefix });
        continue;
      }
    }

    let last = 0;
    TOKEN_RE.lastIndex = 0;
    let m;
    while ((m = TOKEN_RE.exec(line))) {
      const text = line.slice(last, m.index).trim();
      if (text) tokens.push({ type: 'text', v: text });
      tokens.push(classify(m[0]));
      last = m.index + m[0].length;
    }
    const tail = line.slice(last).trim();
    if (tail) tokens.push({ type: 'text', v: tail });
  }
  return tokens.filter(Boolean);
}

function classify(tok) {
  if (tok.startsWith('[[')) {
    const t = parseTransition(tok);
    return t ? { type: 'link', target: t.target, delay: t.delaySec } : { type: 'ignore' };
  }
  const body = tok.slice(2, -2).trim();
  if (body === 'silently') return { type: 'silent' };
  if (body === 'endsilently') return { type: 'endsilent' };
  if (body === 'else') return { type: 'else' };
  if (body === 'endif') return { type: 'endif' };
  if (body.startsWith('if ')) return { type: 'if', v: body.slice(3) };
  if (body.startsWith('elseif ')) return { type: 'elseif', v: body.slice(7) };
  if (body.startsWith('set ')) return { type: 'set', v: body.slice(4) };
  return { type: 'ignore' };
}

function resolveIf(tokens, i) {
  const branches = [];
  let cur = { cond: tokens[i].v, from: i + 1 };
  let depth = 0;
  for (let j = i + 1; j < tokens.length; j++) {
    const t = tokens[j];
    if (t.type === 'if') { depth += 1; continue; }
    if (t.type === 'endif') {
      if (depth === 0) { cur.to = j; branches.push(cur); return { branches, after: j + 1 }; }
      depth -= 1;
      continue;
    }
    if (depth !== 0) continue;
    if (t.type === 'elseif') {
      cur.to = j; branches.push(cur); cur = { cond: t.v, from: j + 1 };
    } else if (t.type === 'else') {
      cur.to = j; branches.push(cur); cur = { cond: null, from: j + 1 };
    }
  }
  cur.to = tokens.length;
  branches.push(cur);
  return { branches, after: tokens.length };
}

/** 段落末尾的存档：回退到最近的跳转/选择 token */
function resumeIndex(tokens) {
  for (let i = tokens.length - 1; i >= 0; i -= 1) {
    if (tokens[i].type === 'choices' || tokens[i].type === 'link') return i;
  }
  return 0;
}

/* ---------------- 渲染与存档 ---------------- */

let current = { passage: 'Start', idx: 0 };

function msgNode(kind, text) {
  const node = document.createElement('div');
  node.className = 'msg' + (kind === 'me' ? ' me' : kind === 'sys' ? ' sys' : '');
  if (kind === 'them') {
    const who = document.createElement('span');
    who.className = 'who';
    who.textContent = speaker();
    node.appendChild(who);
  }
  appendRich(node, text);
  return node;
}

function addMsg(kind, text) {
  const node = msgNode(kind, text);
  chat.appendChild(node);
  log.push({ k: kind, t: text });
  if (log.length > 600) log = log.slice(-500);
  scrollBottom();
  saveState();
}

async function say(text, myGen) {
  if (myGen !== gen) return false;
  typing.hidden = false;
  scrollBottom();
  await sleep(fast ? 80 : 220);
  typing.hidden = true;
  if (myGen !== gen) return false;

  const node = document.createElement('div');
  node.className = 'msg';
  const who = document.createElement('span');
  who.className = 'who';
  who.textContent = speaker();
  const body = document.createElement('span');
  body.className = 'body';
  node.append(who, body);
  chat.appendChild(node);
  scrollBottom();

  skipTyping = false;
  const chunk = fast ? 4 : 1;
  const budget = fast ? 1000 : 2400;
  const steps = Math.ceil(text.length / chunk);
  const per = Math.max(6, Math.min(52, budget / Math.max(1, steps)));
  let i = 0;
  while (i < text.length) {
    if (myGen !== gen) { node.remove(); return false; }
    if (skipTyping) { i = text.length; break; }
    i = Math.min(text.length, i + chunk);
    body.textContent = text.slice(0, i);
    scrollBottom();
    await sleep(per);
  }
  body.textContent = '';
  appendRich(body, text);
  log.push({ k: 'them', t: text });
  if (log.length > 600) log = log.slice(-500);
  saveState();
  blip();
  bump('messages');
  return true;
}

let saveTimer = null;

function snapshot() {
  return capture({ passage: current.passage, idx: current.idx, vars, log, checkpoints });
}

function writeSave() {
  saveTimer = null;
  try { localStorage.setItem(AUTO_KEY, JSON.stringify(snapshot())); } catch (_) { /* 隐私模式下静默失败 */ }
}

function saveState() {
  if (saveTimer) return;
  saveTimer = setTimeout(writeSave, 220);
}

function flushSave() {
  if (!saveTimer) return;
  clearTimeout(saveTimer);
  writeSave();
}

function loadAutoSave() {
  for (const key of [AUTO_KEY, LEGACY_KEY]) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const r = validate(JSON.parse(raw), story);
      if (r.ok) return r.save;
    } catch (_) { /* 忽略损坏的存档 */ }
  }
  return null;
}

function savePrefs() {
  try { localStorage.setItem(PREFS, JSON.stringify({ fast, soundOn, notifyOn })); } catch (_) {}
}

function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS) || '{}');
    if (typeof p.fast === 'boolean') fast = p.fast;
    if (typeof p.soundOn === 'boolean') soundOn = p.soundOn;
    if (typeof p.notifyOn === 'boolean') notifyOn = p.notifyOn;
  } catch (_) {}
}

/* ---------------- 本机统计（不上传） ---------------- */

function blankStats() {
  return {
    sessions: 0, messages: 0, choices: 0, passages: 0, endings: 0,
    firstAt: Date.now(), lastAt: Date.now(),
  };
}

function loadStats() {
  try {
    stats = Object.assign(blankStats(), JSON.parse(localStorage.getItem(STATS_KEY) || '{}'));
  } catch (_) { stats = blankStats(); }
}

function saveStats() {
  try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch (_) {}
}

function bump(key, n = 1) {
  if (!stats) return;
  stats[key] = (stats[key] || 0) + n;
  stats.lastAt = Date.now();
  saveStats();
}

/* ---------------- 音频 ---------------- */

function initAudio() {
  ambience = new Audio('assets/audio/ambience.mp3');
  ambience.loop = true;
  ambience.volume = 0.16;
  blips = ['a', 'b', 'c'].map((x) => {
    const a = new Audio(`assets/audio/message_incoming_${x}.mp3`);
    a.volume = 0.5;
    return a;
  });
  tap = new Audio('assets/audio/button_tap.mp3');
  tap.volume = 0.5;
}

function startAmbience() {
  if (!soundOn || !ambience) return;
  ambience.play().catch(() => {});
}

function blip() {
  if (!soundOn || blips.length === 0) return;
  const a = blips[Math.floor(Math.random() * blips.length)];
  a.currentTime = 0;
  a.play().catch(() => {});
}

function tapSound() {
  if (!soundOn || !tap) return;
  tap.currentTime = 0;
  tap.play().catch(() => {});
}

/* ---------------- 系统通知 ---------------- */

function notify(title, body) {
  if (!notifyOn) return;
  if (document.visibilityState === 'visible') return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    new Notification(title, {
      body,
      icon: 'assets/img/notification_icon_with_color.png',
      tag: 'lifeline',
    });
  } catch (_) { /* 某些浏览器在非 SW 环境禁止构造 */ }
}

/* ---------------- 等待 ---------------- */

function waitSeconds(sec) {
  return new Promise((resolve) => {
    if (!sec || sec <= 0) { resolve(); return; }
    const eff = fast ? Math.min(sec, 4) : Math.min(sec, 300);
    const note = eff < sec ? `（原定 ${fmtDur(sec)}，已压缩）` : '';
    let left = eff;
    const paint = () => { footHint.textContent = `泰勒正在处理… ${left}s ${note}`; };
    paint();
    footHint.classList.add('clickable');
    const tick = setInterval(() => { left -= 1; if (left > 0) paint(); }, 1000);
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      clearInterval(tick);
      clearTimeout(timeout);
      footHint.classList.remove('clickable');
      footHint.textContent = hint();
      footHint.onclick = null;
      notify('泰勒在等你', '他发完消息了，在等你的回复。');
      resolve();
    };
    const timeout = setTimeout(done, eff * 1000);
    footHint.onclick = done;
  });
}

/* ---------------- 选项 / 输入 ---------------- */

function clearInteractions() {
  choicesBox.hidden = true;
  choicesBox.textContent = '';
  inputRow.hidden = true;
  if (choiceCancel) { const c = choiceCancel; choiceCancel = null; c(); }
  if (inputCancel) { const c = inputCancel; inputCancel = null; c(); }
}

function choose(opts) {
  return new Promise((resolve) => {
    choicesBox.textContent = '';
    choicesBox.hidden = false;
    let settled = false;
    const finish = (val) => {
      if (settled) return;
      settled = true;
      choiceCancel = null;
      choicesBox.hidden = true;
      choicesBox.textContent = '';
      resolve(val);
    };
    choiceCancel = () => finish(null);
    opts.forEach((o, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'choice';
      const num = document.createElement('span');
      num.className = 'num';
      num.textContent = String(i + 1);
      b.appendChild(num);
      appendRich(b, substitute(o.text, vars));
      b.addEventListener('click', () => { tapSound(); finish(o); });
      choicesBox.appendChild(b);
    });
    notify('有新消息', '泰勒发来了新的选择。');
    scrollBottom();
  });
}

function askInput(ti) {
  return new Promise((resolve) => {
    inputRow.hidden = false;
    freeInput.value = '';
    freeInput.placeholder = '输入后按回车…';
    freeInput.focus();
    let settled = false;
    const finish = (val) => {
      if (settled) return;
      settled = true;
      inputCancel = null;
      inputRow.hidden = true;
      freeInput.onkeydown = null;
      inputSend.onclick = null;
      resolve(val);
    };
    inputCancel = () => finish(null);
    inputSend.onclick = () => finish(freeInput.value.trim());
    freeInput.onkeydown = (e) => { if (e.key === 'Enter') finish(freeInput.value.trim()); };
    scrollBottom();
  });
}

/* ---------------- 执行器 ---------------- */

async function runPassage(name, startIdx, myGen, opts = {}) {
  const tokens = story.get(name);
  let at = Math.max(0, Math.min(startIdx, tokens ? tokens.length : 0));
  if (tokens && at >= tokens.length) at = resumeIndex(tokens);
  current = { passage: name, idx: at };
  saveState();
  if (!tokens) { addMsg('sys', `（缺少段落：${name}）`); return; }

  bump('passages');
  if (name === 'gameover') bump('endings');

  const jumps = new Map();
  let silent = false;

  for (let i = at; i < tokens.length; ) {
    if (myGen !== gen) return;
    if (jumps.has(i)) { i = jumps.get(i); continue; }

    const tk = tokens[i];
    const tkIndex = i;
    i += 1;
    current = { passage: name, idx: i };
    saveState();

    switch (tk.type) {
      case 'text':
        if (silent) break;
        if (!(await say(substitute(tk.v, vars), myGen))) return;
        break;

      case 'set':
        applySet(tk.v, vars);
        saveState();
        break;

      case 'silent':
        silent = true;
        break;

      case 'endsilent':
        silent = false;
        break;

      case 'ignore':
        break;

      case 'if': {
        const r = resolveIf(tokens, i - 1);
        let chosen = null;
        for (const b of r.branches) {
          if (b.cond === null || evalCondition(b.cond, vars)) { chosen = b; break; }
        }
        if (chosen) { jumps.set(chosen.to, r.after); i = chosen.from; }
        else { i = r.after; }
        break;
      }

      case 'choices': {
        const skipPrefix = opts.skipPrefix && tkIndex === at;
        if (tk.prefix && !silent && !skipPrefix) {
          if (!(await say(substitute(tk.prefix, vars), myGen))) return;
        }
        const cpVars = { ...vars };
        const cpLogLen = log.length;
        const picked = await choose(tk.opts);
        if (myGen !== gen || !picked) return;
        const label = substitute(picked.text, vars);
        checkpoints.push({
          passage: name, idx: tkIndex, vars: cpVars, choice: label,
          at: Date.now(), logLen: cpLogLen,
        });
        if (checkpoints.length > 80) checkpoints = checkpoints.slice(-80);
        addMsg('me', label);
        bump('choices');
        return runPassage(picked.target, 0, myGen);
      }

      case 'link': {
        await waitSeconds(tk.delay);
        if (myGen !== gen) return;
        return runPassage(tk.target, 0, myGen);
      }

      case 'input': {
        if (tk.prefix && !silent) {
          if (!(await say(substitute(tk.prefix, vars), myGen))) return;
        }
        const value = await askInput(tk);
        if (myGen !== gen || value === null) return;
        addMsg('me', value);
        vars[tk.name] = value;
        saveState();
        if (!tk.target) { footHint.textContent = hint(); return; }
        return runPassage(tk.target, 0, myGen);
      }

      default:
        break;
    }
  }
  footHint.textContent = hint();
}

/* ---------------- 流程控制 ---------------- */

function newRun(passage, idx, opts) {
  gen += 1;
  clearInteractions();
  return runPassage(passage, idx, gen, opts);
}

function rebuildChat() {
  chat.textContent = '';
  for (const item of log) {
    chat.appendChild(msgNode(item.k, item.t));
  }
  scrollBottom();
}

function restart() {
  if (!confirm('要重新开始故事吗？当前进度会被清除。')) return;
  gen += 1;
  clearInteractions();
  vars = {};
  log = [];
  checkpoints = [];
  chat.textContent = '';
  footHint.textContent = hint();
  try { localStorage.removeItem(AUTO_KEY); localStorage.removeItem(LEGACY_KEY); } catch (_) {}
  newRun('Start', 0);
}

/* ---------------- 存档界面 ---------------- */

const autoInfo = el('autoInfo');
const slotsBox = el('slots');
const codeBox = el('codeBox');
const saveMsg = el('saveMsg');

function setSaveMsg(text, isErr) {
  saveMsg.textContent = text || '';
  saveMsg.classList.toggle('err', Boolean(isErr));
}

function describe(save) {
  const n = (save.log || []).length;
  return `${save.passage} · ${n} 条消息 · ${fmtTime(save.savedAt)}`;
}

function readSlot(n) {
  try {
    const raw = localStorage.getItem(slotKey(n));
    if (!raw) return null;
    const r = validate(JSON.parse(raw), story);
    return r.ok ? r.save : null;
  } catch (_) { return null; }
}

function renderSlots() {
  slotsBox.textContent = '';
  for (let n = 1; n <= 3; n += 1) {
    const s = readSlot(n);
    const row = document.createElement('div');
    row.className = 'slot';

    const info = document.createElement('div');
    info.className = 'slot-info';
    const name = document.createElement('div');
    name.className = 'slot-name';
    name.textContent = `槽位 ${n}`;
    const meta = document.createElement('div');
    meta.className = 'slot-meta';
    meta.textContent = s ? describe(s) : '空';
    info.append(name, meta);

    const btnSave = document.createElement('button');
    btnSave.type = 'button';
    btnSave.className = 'ghost';
    btnSave.textContent = '保存';
    btnSave.addEventListener('click', () => {
      try {
        localStorage.setItem(slotKey(n), JSON.stringify(snapshot()));
        renderSlots();
        renderAutoInfo();
        setSaveMsg(`已保存到槽位 ${n}`);
      } catch (_) { setSaveMsg('保存失败：浏览器存储不可用', true); }
    });

    const btnLoad = document.createElement('button');
    btnLoad.type = 'button';
    btnLoad.className = 'ghost';
    btnLoad.textContent = '读取';
    btnLoad.disabled = !s;
    btnLoad.addEventListener('click', () => { if (s) applySave(s, `已读取槽位 ${n}`); });

    const btnDel = document.createElement('button');
    btnDel.type = 'button';
    btnDel.className = 'ghost';
    btnDel.textContent = '删除';
    btnDel.disabled = !s;
    btnDel.addEventListener('click', () => {
      try { localStorage.removeItem(slotKey(n)); } catch (_) {}
      renderSlots();
      setSaveMsg(`已删除槽位 ${n}`);
    });

    row.append(info, btnSave, btnLoad, btnDel);
    slotsBox.appendChild(row);
  }
}

function renderAutoInfo() {
  autoInfo.textContent = `${describe(snapshot())}（自动存档）`;
}

function openSave() {
  setSaveMsg('');
  codeBox.value = '';
  renderSlots();
  renderAutoInfo();
  saveModal.hidden = false;
}

function closeSave() { saveModal.hidden = true; }

function applySave(rawSave, note) {
  const r = validate(rawSave, story);
  if (!r.ok) { setSaveMsg(r.error, true); return false; }
  const s = r.save;
  gen += 1;
  clearInteractions();
  vars = { ...s.vars };
  log = s.log.map((m) => ({ ...m }));
  checkpoints = (s.checkpoints || []).map((c) => ({ ...c }));
  if (!log.length) {
    log.push({ k: 'sys', t: '（已从存档继续；进度码不含聊天记录，之前的消息不会显示）' });
  }
  chat.textContent = '';
  el('splash').hidden = true;
  el('app').hidden = false;
  startAmbience();
  rebuildChat();
  newRun(s.passage, s.idx);
  writeSave();
  closeSave();
  if (note) {
    footHint.textContent = note;
    setTimeout(() => { footHint.textContent = hint(); }, 2600);
  }
  return true;
}

/* ---------------- 更多面板 ---------------- */

const moreMsg = el('gistMsg');

function setGistMsg(text, isErr) {
  moreMsg.textContent = text || '';
  moreMsg.classList.toggle('err', Boolean(isErr));
}

function openMore() {
  el('langSel').value = lang;
  el('notifyState').textContent = notifyOn ? '已开启' : (('Notification' in window) && Notification.permission === 'denied' ? '已被浏览器拒绝' : '已关闭');
  el('btn-notify').textContent = notifyOn ? '关闭通知' : '开启通知';
  try {
    const g = JSON.parse(localStorage.getItem(GIST_KEY) || '{}');
    if (g.token) { el('gistToken').value = g.token; el('gistRemember').checked = true; }
  } catch (_) {}
  renderRewind();
  renderTerms(el('termSearch').value.trim());
  renderStats();
  el('btn-install').hidden = !installPrompt;
  moreModal.hidden = false;
}

function closeMore() { moreModal.hidden = true; }

function renderRewind() {
  const box = el('rewindList');
  box.textContent = '';
  if (!checkpoints.length) {
    const p = document.createElement('p');
    p.className = 'rewind-empty';
    p.textContent = '还没有可回溯的选择点。';
    box.appendChild(p);
    return;
  }
  [...checkpoints].reverse().forEach((cp, n) => {
    const realIdx = checkpoints.length - 1 - n;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'rewind-item';
    const idx = document.createElement('span');
    idx.className = 'idx';
    idx.textContent = `#${realIdx + 1}`;
    const meta = document.createElement('div');
    meta.className = 'meta';
    const where = document.createElement('div');
    where.className = 'where';
    where.textContent = cp.passage;
    const what = document.createElement('div');
    what.className = 'what';
    what.textContent = `你当时选了「${cp.choice}」 · ${fmtTime(cp.at)}`;
    meta.append(where, what);
    b.append(idx, meta);
    b.addEventListener('click', () => {
      if (!confirm('回到这个选择点？当前进度会被覆盖。')) return;
      applyCheckpoint(realIdx);
    });
    box.appendChild(b);
  });
}

function applyCheckpoint(index) {
  const cp = checkpoints[index];
  if (!cp) return;
  gen += 1;
  clearInteractions();
  vars = { ...cp.vars };
  log = log.slice(0, Math.max(0, cp.logLen || 0));
  checkpoints = checkpoints.slice(0, index);
  rebuildChat();
  newRun(cp.passage, cp.idx, { skipPrefix: true });
  writeSave();
  closeMore();
  footHint.textContent = `已回到选择点 #${index + 1}`;
  setTimeout(() => { footHint.textContent = hint(); }, 2600);
}

function renderTerms(q) {
  const box = el('termList');
  box.textContent = '';
  if (lang !== 'cn') {
    const p = document.createElement('p');
    p.className = 'rewind-empty';
    p.textContent = '词典目前只收录中文词条。';
    box.appendChild(p);
    return;
  }
  const items = glossary.filter((t) => {
    if (!q) return true;
    return t.k.includes(q) || (t.a || []).some((a) => a.includes(q)) || t.d.includes(q);
  });
  if (!items.length) {
    const p = document.createElement('p');
    p.className = 'rewind-empty';
    p.textContent = '没有匹配的词条。';
    box.appendChild(p);
    return;
  }
  for (const t of items) {
    const item = document.createElement('div');
    item.className = 'term-item';
    const title = document.createElement('b');
    title.textContent = t.k;
    item.appendChild(title);
    if (t.a && t.a.length) {
      const alias = document.createElement('span');
      alias.className = 'alias';
      alias.textContent = t.a.join(' / ');
      item.appendChild(alias);
    }
    const p = document.createElement('p');
    p.textContent = t.d;
    item.appendChild(p);
    box.appendChild(item);
  }
}

function showTerm(word) {
  el('termSearch').value = word;
  openMore();
  renderTerms(word);
  el('termList').scrollTop = 0;
}

function renderStats() {
  const box = el('statsBox');
  box.textContent = '';
  const items = [
    ['游玩次数', stats.sessions],
    ['收到消息', stats.messages],
    ['做出选择', stats.choices],
    ['到访段落', stats.passages],
    ['抵达结局', stats.endings],
    ['可回溯点', checkpoints.length],
  ];
  for (const [k, v] of items) {
    const d = document.createElement('div');
    d.className = 'stat';
    const kk = document.createElement('span');
    kk.className = 'k';
    kk.textContent = k;
    const vv = document.createElement('span');
    vv.className = 'v';
    vv.textContent = String(v);
    d.append(kk, vv);
    box.appendChild(d);
  }
}

/* ---------------- 云存档（GitHub Gist） ---------------- */

function rememberToken(token) {
  try {
    if (el('gistRemember').checked && token) localStorage.setItem(GIST_KEY, JSON.stringify({ token }));
    else localStorage.removeItem(GIST_KEY);
  } catch (_) {}
}

async function gistUpload() {
  const token = el('gistToken').value.trim();
  if (!token) { setGistMsg('请先填入 GitHub 令牌（需 gist 权限）', true); return; }
  setGistMsg('正在上传…');
  try {
    const res = await fetch('https://api.github.com/gists', {
      method: 'POST',
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        description: '生命线 · Lifeline 存档',
        public: false,
        files: { 'lifeline-save.json': { content: JSON.stringify(snapshot(), null, 2) } },
      }),
    });
    if (!res.ok) throw new Error(`GitHub 返回 HTTP ${res.status}`);
    const j = await res.json();
    gistInfo = { id: j.id, url: j.html_url };
    rememberToken(token);
    el('gistId').value = j.id;
    setGistMsg(`已上传：${j.html_url}`);
  } catch (err) {
    setGistMsg('上传失败：' + (err.message || '网络错误'), true);
  }
}

function shareUrl(id) {
  const u = new URL(location.href);
  u.search = '';
  u.searchParams.set('gist', id);
  if (lang !== 'cn') u.searchParams.set('lang', lang);
  return u.toString();
}

async function gistShare() {
  const id = gistInfo && gistInfo.id ? gistInfo.id : el('gistId').value.trim();
  if (!id) { setGistMsg('还没有可分享的 Gist，请先上传或填入 ID', true); return; }
  const url = shareUrl(id);
  try {
    await navigator.clipboard.writeText(url);
    setGistMsg('分享链接已复制：' + url);
  } catch (_) {
    el('gistId').value = url;
    setGistMsg('已生成链接，请手动复制：' + url);
  }
}

async function gistDownload(idOrUrl, auto) {
  const raw = String(idOrUrl || '').trim();
  const id = (raw.match(/[0-9a-f]{20,}/i) || [raw])[0];
  if (!id) { setGistMsg('请填入 Gist ID 或链接', true); return; }
  setGistMsg('正在从 Gist 读取…');
  try {
    const res = await fetch(`https://api.github.com/gists/${id}`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) throw new Error(`GitHub 返回 HTTP ${res.status}`);
    const j = await res.json();
    const file = j.files['lifeline-save.json'] || Object.values(j.files)[0];
    if (!file) throw new Error('这个 Gist 里没有存档文件');
    let content = file.content;
    if (file.truncated && file.raw_url) content = await (await fetch(file.raw_url)).text();
    gistInfo = { id: j.id, url: j.html_url };
    const ok = applySave(JSON.parse(content), auto ? '已从分享链接恢复进度' : '已从 Gist 恢复进度');
    if (ok) setGistMsg(`已恢复：${j.html_url}`);
  } catch (err) {
    setGistMsg('读取失败：' + (err.message || '网络错误'), true);
  }
}

/* ---------------- 启动 ---------------- */

async function loadLangPack(code) {
  const [storyText, stringsText] = await Promise.all([
    fetch(`data/story_${code}.txt`).then((r) => { if (!r.ok) throw new Error(r.status); return r.text(); }),
    fetch(`data/strings_${code}.xml`).then((r) => { if (!r.ok) throw new Error(r.status); return r.text(); }),
  ]);
  const raw = parseStory(storyText);
  const map = new Map();
  for (const [name, lines] of raw) map.set(name, tokenizePassage(lines));
  strings = parseStrings(stringsText);
  return map;
}

async function loadGlossary(code) {
  glossary = [];
  termRe = null;
  if (code !== 'cn') return;
  try {
    const r = await fetch('data/glossary_cn.json');
    if (r.ok) {
      const j = await r.json();
      glossary = j.terms || [];
      buildTermRe();
    }
  } catch (_) { /* 词典缺失不影响游戏 */ }
}

async function boot() {
  loadPrefs();
  lang = pickLang();
  document.documentElement.lang = lang === 'cn' ? 'zh-CN' : lang;
  applyChrome();
  el('langSel').value = lang;

  story = await loadLangPack(lang);
  await loadGlossary(lang);
  loadStats();
  bump('sessions');
  initAudio();

  const save = loadAutoSave();
  if (save && !story.has(save.passage)) { save.passage = 'Start'; save.idx = 0; }
  if (save) checkpoints = (save.checkpoints || []).map((c) => ({ ...c }));
  if (save && save.log && save.log.length) el('btn-continue').hidden = false;

  /* ---- 开场 ---- */
  el('btn-start').addEventListener('click', () => {
    el('splash').hidden = true;
    el('app').hidden = false;
    startAmbience();
    vars = {};
    log = [];
    checkpoints = [];
    chat.textContent = '';
    try { localStorage.removeItem(AUTO_KEY); localStorage.removeItem(LEGACY_KEY); } catch (_) {}
    newRun('Start', 0);
  });

  el('btn-continue').addEventListener('click', () => {
    el('splash').hidden = true;
    el('app').hidden = false;
    startAmbience();
    vars = (save && save.vars) || {};
    log = (save && save.log) || [];
    checkpoints = (save && save.checkpoints) || [];
    rebuildChat();
    newRun(save.passage || 'Start', save.idx || 0);
  });

  /* ---- 顶栏 ---- */
  btnSpeed.addEventListener('click', () => {
    fast = !fast;
    btnSpeed.textContent = fast ? chrome().speedOn : chrome().speedOff;
    savePrefs();
  });

  btnSound.addEventListener('click', () => {
    soundOn = !soundOn;
    btnSound.textContent = soundOn ? chrome().soundOn : chrome().soundOff;
    savePrefs();
    if (!ambience) return;
    if (soundOn) ambience.play().catch(() => {});
    else ambience.pause();
  });

  btnRestart.addEventListener('click', restart);

  /* ---- 存档弹窗 ---- */
  el('btn-save').addEventListener('click', openSave);
  el('saveClose').addEventListener('click', closeSave);
  saveModal.addEventListener('click', (e) => { if (e.target === saveModal) closeSave(); });

  el('btn-export-file').addEventListener('click', () => {
    download(snapshot());
    setSaveMsg('已开始下载存档文件');
  });

  el('btn-import-file').addEventListener('click', () => el('fileInput').click());
  el('fileInput').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      applySave(await readFile(file), '已导入存档文件');
    } catch (err) { setSaveMsg(err.message || '导入失败', true); }
  });

  el('btn-copy-code').addEventListener('click', async () => {
    try {
      const code = await toCode(snapshot());
      codeBox.value = code;
      codeBox.focus();
      codeBox.select();
      setSaveMsg('已生成进度码，正在尝试复制…');
      Promise.resolve(navigator.clipboard.writeText(code))
        .then(() => setSaveMsg('进度码已复制到剪贴板'))
        .catch(() => setSaveMsg('已生成进度码，请手动复制文本框内容'));
    } catch (err) { setSaveMsg('生成进度码失败：' + err.message, true); }
  });

  el('btn-paste-code').addEventListener('click', async () => {
    const fallback = () => {
      codeBox.focus();
      setSaveMsg('浏览器不允许读取剪贴板，请手动粘贴（Ctrl+V）', true);
    };
    try {
      const text = await Promise.race([
        navigator.clipboard.readText(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1200)),
      ]);
      codeBox.value = text;
      setSaveMsg('已从剪贴板粘贴');
    } catch (_) { fallback(); }
  });

  el('btn-import-code').addEventListener('click', async () => {
    try {
      applySave(await fromCode(codeBox.value), '已从进度码继续');
    } catch (err) { setSaveMsg('进度码导入失败：' + err.message, true); }
  });

  /* ---- 更多弹窗 ---- */
  el('btn-more').addEventListener('click', openMore);
  el('moreClose').addEventListener('click', closeMore);
  moreModal.addEventListener('click', (e) => { if (e.target === moreModal) closeMore(); });

  el('langSel').addEventListener('change', () => {
    const v = el('langSel').value;
    try { localStorage.setItem(LANG_KEY, v); } catch (_) {}
    flushSave();
    const u = new URL(location.href);
    if (v === 'cn') u.searchParams.delete('lang'); else u.searchParams.set('lang', v);
    location.href = u.toString();
  });

  el('termSearch').addEventListener('input', () => renderTerms(el('termSearch').value.trim()));

  el('btn-notify').addEventListener('click', async () => {
    if (!('Notification' in window)) { el('notifyState').textContent = '此浏览器不支持通知'; return; }
    if (Notification.permission === 'denied') { el('notifyState').textContent = '已被浏览器拒绝，请在站点设置里允许'; return; }
    if (Notification.permission !== 'granted') {
      try { await Notification.requestPermission(); } catch (_) {}
    }
    notifyOn = Notification.permission === 'granted' ? !notifyOn : false;
    savePrefs();
    el('btn-notify').textContent = notifyOn ? '关闭通知' : '开启通知';
    el('notifyState').textContent = notifyOn ? '已开启' : '已关闭';
    if (notifyOn) {
      try { new Notification('生命线', { body: '通知已开启：页面在后台时会收到提醒。', icon: 'assets/img/notification_icon_with_color.png' }); } catch (_) {}
    }
  });

  el('btn-gist-up').addEventListener('click', gistUpload);
  el('btn-gist-down').addEventListener('click', () => gistDownload(el('gistId').value, false));
  el('btn-gist-share').addEventListener('click', gistShare);

  el('btn-clear-local').addEventListener('click', () => {
    if (!confirm('清除本机的存档、槽位、统计与回溯记录？此操作不可撤销。')) return;
    try {
      for (const k of [AUTO_KEY, LEGACY_KEY, STATS_KEY, PREFS, GIST_KEY]) localStorage.removeItem(k);
      for (let n = 1; n <= 3; n += 1) localStorage.removeItem(slotKey(n));
    } catch (_) {}
    stats = blankStats();
    checkpoints = [];
    renderStats();
    setGistMsg('已清除本机数据');
  });

  el('btn-install').addEventListener('click', async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    try { await installPrompt.userChoice; } catch (_) {}
    installPrompt = null;
    el('btn-install').hidden = true;
  });

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt = e;
    if (!moreModal.hidden) el('btn-install').hidden = false;
  });

  /* ---- 键盘 ---- */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!saveModal.hidden) { closeSave(); return; }
      if (!moreModal.hidden) { closeMore(); return; }
    }
    if (!saveModal.hidden || !moreModal.hidden) return;
    if (!typing.hidden && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); skipTyping = true; return; }
    if (!choicesBox.hidden && /^[1-9]$/.test(e.key)) {
      const btns = choicesBox.querySelectorAll('.choice');
      const idx = Number(e.key) - 1;
      if (btns[idx]) { e.preventDefault(); btns[idx].click(); }
    }
  });

  /* ---- 点击正文跳过逐字输出 ---- */
  chat.addEventListener('click', () => { if (!typing.hidden) skipTyping = true; });

  /* ---- 离开页面 ---- */
  window.addEventListener('pagehide', flushSave);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushSave();
  });

  /* ---- PWA ---- */
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* 非 https 或本地调试时忽略 */ });
  }

  /* ---- 分享链接里的 gist ---- */
  const gid = new URLSearchParams(location.search).get('gist');
  if (gid) {
    el('splash').hidden = true;
    el('app').hidden = false;
    startAmbience();
    await gistDownload(gid, true).catch(() => {});
  }

  window.__ll = {
    vars: () => vars,
    current: () => current,
    passages: () => [...story.keys()],
    textOf: (name) => (story.get(name) || []).map((t) => t.type).slice(0, 40),
    save: () => snapshot(),
    apply: (s) => applySave(s, '已由调试接口导入'),
    openSave,
    openMore,
    rewind: (i) => applyCheckpoint(i),
    checkpoints: () => checkpoints,
    stats: () => stats,
    lang: () => lang,
  };
}

boot().catch((err) => {
  el('splash').hidden = true;
  el('app').hidden = false;
  addMsg('sys', '故事数据加载失败：' + err.message);
  addMsg('sys', '请通过本地服务器打开（例如 python -m http.server），不要直接双击 index.html。');
});
