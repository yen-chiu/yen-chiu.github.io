/*!
 * 写作台 —— 在浏览器里直接编辑 / 上传 / 发布博客文章
 * ---------------------------------------------------------------------------
 * 纯前端实现：所有请求直连 GitHub REST API，令牌只保存在本机浏览器。
 * 不依赖构建工具，直接以普通 script 加载。
 */
(function () {
  'use strict';

  var API_DEFAULT = 'https://api.github.com';
  var LS_KEY = 'wx-admin-config';
  var DRAFT_PREFIX = 'wx-admin-draft:';
  var MAX_IMAGE = 1600;
  var JPEG_QUALITY = 0.86;

  /* ------------------------------------------------------------------ *
   * 状态
   * ------------------------------------------------------------------ */

  var state = {
    token: '',
    tokenSource: 'pat', // 'pat' | 'oauth'
    tokenExpiresAt: 0,
    refreshToken: '',
    authBase: '',
    owner: '',
    repo: '',
    branch: '',
    draftMode: false,
    apiBase: API_DEFAULT,
    files: [],
    filter: '',
    current: null, // { path, sha, isNew }
    original: '', // 载入时的完整文本，用于 dirty 判断
    saving: false
  };

  /* ------------------------------------------------------------------ *
   * 小工具
   * ------------------------------------------------------------------ */

  function $(sel) {
    return document.querySelector(sel);
  }

  function echo(el, text) {
    if (el) el.textContent = text == null ? '' : String(text);
  }

  function b64encode(str) {
    var bytes = new TextEncoder().encode(str);
    var bin = '';
    for (var i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function b64decode(b64) {
    var bin = atob(String(b64).replace(/\s/g, ''));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function pad(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function slugify(title) {
    return String(title || '')
      .trim()
      .replace(/[\\/:*?"<>|#%{}^~[\]`]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'untitled';
  }

  var toastTimer = null;
  function toast(html, isError, ms) {
    var el = $('#adm-toast');
    if (!el) return;
    el.innerHTML = html;
    el.classList.toggle('is-error', !!isError);
    el.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      el.hidden = true;
    }, ms || 4200);
  }

  function status(text) {
    echo($('#adm-status'), text);
  }

  /* ------------------------------------------------------------------ *
   * 配置持久化
   * ------------------------------------------------------------------ */

  function isLocalHost() {
    return /^(127\.0\.0\.1|localhost|\[::1\])$/.test(location.hostname);
  }

  function resolveApiBase() {
    var fromQuery = new URLSearchParams(location.search).get('api');
    if (isLocalHost() && fromQuery && /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(fromQuery)) {
      return fromQuery;
    }
    if (isLocalHost()) {
      var stored = localStorage.getItem('wx-admin-api');
      if (stored && /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(stored)) return stored;
    }
    return API_DEFAULT;
  }

  /** 解析登录代理地址：优先 ?auth=（仅本机调试），其次 data-auth 属性 */
  function resolveAuthBase() {
    var fromQuery = new URLSearchParams(location.search).get('auth');
    if (isLocalHost() && fromQuery && /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(fromQuery)) {
      return fromQuery.replace(/\/$/, '');
    }
    var root = document.getElementById('wx-admin');
    var attr = root && root.dataset ? root.dataset.auth : '';
    return attr ? String(attr).replace(/\/$/, '') : '';
  }

  function loadConfig() {
    var cfg = null;
    try {
      cfg = JSON.parse(localStorage.getItem(LS_KEY) || sessionStorage.getItem(LS_KEY) || 'null');
    } catch (e) {
      cfg = null;
    }
    state.apiBase = resolveApiBase();
    state.authBase = resolveAuthBase();
    if (!cfg) return false;
    state.token = cfg.token || '';
    state.owner = cfg.owner || '';
    state.repo = cfg.repo || '';
    state.branch = cfg.branch || '';
    state.tokenSource = cfg.source || 'pat';
    state.tokenExpiresAt = cfg.expires_at || 0;
    state.refreshToken = ''; // refresh_token 不再持久化
    if (cfg.refresh_token) {
      // 旧版本写入的刷新令牌：顺手擦掉，避免长期凭据留在本机
      try {
        delete cfg.refresh_token;
        var store = localStorage.getItem(LS_KEY) ? localStorage : sessionStorage;
        store.setItem(LS_KEY, JSON.stringify(cfg));
      } catch (e) {
        /* ignore */
      }
    }
    // OAuth 令牌过期则视为未登录
    if (state.tokenExpiresAt && Date.now() > state.tokenExpiresAt) {
      state.token = '';
      return false;
    }
    return !!(state.token && state.owner && state.repo);
  }

  function saveConfig(token, owner, repo, branch, remember) {
    var cfg = {
      token: token,
      owner: owner,
      repo: repo,
      branch: branch,
      source: state.tokenSource || 'pat',
      expires_at: state.tokenExpiresAt || 0
    };
    try {
      if (remember) {
        localStorage.setItem(LS_KEY, JSON.stringify(cfg));
        sessionStorage.removeItem(LS_KEY);
      } else {
        sessionStorage.setItem(LS_KEY, JSON.stringify(cfg));
        localStorage.removeItem(LS_KEY);
      }
    } catch (e) {
      /* 隐私模式下可能写不进去，忽略 */
    }
  }

  /**
   * 文章列表抽屉的统一开关。
   * 窄屏下抽屉是覆盖层：必须同时控制遮罩，并提供明确的关闭路径
   * （右上角 ✕ / 点遮罩 / Esc / 新建或载入后自动收起）。
   */
  function setSideOpen(open) {
    var side = $('#adm-side');
    var backdrop = $('#adm-backdrop');
    var toggle = $('#adm-toggle-list');
    if (side) side.classList.toggle('is-open', !!open);
    if (backdrop) backdrop.hidden = !open;
    if (toggle) toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    document.body.classList.toggle('adm-drawer-open', !!open);
  }

  function clearConfig() {
    try {
      localStorage.removeItem(LS_KEY);
      sessionStorage.removeItem(LS_KEY);
    } catch (e) {
      /* ignore */
    }
  }

  /** 只在用户显式登出时调用：清掉本地草稿（未发布的文章正文） */
  function purgeDrafts() {
    try {
      [localStorage, sessionStorage].forEach(function (store) {
        var doomed = [];
        for (var i = 0; i < store.length; i += 1) {
          var key = store.key(i);
          if (key && key.indexOf(DRAFT_PREFIX) === 0) doomed.push(key);
        }
        doomed.forEach(function (key) {
          store.removeItem(key);
        });
      });
    } catch (e) {
      /* ignore */
    }
  }

  /* ------------------------------------------------------------------ *
   * GitHub API
   * ------------------------------------------------------------------ */

  function api(path, options) {
    options = options || {};
    var headers = {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + state.token,
      'X-GitHub-Api-Version': '2022-11-28'
    };
    if (options.body) headers['Content-Type'] = 'application/json';

    return fetch(state.apiBase + path, {
      method: options.method || 'GET',
      headers: headers,
      body: options.body
    }).then(function (res) {
      var parse = res.status === 204 ? Promise.resolve(null) : res.json().catch(function () {
        return null;
      });
      return parse.then(function (data) {
        if (!res.ok) {
          if (res.status === 401 && state.tokenSource === 'oauth') onAuthExpired();
          var err = new Error((data && data.message) || '请求失败（' + res.status + '）');
          err.status = res.status;
          err.data = data;
          throw err;
        }
        return data;
      });
    });
  }

  /** GitHub 登录到期：清掉本地登录态，回到登录页 */
  function onAuthExpired() {
    if (state.tokenSource !== 'oauth') return;
    state.token = '';
    state.tokenExpiresAt = 0;
    state.refreshToken = '';
    clearConfig();
    var login = $('#adm-login');
    var bench = $('#adm-workbench');
    if (login) login.hidden = false;
    if (bench) bench.hidden = true;
    toast('GitHub 登录已过期（约 8 小时），重新点「使用 GitHub 登录」即可', true, 9000);
  }

  function repoPath(p) {
    return p.split('/').map(encodeURIComponent).join('/');
  }

  function refQuery() {
    return state.branch ? '?ref=' + encodeURIComponent(state.branch) : '';
  }

  /* ------------------------------------------------------------------ *
   * Front matter
   * ------------------------------------------------------------------ */

  function parseFrontMatter(text) {
    var m = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?/.exec(text);
    if (!m) return { raw: '', body: text, data: {} };
    return { raw: m[1], body: text.slice(m[0].length), data: parseYamlLite(m[1]) };
  }

  function parseYamlLite(raw) {
    var data = {};
    var lines = raw.split(/\r?\n/);
    var parent = null;
    for (var i = 0; i < lines.length; i += 1) {
      var line = lines[i];
      if (!line.trim() || /^\s*#/.test(line)) continue;
      var indented = /^\s+/.test(line);
      var kv = /^\s*([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line);
      if (!kv) continue;
      var key = kv[1];
      var value = kv[2];

      if (!indented) parent = null;
      if (!value) {
        if (!indented) {
          parent = key;
          data[key] = data[key] || {};
        }
        continue;
      }
      var parsed = parseYamlValue(value);
      if (indented && parent) {
        if (typeof data[parent] !== 'object' || data[parent] === null) data[parent] = {};
        data[parent][key] = parsed;
      } else {
        data[key] = parsed;
      }
    }
    return data;
  }

  function parseYamlValue(value) {
    var v = value.trim();
    if (/^\[.*\]$/.test(v)) {
      var inner = v.slice(1, -1).trim();
      if (!inner) return [];
      return inner.split(',').map(function (s) {
        return unquote(s.trim());
      });
    }
    if (/^(true|false)$/i.test(v)) return /^true$/i.test(v);
    return unquote(v);
  }

  function unquote(v) {
    if (/^".*"$/.test(v)) {
      return v.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    }
    if (/^'.*'$/.test(v)) return v.slice(1, -1).replace(/''/g, "'");
    return v;
  }

  function yamlString(value) {
    var v = String(value == null ? '' : value);
    if (!v) return '""';
    if (/^[\s>|&*!%@`{}\[\]#-]/.test(v) || /: |\s#|["'\n]/.test(v) || /^(true|false|null|~|\d+(\.\d+)?)$/i.test(v)) {
      return '"' + v.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
    }
    return v;
  }

  function yamlList(list) {
    var items = list.filter(function (s) {
      return String(s).trim() !== '';
    });
    if (!items.length) return '';
    return '[' + items.map(yamlString).join(', ') + ']';
  }

  /* ------------------------------------------------------------------ *
   * 文档模型
   * ------------------------------------------------------------------ */

  /**
   * 把 front matter 里的日期拆成「日期」和「时间」两段，喂给两个原生控件。
   * 之前用 <input type="datetime-local">，在 iOS Safari 和部分 Android 浏览器上
   * 会退化成普通文本框（点不动、也不弹选择器），所以改成 date + time 两个控件。
   */
  function splitDateTime(dateStr) {
    var m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(String(dateStr || ''));
    if (!m) {
      var now = new Date();
      return {
        date: now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()),
        time: pad(now.getHours()) + ':' + pad(now.getMinutes())
      };
    }
    return { date: m[1] + '-' + m[2] + '-' + m[3], time: (m[4] || '00') + ':' + (m[5] || '00') };
  }

  /** 两个控件合回 "YYYY-MM-DD HH:MM:SS +0800"；缺哪个就用当前时间补哪个 */
  function composeDateTime() {
    var dateEl = $('#adm-date');
    var timeEl = $('#adm-time');
    var now = splitDateTime('');
    var date = (dateEl && dateEl.value) || now.date;
    var time = (timeEl && timeEl.value) || now.time;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) date = now.date;
    if (!/^\d{2}:\d{2}$/.test(time)) time = now.time;
    return date + ' ' + time + ':00 +0800';
  }

  function setForm(data) {
    $('#adm-title').value = data.title || '';
    var dt = splitDateTime(data.date);
    $('#adm-date').value = dt.date;
    $('#adm-time').value = dt.time;
    $('#adm-categories').value = toList(data.categories).join(', ');
    $('#adm-tags').value = toList(data.tags).join(', ');
    $('#adm-pin').checked = data.pin === true || data.pin === 'true';
    $('#adm-description').value = typeof data.description === 'string' ? data.description : '';
    var cover = data.image && (data.image.path || data.image);
    $('#adm-cover').value = typeof cover === 'string' ? cover : '';
    $('#adm-cover').dataset.alt = (data.image && data.image.alt) || '';
  }

  /**
   * 列表字段的解析。除了半角逗号，还兼容中文场景里最容易打出来的分隔符：
   * 全角逗号「，」、顿号「、」、中英文分号、竖线、换行。
   * 不兼容的后果很隐蔽：categories: [杂技，综合] 在 YAML 里会被当成**一个**分类。
   */
  function toList(value) {
    if (Array.isArray(value)) {
      return value
        .map(String)
        .map(function (s) {
          return s.trim();
        })
        .filter(Boolean);
    }
    if (value == null || value === '') return [];
    return String(value)
      .split(/[,，、;；|｜\n\r]+/)
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);
  }

  /** 保存前把输入框里的中文分隔符统一成半角，避免写出 YAML 认不出的写法 */
  function normalizeListField(id) {
    var el = $(id);
    if (!el) return;
    var list = toList(el.value);
    var canonical = list.join(', ');
    if (canonical !== el.value) el.value = canonical;
  }

  function composeDocument(body) {
    var title = $('#adm-title').value.trim() || '无标题';
    var date = composeDateTime();
    var categories = toList($('#adm-categories').value);
    var tags = toList($('#adm-tags').value);
    var pin = $('#adm-pin').checked;
    var description = $('#adm-description').value.trim();
    var cover = $('#adm-cover').value.trim();
    var coverAlt = ($('#adm-cover').dataset.alt || '').trim();

    var lines = ['---'];
    lines.push('title: ' + yamlString(title));
    lines.push('date: ' + date);
    if (categories.length) lines.push('categories: ' + yamlList(categories));
    if (tags.length) lines.push('tags: ' + yamlList(tags));
    if (pin) lines.push('pin: true');
    if (description) lines.push('description: ' + yamlString(description));
    if (cover) {
      lines.push('image:');
      lines.push('  path: ' + yamlString(cover));
      if (coverAlt) lines.push('  alt: ' + yamlString(coverAlt));
    }
    lines.push('---');
    lines.push('');
    return lines.join('\n') + body.replace(/^\n+/, '');
  }

  /* ------------------------------------------------------------------ *
   * 列表
   * ------------------------------------------------------------------ */

  function loadFiles() {
    status('正在读取文章列表…');
    return api('/repos/' + state.owner + '/' + state.repo + '/git/trees/' + encodeURIComponent(state.branch || 'HEAD') + '?recursive=1')
      .then(function (tree) {
        state.files = (tree.tree || [])
          .filter(function (node) {
            return node.type === 'blob' && /^_posts\/.+\.(md|markdown)$/i.test(node.path);
          })
          .map(function (node) {
            return { path: node.path, sha: node.sha, size: node.size };
          })
          .sort(function (a, b) {
            return b.path.localeCompare(a.path);
          });
        renderList();
        status('共 ' + state.files.length + ' 篇文章');
        var empty = $('#adm-list-empty');
        if (empty) empty.hidden = state.files.length > 0;
      })
      .catch(function (err) {
        status('列表加载失败：' + err.message);
        toast(escapeHtml(err.message), true);
      });
  }

  function displayTitle(path) {
    var name = path.split('/').pop().replace(/\.(md|markdown)$/i, '');
    return name.replace(/^\d{4}-\d{2}-\d{2}-/, '');
  }

  function renderList() {
    var list = $('#adm-list');
    if (!list) return;
    var filter = state.filter.toLowerCase();
    list.innerHTML = '';
    state.files
      .filter(function (file) {
        return !filter || file.path.toLowerCase().indexOf(filter) >= 0;
      })
      .forEach(function (file) {
        var li = document.createElement('li');
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.path = file.path;
        if (state.current && state.current.path === file.path) btn.classList.add('is-active');

        var title = document.createElement('span');
        title.className = 'adm-item-title';
        title.textContent = file.path.indexOf('_drafts/') === 0 ? '［草稿］' + displayTitle(file.path) : displayTitle(file.path);

        var meta = document.createElement('span');
        meta.className = 'adm-item-meta';
        var dateMatch = /(\d{4}-\d{2}-\d{2})/.exec(file.path);
        meta.textContent = (dateMatch ? dateMatch[1] + ' · ' : '') + Math.max(1, Math.round((file.size || 0) / 1024)) + ' KB';

        btn.appendChild(title);
        btn.appendChild(meta);
        li.appendChild(btn);
        list.appendChild(li);
      });
  }

  /* ------------------------------------------------------------------ *
   * 打开 / 新建
   * ------------------------------------------------------------------ */

  function openFile(path) {
    status('正在载入…');
    return api('/repos/' + state.owner + '/' + state.repo + '/contents/' + repoPath(path) + refQuery())
      .then(function (data) {
        var text = b64decode(data.content || '');
        var parsed = parseFrontMatter(text);
        setForm(parsed.data);
        $('#adm-content').value = parsed.body;
        resetHistory(parsed.body);
        state.current = { path: path, sha: data.sha, isNew: false };
        state.original = text;
        $('#adm-workbench').hidden = false;
        $('#adm-dirty').hidden = true;
        renderList();
        renderPreview();
        updateCounter();
        status('已载入 ' + path.split('/').pop());
        maybeOfferDraft(path, text);
        setSideOpen(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      })
      .catch(function (err) {
        status('载入失败：' + err.message);
        toast(escapeHtml(err.message), true);
      });
  }

  function newPost() {
    var now = new Date();
    var stamp = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
    var path = '_posts/' + stamp + '-draft.md';
    var template = ['## 小标题', '', '在这里开始写你的正文。', '', '> 提示：可以直接把图片拖进编辑器上传。', ''].join('\n');
    state.current = { path: path, sha: null, isNew: true };
    setForm({
      title: '',
      date: stamp + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':00',
      categories: [],
      tags: []
    });
    $('#adm-content').value = template;
    resetHistory(template);
    state.original = '';
    $('#adm-workbench').hidden = false;
    renderList();
    renderPreview();
    updateCounter();
    $('#adm-dirty').hidden = false;
    setSideOpen(false);
    // 移动端「文章信息」默认收起，新建立即展开并聚焦标题，省一次点击
    var details = $('#adm-details');
    if (details) details.open = true;
    $('#adm-title').focus();
    status('新建文章：' + path);
  }

  /* ------------------------------------------------------------------ *
   * 保存
   * ------------------------------------------------------------------ */

  /**
   * 保存前的格式预检查。返回问题列表（空数组 = 通过）。
   * 思路是「能在本地判断的，就不要等 CI 或 Jekyll 才暴露」。
   */
  function validateDraft() {
    var errors = [];
    var warnings = [];
    var problems = errors;
    var title = $('#adm-title').value.trim();
    if (!title) problems.push('标题不能为空');

    var d = $('#adm-date').value;
    var tm = $('#adm-time').value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) problems.push('日期格式不对，应为 YYYY-MM-DD');
    if (!/^\d{2}:\d{2}$/.test(tm)) problems.push('时间格式不对，应为 HH:MM');

    if (/^\d{4}-\d{2}-\d{2}$/.test(d) && /^\d{2}:\d{2}$/.test(tm)) {
      var when = new Date(d + 'T' + tm + ':00');
      if (!isNaN(when.getTime()) && when.getTime() > Date.now() + 60 * 1000) {
        // 只是提醒，不阻断：作者可能就是提前排稿
        warnings.push('日期在未来：站点配置了 future: false，这篇文章不会立刻出现在博客上');
      }
    }

    var body = $('#adm-content').value;
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(body)) {
      problems.push('正文里含有不可见的控制字符，建议删掉后重写');
    }

    return { errors: errors, warnings: warnings };
  }

  function currentText() {
    return composeDocument($('#adm-content').value);
  }

  function ensureDraftBranch() {
    var base = '/repos/' + state.owner + '/' + state.repo;
    return api(base + '/git/ref/heads/drafts')
      .then(function () {
        return 'drafts';
      })
      .catch(function () {
        return api(base + '/git/ref/heads/' + encodeURIComponent(state.branch || 'master'))
          .then(function (ref) {
            return api(base + '/git/refs', {
              method: 'POST',
              body: JSON.stringify({ ref: 'refs/heads/drafts', sha: ref.object.sha })
            }).then(function () {
              return 'drafts';
            });
          });
      });
  }

  function save() {
    if (state.saving) return;
    if (!state.current) {
      toast('请先打开或新建一篇文章', true);
      return;
    }

    // 先把中文标点归一化，再校验
    normalizeListField('#adm-categories');
    normalizeListField('#adm-tags');
    var report = validateDraft();
    if (report.errors.length) {
      renderPreview();
      toast(
        '<b>格式检查没通过：</b><br>· ' + report.errors.map(escapeHtml).join('<br>· '),
        true,
        9000
      );
      status('保存已取消：' + report.errors[0]);
      return;
    }
    if (report.warnings.length) {
      toast('格式提醒：<br>· ' + report.warnings.map(escapeHtml).join('<br>· '), false, 8000);
    }

    var content = currentText();
    var path = state.current.path;
    var title = $('#adm-title').value.trim();

    // 新文章按标题重命名
    if (state.current.isNew) {
      var dir = path.indexOf('_drafts/') === 0 ? '_drafts/' : '_posts/';
      var datePrefix = /\d{4}-\d{2}-\d{2}/.exec(path);
      var name = (datePrefix ? datePrefix[0] + '-' : '') + slugify(title) + '.md';
      path = dir + name;
    }

    state.saving = true;
    status('正在保存…');
    $('#adm-save').disabled = true;

    var branchPromise = state.draftMode ? ensureDraftBranch() : Promise.resolve(state.branch);
    branchPromise
      .then(function (branch) {
        var body = {
          message: (state.current.isNew ? 'post: 新增 ' : 'post: 更新 ') + (title || path.split('/').pop()) + '（写作台）',
          content: b64encode(content)
        };
        if (state.current.sha) body.sha = state.current.sha;
        // 重命名时：新路径 + 旧 sha 无法直接 PUT，改为先写新文件再删除旧文件
        if (path !== state.current.path && state.current.sha) {
          delete body.sha;
          return api('/repos/' + state.owner + '/' + state.repo + '/contents/' + repoPath(path), {
            method: 'PUT',
            body: JSON.stringify(Object.assign({ branch: branch || undefined }, body))
          }).then(function (res) {
            return api(
              '/repos/' + state.owner + '/' + state.repo + '/contents/' + repoPath(state.current.path),
              {
                method: 'DELETE',
                body: JSON.stringify({
                  message: body.message + '：删除旧文件',
                  sha: state.current.sha,
                  branch: branch || undefined
                })
              }
            ).then(function () {
              return res;
            });
          });
        }
        return api('/repos/' + state.owner + '/' + state.repo + '/contents/' + repoPath(path), {
          method: 'PUT',
          body: JSON.stringify(Object.assign({ branch: branch || undefined }, body))
        });
      })
      .then(function (res) {
        state.current = { path: path, sha: res.content.sha, isNew: false };
        state.original = content;
        $('#adm-dirty').hidden = true;
        clearDraft(path);
        status('已保存到 ' + (state.draftMode ? 'drafts 分支' : state.branch || '默认分支'));
        var url = res.content.html_url;
        toast(
          '保存成功 · <a href="' +
            escapeHtml(url) +
            '" target="_blank" rel="noopener noreferrer">查看文件</a>' +
            (state.draftMode
              ? ' · 已提交到 drafts 分支'
              : ' · 站点构建约 1-2 分钟后生效'),
          false,
          6000
        );
        loadFiles();
      })
      .catch(function (err) {
        if (err.status === 409) {
          toast('保存冲突：远端文件已被修改。请点「重载」后再改。', true, 8000);
        } else if (err.status === 403) {
          toast(
            '权限不足（403）：令牌需要本仓库的 <b>Contents: Read and write</b>，当前可能只有 Read-only。<br>' +
              '到 GitHub → Settings → Developer settings → Fine-grained tokens 修改后重新连接。',
            true,
            12000
          );
        } else {
          toast('保存失败：' + escapeHtml(err.message), true, 8000);
        }
        status('保存失败：' + err.message);
      })
      .then(function () {
        state.saving = false;
        $('#adm-save').disabled = false;
      });
  }

  /* ------------------------------------------------------------------ *
   * 本地草稿
   * ------------------------------------------------------------------ */

  function draftKey(path) {
    return DRAFT_PREFIX + path;
  }

  function clearDraft(path) {
    try {
      localStorage.removeItem(draftKey(path));
    } catch (e) {
      /* ignore */
    }
  }

  function maybeOfferDraft(path, serverText) {
    var saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(draftKey(path)) || 'null');
    } catch (e) {
      saved = null;
    }
    if (!saved || !saved.body || saved.body === serverText) return;
    toast(
      '发现本地草稿（' +
        new Date(saved.ts).toLocaleString() +
        '） <button type="button" id="adm-restore" class="adm-btn adm-btn-sm adm-btn-ghost" style="margin-left:.4rem">恢复</button>',
      false,
      10000
    );
    window.setTimeout(function () {
      var btn = document.getElementById('adm-restore');
      if (!btn) return;
      btn.addEventListener('click', function () {
        var parsed = parseFrontMatter(saved.body);
        setForm(parsed.data);
        $('#adm-content').value = parsed.body;
        updateCounter();
        $('#adm-dirty').hidden = false;
        toast('已恢复本地草稿', false);
      });
    }, 0);
  }

  function stashDraft() {
    if (!state.current) return;
    try {
      localStorage.setItem(
        draftKey(state.current.path),
        JSON.stringify({ body: currentText(), ts: Date.now() })
      );
    } catch (e) {
      /* ignore */
    }
  }

  /* ------------------------------------------------------------------ *
   * 预览
   * ------------------------------------------------------------------ */

  var ALLOWED_TAGS = {
    P: 1, BR: 1, HR: 1, H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1, UL: 1, OL: 1, LI: 1,
    BLOCKQUOTE: 1, PRE: 1, CODE: 1, TABLE: 1, THEAD: 1, TBODY: 1, TR: 1, TH: 1, TD: 1,
    A: 1, IMG: 1, STRONG: 1, EM: 1, DEL: 1, SPAN: 1, DIV: 1, FIGCAPTION: 1, FIGURE: 1,
    SUP: 1, SUB: 1, KBD: 1, MARK: 1, VIDEO: 1, SOURCE: 1
  };

  // 需要校验取值的 URL 类属性
  var URL_ATTRS = { href: 1, src: 1, poster: 1 };
  // 允许的协议（其余一律拒绝）
  var SAFE_SCHEME = /^(https?|mailto|tel):/i;
  var IMAGE_DATA_URL = /^data:image\/(png|jpe?g|gif|webp|avif);base64,/i;

  /**
   * 判断 URL 是否安全：
   * 先去掉所有控制字符与空白（`java\tscript:` 这类绕过的根因），
   * 再用「有协议则必须在白名单内」的正向规则，而不是黑名单匹配。
   */
  function isSafeUrl(value, allowImageData) {
    var v = String(value == null ? '' : value).replace(
      /[\u0000-\u0020\u007f\u00a0\u2000-\u200f\u2028\u2029\ufeff]+/g,
      ''
    );
    if (!v) return true; // 空属性无害
    // 协议相对（//evil.com）、反斜杠变体（\\evil.com、/\\evil.com）一律不放行
    if (/^[\\/]{2}/.test(v) || /^\/[\\]/.test(v)) return false;
    if (/^(#|\/|\?|\.{1,2}\/)/.test(v)) return true; // 锚点 / 站内绝对 / 相对
    if (!/^[a-z][a-z0-9+.-]*:/i.test(v)) return true; // 无协议，按相对路径处理
    if (SAFE_SCHEME.test(v)) return true;
    if (allowImageData && IMAGE_DATA_URL.test(v)) return true;
    return false;
  }

  /** srcset 是逗号分隔的候选列表，逐个校验，保留安全的候选 */
  function cleanSrcset(value) {
    return String(value || '')
      .split(',')
      .map(function (part) {
        var trimmed = part.trim();
        if (!trimmed) return '';
        var url = trimmed.split(/\s+/)[0];
        return isSafeUrl(url, true) ? trimmed : '';
      })
      .filter(Boolean)
      .join(', ');
  }

  function sanitize(html) {
    var tpl = document.createElement('template');
    tpl.innerHTML = html;

    var walk = function (node) {
      var children = Array.prototype.slice.call(node.childNodes || []);
      children.forEach(function (child) {
        if (child.nodeType === 3) return; // text
        if (child.nodeType !== 1) {
          child.remove();
          return;
        }
        var tag = child.tagName;
        if (tag === 'INPUT') {
          // GFM 任务列表：<input type=checkbox checked disabled> → ☑ / ☐
          var isCheckbox = (child.getAttribute('type') || '').toLowerCase() === 'checkbox';
          if (isCheckbox) {
            var box = child.hasAttribute('checked') ? '☑ ' : '☐ ';
            child.replaceWith(document.createTextNode(box));
          } else {
            child.remove();
          }
          return;
        }
        if (!ALLOWED_TAGS[tag]) {
          child.remove();
          return;
        }
        Array.prototype.slice.call(child.attributes).forEach(function (attr) {
          var name = attr.name.toLowerCase();
          var value = attr.value || '';

          // 事件处理器、内联样式、内嵌文档一律剥离
          if (name.indexOf('on') === 0 || name === 'srcdoc' || name === 'style' || name === 'ping') {
            child.removeAttribute(attr.name);
            return;
          }

          // id / name 会造成 DOM clobbering 与锚点劫持，预览里不需要
          if (name === 'id' || name === 'name') {
            child.removeAttribute(attr.name);
            return;
          }

          if (URL_ATTRS[name]) {
            if (!isSafeUrl(value, name === 'src')) child.removeAttribute(attr.name);
            return;
          }

          if (name === 'srcset') {
            // data: URL 自带逗号，srcset 的逗号语法无法可靠切分，直接丢弃
            var cleaned = /data:/i.test(value) ? '' : cleanSrcset(value);
            if (cleaned) child.setAttribute('srcset', cleaned);
            else child.removeAttribute(attr.name);
            return;
          }

          // target 一律改为新窗口 + noopener，避免反向标签页劫持
          if (name === 'target') {
            child.setAttribute('target', '_blank');
            child.setAttribute('rel', 'noopener noreferrer');
          }
        });
        walk(child);
      });
    };

    walk(tpl.content);
    return tpl.innerHTML;
  }

  function renderPreview() {
    var target = $('#adm-preview-inner');
    if (!target) return;
    var body = $('#adm-content').value;
    var html = '';
    try {
      if (window.marked) {
        html = window.marked.parse(body, { gfm: true, breaks: false, headerIds: false, mangle: false });
      } else {
        html = '<pre>' + escapeHtml(body) + '</pre>';
      }
    } catch (e) {
      html = '<pre>' + escapeHtml(body) + '</pre>';
    }
    target.innerHTML = sanitize(html);
  }

  /* ------------------------------------------------------------------ *
   * 图片上传
   * ------------------------------------------------------------------ */

  function loadImageElement(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        resolve(img);
      };
      img.onerror = reject;
      img.src = src;
    });
  }

  function prepareImage(file) {
    var objectUrl = URL.createObjectURL(file);
    return loadImageElement(objectUrl)
      .then(function (img) {
        var w = img.naturalWidth || img.width;
        var h = img.naturalHeight || img.height;
        var scale = Math.min(1, MAX_IMAGE / Math.max(w, h));
        var tw = Math.max(1, Math.round(w * scale));
        var th = Math.max(1, Math.round(h * scale));
        var canvas = document.createElement('canvas');
        canvas.width = tw;
        canvas.height = th;
        canvas.getContext('2d').drawImage(img, 0, 0, tw, th);
        URL.revokeObjectURL(objectUrl);

        var mime = file.type === 'image/png' || /\.png$/i.test(file.name) ? 'image/png' : 'image/jpeg';
        var dataUrl = canvas.toDataURL(mime, JPEG_QUALITY);
        return {
          base64: dataUrl.split(',')[1],
          ext: mime === 'image/png' ? 'png' : 'jpg',
          name: file.name || 'image',
          width: tw,
          height: th
        };
      })
      .catch(function (err) {
        URL.revokeObjectURL(objectUrl);
        throw err;
      });
  }

  function uploadFiles(fileList) {
    var files = Array.prototype.slice.call(fileList || []);
    if (!files.length) return;
    var now = new Date();
    var dir = 'assets/img/uploads/' + now.getFullYear() + '/' + pad(now.getMonth() + 1) + '/';

    status('正在上传 ' + files.length + ' 张图片…');
    files.reduce(function (chain, file) {
      return chain.then(function () {
        return prepareImage(file).then(function (prepared) {
          var base = slugify(prepared.name.replace(/\.[^.]+$/, '')) || 'image';
          var path = dir + base + '-' + Date.now() + '.' + prepared.ext;
          return api('/repos/' + state.owner + '/' + state.repo + '/contents/' + repoPath(path), {
            method: 'PUT',
            body: JSON.stringify({
              message: 'assets: 上传图片 ' + path.split('/').pop() + '（写作台）',
              content: prepared.base64,
              branch: state.draftMode ? undefined : state.branch || undefined
            })
          }).then(function (res) {
            var rel = '/' + String(res.content.path).replace(/^\/+/, '');
            insertAtCursor('![](' + rel + ')' + '\n');
            toast('图片已上传：' + escapeHtml(rel.split('/').pop()), false, 3000);
          });
        });
      });
    }, Promise.resolve())
      .then(function () {
        status('图片上传完成');
        renderPreview();
      })
      .catch(function (err) {
        status('上传失败：' + err.message);
        if (err.status === 403) {
          toast(
            '权限不足（403）：上传图片同样需要 <b>Contents: Read and write</b>。',
            true,
            10000
          );
        } else {
          toast('上传失败：' + escapeHtml(err.message), true, 7000);
        }
      });
  }

  /* ------------------------------------------------------------------ *
   * 编辑器交互
   * ------------------------------------------------------------------ */

  function insertAtCursor(text) {
    var area = $('#adm-content');
    var start = area.selectionStart || 0;
    var end = area.selectionEnd || 0;
    var value = area.value;
    area.value = value.slice(0, start) + text + value.slice(end);
    var pos = start + text.length;
    area.focus();
    area.setSelectionRange(pos, pos);
    onContentChanged();
  }

  function wrapSelection(before, after, placeholder) {
    var area = $('#adm-content');
    var start = area.selectionStart || 0;
    var end = area.selectionEnd || 0;
    var value = area.value;
    var selected = value.slice(start, end) || placeholder || '';
    area.value = value.slice(0, start) + before + selected + after + value.slice(end);
    var pos = start + before.length + selected.length;
    area.focus();
    area.setSelectionRange(pos - after.length, pos);
    onContentChanged();
  }

  function prefixLines(prefix) {
    var area = $('#adm-content');
    var start = area.selectionStart || 0;
    var end = area.selectionEnd || 0;
    var value = area.value;
    var lineStart = value.lastIndexOf('\n', start - 1) + 1;
    var block = value.slice(lineStart, end) || '';
    var updated = block
      .split('\n')
      .map(function (line) {
        return prefix + line;
      })
      .join('\n');
    area.value = value.slice(0, lineStart) + updated + value.slice(end);
    area.focus();
    area.setSelectionRange(lineStart, lineStart + updated.length);
    onContentChanged();
  }

  function applyToolbar(action) {
    switch (action) {
      case 'h2':
        prefixLines('## ');
        break;
      case 'bold':
        wrapSelection('**', '**', '加粗文字');
        break;
      case 'italic':
        wrapSelection('*', '*', '斜体文字');
        break;
      case 'link':
        wrapSelection('[', '](https://)', '链接文字');
        break;
      case 'code':
        wrapSelection('`', '`', 'code');
        break;
      case 'quote':
        prefixLines('> ');
        break;
      case 'list':
        prefixLines('- ');
        break;
      case 'image':
        insertAtCursor('![](/assets/img/uploads/)');
        break;
      case 'upload':
        $('#adm-file').click();
        break;
      default:
        break;
    }
  }

  function updateCounter() {
    var text = $('#adm-content').value;
    echo($('#adm-counter'), text.length + ' 字');
  }

  /* ------------------------------------------------------------------ *
   * 撤销 / 重做（自己维护快照栈，比 execCommand 在各端更一致）
   * ------------------------------------------------------------------ */

  var history = { stack: [], index: -1, timer: null, applying: false };

  function updateHistoryButtons() {
    var undoBtn = $('#adm-undo');
    var redoBtn = $('#adm-redo');
    if (undoBtn) undoBtn.disabled = history.index <= 0;
    if (redoBtn) redoBtn.disabled = history.index >= history.stack.length - 1;
  }

  function resetHistory(value) {
    history.stack = [String(value == null ? '' : value)];
    history.index = 0;
    history.timer = null;
    updateHistoryButtons();
  }

  function pushHistory() {
    if (history.applying) return;
    var value = $('#adm-content').value;
    if (history.stack[history.index] === value) return;
    history.stack = history.stack.slice(0, history.index + 1);
    history.stack.push(value);
    if (history.stack.length > 200) history.stack.shift();
    history.index = history.stack.length - 1;
    updateHistoryButtons();
  }

  function scheduleHistory() {
    if (history.applying) return;
    clearTimeout(history.timer);
    history.timer = setTimeout(pushHistory, 400);
  }

  function applyHistory(delta) {
    clearTimeout(history.timer);
    pushHistory();
    var next = history.index + delta;
    if (next < 0 || next >= history.stack.length) return;
    history.index = next;
    history.applying = true;
    $('#adm-content').value = history.stack[next];
    history.applying = false;
    onContentChanged();
    updateHistoryButtons();
  }

  function onContentChanged() {
    renderPreview();
    updateCounter();
    $('#adm-dirty').hidden = false;
    stashDraft();
  }

  /* ------------------------------------------------------------------ *
   * 登录流程
   * ------------------------------------------------------------------ */

  /* ---------- GitHub 设备码登录（经 Cloudflare Worker 代理） ---------- */

  var device = { polling: false, timer: null, code: '', interval: 5, startedAt: 0 };

  function setDeviceStatus(text) {
    echo($('#adm-device-status'), text);
  }

  function stopDevice(text) {
    device.polling = false;
    window.clearTimeout(device.timer);
    if (text) setDeviceStatus(text);
    var btn = $('#adm-gh-login');
    if (btn) btn.disabled = false;
  }

  function copyText(text) {
    if (!navigator.clipboard || !navigator.clipboard.writeText) return Promise.resolve(false);
    return navigator.clipboard.writeText(text).then(
      function () {
        return true;
      },
      function () {
        return false;
      }
    );
  }

  function startDeviceLogin() {
    if (!state.authBase) {
      toast('还没有配置 GitHub 登录代理，请先使用访问令牌', true);
      return;
    }

    var btn = $('#adm-gh-login');
    if (btn) btn.disabled = true;
    var box = $('#adm-device');
    if (box) {
      box.hidden = false;
      if (box.scrollIntoView) box.scrollIntoView({ block: 'nearest' });
    }
    echo($('#adm-user-code'), '······');
    setDeviceStatus('正在向 GitHub 申请验证码…');

    fetch(state.authBase + '/device/code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok || !data.device_code) {
            throw new Error(data.error_description || data.error || '代理返回 ' + res.status);
          }
          return data;
        });
      })
      .then(function (data) {
        device.code = data.device_code;
        device.interval = Math.max(5, Number(data.interval) || 5);
        device.startedAt = Date.now();
        echo($('#adm-user-code'), data.user_code || '----');
        var link = $('#adm-device-link');
        if (link && data.verification_uri) link.href = data.verification_uri;
        setDeviceStatus('验证码已显示；点下面链接去 GitHub 粘贴确认');
        copyText(data.user_code || '').then(function (ok) {
          if (ok) setDeviceStatus('验证码已复制，去 GitHub 粘贴确认…');
        });
        pollDeviceToken();
      })
      .catch(function (err) {
        stopDevice('获取验证码失败：' + err.message);
      });
  }

  function pollDeviceToken() {
    device.polling = true;

    var schedule = function () {
      if (!device.polling) return;
      device.timer = window.setTimeout(tick, device.interval * 1000);
    };

    var tick = function () {
      if (!device.polling) return;
      if (Date.now() - device.startedAt > 15 * 60 * 1000) {
        stopDevice('验证码已过期，请重新点「使用 GitHub 登录」');
        return;
      }

      fetch(state.authBase + '/device/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_code: device.code })
      })
        .then(function (res) {
          return res.json();
        })
        .then(function (data) {
          if (data && data.access_token) {
            stopDevice('授权成功，正在连接仓库…');
            applyOAuthToken(data);
            return;
          }
          var err = data && data.error;
          if (err === 'authorization_pending') {
            setDeviceStatus('等待你在 GitHub 上确认…');
            schedule();
            return;
          }
          if (err === 'slow_down') {
            device.interval += 5;
            schedule();
            return;
          }
          if (err === 'expired_token') {
            stopDevice('验证码已过期，请重新点「使用 GitHub 登录」');
            return;
          }
          if (err === 'access_denied') {
            stopDevice('你取消了授权');
            return;
          }
          stopDevice('登录失败：' + ((data && data.error_description) || err || '未知错误'));
        })
        .catch(function () {
          schedule();
        });
    };

    tick();
  }

  function applyOAuthToken(data) {
    state.token = data.access_token;
    state.tokenSource = 'oauth';
    state.tokenExpiresAt = data.expires_in ? Date.now() + Number(data.expires_in) * 1000 : 0;
    state.refreshToken = ''; // 刷新令牌需要 client_secret，本应用不使用，不落盘
    connect(
      $('#adm-owner').value.trim(),
      $('#adm-repo').value.trim(),
      $('#adm-branch').value.trim(),
      state.token,
      $('#adm-remember').checked
    );
  }

  function connect(owner, repo, branch, token, remember) {
    state.token = token;
    state.owner = owner;
    state.repo = repo;
    state.branch = branch;
    echo($('#adm-login-msg'), '正在验证令牌…');

    return api('/repos/' + owner + '/' + repo)
      .then(function (data) {
        state.branch = state.branch || data.default_branch;
        saveConfig(token, owner, repo, state.branch, remember);
        $('#adm-login').hidden = true;
        $('#adm-workbench').hidden = false;
        echo($('#adm-repo-label'), owner + '/' + repo);
        echo($('#adm-branch-label'), state.branch);
        return api('/user').then(function (user) {
          echo($('#adm-user-label'), '@' + user.login);
          toast('已连接 ' + escapeHtml(owner + '/' + repo), false);
          return loadFiles();
        });
      })
      .catch(function (err) {
        echo($('#adm-login-msg'), '');
        var msg = $('#adm-login-msg');
        msg.textContent =
          err.status === 401
            ? '令牌无效或已过期（401）。'
            : err.status === 404
              ? '找不到仓库，或令牌没有该仓库的访问权限（404）。'
              : '连接失败：' + err.message;
        msg.classList.add('is-error');
      });
  }

  function logout() {
    stopDevice('');
    device.code = '';
    clearConfig();
    purgeDrafts();
    state.token = '';
    state.tokenSource = 'pat';
    state.tokenExpiresAt = 0;
    state.refreshToken = '';
    state.current = null;
    $('#adm-login').hidden = false;
    $('#adm-workbench').hidden = true;
    $('#adm-token').value = '';
    toast('已退出，本机令牌已清除', false);
  }

  /* ------------------------------------------------------------------ *
   * 初始化
   * ------------------------------------------------------------------ */

  function bindEvents() {
    var loginForm = $('#adm-login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', function (event) {
        event.preventDefault();
        var owner = $('#adm-owner').value.trim();
        var repo = $('#adm-repo').value.trim();
        var branch = $('#adm-branch').value.trim();
        var token = $('#adm-token').value.trim();
        if (!owner || !repo || !token) {
          echo($('#adm-login-msg'), '请填写仓库与令牌。');
          $('#adm-login-msg').classList.add('is-error');
          return;
        }
        connect(owner, repo, branch, token, $('#adm-remember').checked);
      });
    }

    var toggle = $('#adm-token-toggle');
    if (toggle) {
      toggle.addEventListener('click', function () {
        var input = $('#adm-token');
        var show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        toggle.textContent = show ? '隐藏' : '显示';
      });
    }

    var ghLogin = $('#adm-gh-login');
    if (ghLogin) {
      ghLogin.addEventListener('click', startDeviceLogin);
    }

    var copyBtn = $('#adm-copy-code');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        var code = ($('#adm-user-code') || {}).textContent || '';
        copyText(code).then(function (ok) {
          setDeviceStatus(ok ? '已复制，去 GitHub 粘贴确认' : '复制失败，请手动选中复制');
        });
      });
    }

    document.addEventListener('click', function (event) {
      var btn = event.target.closest ? event.target.closest('#adm-list button') : null;
      if (btn) openFile(btn.dataset.path);
    });

    var search = $('#adm-search');
    if (search) {
      search.addEventListener('input', function () {
        state.filter = search.value.trim();
        renderList();
      });
    }

    var on = function (id, type, handler) {
      var el = document.getElementById(id);
      if (el) el.addEventListener(type, handler);
    };

    on('adm-new', 'click', newPost);
    on('adm-undo', 'click', function () {
      applyHistory(-1);
    });
    on('adm-redo', 'click', function () {
      applyHistory(1);
    });
    var contentEl = $('#adm-content');
    if (contentEl) {
      contentEl.addEventListener('input', scheduleHistory);
      contentEl.addEventListener('keydown', function (e) {
        if (!(e.ctrlKey || e.metaKey)) return;
        var k = (e.key || '').toLowerCase();
        if (k === 'z') {
          e.preventDefault();
          applyHistory(e.shiftKey ? 1 : -1);
        } else if (k === 'y') {
          e.preventDefault();
          applyHistory(1);
        }
      });
    }
    on('adm-save', 'click', save);
    on('adm-logout', 'click', logout);
    on('adm-toggle-list', 'click', function () {
      var side = $('#adm-side');
      setSideOpen(!(side && side.classList.contains('is-open')));
    });
    on('adm-close-list', 'click', function () {
      setSideOpen(false);
    });
    var backdrop = $('#adm-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', function () {
        setSideOpen(false);
      });
    }
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && $('#adm-side') && $('#adm-side').classList.contains('is-open')) {
        setSideOpen(false);
      }
    });
    // 视口变宽（>=992px）时抽屉不再需要，避免残留遮罩挡住桌面端
    window.addEventListener('resize', function () {
      if (window.innerWidth >= 992) setSideOpen(false);
    });
    on('adm-reload', 'click', function () {
      if (state.current && state.current.sha) openFile(state.current.path);
    });

    var draftMode = $('#adm-draft-mode');
    if (draftMode) {
      draftMode.addEventListener('change', function () {
        state.draftMode = draftMode.checked;
        status(state.draftMode ? '保存目标：drafts 分支' : '保存目标：' + (state.branch || '默认分支'));
      });
    }

    Array.prototype.slice.call(document.querySelectorAll('.adm-tab')).forEach(function (tab) {
      tab.addEventListener('click', function () {
        Array.prototype.slice.call(document.querySelectorAll('.adm-tab')).forEach(function (t) {
          t.classList.toggle('is-active', t === tab);
        });
        var view = tab.dataset.view;
        $('#adm-body').dataset.view = view;
        if (view === 'preview') renderPreview();
      });
    });

    var toolbar = $('#adm-md-toolbar');
    if (toolbar) {
      toolbar.addEventListener('click', function (event) {
        var btn = event.target.closest('button[data-md]');
        if (btn) applyToolbar(btn.dataset.md);
      });
    }

    var content = $('#adm-content');
    if (content) {
      content.addEventListener('input', onContentChanged);
      content.addEventListener('keydown', function (event) {
        if (event.key === 'Tab') {
          event.preventDefault();
          insertAtCursor('  ');
        }
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
          event.preventDefault();
          save();
        }
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'b') {
          event.preventDefault();
          wrapSelection('**', '**', '加粗文字');
        }
      });
      content.addEventListener('paste', function (event) {
        var items = (event.clipboardData && event.clipboardData.files) || [];
        if (items.length && /^image\//.test(items[0].type)) {
          event.preventDefault();
          uploadFiles(items);
        }
      });
    }

    ['#adm-title', '#adm-date', '#adm-time', '#adm-categories', '#adm-tags', '#adm-pin', '#adm-description', '#adm-cover'].forEach(
      function (sel) {
        var el = $(sel);
        if (el) {
          el.addEventListener('input', function () {
            $('#adm-dirty').hidden = false;
            stashDraft();
          });
          el.addEventListener('change', function () {
            $('#adm-dirty').hidden = false;
          });
        }
      }
    );

    var fileInput = $('#adm-file');
    if (fileInput) {
      fileInput.addEventListener('change', function () {
        uploadFiles(fileInput.files);
        fileInput.value = '';
      });
    }

    var editorWrap = $('#adm-editor-wrap');
    var drop = $('#adm-drop');
    var area = $('#adm-content');
    if (area && drop) {
      ['dragenter', 'dragover'].forEach(function (type) {
        area.addEventListener(type, function (event) {
          event.preventDefault();
          drop.hidden = false;
        });
      });
      ['dragleave', 'drop'].forEach(function (type) {
        area.addEventListener(type, function (event) {
          event.preventDefault();
          if (type === 'drop' && event.dataTransfer && event.dataTransfer.files.length) {
            uploadFiles(event.dataTransfer.files);
          }
          drop.hidden = true;
        });
      });
    }

    window.addEventListener('beforeunload', function (event) {
      if (!$('#adm-dirty').hidden) {
        event.preventDefault();
        event.returnValue = '';
      }
    });
  }

  function init() {
    var root = $('#wx-admin');
    if (!root) return;
    state.apiBase = resolveApiBase();
    state.authBase = resolveAuthBase();
    bindEvents();

    // 配置了登录代理才显示「使用 GitHub 登录」
    var ghBlock = $('#adm-gh-block');
    if (ghBlock) ghBlock.hidden = !state.authBase;

    // 移动端默认收起「文章信息」，让正文编辑区直接可见
    var details = document.getElementById('adm-details');
    if (details && window.matchMedia('(max-width: 991.98px)').matches) {
      details.open = false;
    }

    if (loadConfig()) {
      $('#adm-owner').value = state.owner;
      $('#adm-repo').value = state.repo;
      $('#adm-branch').value = state.branch;
      $('#adm-login-msg').textContent = '本机已保存令牌，正在自动连接…';
      connect(state.owner, state.repo, state.branch, state.token, true);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
