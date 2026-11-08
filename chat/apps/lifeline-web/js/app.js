// app.js —— 界面、DSL 逐 token 执行、存档与音频
import {
  parseStory, parseStrings, evalCondition, applySet, substitute,
  parseChoices, parseTransition, parseTextInput
} from './engine.js';
import {
  capture, validate, toCode, fromCode, download, readFile,
  slotKey, AUTO_KEY, LEGACY_KEY
} from './save.js';

const PREFS = 'lifeline.web.prefs.v1';
const DEFAULT_HINT = '信号已接入 · 回复会传回地面';
const TOKEN_RE = /<<[^>]*>>|\[\[[^\]]*\]\]/g;

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

let story = null;        // Map<段落名, token[]>
let strings = {};
let vars = {};
let log = [];
let gen = 0;
let fast = true;
let soundOn = true;

let choiceCancel = null;
let inputCancel = null;
let ambience = null;
let blips = [];
let tap = null;

/* ---------------- 基础工具 ---------------- */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

function typeDelay(text) {
  const len = text.length;
  return fast ? clamp(200 + len * 9, 260, 1300) : clamp(500 + len * 26, 700, 3000);
}

function fmtDur(sec) {
  if (sec >= 3600) return `${Math.round(sec / 3600)} 小时`;
  if (sec >= 60) return `${Math.round(sec / 60)} 分钟`;
  return `${sec} 秒`;
}

const scrollBottom = () => { chat.scrollTop = chat.scrollHeight; };

function speaker() {
  return String(vars.inBridgeContent) === '1' ? '梅兰妮' : '泰勒';
}

/* ---------------- 把段落切成 token ---------------- */

function tokenizePassage(lines) {
  const tokens = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    // 整行是跳转（含延迟）
    const tr = parseTransition(line);
    if (tr) { tokens.push({ type: 'link', target: tr.target, delay: tr.delaySec }); continue; }

    // 带选项的行
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

    // 带输入框的行
    if (line.includes('<<textinput')) {
      const ti = parseTextInput(line);
      if (ti) {
        const prefix = line.replace(/<<textinput[\s\S]*?>>/g, ' ').trim();
        tokens.push({ type: 'input', ...ti, prefix });
        continue;
      }
    }

    // 普通行：按 <<...>> / [[...]] 切段
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
  return { type: 'ignore' };   // <<category>>、<<netcheck>>、<<sendemail>> 等
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

function addMsg(kind, text) {
  const node = document.createElement('div');
  node.className = 'msg' + (kind === 'me' ? ' me' : kind === 'sys' ? ' sys' : '');
  if (kind === 'them') {
    const who = document.createElement('span');
    who.className = 'who';
    who.textContent = speaker();
    node.appendChild(who);
  }
  node.appendChild(document.createTextNode(text));
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
  await sleep(typeDelay(text));
  typing.hidden = true;
  if (myGen !== gen) return false;
  addMsg('them', text);
  blip();
  return true;
}

let saveTimer = null;

function snapshot() {
  return capture({ passage: current.passage, idx: current.idx, vars, log });
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
  try { localStorage.setItem(PREFS, JSON.stringify({ fast, soundOn })); } catch (_) {}
}

function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS) || '{}');
    if (typeof p.fast === 'boolean') fast = p.fast;
    if (typeof p.soundOn === 'boolean') soundOn = p.soundOn;
  } catch (_) {}
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
      footHint.textContent = DEFAULT_HINT;
      footHint.onclick = null;
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
    opts.forEach((o) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'choice';
      b.textContent = substitute(o.text, vars);
      b.addEventListener('click', () => { tapSound(); finish(o); });
      choicesBox.appendChild(b);
    });
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

async function runPassage(name, startIdx, myGen) {
  const tokens = story.get(name);
  // 存档可能停在段落末尾（最后一个 token 已消费、跳转尚未发生）；
  // 这时回退到最近的跳转/选择 token，让玩家重新决策，而不是卡死。
  let at = Math.max(0, Math.min(startIdx, tokens ? tokens.length : 0));
  if (tokens && at >= tokens.length) at = resumeIndex(tokens);
  current = { passage: name, idx: at };
  saveState();
  if (!tokens) { addMsg('sys', `（缺少段落：${name}）`); return; }

  const jumps = new Map();
  let silent = false;

  for (let i = at; i < tokens.length; ) {
    if (myGen !== gen) return;
    if (jumps.has(i)) { i = jumps.get(i); continue; }

    const tk = tokens[i];
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
        if (tk.prefix && !silent) {
          if (!(await say(substitute(tk.prefix, vars), myGen))) return;
        }
        const picked = await choose(tk.opts);
        if (myGen !== gen || !picked) return;
        addMsg('me', substitute(picked.text, vars));
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
        if (!tk.target) { footHint.textContent = DEFAULT_HINT; return; }
        return runPassage(tk.target, 0, myGen);
      }

      default:
        break;
    }
  }
  footHint.textContent = DEFAULT_HINT;
}

