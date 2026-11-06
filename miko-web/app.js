/* 异次元通讯 · 次元复苏 —— 网页移植版运行时
 * 剧本数据来自 data/story.json（由 00_工具/web_build.py 编译）
 * 运行模型：顺序播放 + 选项跳块 + 显式跳转 + 兄弟块跳过
 */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // 打字时长：按字数 + 标点停顿 + 少量随机起伏，模拟真人敲字，而不是「字数 × 固定值」
  var SPEED = { slow: 170, normal: 110, fast: 65 };         // 每字基准毫秒（慢≈6字/秒，中≈9，快≈15）
  var SPEED_CAP = { slow: 8000, normal: 5500, fast: 3000 }; // 单条上限（长段不再线性膨胀）
  // 原版节奏系数：慢 1.35× / 中 1× / 快 0.6×（时长基准来自原版 busyWaitTime）
  var PACE = { slow: 1.35, normal: 1, fast: 0.6 };
  var PUNCT_HEAVY = '。！？!?';
  var PUNCT_LIGHT = '，、；：,;:';
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
    revealed: {},       // 已认识的角色（原作：未认识时显示问号头像）
    named: {},          // 已知名字（第二态：黑色字母头像）
    avaUp: {},          // 已上传头像（第三态：人物立绘）
    settings: {
      speed: 'normal', wait: 1, bgm: false, sfx: true, autoUnlock: false,
      myAvatar: { type: 'none' },   // 我的形象：none / qq / data
      revealLock: true,
      npc: { 'Miko': '头像2', 'Iris': '头像3', 'Lily': 'Lily', '未知用户': '未知用户' }
    },
    auto: false,
    skipAll: false,
    busy: false,
    gen: 0,
    restored: false,
    typing: false,
    typingSkip: false,
    lastOnline: 0,      // 0 = 在线；否则为她最后下线的时间戳
    likes: {},
    comments: {},
    replies: {},        // {postKey: [{to, text, t}]} 对某条评论的回复
    mikoSaid: {},       // {postKey: {commentIndex: true}} Miko 已经接过话
    after: [],
    logOpen: {},
    progress: {},       // 每章读到的最远行号
    marks: {},          // 每章的书签 {cur, ctx}
    profileWho: 'Miko'
  };

  /* ---------------- 存档 ---------------- */
  function save() {
    if (st.importing) return;   // 导入后正在重载，别让 beforeunload 把旧进度写回去
    try {
      if (st.chapterId) {
        var prev = st.progress[st.chapterId] || 0;
        st.progress[st.chapterId] = Math.max(prev, st.cur);
        st.marks[st.chapterId] = {
          cur: st.cur,
          ctx: st.ctx ? { labels: Array.from(st.ctx.labels), resume: st.ctx.resume, target: st.ctx.target } : null
        };
      }
      var data = {
        chapterId: st.chapterId,
        cur: st.cur,
        ctx: st.ctx ? { labels: Array.from(st.ctx.labels), resume: st.ctx.resume, target: st.ctx.target } : null,
        unlock: st.unlock,
        done: st.done,
        revealed: st.revealed,
        named: st.named,
        avaUp: st.avaUp,
        likes: st.likes,
        comments: st.comments,
        replies: st.replies,
        mikoSaid: st.mikoSaid,
        after: st.after,
        progress: st.progress,
        marks: st.marks,
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
      if (d.revealed) st.revealed = d.revealed || {};
      if (d.named) {
        var profKeys = Object.keys((st.meta && st.meta.profiles) || {});
        st.named = {};
        Object.keys(d.named || {}).forEach(function (k) {
          if (profKeys.indexOf(k) >= 0) st.named[k] = true;   // 丢掉历史脏键（如词典编号）
        });
      }
      if (d.avaUp) st.avaUp = d.avaUp || {};
      if (d.likes) st.likes = d.likes;
      if (d.comments) st.comments = d.comments;
      if (d.after) st.after = d.after;
      if (d.settings) {
        var npc = d.settings.npc || {};
        Object.assign(st.settings, d.settings);
        st.settings.npc = Object.assign({ 'Miko': '头像2', 'Iris': '头像3', 'Lily': 'Lily', '未知用户': '未知用户' }, npc);
      }
      return d;
    } catch (e) { return null; }
      if (d.progress) st.progress = d.progress;
      if (d.marks) st.marks = d.marks;
      if (d.replies) st.replies = d.replies;
      if (d.mikoSaid) st.mikoSaid = d.mikoSaid;
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
  var CHARA_WHO = ['Miko', 'Iris', 'Lily'];
  var LOCK_SVG = '<svg class="lock" viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M7.6 10V7.4a4.4 4.4 0 0 1 8.8 0V10" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>' +
    '<rect x="5.2" y="10" width="13.6" height="9.6" rx="2.4" fill="none" stroke="currentColor" stroke-width="1.7"/>' +
    '<circle cx="12" cy="14.2" r="1.15" fill="currentColor"/>' +
    '<path d="M12 15.2v2.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

  // 「头像随剧情解锁」：没认出来之前，NPC 头像显示问号（原作设定）
  // 存档补算：已经读到揭示点之后的，直接算「已认识」（切章/读档时补上）
  function syncReveals() {
    var rv = (st.meta && st.meta.reveals) || {};
    Object.keys(rv).forEach(function (who) {
      if (st.revealed[who]) return;
      var hit = rv[who];
      var far = Math.max(
        (st.progress || {})[hit.chapter] || 0,
        ((st.marks || {})[hit.chapter] || {}).cur || 0,
        st.chapterId === hit.chapter ? st.cur : 0
      );
      if (far > Number(hit.row)) st.revealed[who] = true;
    });
    var av = (st.meta && st.meta.avatars) || {};
    st.avaUp = st.avaUp || {};
    Object.keys(av).forEach(function (who) {
      if (st.avaUp[who]) return;
      var hit = av[who];
      var far = Math.max(
        (st.progress || {})[hit.chapter] || 0,
        ((st.marks || {})[hit.chapter] || {}).cur || 0,
        st.chapterId === hit.chapter ? st.cur : 0,
        st.done && st.done[hit.chapter] ? 1e9 : 0
      );
      if (far > Number(hit.row)) st.avaUp[who] = true;
    });
  }

  function isRevealed(who) {
    if (st.settings.revealLock === false) return true;
    return !!(st.revealed || {})[who];
  }

  // 名字是否已知：自报姓名/首次被点名 之后算已知
  function nameKnown(who) {
    if (!who || who === '未知用户') return false;
    if (isRevealed(who)) return true;
    if ((st.avaUp || {})[who]) return true;     // 都换头像了，名字自然知道
    return !!(st.named || {})[who];
  }

  // 是否已经「上传头像」：剧情走到她第一次发图（动态/图鉴）之后
  function hasAvatar(who) {
    return !!(st.avaUp || {})[who];
  }

  function avatarFor(who) {
    if (who === '我') return myAvatarSrc();
    if (who === '未知用户') return asset('icon/未知用户.webp');
    if (!nameKnown(who)) return asset('icon/未知用户.webp');   // ① 未知：问号
    if (!hasAvatar(who)) return null;                          // ② 知道名字但没头像：黑色字母
    var pick = (st.settings.npc || {})[who];                   // ③ 有头像：人物立绘
    if (pick === 'letter') return null;
    if (pick) return asset('icon/' + pick + '.webp');
    var d = NPC_DEFAULT[who];
    return d ? asset('icon/' + d + '.webp') : null;
  }

  // 出现过名字就算「已知」，用于字母头像态
  function markNamed(who) {
    if (!who || who === '我' || who === '未知用户') return;
    var profs = (st.meta && st.meta.profiles) || {};
    if (!profs[who]) return;          // 只认角色表里的名字（词典行第 1 列是编号）
    if (!st.named) st.named = {};
    if (!st.named[who]) { st.named[who] = true; }
  }

  // 走到「她第一次发图」那一行时，把字母头像换成人物头像
  function checkAvatar(row) {
    var av = (st.meta && st.meta.avatars) || {};
    var hit = av[row.who];
    if (!hit || hit.chapter !== st.chapterId) return;
    if (Number(st.cur) < Number(hit.row)) return;
    if (!st.avaUp) st.avaUp = {};
    if (st.avaUp[row.who]) return;
    st.avaUp[row.who] = true;
    save();
    refreshAvatars(row.who);
    toast('对方换上了头像 · ' + row.who);
  }

  // 走到「自报姓名」那一行时揭示头像
  function checkReveal(row) {
    var rv = (st.meta && st.meta.reveals) || {};
    var hit = rv[row.who];
    if (!hit || hit.chapter !== st.chapterId || Number(hit.row) !== Number(st.cur)) return;
    st.revealed = st.revealed || {};
    if (st.revealed[row.who]) return;
    st.revealed[row.who] = true;
    save();
    refreshAvatars(row.who);
    toast('已认识对方 · ' + row.who);
  }

  function letterAvatar(who, right) {
    var d = document.createElement('div');
    d.className = 'ava ava-txt' + (right ? ' me' : '');
    d.textContent = (who || '?').slice(0, 1).toUpperCase();
    d.setAttribute('data-who', who || '');
    return d;
  }

  /* ---------------- 路由 ---------------- */
  function go(route) {
    st.autoHome = String(route).indexOf('home') === 0;   // 用户主动回章节列表
    location.hash = '#/' + route;
  }

  function route() {
    if (st.meta) syncReveals();
    var h = (location.hash || '#/').replace(/^#\/?/, '');
    var parts = h.split('/');
    var name = parts[0] || 'home';
    $$('.view').forEach(function (v) { v.classList.remove('active'); });

    if (name === 'chat' && parts[1]) {
      $('#view-chat').classList.add('active');
      var cid = decodeURIComponent(parts[1]);
      st.autoHome = false;
      if (st.coverFor !== cid) {
        st.coverFor = cid;
        startChapter(cid, true);
        return;
      }
      startChapter(cid, false);
      return;
    }
    if (name === 'dict') { $('#view-dict').classList.add('active'); renderDict(); return; }
    if (name === 'gallery') { $('#view-gallery').classList.add('active'); renderGallery(); return; }
    if (name === 'feed' || name === 'user') {
      $('#view-feed').classList.add('active');
      renderFeed(parts[1] ? decodeURIComponent(parts[1]) : '');
      return;
    }
    if (name === 'settings') { $('#view-settings').classList.add('active'); syncSettings(); return; }

    if (st.booted && (h === '' || h === '/') && !st.autoHome) {
      // 直接进最近一章（默认第一章），不先停在章节列表
      var first = st.chapterId || (orderedChapters()[0] || {}).id;
      if (first) { go('chat/' + encodeURIComponent(first)); return; }
    }
    $('#view-home').classList.add('active');
    renderHome();
  }

  /* ---------------- 首页 ---------------- */
  function orderOf(id) {
    var k = STORY_ORDER.indexOf(id);
    return k < 0 ? 99 : k;
  }

  function orderedChapters() {
    return st.story.chapters.slice().sort(function (a, b) {
      return orderOf(a.id) - orderOf(b.id);
    });
  }

  function chapterProgress(c) {
    var p = (st.progress || {})[c.id];
    if (st.done[c.id]) return { pct: 100, label: '已读完' };
    if (!p && !(p === 0)) return { pct: 0, label: '' };
    var n = (c.rows || []).length || 1;
    var pct = Math.min(99, Math.round(p / n * 100));
    return { pct: pct, label: '进度 ' + pct + '%' };
  }

  function renderHome() {
    var grid = $('#chapter-grid');
    grid.innerHTML = '';
    var extras = (st.meta && st.meta.extras) || {};

    function cardHtml(c, ex) {
      var n = (c.rows || []).length;
      var pr = chapterProgress(c);
      if (ex) {
        return '<button class="chapter-card cc-extra" data-cid="' + esc(c.id) + '">' +
          '<span class="cc-branch">└</span>' +
          '<div class="cc-body"><div class="cc-name">番外 · ' + esc(ex.title) + '</div>' +
          '<div class="cc-meta">' + (pr.label ? pr.label : (n ? n + ' 行对话' : '')) + '</div>' +
          '</div>' +
          (st.done[c.id] ? '<span class="cc-done">已读</span>' : '') +
          '</button>';
      }
      var pr2 = pr;
      return '<button class="chapter-card" data-cid="' + esc(c.id) + '">' +
        '<img src="' + esc(asset('chapter/' + c.id + '.webp')) + '" alt="' + esc(c.id) + '" loading="lazy">' +
        '<div class="cc-body"><div class="cc-name">' + esc(c.id) + '</div>' +
        '<div class="cc-meta">' + (pr2.label ? pr2.label : (n ? n + ' 行对话' : '')) + '</div>' +
        (pr2.pct > 0 ? '<div class="cc-bar"><i style="width:' + pr2.pct + '%"></i></div>' : '') +
        '</div>' +
        (st.done[c.id] ? '<span class="cc-done">已读</span>' : '') +
        '</button>';
    }

    // 主章节和它的番外放进同一个格子，形成「第一章 └ 番外」的树状
    var list = orderedChapters();
    var groups = [];
    var cur = null;
    list.forEach(function (c) {
      if (extras[c.id]) {                       // 先出现的是番外，挂到上一个主章节
        if (cur) cur.extras.push(c);
        else groups.push((cur = { main: null, extras: [c] }));
      } else {
        groups.push((cur = { main: c, extras: [] }));
      }
    });

    groups.forEach(function (g) {
      var wrap = document.createElement('div');
      wrap.className = 'cc-group';
      wrap.innerHTML = (g.main ? cardHtml(g.main, null) : '') +
        g.extras.map(function (c) { return cardHtml(c, extras[c.id]); }).join('');
      grid.appendChild(wrap);
    });

    grid.querySelectorAll('[data-cid]').forEach(function (b) {
      b.onclick = function () { pickChapter(b.getAttribute('data-cid')); };
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

  /* ---------------- 章节切换：封面 + 提示 ---------------- */
  function pickChapter(id) {
    openIntro(id);
  }

  /* 章节预览卡：大图 + 钩子（原文）+ 一起进入 */
  function openIntro(id) {
    var box = $('#intro');
    if (!box) { enterChapter(id); return; }
    var ch = chapter(id);
    var info = ((st.meta && st.meta.intro) || {})[id] || {};
    var pr = chapterProgress(ch || { id: id, rows: [] });
    var img = $('#intro-img');
    if (img) { img.src = asset('chapter/' + id + '.webp'); img.alt = id; }
    $('#intro-title').textContent = id;
    var tag = $('#intro-tag');
    if (tag) { tag.textContent = info.tag || ''; tag.hidden = !info.tag; }
    var hook = $('#intro-hook');
    var lines = (info.hook || []).slice(0, 3);
    hook.innerHTML = lines.map(function (t, i) {
      return i === 0 ? '<b>' + esc(t) + '</b>' : esc(t);
    }).join('\n');
    var days = chapterDays(ch).length;
    $('#intro-meta').textContent =
      (days ? days + ' 天 · ' : '') + ((ch && ch.rows ? ch.rows.length : 0) + ' 行对话') +
      (pr.pct ? ' · ' + pr.label : '');
    // 还不知道她是谁的时候（第一章开头），别在按钮上剧透名字
    var known = isRevealed('Miko') || id === '番外一' || id === '番外二';
    var goBtn = $('#intro-go');
    goBtn.textContent = known ? '与 Miko 一起进入这段冒险' : '进入这段冒险';
    box.hidden = false;
    goBtn.onclick = function () { closeIntro(); enterChapter(id); };
    $('#intro-back').onclick = function () { closeIntro(); };
    box.onclick = function (e) { if (e.target === box) closeIntro(); };
  }

  function closeIntro() {
    var b = $('#intro');
    if (b) b.hidden = true;
  }

  function enterChapter(id) {
    var cur = st.chapterId ? orderOf(st.chapterId) : -1;
    var target = orderOf(id);
    if (cur >= 0 && target !== cur) {
      var ahead = target > cur;
      var msg = ahead
        ? '跳到《' + id + '》会跳过前面的剧情，' + (st.done[st.chapterId] ? '' : '当前章节还没读完。') + '确定继续？'
        : '回到前面的《' + id + '》，已读进度会保留。确定？';
      if (!confirm(msg)) return;
      if (!ahead) {
        var pr = chapterProgress(chapter(id) || { id: id, rows: [] });
        toast('往前跳：回到《' + id + '》' + (pr.pct ? '（已读 ' + pr.pct + '%）' : ''));
      }
    }
    st.restored = true;
    go('chat/' + encodeURIComponent(id));
  }

  function showCover(id, done) {
    var cv = $('#cover');
    if (!cv) { done(); return; }
    var title = $('#cover-title'), sub = $('#cover-sub');
    if (title) title.textContent = id;   // 供读屏；视觉上已由封面图自带
    if (sub) {
      var p = (st.progress || {})[id];
      sub.textContent = p ? '继续上次的对话' : '新的对话';
    }
    var img = $('#cover-img');
    if (img) img.src = asset('chapter/' + id + '.webp');
    cv.hidden = false;
    cv.classList.add('in');
    var t = setTimeout(finish, 2400);
    function finish() {
      clearTimeout(t);
      cv.classList.remove('in');
      cv.hidden = true;
      cv.onclick = null;
      done();
    }
    cv.onclick = finish;
  }

  /* ---------------- 章节启动 ---------------- */
  function startChapter(id, withCover) {
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
      var mk = st.marks[id];
      if (mk) {
        st.cur = mk.cur || 0;
        st.ctx = mk.ctx ? { labels: new Set(mk.ctx.labels), resume: mk.ctx.resume, target: mk.ctx.target } : null;
      } else if (d && d.chapterId === id) {
        st.cur = d.cur || 0;
        st.ctx = d.ctx ? { labels: new Set(d.ctx.labels), resume: d.ctx.resume, target: d.ctx.target } : null;
      }
    }

    syncReveals();
    $('#chat-title').textContent = chatWho(ch);
    st.typing = false;
    updateChatStatus();
    $('#msg-list').innerHTML = '';
    $('#choices').hidden = true;
    $('#choices').innerHTML = '';
    $('#menu-sheet').hidden = true;
    $('#be-modal').hidden = true;
    restoreHistory(ch);
    st.paused = false;
    st.skipAll = false;
    if (withCover) {
      st.paused = true;
      showCover(id, function () { st.paused = false; tick(); });
    } else {
      tick();
    }
  }

  /* ---------------- 聊天头部：对方名字 + 在线状态 ---------------- */
  function chapterDays(ch) {
    var days = [];
    if (!ch) return days;
    (ch.rows || []).forEach(function (r) {
      if (r.tags && r.tags.indexOf('无') >= 0) days.push({ label: r.day || r.text || '天', idx: r.i });
    });
    return days;
  }

  function refreshDayEntry() {
    var ch = chapter(st.chapterId);
    var days = chapterDays(ch);
    var sub = $('#jumpday-sub');
    var list = $('#day-list');
    var btn = $('#btn-jumpday');
    if (list) list.hidden = true;
    if (!days.length) {
      if (sub) sub.textContent = '本章没有分天';
      if (btn) btn.classList.add('off');
      return;
    }
    if (btn) btn.classList.remove('off');
    if (sub) sub.textContent = '共 ' + days.length + ' 天，点这里选';
  }

  function chatWho(ch) {
    if (!ch) return '对方';
    var cnt = {}, best = '', n = -1;
    (ch.rows || []).forEach(function (r) {
      var w = r.who || '';
      if (!w || w === '我' || w.indexOf('-') >= 0 || w.indexOf('_') >= 0) return;
      cnt[w] = (cnt[w] || 0) + 1;
    });
    Object.keys(cnt).forEach(function (w) { if (cnt[w] > n) { n = cnt[w]; best = w; } });
    if (!best) return '对方';
    if (!nameKnown(best)) return '未知用户';
    return best;
  }

  function relTime(ms) {
    var m = Math.floor(ms / 60000);
    if (m < 1) return '刚刚';
    if (m < 60) return m + ' 分钟前';
    var h = Math.floor(m / 60);
    if (h < 24) return h + ' 小时前';
    var d = Math.floor(h / 24);
    return d + ' 天前';
  }

  function updateChatStatus() {
    var el = $('#chat-sub');
    if (!el) return;
    if (st.typing) {
      el.className = 'chat-sub on typing';
      el.innerHTML = '<span class="st-typing">对方正在输入</span>' +
        '<span class="dots"><i></i><i></i><i></i></span>';
      return;
    }
    if (st.lastOnline) {
      el.className = 'chat-sub off';
      el.innerHTML = '<i class="dot"></i>上次在线 ' + relTime(Date.now() - st.lastOnline);
    } else {
      el.className = 'chat-sub on';
      el.innerHTML = '<i class="dot"></i>在线';
    }
  }

  setInterval(function () {
    if (st.lastOnline && $('#view-chat') && $('#view-chat').classList.contains('active')) updateChatStatus();
  }, 30000);

  /* ---------------- 后日谈（AI 未接入时的本地记事） ---------------- */
  function renderAfter() {
    var log = $('#after-log');
    if (!log) return;
    if (!st.after.length) {
      log.innerHTML = '<p class="after-empty">还没有说过话。等接入 AI 之后，这里能接着结局往下聊。</p>';
      return;
    }
    log.innerHTML = st.after.map(function (m) {
      return '<div class="after-line ' + (m.role === 'me' ? 'me' : 'her') + '">' +
        '<span>' + esc(m.text) + '</span></div>';
    }).join('');
    log.scrollTop = log.scrollHeight;
  }

  function openAfter() {
    $('#after-modal').hidden = false;
    var hint = $('#after-hint');
    if (hint) {
      hint.textContent = (typeof window.MIKO_AI === 'function')
        ? '已接入 AI：她的回复由你配置的接口生成。'
        : '结局之后的时间线。接入 AI 之前，这里只记录你想说的话（设置 window.MIKO_AI = async (history, text) => "..." 即可接上）。';
    }
    renderAfter();
    setTimeout(function () { var i = $('#after-input'); if (i) i.focus(); }, 60);
  }

  function sendAfter() {
    var el = $('#after-input');
    var text = (el.value || '').trim();
    if (!text) return;
    el.value = '';
    st.after.push({ role: 'me', text: text, t: Date.now() });
    renderAfter();
    save();
    if (typeof window.MIKO_AI === 'function') {
      Promise.resolve(window.MIKO_AI(st.after.slice(0, -1), text)).then(function (reply) {
        if (!reply) return;
        st.after.push({ role: 'her', text: String(reply), t: Date.now() });
        renderAfter();
        save();
      });
    }
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
    if (row.dir === 'center') {
      var tx = String(row.text || '');
      if (tx.indexOf('下线') >= 0) { st.lastOnline = Date.now(); updateChatStatus(); }
      else if (tx.indexOf('上线') >= 0) { st.lastOnline = 0; updateChatStatus(); }
    }
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
      var ra = myAvatarSrc();
      el.innerHTML =
        (ra ? '<img class="ava" src="' + esc(ra) + '" alt="">' : '') +
        '<div class="col"><div class="bubble">' + esc(row.text || '') + '</div></div>';
    } else {
      var na = avatarFor(who);
      var av = na ? '<img class="ava" data-who="' + esc(who) + '" src="' + esc(na) + '" alt="">'
        : '<span class="ava ava-txt" style="background:linear-gradient(135deg,#3a3550,#26233a)">' + esc((who || '·').slice(0, 1)) + '</span>';
      el.innerHTML = av +
        '<div class="col"><div class="bubble">' + esc(row.text || '') + '</div></div>';
      var avEl = el.querySelector('.ava');
      var target = who === '未知用户' ? 'Miko' : who;
      if (avEl && (CHARA_WHO.indexOf(who) >= 0 || who === '未知用户')) {
        avEl.classList.add('ava-link');
        avEl.title = '进入' + (who === '未知用户' ? '对方' : ' ' + who) + '的资料页';
        avEl.onclick = function () { go('user/' + encodeURIComponent(target)); };
      }
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
          // 对方刚说完最后一句就立刻弹选项会很突兀：等一会儿再出，且淡入
          if (!st.skipAll) {
            st.choiceWait = true;
            await sleep(st.auto ? 650 : 1000);
            st.choiceWait = false;
            if (myGen !== st.gen) break;
          }
          showChoices(ch, st.cur);
          break;                      // 等玩家点选
        }

        var typing = row.dir === 'left' && row.text && (row.tags || []).length === 0;
        if (typing && !st.skipAll) {
          await typingHint(row, myGen);
          if (myGen !== st.gen) break;
        }
        markNamed(row.who);
        appendRow(row, st.skipAll);
        unlockFrom(row);
        checkReveal(row);
        checkAvatar(row);
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

  // 「对方输入中」的时长：优先用原版实测的 busyWaitTime（逐条），
  // 没有对应条目时用原版 966 条的拟合模型 wait_ms ≈ 523 + 175 × 字数。
  function msgDelay(row) {
    var text = String(row.text || '');
    var byCh = (st.meta && st.meta.delayMap) || {};
    var map = byCh[st.chapterId] || {};
    var t = text.trim();
    var ms = map[t];
    // 原版把「离线等待」也记在 busyWaitTime 里（最长 4 小时）；超过 60s 的一律交给「等待」指令，按模型估
    if (ms && ms > 60000) ms = 0;
    if (!ms) {
      var tm = (st.meta && st.meta.timing) || { base: 523, per: 175 };
      ms = tm.base + tm.per * text.length;
    }
    var k = PACE[st.settings.speed] || 1;
    if (st.auto) k *= 0.75;
    return Math.max(600, Math.min(20000, ms * k));
  }

  // 气泡之间的呼吸停顿（很短，主要节奏交给 msgDelay）
  function readDelay(row) {
    if (row.dir === 'right' || row.dir === 'center') return 120;
    return st.auto ? 260 : 180;
  }

  // 旧的字数×固定毫秒模型：仅作兜底（原版时长取不到时）
  function typingMs(row) {
    return msgDelay(row);
  }

  function typingHint(row, myGen) {
    return new Promise(function (resolve) {
      var ms = row._delay || msgDelay(row);
      st.typing = true;
      st.typingSkip = false;
      updateChatStatus();
      var t0 = Date.now();
      var iv = setInterval(function () {
        if (myGen !== st.gen || st.skipAll || st.typingSkip) return done();
        if (Date.now() - t0 >= ms) done();
      }, 60);
      function done() {
        clearInterval(iv);
        st.typing = false;
        updateChatStatus();
        resolve();
      }
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
        var sec = Math.ceil(left / 1000);
        var show = sec >= 60
          ? Math.floor(sec / 60) + ' 分 ' + String(sec % 60) + ' 秒'
          : sec + ' 秒';
        txt.textContent = '对方暂时不在 · 还剩 ' + show;
      }, 200);
      txt.textContent = minutes >= 60
        ? '对方暂时不在 · 还需等待 ' + Math.floor(minutes / 60) + ' 小时 ' + (minutes % 60 ? (minutes % 60) + ' 分' : '')
        : '对方暂时不在 · 还需等待 ' + minutes + ' 分钟';
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
    box.classList.remove('in');
    void box.offsetWidth;
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
        box.hidden = true; box.classList.remove('in'); box.innerHTML = '';
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
    requestAnimationFrame(function () { box.classList.add('in'); });
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
    if (!box) return;
    var gal = (st.meta && st.meta.gallery) || [];
    var got = gal.filter(function (g) { return st.unlock.gal[g.key]; }).length;
    $('#gallery-count').textContent = got + ' / ' + gal.length;
    box.className = 'page-body';
    box.innerHTML = '';

    var order = ((st.meta && st.meta.chapters) || []).map(function (c) { return c.id; });
    var groups = {};
    gal.forEach(function (g) {
      var c = g.chapter || '其他';
      (groups[c] = groups[c] || []).push(g);
    });
    var names = order.filter(function (c) { return groups[c]; })
      .concat(Object.keys(groups).filter(function (c) { return order.indexOf(c) < 0; }));

    names.forEach(function (c) {
      var list = groups[c];
      var n = list.filter(function (g) { return st.unlock.gal[g.key]; }).length;
      var sec = document.createElement('section');
      sec.className = 'gal-sec';
      sec.innerHTML = '<div class="gal-sec-head"><span>' + esc(c) + '</span>' +
        '<span class="gal-sec-n">' + n + ' / ' + list.length + '</span></div>' +
        '<div class="gal-grid"></div>';
      var grid = sec.querySelector('.gal-grid');
      list.forEach(function (g) {
        var unlocked = !!st.unlock.gal[g.key];
        var el = document.createElement('div');
        el.className = 'gal-item' + (unlocked ? '' : ' locked');
        if (unlocked) {
          el.innerHTML = '<img src="' + esc(photoPath(g.key)) + '" alt="' + esc(g.key) + '" loading="lazy">' +
            '<span class="glk">' + esc(g.key) + '</span>';
          el.querySelector('img').onclick = function () { openLightbox(photoPath(g.key)); };
        } else {
          el.innerHTML = '<div class="gal-blind"></div>' + LOCK_SVG +
            '<span class="glk">未解锁</span>';
        }
        grid.appendChild(el);
      });
      box.appendChild(sec);
    });
  }

  // 个人空间：封面 + 头像 + 昵称 + 签名 + 标签 + 动态
  function profileOf(who) {
    var p = ((st.meta && st.meta.profiles) || {})[who] || {};
    // 名字与签名始终显示（剧情里「动态」提示本来就叫得出名字），只有头像受「随剧情解锁」控制
    return {
      who: who,
      name: who,
      sig: p.sig || '',
      tags: p.tags || [],
      interests: p.interests || [],
      age: p.age || '',
      cover: p.cover || 'images/聊天背景.webp'
    };
  }

  // 阅读顺序：每个主章节后面紧跟它的番外
  var STORY_ORDER = ['第一章', '番外一', '第二章', '番外二', '第三章', '第四章', '第五章', '第六章'];

  function myDynamics(who) {
    var mine = ((st.meta && st.meta.dynamics) || []).filter(function (d) {
      return (d.who || 'Miko') === who;
    });
    var shown = mine.filter(function (d) { return st.unlock.dyn[d.image]; });
    shown.sort(function (a, b) {
      var ia = STORY_ORDER.indexOf(a.chapter), ib = STORY_ORDER.indexOf(b.chapter);
      if (ia < 0) ia = 99;
      if (ib < 0) ib = 99;
      if (ia !== ib) return ia - ib;
      return (a.row || 0) - (b.row || 0);
    });
    return { mine: mine, shown: shown };
  }

  var ICON_TAG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="7.5" r="1.4"/></svg>';
  var ICON_HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.6-7-9.3C5 7.9 7 6 9.4 6c1.4 0 2.3.7 2.6 1.4C12.3 6.7 13.2 6 14.6 6 17 6 19 7.9 19 10.7 19 15.4 12 20 12 20z"/></svg>';
  var ICON_LIST = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10"/></svg>';

  function renderFeed(who) {
    who = who || 'Miko';
    if (CHARA_WHO.indexOf(who) < 0) who = 'Miko';
    st.profileWho = who;
    var box = $('#feed-list');
    if (!box) return;
    var prof = profileOf(who);
    var pair = myDynamics(who);
    var shown = pair.shown;
    var head = document.querySelector('#view-feed h1');
    if (head) head.textContent = '资料';
    $('#feed-count').textContent = shown.length + ' / ' + pair.mine.length;

    var open = !!(st.logOpen && st.logOpen[who]);
    var slice = open ? shown : shown.slice(0, 3);

    box.className = 'page-body pf';
    box.innerHTML =
      '<div class="pf-hero">' +
        '<div class="pf-hero-bg" style="background-image:url(\'' + esc(asset(prof.cover)) + '\')"></div>' +
        '<div class="pf-hero-mask"></div>' +
        '<div class="pf-id">' +
          '<img class="pf-ava" src="' + esc(avatarFor(who)) + '" alt="" data-who="' + esc(who) + '">' +
          '<div class="pf-name">' + esc(prof.name) +
            (prof.age ? '<span class="pf-age">' + esc(prof.age) + '</span>' : '') + '</div>' +
          (prof.sig ? '<div class="pf-sig">' + esc(prof.sig) + '</div>' : '') +
        '</div>' +
      '</div>' +
      '<div class="pf-rows">' +
        '<div class="pf-row"><span class="pf-lab">' + ICON_TAG + '标签</span>' +
          '<span class="pf-pills">' + (prof.tags.length ? prof.tags.map(function (t) {
            return '<span>' + esc(t) + '</span>';
          }).join('') : '<i class="pf-none">未公开</i>') + '</span></div>' +
        '<div class="pf-row"><span class="pf-lab">' + ICON_HEART + '兴趣</span>' +
          '<span class="pf-pills hot">' + (prof.interests && prof.interests.length
            ? prof.interests.map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('')
            : '<i class="pf-none">未公开</i>') + '</span></div>' +
      '</div>' +
      '<div class="pf-logs">' +
        '<div class="pf-logs-head"><span>' + ICON_LIST + '日志</span>' +
          (shown.length > 3
            ? '<button class="pf-more" data-log="' + (open ? 'less' : 'more') + '">' +
              (open ? '收起' : '查看全部 ' + shown.length) + '</button>'
            : '') +
        '</div>' +
        '<div class="qz-list" id="qz-list"></div>' +
      '</div>';

    var list = box.querySelector('#qz-list');
    bindFeed(list);

    if (!shown.length) {
      list.innerHTML = '<p class="qz-empty">' +
        (pair.mine.length ? '还没有解锁的日志，去剧情里看看吧' : '还没开始写日志哦') + '</p>';
      return;
    }

    slice.forEach(function (d) { list.appendChild(logPost(d, prof, who)); });
  }

  function socialOf(key) {
    var all = ((st.meta && st.meta.social) || {})[key];
    if (!all) return { likes: [], comments: [] };
    var need = all.need;
    var reached = !need || orderOf(st.chapterId) >= orderOf(need) ||
      !!(st.progress || {})[need] || !!st.done[need];
    if (!reached) return { likes: [], comments: [] };
    return { likes: all.likes || [], comments: all.comments || [] };
  }

  function logPost(d, prof, who) {
    var el = document.createElement('div');
    el.className = 'qz-post';
    var key = d.image || ('x' + d.row);
    var liked = !!st.likes[key];
    var soc = socialOf(key);
    var replies = (st.replies && st.replies[key]) || [];
    var said = (st.mikoSaid && st.mikoSaid[key]) || {};
    var total = soc.comments.length + replies.length;

    var cmtHtml = soc.comments.map(function (c, i) {
      var mine = replies.filter(function (r) { return r.to === i; });
      var miko = (said[i] && c.miko) ? '<div class="qz-cmt by-npc"><b>Miko</b>' + esc(c.miko) + '</div>' : '';
      return '<div class="qz-cmt by-npc" data-ci="' + i + '"><b>' + esc(c.who) + '</b>' + esc(c.text) +
        '<button class="qz-reply" data-reply="' + i + '">回复</button></div>' +
        mine.map(function (r) { return '<div class="qz-cmt sub"><b>我</b>' + esc(r.text) + '</div>'; }).join('') + miko;
    }).join('');

    el.innerHTML =
      '<div class="qz-post-head">' +
        '<img src="' + esc(avatarFor(who)) + '" alt="">' +
        '<div><div class="qz-post-name">' + esc(prof.name.toUpperCase()) + '</div>' +
        '<div class="qz-post-when">' + esc(d.chapter || '') + '</div></div>' +
      '</div>' +
      '<div class="qz-post-text">' + esc(d.text || '') + '</div>';
    el.appendChild(imageCard(d.image, false));
    el.insertAdjacentHTML('beforeend',
      '<div class="qz-actions">' +
        '<button class="qz-act like' + (liked ? ' on' : '') + '" data-like="' + esc(key) + '">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.6-7-9.3C5 7.9 7 6 9.4 6c1.4 0 2.3.7 2.6 1.4C12.3 6.7 13.2 6 14.6 6 17 6 19 7.9 19 10.7 19 15.4 12 20 12 20z"/></svg>' +
          '<span>' + (liked ? '已赞' : '赞') + '</span></button>' +
        '<button class="qz-act cmt" data-cmt="' + esc(key) + '">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-4 3z"/></svg>' +
          '<span>评论' + (total ? ' ' + total : '') + '</span></button>' +
      '</div>' +
      (soc.likes.length
        ? '<div class="qz-likers">' + soc.likes.map(function (w) {
            return '<span class="qz-liker"><img src="' + esc(avatarFor(w)) + '" alt="">' + esc(w) + '</span>';
          }).join('<span class="qz-liker-sep">、</span>') + '<span class="qz-liker-txt">觉得这条不错</span></div>'
        : '') +
      '<div class="qz-cmts"' + (total ? '' : ' hidden') + '>' + cmtHtml + '</div>' +
      '<div class="qz-cmt-box" hidden><input type="text" maxlength="120" placeholder="说点什么…"><button>发送</button></div>');
    return el;
  }

  function bindFeed(list) {
    var more = document.querySelector('.pf-more');
    if (more) more.onclick = function (e) {
      e.stopPropagation();
      st.logOpen = st.logOpen || {};
      st.logOpen[st.profileWho || 'Miko'] = more.getAttribute('data-log') === 'more';
      renderFeed(st.profileWho || 'Miko');
    };
    list.addEventListener('click', function (e) {
      var lb = e.target.closest('[data-like]');
      if (lb) {
        var k = lb.getAttribute('data-like');
        st.likes[k] = !st.likes[k];
        lb.classList.toggle('on', !!st.likes[k]);
        lb.querySelector('span').textContent = st.likes[k] ? '已赞' : '赞';
        save();
        return;
      }
      var rp = e.target.closest('[data-reply]');
      if (rp) {
        var pst = rp.closest('.qz-post');
        var bx = pst.querySelector('.qz-cmt-box');
        bx.dataset.to = rp.getAttribute('data-reply');
        bx.hidden = false;
        var pin = bx.querySelector('input');
        pin.placeholder = '回复 ' + rp.parentNode.querySelector('b').textContent + '…';
        pin.focus();
        return;
      }
      var cb = e.target.closest('[data-cmt]');
      if (cb) {
        var box = cb.closest('.qz-post').querySelector('.qz-cmt-box');
        box.hidden = !box.hidden;
        box.dataset.to = '';
        if (!box.hidden) box.querySelector('input').focus();
        return;
      }
      var send = e.target.closest('.qz-cmt-box button');
      if (send) {
        var post = send.closest('.qz-post');
        var inp = post.querySelector('.qz-cmt-box input');
        var txt = (inp.value || '').trim();
        var cm = post.querySelector('[data-cmt]');
        var key = cm.getAttribute('data-cmt');
        if (!txt) return;
        var to = post.querySelector('.qz-cmt-box').dataset.to;
        if (to === '' || to === undefined) {
          // 直接评论这条动态
          (st.comments[key] = st.comments[key] || []).push({ text: txt, t: Date.now() });
          inp.value = '';
          var wrap = post.querySelector('.qz-cmts');
          wrap.hidden = false;
          wrap.insertAdjacentHTML('beforeend', '<div class="qz-cmt"><b>我</b>' + esc(txt) + '</div>');
          var n0 = (st.comments[key] || []).length;
          cm.querySelector('span').textContent = '评论 ' + n0;
        } else {
          // 回复某一条（对方会顺着接一句）
          var idx = Number(to);
          var arr = (st.replies[key] = st.replies[key] || []);
          arr.push({ to: idx, text: txt, t: Date.now() });
          st.mikoSaid[key] = st.mikoSaid[key] || {};
          st.mikoSaid[key][idx] = true;
          inp.value = '';
          post.querySelector('.qz-cmt-box').dataset.to = '';
          inp.placeholder = '说点什么…';
          renderFeed(st.profileWho || 'Miko');
          save();
          return;
        }
        save();
      }
    });
    list.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.matches('.qz-cmt-box input')) {
        e.preventDefault();
        e.target.closest('.qz-cmt-box').querySelector('button').click();
      }
    });
  }

  /* ---------------- 设置 ---------------- */
  function avatarOptions() { return AVATARS.concat(['Lily', '未知用户']); }

  // 角色头像下拉旁的小预览（选「字母」时显示首字母）
  function syncNpcPrev(who, name) {
    var img = document.querySelector('.npc-prev[data-prev="' + who + '"]');
    if (!img) return;
    if (name === 'letter') {
      img.removeAttribute('src');
      img.classList.add('empty');
      img.textContent = who.slice(0, 1);
    } else {
      img.classList.remove('empty');
      img.textContent = '';
      img.src = asset('icon/' + name + '.webp');
    }
  }

  function renderAvatarPicker() {
    function label(name) {
      if (!name || name === 'letter') return '字母';
      if (name === 'Lily') return 'Lily';
      if (name === '未知用户') return '未知用户';
      return name;
    }
    $$('.npc-pick').forEach(function (btn) {
      var who = btn.getAttribute('data-npc');
      var cur = (st.settings.npc || {})[who] || NPC_DEFAULT[who] || 'letter';
      syncNpcPrev(who, cur);
      var lab = btn.querySelector('.npc-cur');
      if (lab) lab.textContent = label(cur);
    });
    renderMyAvatar();
  }

  function openAvaPop(who, btn) {
    var pop = $('#ava-pop');
    var cur = (st.settings.npc || {})[who] || NPC_DEFAULT[who] || 'letter';
    var list = avatarOptions();
    pop.innerHTML = list.map(function (n) {
      return '<button class="ava-opt' + (n === cur ? ' on' : '') + '" data-name="' + esc(n) + '">' +
        '<img src="' + esc(asset('icon/' + n + '.webp')) + '" alt="">' +
        '<span>' + esc(n.replace('头像', '头像 ')) + '</span></button>';
    }).join('') +
      '<button class="ava-opt letter' + (cur === 'letter' ? ' on' : '') + '" data-name="letter"><span class="lt">A</span><span>字母</span></button>';
    pop.hidden = false;
    pop.setAttribute('data-who', who);
    var r = btn.getBoundingClientRect();
    pop.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 236)) + 'px';
    var top = r.bottom + 6;
    if (top + 300 > window.innerHeight) top = Math.max(8, r.top - Math.min(pop.offsetHeight || 300, 320));
    pop.style.top = top + 'px';
    $$('.npc-pick').forEach(function (b) { b.classList.toggle('open', b === btn); });
    pop.onclick = function (e) {
      var b = e.target.closest('[data-name]');
      if (!b) return;
      e.stopPropagation();
      var name = b.getAttribute('data-name');
      var w = pop.getAttribute('data-who');
      st.settings.npc[w] = name;
      syncNpcPrev(w, name);
      var lab = document.querySelector('.npc-pick[data-npc="' + w + '"] .npc-cur');
      if (lab) lab.textContent = (name === 'letter' ? '字母' : name);
      save();
      refreshAvatars(w);
      closeAvaPop();
    };
  }

  function closeAvaPop() {
    var pop = $('#ava-pop');
    if (pop) pop.hidden = true;
    $$('.npc-pick').forEach(function (b) { b.classList.remove('open'); });
  }

  /* ---- 我的形象：QQ 头像 / 本地上传 / 不显示 ---- */
  function myAvatarSrc() {
    var a = st.settings.myAvatar || {};
    if (a.type === 'qq' && a.qq) return 'https://q1.qlogo.cn/g?b=qq&nk=' + encodeURIComponent(a.qq) + '&s=100';
    if (a.type === 'data' && a.data) return a.data;
    return '';
  }

  function renderMyAvatar() {
    var box = $('#my-ava-preview');
    if (!box) return;
    var src = myAvatarSrc();
    box.innerHTML = src
      ? '<img src="' + esc(src) + '" alt="我的头像">'
      : '<span class="ava-empty">无</span>';
    var a = st.settings.myAvatar || {};
    var qq = $('#my-qq');
    if (qq && a.type === 'qq') qq.value = a.qq || '';
  }

  function setMyAvatarQQ() {
    var qq = ($('#my-qq').value || '').trim();
    if (!/^[1-9]\d{4,11}$/.test(qq)) { toast('请输入 5–12 位 QQ 号'); return; }
    st.settings.myAvatar = { type: 'qq', qq: qq };
    save();
    renderMyAvatar();
    refreshMyAvatar();
    toast('已使用 QQ 头像');
  }

  function refreshMyAvatar() {
    var src = myAvatarSrc();
    $$('.ava[data-who="我"]').forEach(function (img) {
      if (src) img.src = src;
    });
  }

  function uploadAvatar(file) {
    var fr = new FileReader();
    fr.onload = function () {
      var im = new Image();
      im.onload = function () {
        var size = 200;
        var cv = document.createElement('canvas');
        cv.width = size; cv.height = size;
        var ctx = cv.getContext('2d');
        var m = Math.min(im.width, im.height);
        ctx.drawImage(im, (im.width - m) / 2, (im.height - m) / 2, m, m, 0, 0, size, size);
        var data = cv.toDataURL('image/jpeg', 0.85);
        st.settings.myAvatar = { type: 'data', data: data };
        try { save(); } catch (e) { toast('图片太大，存不下'); }
        renderMyAvatar();
        toast('头像已更新（仅存在本机）');
      };
      im.onerror = function () { toast('图片读不出来'); };
      im.src = fr.result;
    };
    fr.onerror = function () { toast('读取文件失败'); };
    fr.readAsDataURL(file);
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
    $('#set-reveal-lock').checked = st.settings.revealLock !== false;
    renderMyAvatar();
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
    $('#set-reveal-lock').onchange = function () {
      st.settings.revealLock = this.checked;
      save();
      $$('.ava[data-who]').forEach(function (el) { refreshAvatars(el.getAttribute('data-who')); });
    };
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
    $('#btn-qq').onclick = setMyAvatarQQ;
    $('#my-qq').onkeydown = function (e) { if (e.key === 'Enter') setMyAvatarQQ(); };
    $('#btn-ava-upload').onclick = function () { $('#file-ava').click(); };
    $('#file-ava').onchange = function () {
      var f = this.files && this.files[0];
      if (f) uploadAvatar(f);
      this.value = '';
    };
    $('#btn-ava-clear').onclick = function () {
      st.settings.myAvatar = { type: 'none' }; save();
      renderMyAvatar();
      $$('.ava[data-who="我"]').forEach(function (img) {
        var p = img.parentNode;
        if (p) p.classList.add('right');
        img.remove();
      });
      toast('已清除我的头像');
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
      if (t) {
        var dest = t.getAttribute('data-go');
        if (dest === 'close') {
          e.preventDefault();
          $$('.modal, .lightbox').forEach(function (m) { m.hidden = true; });
          return;
        }
        go(dest);
        return;
      }
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
      if (!s.hidden) refreshDayEntry();
    };
    $('#btn-restart').onclick = function () {
      st.cur = 0; st.ctx = null; $('#msg-list').innerHTML = '';
      $('#menu-sheet').hidden = true;
      save(); tick();
    };
    $('#btn-auto').onclick = function (e) {
      e.stopPropagation();
      st.auto = !st.auto;
      this.classList.toggle('on', st.auto);
      toast(st.auto ? '自动播放：开（自动推进 + 自动选第一个）' : '自动播放：关');
      if (st.auto) tick();
    };
    $('#btn-skip').onclick = function (e) {
      e.stopPropagation();
      st.skipAll = !st.skipAll;
      this.classList.toggle('on', st.skipAll);
      toast(st.skipAll ? '立即显示：开' : '立即显示：关');
      if (st.skipAll) {
        var w = $('#wait-card');
        if (!w.hidden && w._skip) w._skip();
        st.typingSkip = true;
        tick();
      }
    };
    $('#btn-jumpday').onclick = function (e) {
      e.stopPropagation();
      var ch = chapter(st.chapterId);
      if (!ch) return;
      var days = chapterDays(ch);
      var list = $('#day-list');
      if (!days.length) { toast('本章没有分天'); return; }
      list.innerHTML = days.map(function (d) {
        return '<button data-jump="' + d.idx + '">' + esc(d.label) + '</button>';
      }).join('');
      list.hidden = !list.hidden;
      $('#jumpday-sub').textContent = list.hidden ? days.length + ' 天可选' : '选择要跳到的天';
    };
    $('#day-list').onclick = function (e) {
      var b = e.target.closest('[data-jump]');
      if (!b) return;
      e.stopPropagation();
      var idx = Number(b.getAttribute('data-jump'));
      st.gen++;
      st.busy = false;
      st.cur = idx;
      st.ctx = null;
      st.typingSkip = true;
      $('#msg-list').innerHTML = '';
      $('#day-list').hidden = true;
      $('#menu-sheet').hidden = true;
      save();
      tick();
    };
    $('#btn-after').onclick = function (e) {
      e.stopPropagation();
      $('#menu-sheet').hidden = true;
      openAfter();
    };
    $('#chat-body').addEventListener('click', function (e) {
      if (e.target.closest('button') || e.target.closest('.img-card')) return;
      st.typingSkip = true;
    });
    $('#wait-skip').onclick = function () {
      var w = $('#wait-card');
      if (w._skip) w._skip();
    };
    document.addEventListener('click', function (e) {
      var s = $('#menu-sheet');
      if (!s.hidden && !e.target.closest('#menu-sheet') && !e.target.closest('#btn-menu')) s.hidden = true;
    });
    // 角色头像：点按钮弹出竖排头像列
    $$('.npc-pick').forEach(function (btn) {
      btn.onclick = function (e) {
        e.stopPropagation();
        var pop = $('#ava-pop');
        if (!pop.hidden && pop.getAttribute('data-who') === btn.getAttribute('data-npc')) {
          closeAvaPop();
          return;
        }
        openAvaPop(btn.getAttribute('data-npc'), btn);
      };
    });
    document.addEventListener('click', function (e) {
      if (!e.target.closest('#ava-pop') && !e.target.closest('.npc-pick')) closeAvaPop();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closeAvaPop(); $('#after-modal').hidden = true; }
    });

    // 后日谈
    $('#after-send').onclick = function (e) { e.stopPropagation(); sendAfter(); };
    $('#after-input').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); sendAfter(); }
    });
    var ac = $('#after-close');
    if (ac) ac.onclick = function () { $('#after-modal').hidden = true; };

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
      st.booted = true;
      if (!st.chapterId) st.chapterId = (orderedChapters()[0] || {}).id || null;
      route();
      applyBgm();
    }).catch(function (err) {
      document.body.innerHTML = '<pre style="color:#f88;padding:20px">数据加载失败：' + esc(err && err.message) + '</pre>';
    });
  }

  // 调试手柄：仅 ?debug=1 时暴露，便于本地验证状态
  if (location.search.indexOf('debug=1') >= 0) {
    window.MIKO_DEBUG = { st: st, save: save, route: route, render: renderFeed, markNamed: markNamed, nameKnown: nameKnown, avatarFor: avatarFor };
  }

  boot();
})();
