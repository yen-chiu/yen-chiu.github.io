// save.js —— 存档的捕获、校验、分享码与文件导入导出
//
// 存档版本 2：
//   { ver:2, app:'lifeline-web', passage, idx, vars, log, savedAt }
// 兼容读取旧版（ver:1，键同 v1 的 passage/idx/vars/log/ts）。
//
// 分享码（进度码）只含进度，不含聊天记录：
//   LL2.<base64url(utf8 json)>          未压缩
//   LL2z.<base64url(deflate-raw utf8)>  压缩（浏览器支持 CompressionStream 时）

export const APP_ID = 'lifeline-web';
export const SAVE_VERSION = 2;

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64u(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function unb64u(str) {
  const s = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deflate(bytes) {
  if (typeof CompressionStream === 'undefined') return null;
  try {
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch (_) { return null; }
}

async function inflate(bytes) {
  if (typeof DecompressionStream === 'undefined') throw new Error('此浏览器不支持解压进度码');
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export function capture({ passage, idx, vars, log }) {
  return {
    ver: SAVE_VERSION,
    app: APP_ID,
    passage,
    idx: Number(idx) || 0,
    vars: { ...vars },
    log: (log || []).map((m) => ({ k: m.k, t: m.t })),
    savedAt: new Date().toISOString(),
  };
}

/** 精简：去掉聊天记录，用于“进度码” */
export function slim(save) {
  return {
    ver: SAVE_VERSION,
    app: APP_ID,
    passage: save.passage,
    idx: save.idx,
    vars: save.vars,
    savedAt: save.savedAt || new Date().toISOString(),
    slim: true,
  };
}

/** 校验并归一化；story 用于确认段落存在 */
export function validate(raw, story) {
  if (!raw || typeof raw !== 'object') return { ok: false, error: '不是有效的存档对象' };
  if (raw.app && raw.app !== APP_ID) return { ok: false, error: '这不是《生命线》的存档' };

  const ver = Number(raw.ver) || 1;
  if (ver !== 1 && ver !== 2) return { ok: false, error: `不支持的存档版本：${raw.ver}` };

  const passage = typeof raw.passage === 'string' ? raw.passage : '';
  if (!passage) return { ok: false, error: '存档缺少段落信息' };
  if (story && !story.has(passage)) return { ok: false, error: `存档指向的段落不存在：${passage}` };

  const idx = Number.isFinite(Number(raw.idx)) ? Math.max(0, Math.floor(Number(raw.idx))) : 0;
  const vars = raw.vars && typeof raw.vars === 'object' && !Array.isArray(raw.vars) ? raw.vars : {};
  const log = Array.isArray(raw.log)
    ? raw.log.filter((m) => m && typeof m.t === 'string' && ['them', 'me', 'sys'].includes(m.k))
        .map((m) => ({ k: m.k, t: m.t }))
    : [];

  return {
    ok: true,
    save: {
      ver: SAVE_VERSION,
      app: APP_ID,
      passage,
      idx,
      vars,
      log,
      savedAt: typeof raw.savedAt === 'string' ? raw.savedAt : (typeof raw.ts === 'number' ? new Date(raw.ts).toISOString() : new Date().toISOString()),
    },
    slim: raw.slim === true || log.length === 0,
  };
}

/** 生成进度码（不含聊天记录） */
export async function toCode(save) {
  const payload = enc.encode(JSON.stringify(slim(save)));
  const packed = await deflate(payload);
  if (packed) return 'LL2z.' + b64u(packed);
  return 'LL2.' + b64u(payload);
}

/** 解析进度码或整段存档 JSON 文本 */
export async function fromCode(text) {
  const str = String(text || '').trim();
  if (!str) throw new Error('进度码为空');

  if (str.startsWith('{')) {
    return JSON.parse(str);
  }
  const m = str.match(/^LL(\d)(z?)\.([A-Za-z0-9_-]+)$/);
  if (!m) throw new Error('进度码格式不正确（应以 LL2. 或 LL2z. 开头）');
  const packed = Boolean(m[2]);
  const bytes = unb64u(m[3]);
  const json = packed ? dec.decode(await inflate(bytes)) : dec.decode(bytes);
  return JSON.parse(json);
}

export function fileName(save) {
  const d = new Date(save.savedAt || Date.now());
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  const where = String(save.passage || 'save').replace(/[^\w\u4e00-\u9fa5-]+/g, '_').slice(0, 24);
  return `lifeline-${stamp}-${where}.json`;
}

export function download(save) {
  const blob = new Blob([JSON.stringify(save, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName(save);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try { resolve(JSON.parse(String(reader.result))); }
      catch (_) { reject(new Error('文件不是有效的 JSON')); }
    };
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsText(file);
  });
}

export function slotKey(n) { return `lifeline.web.slot.v2.${n}`; }
export const AUTO_KEY = 'lifeline.web.save.v2';
export const LEGACY_KEY = 'lifeline.web.save.v1';