/* ---------------- 流程控制 ---------------- */

function newRun(passage, idx) {
  gen += 1;
  clearInteractions();
  return runPassage(passage, idx, gen);
}

function rebuildChat() {
  chat.textContent = '';
  for (const item of log) {
    if (item.k === 'sys') {
      const n = document.createElement('div');
      n.className = 'msg sys';
      n.textContent = item.t;
      chat.appendChild(n);
    } else {
      const n = document.createElement('div');
      n.className = 'msg' + (item.k === 'me' ? ' me' : '');
      if (item.k === 'them') {
        const who = document.createElement('span');
        who.className = 'who';
        who.textContent = speaker();
        n.appendChild(who);
      }
      n.appendChild(document.createTextNode(item.t));
      chat.appendChild(n);
    }
  }
  scrollBottom();
}

function restart() {
  if (!confirm('要重新开始故事吗？当前进度会被清除。')) return;
  gen += 1;
  clearInteractions();
  vars = {};
  log = [];
  chat.textContent = '';
  footHint.textContent = DEFAULT_HINT;
  try { localStorage.removeItem(AUTO_KEY); localStorage.removeItem(LEGACY_KEY); } catch (_) {}
  newRun('Start', 0);
}

/* ---------------- 存档界面 ---------------- */

const saveModal = el('saveModal');
const autoInfo = el('autoInfo');
const slotsBox = el('slots');
const codeBox = el('codeBox');
const saveMsg = el('saveMsg');

function setSaveMsg(text, isErr) {
  saveMsg.textContent = text || '';
  saveMsg.classList.toggle('err', Boolean(isErr));
}

function fmtTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('zh-CN', {
    hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
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
    setTimeout(() => { footHint.textContent = DEFAULT_HINT; }, 2600);
  }
  return true;
}

/* ---------------- 启动 ---------------- */

async function boot() {
  loadPrefs();
  btnSpeed.textContent = fast ? '快进 · 开' : '快进 · 关';
  btnSound.textContent = soundOn ? '声音 · 开' : '声音 · 关';

  const [storyText, stringsText] = await Promise.all([
    fetch('data/story_cn.txt').then((r) => { if (!r.ok) throw new Error(r.status); return r.text(); }),
    fetch('data/strings_cn.xml').then((r) => { if (!r.ok) throw new Error(r.status); return r.text(); }),
  ]);
  const raw = parseStory(storyText);
  story = new Map();
  for (const [name, lines] of raw) story.set(name, tokenizePassage(lines));
  strings = parseStrings(stringsText);
  initAudio();

  const save = loadAutoSave();
  if (save && save.log && save.log.length) el('btn-continue').hidden = false;

  el('btn-start').addEventListener('click', () => {
    el('splash').hidden = true;
    el('app').hidden = false;
    startAmbience();
    vars = {};
    log = [];
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
    rebuildChat();
    newRun(save.passage || 'Start', save.idx || 0);
  });

  btnSpeed.addEventListener('click', () => {
    fast = !fast;
    btnSpeed.textContent = fast ? '快进 · 开' : '快进 · 关';
    savePrefs();
  });

  btnSound.addEventListener('click', () => {
    soundOn = !soundOn;
    btnSound.textContent = soundOn ? '声音 · 开' : '声音 · 关';
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
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !saveModal.hidden) closeSave();
  });

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
      // 剪贴板权限在某些浏览器里会一直挂起，不能阻塞界面
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

  window.addEventListener('pagehide', flushSave);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushSave();
  });

  window.__ll = {
    vars: () => vars,
    current: () => current,
    passages: () => [...story.keys()],
    textOf: (name) => (story.get(name) || []).map((t) => t.type).slice(0, 40),
    save: () => snapshot(),
    apply: (s) => applySave(s, '已由调试接口导入'),
    openSave,
  };
}

boot().catch((err) => {
  el('splash').hidden = true;
  el('app').hidden = false;
  addMsg('sys', '故事数据加载失败：' + err.message);
  addMsg('sys', '请通过本地服务器打开（例如 python -m http.server），不要直接双击 index.html。');
});
