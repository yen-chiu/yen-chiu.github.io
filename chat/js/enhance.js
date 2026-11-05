/**
 * 与念真聊天中 —— 体验增强
 * ---------------------------------------------------------------------------
 * 原站点是 Vue 写的脚本化对话（src/index.js + assets/dialog.json），
 * 这里不改它的核心逻辑，只在外层补齐几件小事：
 *
 *   1. 「重新开始」：清空对话重来（直接重载页面，最简单也最可靠）
 *   2. 数字键 1~9 快速选择选项，Esc 关闭面板（桌面端更顺手）
 *   3. 给选项加序号并同步到按钮，方便键盘用户
 *   4. 给动态生成的链接补 rel="noopener"，避免新标签页拿到 window.opener
 *   5. 重复提问：同一句再问一遍，只回一句「刚说过」，不重播整段
 */

(function () {
  'use strict';

  /* ---------------- 兼容旧埋点 ----------------
     原插件里写着 if (_gaq) _gaq.push([...])，GA 移除后直接引用未声明变量会抛
     ReferenceError（中文环境下表现为「点了选项没反应」）。这里放一个无害的替身。 */
  if (!window._gaq) {
    window._gaq = [];
  }

  /* ---------------- 重新开始 ---------------- */

  function restart() {
    try {
      // 保留 hash 之外的状态全部清掉
      window.location.reload();
    } catch (e) {
      window.location.href = window.location.pathname;
    }
  }

  var restartBtn = document.getElementById('restart-btn');
  if (restartBtn) {
    restartBtn.addEventListener('click', restart);
  }

  /* ---------------- 重复提问：刚说过 ----------------
     脚本本身没有记忆，这里在外层记下「这次会话里问过什么」。
     同一句再问，不重播整段，只回一句她的口气——短、嘴硬，偶尔心软。 */

  function setupRepeatGuard() {
    var root = document.getElementById('mobile');
    var vm = root && root.__vue__;
    if (!vm || typeof vm.respond !== 'function' || vm.__wdRepeatGuard) return;
    vm.__wdRepeatGuard = true;

    var seen = Object.create(null);

    var LINES = [
      '刚说过啦。',
      '又问一遍？……你是没记住，还是想听我再说一次。',
      '这个刚讲过。换一个问。',
      '哼~ 自己翻聊天记录去。',
      '讲过了呀，你是来查岗的吗。',
      '……你是在套我话吧。',
      '刚说过。不过你要是真想听，我也可以再讲一遍。',
      '你这一遍问得跟上一遍一模一样。'
    ];

    function scrollChat() {
      var body = document.getElementById('mobile-body-content');
      if (body) body.scrollTop = body.scrollHeight;
    }

    function pickLine() {
      return LINES[Math.floor(Math.random() * LINES.length)];
    }

    function sayRepeat(userText) {
      vm.hasPrompt = false;
      vm.isXianzheTyping = true;
      vm.messages.push({ author: 'me', content: userText });
      scrollChat();
      setTimeout(function () {
        vm.messages.push({ author: 'xianzhe', content: pickLine() });
        scrollChat();
        setTimeout(function () {
          vm.isXianzheTyping = false;
          scrollChat();
        }, 600);
      }, 550);
    }

    var originalRespond = vm.respond;
    vm.respond = function (response) {
      var key = response && response.content ? String(response.content) : '';
      if (key && seen[key]) {
        sayRepeat(key);
        return;
      }
      if (key) seen[key] = true;
      return originalRespond.call(vm, response);
    };

    var originalAsk = vm.ask;
    vm.ask = function (topic) {
      var key = topic && topic.brief ? 'topic:' + topic.brief : '';
      if (key && seen[key]) {
        var details = (topic && topic.details) || [];
        var line = details.length ? details[Math.floor(Math.random() * details.length)] : topic.brief;
        sayRepeat(line);
        return;
      }
      if (key) seen[key] = true;
      return originalAsk.call(vm, topic);
    };
  }

  setupRepeatGuard();

  /* ---------------- 选项序号 + 键盘选择 ---------------- */

  function getOptionLinks() {
    return Array.prototype.slice.call(
      document.querySelectorAll(
        '#prompt-body .responses li a, #prompt-body .topics li a'
      )
    );
  }

  function syncKeys() {
    getOptionLinks().forEach(function (link, index) {
      var key = index + 1;
      if (key <= 9) {
        link.setAttribute('data-key', String(key));
        link.setAttribute('data-shortcut', String(key));
        if (!link.getAttribute('title')) {
          link.setAttribute('title', '按 ' + key + ' 选择');
        }
      }
    });
  }

  // Vue 会重绘面板，用 MutationObserver 保持序号同步
  var promptBody = document.getElementById('prompt-body');
  if (promptBody && window.MutationObserver) {
    new MutationObserver(syncKeys).observe(promptBody, {
      childList: true,
      subtree: true
    });
  }
  syncKeys();

  function closePrompt() {
    var bg = document.getElementById('prompt-bg');
    if (bg) bg.click();
  }

  function openPrompt() {
    var hint = document.getElementById('input-hint');
    if (hint && !document.querySelector('#mobile.has-prompt')) {
      hint.click();
    }
  }

  document.addEventListener('keydown', function (e) {
    var tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.isComposing) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.key === 'Escape') {
      closePrompt();
      return;
    }

    if (e.key === 'Enter' || e.key === ' ') {
      var opened = document.querySelector('#mobile.has-prompt');
      if (!opened) {
        e.preventDefault();
        openPrompt();
      }
      return;
    }

    if (/^[1-9]$/.test(e.key)) {
      var links = getOptionLinks();
      var target = links[parseInt(e.key, 10) - 1];
      if (target) {
        e.preventDefault();
        target.click();
      }
    }
  });

  /* ---------------- 动态链接补 rel ---------------- */

  var chatBody = document.getElementById('mobile-body-content');
  if (chatBody && window.MutationObserver) {
    var observer = new MutationObserver(function () {
      chatBody.querySelectorAll('a[target="_blank"]').forEach(function (a) {
        var rel = a.getAttribute('rel') || '';
        if (rel.indexOf('noopener') === -1) {
          a.setAttribute('rel', (rel ? rel + ' ' : '') + 'noopener noreferrer');
        }
      });
    });
    observer.observe(chatBody, { childList: true, subtree: true });
  }

  /* ---------------- 首屏：把焦点交给「说点什么」，移动端弹出提示 ---------------- */

  window.addEventListener('load', function () {
    var hint = document.getElementById('input-hint');
    if (hint) {
      hint.setAttribute('tabindex', '0');
      hint.setAttribute('role', 'button');
      hint.setAttribute('aria-label', '选择一个话题开始聊天');
    }
  });
})();
