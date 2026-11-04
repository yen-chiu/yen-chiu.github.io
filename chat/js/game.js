/**
 * 对话游戏页面：把剧本数据接到界面上
 * ---------------------------------------------------------------------------
 * 这一层只做四件事：
 *   1. 取剧本（assets/stories/*.json）交给 WDNarrative.Story
 *   2. 把事件画成聊天气泡 / 选项
 *   3. 自动存档、结局收集
 *   4. 菜单：快速模式、回退一步、重新开始
 */

(function () {
  'use strict';

  var STORY_URL = 'assets/stories/night-radio.json';
  var SAVE_KEY = 'wd.story.night-radio.save';
  var ENDING_KEY = 'wd.story.endings';
  var SPEED_KEY = 'wd.story.speed';

  var el = {
    chat: document.getElementById('wd-chat'),
    typing: document.getElementById('wd-typing'),
    choices: document.getElementById('wd-choices'),
    choicesList: document.getElementById('wd-choices-list'),
    choicesHint: document.getElementById('wd-choices-hint'),
    chapter: document.getElementById('wd-chapter'),
    intro: document.getElementById('wd-intro'),
    ending: document.getElementById('wd-ending'),
    start: document.getElementById('wd-start'),
    continueBtn: document.getElementById('wd-continue'),
    menu: document.getElementById('wd-menu'),
    menuBtn: document.getElementById('wd-menu-btn'),
    rewind: document.getElementById('wd-rewind'),
    speed: document.getElementById('wd-speed'),
    restart: document.getElementById('wd-restart'),
    gallery: document.getElementById('wd-gallery'),
    galleryCount: document.getElementById('wd-gallery-count')
  };

  var story = null;
  var data = null;
  var state = {
    finished: false,
    ending: null
  };
  var fastMode = false;
  var reducedMotion = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  /* ---------------- 存取 ---------------- */

  function readJSON(key, fallback) {
    try {
      var raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  function loadSave() {
    var save = readJSON(SAVE_KEY, null);
    if (!save || !save.nodeId || !Array.isArray(save.messages)) return null;
    if (save.version !== 1) return null;
    return save;
  }

  function persist() {
    if (!story || !story.nodeId) return;
    writeJSON(SAVE_KEY, {
      version: 1,
      nodeId: story.nodeId,
      vars: story.vars,
      messages: story.messages,
      snapshots: story.snapshots,
      finished: story.finished,
      ending: story.ending,
      updatedAt: Date.now()
    });
  }

  function clearSave() {
    try {
      window.localStorage.removeItem(SAVE_KEY);
    } catch (e) {
      /* 无所谓 */
    }
  }

  function unlockedEndings() {
    var list = readJSON(ENDING_KEY, []);
    return Array.isArray(list) ? list : [];
  }

  function unlockEnding(id) {
    if (!id) return;
    var list = unlockedEndings();
    if (list.indexOf(id) === -1) {
      list.push(id);
      writeJSON(ENDING_KEY, list);
    }
    updateGalleryCount();
  }

  function updateGalleryCount() {
    if (!el.galleryCount || !data) return;
    el.galleryCount.textContent = unlockedEndings().length + ' / ' + data.meta.endingCount;
  }

  /* ---------------- 渲染 ---------------- */

  function escapeHTML(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function scrollDown() {
    if (!el.chat) return;
    requestAnimationFrame(function () {
      el.chat.scrollTop = el.chat.scrollHeight;
    });
  }

  function appendTime(text) {
    var node = document.createElement('div');
    node.className = 'wd-chat__time';
    node.textContent = text;
    el.chat.appendChild(node);
    scrollDown();
  }

  function appendNotice(text) {
    var node = document.createElement('div');
    node.className = 'wd-chat__notice';
    node.textContent = text;
    el.chat.appendChild(node);
    scrollDown();
  }

  function appendBubble(msg) {
    var row = document.createElement('div');
    row.className = 'wd-row' + (msg.who === 'me' ? ' wd-row--me' : '');

    if (msg.who !== 'me') {
      var avatar = document.createElement('div');
      avatar.className = 'wd-avatar';
      avatar.setAttribute('aria-hidden', 'true');
      avatar.textContent = '柚';
      row.appendChild(avatar);
    }

    var bubble = document.createElement('div');
    bubble.className = 'wd-bubble';

    if (msg.image) {
      var img = document.createElement('img');
      img.src = msg.image;
      img.alt = msg.caption || '照片';
      img.loading = 'lazy';
      img.addEventListener('load', scrollDown);
      bubble.appendChild(img);
      if (msg.caption) {
        var cap = document.createElement('figcaption');
        cap.textContent = msg.caption;
        bubble.appendChild(cap);
      }
    }

    if (msg.text) {
      var text = document.createElement('span');
      text.textContent = msg.text;
      bubble.appendChild(text);
    }

    row.appendChild(bubble);
    el.chat.appendChild(row);
    scrollDown();
  }

  function appendMessage(msg) {
    if (!msg) return;
    if (msg.who === 'system') {
      appendNotice(msg.text || '');
      return;
    }
    appendBubble(msg);
  }

  function showTyping(on) {
    if (!el.typing) return;
    el.typing.hidden = !on;
    if (on) scrollDown();
  }

  function setChapter(time) {
    if (!el.chapter || !time) return;
    el.chapter.textContent = time + ' · 一个普通的深夜';
  }

  function clearChoices() {
    if (!el.choices) return;
    el.choices.hidden = true;
    el.choicesList.innerHTML = '';
  }

  function renderChoices(list) {
    if (!el.choices) return;
    el.choicesList.innerHTML = '';
    if (!list || !list.length) {
      el.choices.hidden = true;
      return;
    }

    list.forEach(function (choice, index) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'wd-choice';
      btn.dataset.index = String(index);

      var key = document.createElement('span');
      key.className = 'wd-choice__key';
      key.textContent = String(index + 1);
      btn.appendChild(key);

      var label = document.createElement('span');
      label.textContent = choice.text;
      btn.appendChild(label);

      if (choice.when) {
        var mark = document.createElement('span');
        mark.className = 'wd-choice__secret';
        mark.title = '只有在前面说对了话，才会出现这句';
        mark.textContent = '✦';
        btn.appendChild(mark);
      }

      btn.addEventListener('click', function () {
        choose(index);
      });

      el.choicesList.appendChild(btn);
    });

    el.choices.hidden = false;
    if (el.choicesHint) {
      el.choicesHint.textContent = window.matchMedia && window.matchMedia('(pointer: fine)').matches
        ? '· 也可以按 1–9'
        : '';
    }
    scrollDown();
  }

  function choose(index) {
    if (!story || state.finished) return;
    clearChoices();
    story.choose(index);
    persist();
    updateMenu();
  }

  /* ---------------- 结局 ---------------- */

  function endingIndexOf(id) {
    if (!data || !data.endings) return 0;
    return Object.keys(data.endings).indexOf(id) + 1;
  }

  function showEnding(ending) {
    if (!ending) return;
    state.finished = true;
    state.ending = ending;
    unlockEnding(ending.id);
    clearChoices();
    persist();

    var unlocked = unlockedEndings();
    var list = Object.keys(data.endings)
      .map(function (id, i) {
        var item = data.endings[id];
        var got = unlocked.indexOf(id) !== -1;
        return (
          '<li data-locked="' + (got ? 'false' : 'true') + '">' +
          '<strong>' + (got ? escapeHTML(item.title) : '？？？') + '</strong>' +
          '<span>' + (got ? escapeHTML(item.hint || '') : '还没有走到这个结局') + '</span>' +
          '</li>'
        );
      })
      .join('');

    el.ending.innerHTML =
      '<p class="wd-overlay__eyebrow">Ending ' + endingIndexOf(ending.id) + ' / ' + data.meta.endingCount + '</p>' +
      '<h1 class="wd-overlay__title">' + escapeHTML(ending.title) + '</h1>' +
      '<p class="wd-ending__quote">' + escapeHTML(ending.quote || '') + '</p>' +
      '<p class="wd-ending__summary">' + escapeHTML(ending.summary || '') + '</p>' +
      '<h2 class="wd-overlay__eyebrow">结局收集</h2>' +
      '<ul class="wd-endings">' + list + '</ul>' +
      '<div class="wd-overlay__actions">' +
      '<button type="button" class="wd-btn" id="wd-again">再玩一次</button>' +
      '<button type="button" class="wd-btn wd-btn--ghost" id="wd-rewind-ending">回到上一个选择</button>' +
      '<button type="button" class="wd-btn wd-btn--ghost" id="wd-close-ending">看看聊天记录</button>' +
      '</div>';

    el.ending.hidden = false;

    var again = document.getElementById('wd-again');
    var rewind = document.getElementById('wd-rewind-ending');
    var close = document.getElementById('wd-close-ending');

    if (again) again.addEventListener('click', restart);
    if (rewind) {
      rewind.hidden = !story.canRewind();
      rewind.addEventListener('click', function () {
        el.ending.hidden = true;
        state.finished = false;
        state.ending = null;
        doRewind();
      });
    }
    if (close) {
      close.addEventListener('click', function () {
        el.ending.hidden = true;
      });
    }
  }

  /* ---------------- 流程 ---------------- */

  function freshStart() {
    clearSave();
    el.chat.innerHTML = '';
    el.ending.hidden = true;
    el.intro.hidden = true;
    state.finished = false;
    state.ending = null;
    clearChoices();
    setChapter('02:17');
    if (!story) return;
    story.start();
    persist();
    updateMenu();
  }

  function continueSave(save) {
    el.intro.hidden = true;
    el.chat.innerHTML = '';
    el.ending.hidden = true;
    state.finished = false;
    state.ending = null;
    clearChoices();

    (save.messages || []).forEach(function (msg) {
      appendMessage(msg);
    });

    if (save.finished && save.ending) {
      showEnding(save.ending);
      return;
    }

    story.resume(save);
    if (save.nodeId) {
      var node = data.nodes[save.nodeId];
      if (node && node.time) setChapter(node.time);
    }
    updateMenu();
  }

  function doRewind() {
    if (!story) return;
    var result = story.rewind();
    if (!result) return;
    state.finished = false;
    state.ending = null;
    el.ending.hidden = true;

    // 界面上把回退点之后的气泡剪掉：只数气泡行和系统小条，时间分隔线跟着剪
    var count = 0;
    for (var i = 0; i < el.chat.children.length; i++) {
      if (isChatItem(el.chat.children[i])) count++;
    }
    while (count > result.messageCount && el.chat.lastChild) {
      var last = el.chat.lastChild;
      if (isChatItem(last)) count--;
      el.chat.removeChild(last);
    }

    persist();
    updateMenu();
  }

  /** 聊天区里「算数」的子节点：气泡行 + 系统小条（时间分隔线不算） */
  function isChatItem(node) {
    var cls = (node && node.className) || '';
    return cls.indexOf('wd-row') !== -1 || cls.indexOf('wd-chat__notice') !== -1;
  }

  function restart() {
    el.ending.hidden = true;
    el.intro.hidden = false;
    clearChoices();
    setChapter('02:17');
    if (story) story.reset();
    updateMenu();
  }

  function updateMenu() {
    if (!story) return;
    if (el.rewind) el.rewind.disabled = !story.canRewind();
    if (el.speed) {
      el.speed.textContent = fastMode ? '快速模式：开' : '快速模式：关';
      el.speed.setAttribute('aria-pressed', String(fastMode));
    }
    updateGalleryCount();
  }

  function applySpeed() {
    if (!story) return;
    story.speed = fastMode ? 3 : reducedMotion ? 5 : 1;
  }

  function toggleMenu(force) {
    if (!el.menu) return;
    var open = force != null ? force : el.menu.hidden;
    el.menu.hidden = !open;
    el.menuBtn.setAttribute('aria-expanded', String(open));
  }

  function showGallery() {
    var unlocked = unlockedEndings();
    var list = Object.keys(data.endings)
      .map(function (id) {
        var item = data.endings[id];
        var got = unlocked.indexOf(id) !== -1;
        return (
          '<li data-locked="' + (got ? 'false' : 'true') + '">' +
          '<strong>' + (got ? escapeHTML(item.title) : '？？？') + '</strong>' +
          '<span>' + (got ? escapeHTML(item.summary || '') : '还没有走到这个结局') + '</span>' +
          '</li>'
        );
      })
      .join('');

    el.ending.innerHTML =
      '<p class="wd-overlay__eyebrow">Ending Gallery</p>' +
      '<h1 class="wd-overlay__title">结局收集</h1>' +
      '<p class="wd-overlay__sub">已经走到 ' + unlocked.length + ' / ' + data.meta.endingCount + ' 个。换个说法，故事会往别处走。</p>' +
      '<ul class="wd-endings">' + list + '</ul>' +
      '<div class="wd-overlay__actions">' +
      '<button type="button" class="wd-btn" id="wd-gallery-close">回到故事</button>' +
      '</div>';

    el.ending.hidden = false;
    document.getElementById('wd-gallery-close').addEventListener('click', function () {
      el.ending.hidden = true;
    });
  }

  /* ---------------- 绑定 ---------------- */

  function bindUI() {
    el.start.addEventListener('click', freshStart);

    if (el.continueBtn) {
      el.continueBtn.addEventListener('click', function () {
        var save = loadSave();
        if (save) continueSave(save);
        else freshStart();
      });
    }

    el.menuBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleMenu();
    });

    el.rewind.addEventListener('click', function () {
      toggleMenu(false);
      doRewind();
    });

    el.speed.addEventListener('click', function () {
      fastMode = !fastMode;
      applySpeed();
      writeJSON(SPEED_KEY, fastMode);
      updateMenu();
    });

    el.restart.addEventListener('click', function () {
      toggleMenu(false);
      restart();
    });

    el.gallery.addEventListener('click', function () {
      toggleMenu(false);
      showGallery();
    });

    document.addEventListener('click', function (e) {
      if (!el.menu.hidden && !el.menu.contains(e.target) && e.target !== el.menuBtn) {
        toggleMenu(false);
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (!el.menu.hidden) {
          toggleMenu(false);
          return;
        }
        if (!el.ending.hidden) {
          el.ending.hidden = true;
        }
        return;
      }

      if (el.intro.hidden === false || el.ending.hidden === false) {
        if ((e.key === 'Enter' || e.key === ' ') && e.target === document.body) {
          e.preventDefault();
          if (!el.intro.hidden) el.start.click();
        }
        return;
      }

      if (/^[1-9]$/.test(e.key) && !el.choices.hidden) {
        var buttons = el.choicesList.querySelectorAll('.wd-choice');
        var target = buttons[parseInt(e.key, 10) - 1];
        if (target) {
          e.preventDefault();
          target.click();
        }
      }
    });
  }

  /* ---------------- 启动 ---------------- */

  function initStoryHandlers() {
    story = new window.WDNarrative.Story(data, {
      onTime: function (time) {
        appendTime(time);
        setChapter(time);
      },
      onTyping: function (who, ms) {
        showTyping(Boolean(who && ms));
      },
      onMessage: function (msg) {
        appendMessage(msg);
        persist();
      },
      onChoices: function (list) {
        if (list && list.length) renderChoices(list);
        else clearChoices();
        persist();
      },
      onEnding: function (ending) {
        if (ending) showEnding(ending);
      }
    });
    applySpeed();
  }

  function boot() {
    bindUI();

    fetch(STORY_URL, { cache: 'no-cache' })
      .then(function (res) {
        if (!res.ok) throw new Error('剧本加载失败：HTTP ' + res.status);
        return res.json();
      })
      .then(function (json) {
        data = json;
        initStoryHandlers();
        updateGalleryCount();

        var speed = readJSON(SPEED_KEY, false);
        fastMode = Boolean(speed);
        applySpeed();
        updateMenu();

        var save = loadSave();
        if (save) {
          el.continueBtn.hidden = false;
          el.continueBtn.textContent = save.finished ? '查看上次的结局' : '继续上次';
        }

        // 方便自测与分享：?autostart 直接开场，?fast 用快速节奏，?reset 丢掉存档
        var params = new URLSearchParams(window.location.search);
        if (params.has('reset')) clearSave();
        if (params.has('fast')) {
          fastMode = true;
          applySpeed();
        }
        if (params.has('autostart')) freshStart();
      })
      .catch(function (err) {
        if (window.console) console.error(err);
        el.start.disabled = true;
        el.start.textContent = '剧本加载失败';
        appendNotice('剧本没能加载：' + err.message + '。刷新一次试试，或者先回聊天页。');
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
