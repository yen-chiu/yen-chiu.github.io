/* 异次元通讯 · 次元复苏 —— 网页移植版运行时
 * 剧本数据来自 data/story.json（由 00_工具/web_build.py 编译）
 * 运行模型：顺序播放 + 选项跳块 + 显式跳转 + 兄弟块跳过
 */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var SPEED = { slow: 95, normal: 55, fast: 25 };   // 每字毫秒（比上一版慢，接近原作的等待感）
  var SAVE_KEY = 'miko.web.save.v1';
  var AVATARS = ['头像1', '头像2', '头像3', '头像4', '头像5', '头像6', '头像7', '头像8'];

  var st = {
    story: null,
    meta: null,
    chapterId: null,
    cur: 0,
    ctx: null,          // {labels:Set, resume:Number, target:Number}
    unlock: { dict: {}, gal: {}, dyn: {} },
    done: {},
    settings: {
      speed: 'normal', wait: 60, bgm: false, sfx: true, autoUnlock: false,
      avatar: '头像1',
      npc: { 'Miko': '头像2', 'Iris': '头像3', 'Lily': 'Lily', '未知用户': '未知用户' }
    },
    auto: false,
    skipAll: false,
    busy: false,
    gen: 0,
    restored: false
  };

  /* ---------------- 存档 ---------------- */
  function save() {
    if (st.importing) return;   // 导入后正在重载，别让 beforeunload 把旧进度写回去
    try {
      var data = {
        chapterId: st.chapterId,
        cur: st.cur,
        ctx: st.ctx ? { labels: Array.from(st.ctx.labels), resume: st.ctx.resume, target: st.ctx.target } : null,
        unlock: st.unlock,
        done: st.done,
        settings: st.settings,
        ts: Date.now()
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) { /* 隐私模式忽略 */ }
  }

  function loadSave() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      var d = JSON.parse(raw);
      if (d.unlock) st.unlock = { dict: d.unlock.dict || {}, gal: d.unlock.gal || {}, dyn: d.unlock.dyn || {} };
      if (d.done) st.done = d.done || {};
      if (d.settings) {
        var npc = d.settings.npc || {};
        Object.assign(st.settings, d.settings);
        st.settings.npc = Object.assign({ 'Miko': '头像2', 'Iris': '头像3', 'Lily': 'Lily', '未知用户': '未知用户' }, npc);
      }
      return d;
    } catch (e) { return null; }
  }

  function chapter(id) {
    return st.story.chapters.filter(function (c) { return c.id === id; })[0];
  }

  /* ---------------- 标签 / 跳转解析 ---------------- */
  function prep(ch) {
    if (ch._lab) return ch;
    var lab = {}, blocks = ch.blocks || {};
    Object.keys(blocks).forEach(function (k) {
      blocks[k].forEach(function (i) { lab[i] = Number(k); });
    });
    ch._lab = lab;
    ch._sorted = Object.keys(blocks).map(function (k) { return { l: Number(k), i: blocks[k].slice().sort(function (a, b) { return a - b; }) }; });
    ch._byLabel = {};
    ch._sorted.forEach(function (o) { ch._byLabel[o.l] = o.i; });
    return ch;
  }

  // 同名标签可重复：取引用点之后最近的一处，否则回绕到第一处
  function resolveLabel(ch, label, ref) {
    prep(ch);
    var lst = ch._byLabel[Number(label)];
    if (!lst || !lst.length) return null;
    for (var i = 0; i < lst.length; i++) if (lst[i] >= ref) return lst[i];
    return lst[0];
  }

  function blockEnd(ch, idx) {
    prep(ch);
    var j = idx + 1;
    while (j < ch.rows.length && ch._lab[j] === undefined) j++;
    return j;
  }

  function afterSiblings(ch, labels, idx) {
    var j = idx;
    while (j < ch.rows.length && labels.has(ch._lab[j])) j = blockEnd(ch, j);
    return j;
  }

  function choiceGroup(ch, idx) {
    var g = [];
    var i = idx;
    while (i >= 0 && ch.rows[i].choice !== undefined) i--;
    i++;
    while (i < ch.rows.length && ch.rows[i].choice !== undefined) { g.push(i); i++; }
    return g.length ? g : [idx];
  }

  /* ---------------- 工具 ---------------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(t._tm);
    t._tm = setTimeout(function () { t.hidden = true; }, 2200);
  }

  function sleep(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  function asset(p) { return 'assets/' + p; }

  /* ---------------- 头像 ---------------- */
  var NPC_DEFAULT = { 'Miko': '头像2', 'Iris': '头像3', 'Lily': 'Lily', '未知用户': '未知用户' };

  function avatarFor(who) {
    if (who === '我') return asset('icon/' + (st.settings.avatar || '头像1') + '.webp');
    var pick = (st.settings.npc || {})[who];
    if (pick === 'letter') return null;
    if (pick) return asset('icon/' + pick + '.webp');
    var d = NPC_DEFAULT[who];
    return d ? asset('icon/' + d + '.webp') : null;
  }

  function letterAvatar(who, right) {
    var d = document.createElement('div');
    d.className = 'ava ava-txt';
    d.textContent = (who || '?').slice(0, 1);
    d.style.background = right ? 'linear-gradient(135deg,#6a5ae0,#4b3fb0)'
      : 'linear-gradient(135deg,#3a3550,#26233a)';
    return d;
  }

  /* ---------------- 路由 ---------------- */
  function go(route) { location.hash = '#/' + route; }

  function route() {
    var h = (location.hash || '#/').replace(/^#\/?/, '');
    var parts = h.split('/');
    var name = parts[0] || 'home';
    $$('.view').forEach(function (v) { v.classList.remove('active'); });

    if (name === 'chat' && parts[1]) {
      $('#view-chat').classList.add('active');
      startChapter(decodeURIComponent(parts[1]));
      return;
    }
    if (name === 'dict') { $('#view-dict').classList.add('active'); renderDict(); return; }
    if (name === 'gallery') { $('#view-gallery').classList.add('active'); renderGallery(); return; }
    if (name === 'feed') { $('#view-feed').classList.add('active'); renderFeed(); return; }
    if (name === 'settings') { $('#view-settings').classList.add('active'); syncSettings(); return; }

    $('#view-home').classList.add('active');
    renderHome();
  }

  /* ---------------- 首页 ---------------- */
  function renderHome() {
    var grid = $('#chapter-grid');
    grid.innerHTML = '';
    st.story.chapters.forEach(function (c) {
      var n = (c.rows || []).length;
      var b = document.createElement('button');
      b.className = 'chapter-card';
      b.innerHTML =
        '<img src="' + esc(asset('chapter/' + c.id + '.webp')) + '" alt="' + esc(c.id) + '" loading="lazy">' +
        '<div class="cc-body"><div class="cc-name">' + esc(c.id) + '</div>' +
        '<div class="cc-meta">' + (n ? n + ' 行对话' : '') + '</div></div>' +
        (st.done[c.id] ? '<span class="cc-done">已读</span>' : '');
      b.onclick = function () { go('chat/' + encodeURIComponent(c.id)); };
      grid.appendChild(b);
    });

    var bar = $('#continue-bar');
    var d = null;
    try { d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { d = null; }
    if (d && d.chapterId && d.cur > 0) {
      bar.hidden = false;
      bar.firstElementChild.textContent = '上次停在「' + d.chapterId + '」';
      $('#continue-btn').onclick = function () {
        st.restored = true;
        go('chat/' + encodeURIComponent(d.chapterId));
      };
    } else {
      bar.hidden = true;
    }
  }

  /* ---------------- 章节启动 ---------------- */
  function startChapter(id) {
    var ch = chapter(id);
    if (!ch) { go('home'); return; }
    prep(ch);

    if (st.chapterId !== id) {
      st.chapterId = id;
      st.cur = 0;
      st.ctx = null;
    }
    if (st.restored) {
      // 从存档恢复
      st.restored = false;
      var d = null;
      try { d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { d = null; }
      if (d && d.chapterId === id) {
        st.cur = d.cur || 0;
        st.ctx = d.ctx ? { labels: new Set(d.ctx.labels), resume: d.ctx.resume, target: d.ctx.target } : null;
      }
    }

    $('#chat-title').textContent = id;
    $('#chat-sub').textContent = dayLabel(ch, st.cur) || '';
    $('#msg-list').innerHTML = '';
    $('#choices').hidden = true;
    $('#choices').innerHTML = '';
    $('#menu-sheet').hidden = true;
    $('#be-modal').hidden = true;
    restoreHistory(ch);
    st.paused = false;
    st.skipAll = false;
    tick();
  }

  function dayLabel(ch, idx) {
    for (var i = Math.min(idx, ch.rows.length - 1); i >= 0; i--) {
      var r = ch.rows[i];
      if (r.tags && r.tags.indexOf('无') >= 0) return r.day || '';
    }
    return '';
  }

  function restoreHistory(ch) {
    // 回看最近若干行，仅作视觉衔接（不重放跳转）
    var start = Math.max(0, st.cur - 14);
    for (var i = start; i < st.cur; i++) {
      var r = ch.rows[i];
      if (r.choice !== undefined) continue;
      if (!r.text && !(r.tags || []).length) continue;
      if ((r.tags || []).indexOf('BE') >= 0) continue;
      appendRow(r, true);
    }
  }

  /* ---------------- 渲染基元 ---------------- */
  function scrollBottom() {
    var b = $('#chat-body');
    b.scrollTop = b.scrollHeight;
  }

  function appendRow(row, instant) {
    var list = $('#msg-list');
    var who = row.who || '';
    var tags = row.tags || [];
    var el;
    if (!String(row.text || '').trim() && !tags.length) return null;

    if (tags.indexOf('无') >= 0) {
      el = document.createElement('div');
      el.className = 'day-row';
      el.textContent = row.day || row.text || '';
      list.appendChild(el); scrollBottom(); return el;
    }
    if (tags.indexOf('BE') >= 0) {
      el = document.createElement('div');
      el.className = 'msg center';
      el.innerHTML = '<div class="pill" style="color:#ff9dc0;border-color:rgba(240,92,150,.5)">BE · 坏结局</div>';
      list.appendChild(el); scrollBottom(); return el;
    }
    if (tags.indexOf('词典') >= 0 || tags.indexOf('图鉴') >= 0) {
      el = document.createElement('div');
      el.className = 'msg center';
      var what = tags.indexOf('词典') >= 0
        ? '词典解锁 · ' + (row.dictTerm || '')
        : '图鉴解锁 · ' + (row.key || '');
      el.innerHTML = '<div class="pill">' + esc(what) + '</div>';
      list.appendChild(el); scrollBottom(); return el;
    }
    if (tags.indexOf('动态') >= 0) {
      el = document.createElement('div');
      el.className = 'msg';
      var mikoAva = avatarFor('Miko') || asset('icon/icon.webp');
      el.innerHTML =
        '<img class="ava" src="' + esc(mikoAva) + '" alt="">' +
        '<div class="col"><div class="name">Miko 发布了动态</div>' +
        '<div class="bubble">' + esc(row.text || '') + '</div></div>';
      list.appendChild(el);
      if (row.image) list.appendChild(imageCard(row.image, true));
      scrollBottom(); return el;
    }
    if (tags.indexOf('语音') >= 0) {
      el = document.createElement('div');
      el.className = 'msg';
      var v = row.voice || row.text || '';
      el.innerHTML =
        '<span class="ava ava-txt" style="background:linear-gradient(135deg,#3a3550,#26233a)">' + esc((who || 'M').slice(0, 1)) + '</span>' +
        '<div class="col"><div class="name">' + esc(who) + ' · 语音</div>' +
        '<button class="voice-btn" data-voice="' + esc(v) + '">' +
        '<span class="bars"><i></i><i></i><i></i></span>' +
        '<span class="voice-txt">' + esc(v) + '</span></button></div>';
      list.appendChild(el); scrollBottom(); return el;
    }

    // 普通消息
    el = document.createElement('div');
    el.className = 'msg' + (row.dir === 'right' ? ' right' : '') + (row.dir === 'center' ? ' center' : '');

    if (row.dir === 'center') {
      el.innerHTML = '<div class="pill">' + esc(row.text || '') + '</div>';
    } else if (row.dir === 'right') {
      var ra = avatarFor('我');
      el.innerHTML =
        (ra ? '<img class="ava" src="' + esc(ra) + '" alt="">' : '') +
        '<div class="col"><div class="bubble">' + esc(row.text || '') + '</div></div>';
      if (!ra) el.insertBefore(letterAvatar('我', true), el.firstChild);
    } else {
      var na = avatarFor(who);
      var av = na ? '<img class="ava" data-who="' + esc(who) + '" src="' + esc(na) + '" alt="">'
        : '<span class="ava ava-txt" style="background:linear-gradient(135deg,#3a3550,#26233a)">' + esc((who || '·').slice(0, 1)) + '</span>';
      el.innerHTML = av +
        '<div class="col"><div class="name">' + esc(who) + '</div>' +
        '<div class="bubble">' + esc(row.text || '') + '</div></div>';
    }
    list.appendChild(el);
    scrollBottom();
    return el;
  }

  function imageCard(key, inline) {
    var wrap = document.createElement('div');
    wrap.className = 'img-card';
    var path = photoPath(key);
    wrap.innerHTML = '<img src="' + esc(path) + '" alt="' + esc(key) + '" loading="lazy">';
    wrap.querySelector('img').onclick = function () { openLightbox(path); };
    return wrap;
  }

  function photoPath(key) {
    var photos = (st.meta && st.meta.photos) || [];
    var k = String(key || '');
    if (photos.indexOf(k) >= 0) return asset('photo/' + k + '.webp');
    var base = k.replace(/-n$/, '');
    if (photos.indexOf(base) >= 0) return asset('photo/' + base + '.webp');
    return asset('photo/' + k + '.webp');
  }

  function openLightbox(src) {
    $('#lightbox-img').src = src;
    $('#lightbox').hidden = false;
  }

  /* ---------------- 主循环 ---------------- */
  function tick() {
    if (!st.chapterId) return;
    var myGen = ++st.gen;
    if (!st.busy) run(myGen);
  }

  async function run(myGen) {
    st.busy = true;
    try {
      while (myGen === st.gen) {
        var ch = prep(chapter(st.chapterId));
        if (!ch) break;
        if (st.cur >= ch.rows.length) { endChapter(); break; }
        if (st.ctx && st.cur >= st.ctx.resume) st.ctx = null;
        var row = ch.rows[st.cur];

        if (row.choice !== undefined) {
          showChoices(ch, st.cur);
          break;                      // 等玩家点选
        }

        var typing = row.dir === 'left' && row.text && (row.tags || []).length === 0;
        if (typing && !st.skipAll) {
          await typingHint(row, myGen);
          if (myGen !== st.gen) break;
        }
        appendRow(row, st.skipAll);
        unlockFrom(row);
        save();

        if (!st.skipAll) {
          await sleep(readDelay(row));
          if (myGen !== st.gen) break;
        }

        if (row.wait && row.wait > 0) {
          await waitCard(row.wait, myGen);
          if (myGen !== st.gen) break;
        }
        if ((row.tags || []).indexOf('BE') >= 0) {
          await beModal(myGen);
          if (myGen !== st.gen) break;
        }
        if (row.jump) {
          var jt = resolveLabel(ch, row.jump, st.cur);
          if (jt !== null && jt !== undefined) { st.cur = jt; save(); continue; }
        }
        if (st.ctx && st.cur !== st.ctx.target && st.ctx.labels.has(ch._lab[st.cur])) {
          st.cur = st.ctx.resume; save(); continue;
        }
        st.cur++;
        save();

      }
    } finally {
      st.busy = false;
      // 若期间又切换了章节/重开（gen 已更新），排队的这一轮由这里接上，
      // 否则 tick() 因 busy 而跳过、旧循环又因 gen 不匹配退出 → 剧情卡住不动。
      if (myGen !== st.gen && $('#view-chat').classList.contains('active')) run(st.gen);
    }
  }

  // 每条消息的停留时间：越长的消息停留越久，模拟真人聊天节奏
  function readDelay(row) {
    var n = String(row.text || '').length;
    var base = 320 + Math.min(1500, n * 24);
    if (row.dir === 'right' || row.dir === 'center') base = 220 + Math.min(600, n * 12);
    return st.auto ? Math.max(1100, base) : base;
  }

  function typingHint(row, myGen) {
    return new Promise(function (resolve) {
      var b = $('#chat-body');
      var div = document.createElement('div');
      div.className = 'typing';
      div.innerHTML = '<span>' + esc(row.who || '对方') + ' 输入中</span><span class="dots"><i></i><i></i><i></i></span>';
      b.appendChild(div);
      scrollBottom();
      var per = SPEED[st.settings.speed] || 24;
      var ms = Math.max(260, Math.min(3200, (row.text || '').length * per));
      var t0 = Date.now();
      var iv = setInterval(function () {
        if (myGen !== st.gen) { done(); return; }
        if (Date.now() - t0 >= ms) done();
      }, 40);
      function done() {
        clearInterval(iv);
        if (div.parentNode) div.parentNode.removeChild(div);
        resolve();
      }
      div._skip = done;
    });
  }

  function waitCard(minutes, myGen) {
    return new Promise(function (resolve) {
      var card = $('#wait-card');
      var rate = Number(st.settings.wait);
      if (rate === 0 || st.skipAll) { resolve(); return; }
      var total = Math.round(minutes * 60 * 1000 / rate);
      var end = Date.now() + total;
      card.hidden = false;
      var txt = $('#wait-text');
      var iv = setInterval(function () {
        if (myGen !== st.gen) { stop(); return; }
        var left = end - Date.now();
        if (left <= 0) { stop(); return; }
        txt.textContent = '对方暂时不在 · 还剩 ' + Math.ceil(left / 1000) + ' 秒';
      }, 200);
      txt.textContent = '对方暂时不在 · 还需等待 ' + minutes + ' 分钟';
      function stop() {
        clearInterval(iv);
        card.hidden = true;
        card._skip = null;
        resolve();
      }
      card._skip = stop;
    });
  }

  function beModal(myGen) {
    return new Promise(function (resolve) {
      var m = $('#be-modal');
      m.hidden = false;
      function close(restart) {
        m.hidden = true;
        $('#be-continue').onclick = null;
        $('#be-restart').onclick = null;
        if (restart) {
          st.cur = 0; st.ctx = null; $('#msg-list').innerHTML = '';
          save();
        }
        resolve();
      }
      $('#be-continue').onclick = function () { close(false); };
      $('#be-restart').onclick = function () { close(true); };
    });
  }

  /* ---------------- 选项 ---------------- */
  function showChoices(ch, idx) {
    var g = choiceGroup(ch, idx);
    var box = $('#choices');
    box.innerHTML = '';
    var labels = new Set();
    var targets = [];
    g.forEach(function (i) {
      var r = ch.rows[i];
      var t = resolveLabel(ch, r.choice, i);
      if (t === null || t === undefined) return;
      if (labels.add(ch._lab[t])) targets.push(t);
    });
    g.forEach(function (i) {
      var r = ch.rows[i];
      if (!r.text) return;
      var b = document.createElement('button');
      b.className = 'choice-btn';
      b.textContent = r.text;
      b.onclick = function () {
        box.hidden = true; box.innerHTML = '';
        var t = resolveLabel(ch, r.choice, i);
        if (t === null || t === undefined) { st.cur = i + 1; tick(); return; }
        var lab = new Set();
        g.forEach(function (k) {
          var tk = resolveLabel(ch, ch.rows[k].choice, k);
          if (tk !== null) lab.add(ch._lab[tk]);
        });
        st.cur = t;
        st.ctx = { labels: lab, resume: afterSiblings(ch, lab, blockEnd(ch, t)), target: t };
        // 让玩家自己的话出现在聊天里
        appendRow({ i: i, who: r.who, text: r.text, dir: r.dir, tags: [] }, true);
        save();
        tick();
      };
      box.appendChild(b);
    });
    box.hidden = false;
    scrollBottom();
    if (!g.length) { st.cur = idx + 1; tick(); }
  }

  /* ---------------- 解锁 ---------------- */
  function unlockFrom(row) {
    var tags = row.tags || [];
    if (tags.indexOf('词典') >= 0) {
      var term = row.dictTerm || row.text || '';
      if (term && !st.unlock.dict[term]) {
        st.unlock.dict[term] = 1;
        toast('解锁词典：' + term);
        save();
      }
    }
    if (tags.indexOf('图鉴') >= 0) {
      var key = row.key || '';
      if (key && !st.unlock.gal[key]) {
        st.unlock.gal[key] = 1;
        toast('解锁图鉴：' + key);
        save();
      }
    }
    if (tags.indexOf('动态') >= 0) {
      var img = row.image || '';
      if (img && !st.unlock.dyn[img]) {
        st.unlock.dyn[img] = 1;
        save();
      }
    }
  }

  function endChapter() {
    st.done[st.chapterId] = true;
    save();
    var list = $('#msg-list');
    var d = document.createElement('div');
    d.className = 'msg center';
    d.innerHTML = '<div class="pill">本章已播完</div>' +
      '<button class="end-back" data-go="home">返回章节列表</button>';
    list.appendChild(d);
    scrollBottom();
  }

  /* ---------------- 收藏页 ---------------- */
  function renderDict() {
    var box = $('#dict-list');
    var dic = (st.meta && st.meta.dictionary) || [];
    var defs = (st.meta && st.meta.defs) || {};
    var got = Object.keys(st.unlock.dict).length;
    $('#dict-count').textContent = got + ' / ' + dic.length;
    box.innerHTML = '';
    var seenTerm = {};
    dic = dic.filter(function (d) {
      if (!d.term || seenTerm[d.term]) return false;
      seenTerm[d.term] = 1; return true;
    });
    dic.forEach(function (d) {
      var unlocked = !!st.unlock.dict[d.term];
      var def = defs[d.term];
      var el = document.createElement('div');
      el.className = 'dict-item' + (unlocked ? '' : ' locked');
      el.innerHTML =
        (unlocked
          ? '<img src="' + esc(asset('dictionary/词典.webp')) + '" alt="">'
          : '<div class="dic-lock">?</div>') +
        '<div><div class="term">' + esc(unlocked ? d.term : '？？？') +
        '<span class="bid">' + (d.id ? '#' + esc(d.id) : '') + '</span></div>' +
        (unlocked
          ? (def ? '<div class="def">' + esc(def.text) + '</div>'
            : '<div class="nometa">释义数据未收录（原释义在 Dart 快照中，未能完整提取）</div>')
          : '<div class="nometa">在剧情中遇到该词条即可解锁</div>') +
        '</div>';
      box.appendChild(el);
    });
  }

  function renderGallery() {
    var box = $('#gallery-list');
    var gal = (st.meta && st.meta.gallery) || [];
    var got = Object.keys(st.unlock.gal).length;
    $('#gallery-count').textContent = got + ' / ' + gal.length;
    box.className = 'page-body gal-grid';
    box.innerHTML = '';
    gal.forEach(function (g) {
      var unlocked = !!st.unlock.gal[g.key];
      var el = document.createElement('div');
      el.className = 'gal-item' + (unlocked ? '' : ' locked');
      var src = unlocked ? photoPath(g.key) : asset('dictionary/未解锁词典.webp');
      el.innerHTML = '<img src="' + esc(src) + '" alt="' + esc(g.key) + '" loading="lazy">' +
        '<span class="glk">' + esc(unlocked ? g.key : '未解锁') + '</span>';
      if (unlocked) el.querySelector('img').onclick = function () { openLightbox(photoPath(g.key)); };
      box.appendChild(el);
    });
  }

  function renderFeed() {
    var box = $('#feed-list');
    var dyn = (st.meta && st.meta.dynamics) || [];
    var got = Object.keys(st.unlock.dyn).length;
    $('#feed-count').textContent = got + ' / ' + dyn.length;
    box.className = 'page-body';
    box.innerHTML = '';
    if (!got) {
      box.innerHTML = '<p style="color:#8d89a8;font-size:13px;text-align:center;margin-top:40px">还没有动态，去剧情里看看吧</p>';
      return;
    }
    dyn.forEach(function (d) {
      if (!st.unlock.dyn[d.image]) return;
      var el = document.createElement('div');
      el.className = 'feed-item';
      el.innerHTML =
        '<div class="feed-head"><img src="' + esc(asset('icon/icon.webp')) + '" alt="">' +
        '<div><div class="feed-name">Miko</div><div class="feed-when">' + esc(d.chapter || '') + '</div></div></div>' +
        '<div class="feed-text">' + esc(d.text || '') + '</div>';
      el.appendChild(imageCard(d.image, false));
      box.appendChild(el);
    });
  }

  /* ---------------- 设置 ---------------- */
  function avatarOptions() { return AVATARS.concat(['Lily', '未知用户']); }

  function renderAvatarPicker() {
    var box = $('#ava-pick');
    if (box) {
      box.innerHTML = '';
      avatarOptions().forEach(function (n) {
        var b = document.createElement('button');
        b.className = 'ava-opt' + ((st.settings.avatar || '头像1') === n ? ' on' : '');
        b.title = n;
        b.innerHTML = '<img src="' + esc(asset('icon/' + n + '.webp')) + '" alt="' + esc(n) + '">';
        b.onclick = function () { st.settings.avatar = n; save(); renderAvatarPicker(); refreshAvatars('我'); };
        box.appendChild(b);
      });
    }
    $$('#view-settings select[data-npc]').forEach(function (sel) {
      var who = sel.getAttribute('data-npc');
      sel.innerHTML = '<option value="letter">字母</option>' +
        avatarOptions().map(function (n) {
          return '<option value="' + esc(n) + '">' + esc(n) + '</option>';
        }).join('');
      sel.value = (st.settings.npc || {})[who] || (NPC_DEFAULT[who] || 'letter');
      sel.onchange = function () {
        st.settings.npc[who] = this.value;
        save();
        refreshAvatars(who);
      };
    });
  }

  // 换头像后让聊天里已有的气泡立即换图
  function refreshAvatars(who) {
    var p = avatarFor(who);
    $$('#msg-list img.ava[data-who="' + who + '"]').forEach(function (img) {
      if (p) { img.src = p; }
      else {
        var sp = letterAvatar(who, who === '我');
        if (img.parentNode) img.parentNode.replaceChild(sp, img);
      }
    });
  }

  function exportSave() {
    var payload = {
      app: 'miko-web', v: 1, ts: Date.now(),
      chapterId: st.chapterId, cur: st.cur,
      ctx: st.ctx ? { labels: Array.from(st.ctx.labels), resume: st.ctx.resume, target: st.ctx.target } : null,
      unlock: st.unlock, done: st.done, settings: st.settings
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    var t = new Date();
    var p2 = function (n) { return (n < 10 ? '0' : '') + n; };
    a.download = 'miko-save-' + t.getFullYear() + p2(t.getMonth() + 1) + p2(t.getDate()) +
      '-' + p2(t.getHours()) + p2(t.getMinutes()) + '.json';
    a.href = URL.createObjectURL(blob);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
    toast('已导出存档文件');
  }

  function importSave(file) {
    var fr = new FileReader();
    fr.onload = function () {
      var d;
      try { d = JSON.parse(fr.result); } catch (e) { toast('不是合法的 JSON 文件'); return; }
      if (!d || typeof d !== 'object') { toast('存档内容为空'); return; }
      var payload = (d.unlock || d.chapterId) ? d : null;
      if (!payload) { toast('不是本作的存档文件'); return; }
      payload.ts = Date.now();
      st.importing = true;
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
      } catch (e) { toast('写入失败：浏览器存储不可用'); return; }
      toast('导入成功，正在重新载入…');
      setTimeout(function () { location.reload(); }, 800);
    };
    fr.onerror = function () { toast('读取文件失败'); };
    fr.readAsText(file);
  }

  function syncSettings() {
    renderAvatarPicker();
    $('#set-speed').value = st.settings.speed;
    $('#set-wait').value = String(st.settings.wait);
    $('#set-bgm').checked = !!st.settings.bgm;
    $('#set-sfx').checked = !!st.settings.sfx;
    $('#set-auto-unlock').checked = !!st.settings.autoUnlock;
    $('#set-stats').textContent =
      '词典 ' + Object.keys(st.unlock.dict).length + ' · 图鉴 ' + Object.keys(st.unlock.gal).length +
      ' · 动态 ' + Object.keys(st.unlock.dyn).length;
  }

  function bindSettings() {
    $('#set-speed').onchange = function () { st.settings.speed = this.value; save(); };
    $('#set-wait').onchange = function () { st.settings.wait = Number(this.value); save(); };
    $('#set-bgm').onchange = function () {
      st.settings.bgm = this.checked; save(); applyBgm();
    };
    $('#set-sfx').onchange = function () { st.settings.sfx = this.checked; save(); };
    $('#set-auto-unlock').onchange = function () {
      st.settings.autoUnlock = this.checked;
      if (this.checked) {
        ((st.meta && st.meta.dictionary) || []).forEach(function (d) { st.unlock.dict[d.term] = 1; });
        ((st.meta && st.meta.gallery) || []).forEach(function (g) { st.unlock.gal[g.key] = 1; });
        ((st.meta && st.meta.dynamics) || []).forEach(function (d) { st.unlock.dyn[d.image] = 1; });
        toast('已解锁全部词典与图鉴（可在设置里关闭）');
      }
      save(); syncSettings();
    };
    $('#btn-export').onclick = exportSave;
    $('#btn-import').onclick = function () { $('#file-import').click(); };
    $('#file-import').onchange = function () {
      var f = this.files && this.files[0];
      if (f) importSave(f);
      this.value = '';
    };
    $('#btn-reset').onclick = function () {
      if (!confirm('确定清空全部进度与解锁记录？')) return;
      localStorage.removeItem(SAVE_KEY);
      st.unlock = { dict: {}, gal: {}, dyn: {} };
      st.done = {};
      st.cur = 0; st.ctx = null; st.chapterId = null;
      syncSettings();
      toast('已清空');
    };
  }

  /* ---------------- 音频 ---------------- */
  function applyBgm() {
    var a = $('#au-bgm');
    if (st.settings.bgm) {
      if (!a.src) a.src = asset('music/bgm.ogg');
      a.volume = 0.35;
      a.play().catch(function () { /* 需用户交互 */ });
    } else {
      a.pause();
    }
  }

  function playVoice(name) {
    if (!st.settings.sfx) return;
    var a = $('#au-sfx');
    a.src = asset('music/' + name + '.ogg');
    a.play().catch(function () {});
  }

  /* ---------------- 事件绑定 ---------------- */
  function bind() {
    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-go]');
      if (t) { go(t.getAttribute('data-go')); return; }
      var v = e.target.closest('[data-voice]');
      if (v) { playVoice(v.getAttribute('data-voice')); return; }
      if (e.target.id === 'lightbox' || e.target.id === 'lightbox-img') {
        $('#lightbox').hidden = true; return;
      }
    }, true);

    $('#btn-menu').onclick = function (e) {
      e.stopPropagation();
      var s = $('#menu-sheet');
      s.hidden = !s.hidden;
    };
    $('#btn-restart').onclick = function () {
      st.cur = 0; st.ctx = null; $('#msg-list').innerHTML = '';
      $('#menu-sheet').hidden = true;
      save(); tick();
    };
    $('#btn-auto').onclick = function () {
      st.auto = !st.auto;
      this.classList.toggle('on', st.auto);
      toast(st.auto ? '自动播放：开' : '自动播放：关');
      if (st.auto) tick();
    };
    $('#btn-skip').onclick = function () {
      st.skipAll = !st.skipAll;
      this.classList.toggle('on', st.skipAll);
      if (st.skipAll) {
        var w = $('#wait-card');
        if (!w.hidden && w._skip) w._skip();
        tick();
      }
    };
    $('#chat-body').addEventListener('click', function (e) {
      if (e.target.closest('button') || e.target.closest('.img-card')) return;
      var t = $('.typing');
      if (t && t._skip) t._skip();
    });
    $('#wait-skip').onclick = function () {
      var w = $('#wait-card');
      if (w._skip) w._skip();
    };
    document.addEventListener('click', function (e) {
      var s = $('#menu-sheet');
      if (!s.hidden && !e.target.closest('#menu-sheet') && !e.target.closest('#btn-menu')) s.hidden = true;
    });

    window.addEventListener('hashchange', route);
    window.addEventListener('beforeunload', save);
  }

  /* ---------------- 启动 ---------------- */
  function boot() {
    loadSave();
    bind();
    bindSettings();
    Promise.all([
      fetch('data/story.json').then(function (r) { return r.json(); }),
      fetch('data/meta.json').then(function (r) { return r.json(); })
    ]).then(function (res) {
      st.story = res[0];
      st.meta = res[1];
      route();
      applyBgm();
    }).catch(function (err) {
      document.body.innerHTML = '<pre style="color:#f88;padding:20px">数据加载失败：' + esc(err && err.message) + '</pre>';
    });
  }

  boot();
})();
