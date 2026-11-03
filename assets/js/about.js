/* ==========================================================================
   关于页交互
   --------------------------------------------------------------------------
   - 首屏打字机
   - 数字滚动
   - 滚动入场
   - 卡片跟随鼠标的聚光
   - giscus 评论区（跟随亮 / 暗主题）

   全部做成「没有 JS 也能读」的渐进增强：动效失败时内容照常显示。
   ========================================================================== */

(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  window.__wxAboutReady = true;

  /* ---------- 首屏打字机 ---------- */
  (function () {
    var el = document.querySelector('[data-wx-typing]');
    if (!el) return;

    var phrases;
    try {
      phrases = JSON.parse(el.getAttribute('data-wx-typing'));
    } catch (err) {
      return;
    }

    if (!Array.isArray(phrases) || phrases.length === 0) return;

    if (reduceMotion) {
      el.textContent = phrases[0];
      return;
    }

    var phraseIndex = 0;
    var charIndex = 0;
    var deleting = false;

    function tick() {
      var phrase = phrases[phraseIndex];
      charIndex += deleting ? -1 : 1;
      el.textContent = phrase.slice(0, charIndex);

      var delay = deleting ? 34 : 88;

      if (!deleting && charIndex === phrase.length) {
        deleting = true;
        delay = 1900;
      } else if (deleting && charIndex === 0) {
        deleting = false;
        phraseIndex = (phraseIndex + 1) % phrases.length;
        delay = 420;
      }

      window.setTimeout(tick, delay);
    }

    window.setTimeout(tick, 500);
  })();

  /* ---------- 运行天数 ---------- */
  (function () {
    var el = document.getElementById('wx-about-days');
    if (!el) return;

    var since = Date.parse(el.getAttribute('data-since') || '');
    if (isNaN(since)) {
      el.textContent = '—';
      return;
    }

    var days = Math.max(0, Math.floor((Date.now() - since) / 86400000));
    el.textContent = days.toLocaleString('zh-CN');
  })();

  /* ---------- 数字滚动 ---------- */
  (function () {
    var counters = document.querySelectorAll('[data-wx-count]');
    if (counters.length === 0) return;

    function finalize(el) {
      var target = parseInt(el.getAttribute('data-wx-count'), 10);
      if (!isNaN(target)) el.textContent = target.toLocaleString('zh-CN');
    }

    if (reduceMotion || !('IntersectionObserver' in window)) {
      counters.forEach(finalize);
      return;
    }

    function animate(el) {
      var target = parseInt(el.getAttribute('data-wx-count'), 10);
      if (isNaN(target)) return;

      var started = null;
      var duration = 900;

      function step(now) {
        if (started === null) started = now;
        var progress = Math.min(1, (now - started) / duration);
        var eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(target * eased).toLocaleString('zh-CN');
        if (progress < 1) window.requestAnimationFrame(step);
      }

      window.requestAnimationFrame(step);
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          animate(entry.target);
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.35 }
    );

    counters.forEach(function (el) {
      observer.observe(el);
    });
  })();

  /* ---------- 滚动入场 ---------- */
  (function () {
    var items = document.querySelectorAll('[data-wx-reveal]');
    if (items.length === 0) return;

    function revealAll() {
      items.forEach(function (el) {
        el.classList.add('is-in');
      });
    }

    if (reduceMotion || !('IntersectionObserver' in window)) {
      document.documentElement.classList.remove('wx-reveal-ready');
      revealAll();
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-in');
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    );

    items.forEach(function (el) {
      observer.observe(el);
    });
  })();

  /* ---------- 卡片聚光 ---------- */
  (function () {
    if (!canHover) return;

    var cards = document.querySelectorAll(
      '.wx-about-card, .wx-about-post, .wx-about-profile'
    );

    cards.forEach(function (card) {
      var frame = null;

      card.addEventListener(
        'pointermove',
        function (event) {
          if (frame !== null) return;

          frame = window.requestAnimationFrame(function () {
            var rect = card.getBoundingClientRect();
            card.style.setProperty('--wx-mx', event.clientX - rect.left + 'px');
            card.style.setProperty('--wx-my', event.clientY - rect.top + 'px');
            frame = null;
          });
        },
        { passive: true }
      );
    });
  })();

  /* ---------- giscus 评论区（折叠后按需加载） ---------- */
  (function () {
    var mount = document.getElementById('wx-about-giscus');
    if (!mount) return;

    var details = document.getElementById('wx-about-comments');
    var repo = mount.getAttribute('data-repo');
    if (!repo) return;

    var origin = 'https://giscus.app';
    var darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
    var loaded = false;

    function currentTheme() {
      var mode = document.documentElement.getAttribute('data-mode');
      if (mode === 'dark') return 'dark_dimmed';
      if (mode === 'light') return 'light';
      return darkQuery.matches ? 'dark_dimmed' : 'light';
    }

    function load() {
      if (loaded) return;
      loaded = true;

      var attributes = {
        src: origin + '/client.js',
        'data-repo': repo,
        'data-repo-id': mount.getAttribute('data-repo-id') || '',
        'data-category': mount.getAttribute('data-category') || '',
        'data-category-id': mount.getAttribute('data-category-id') || '',
        'data-mapping': mount.getAttribute('data-mapping') || 'pathname',
        'data-strict': '0',
        'data-reactions-enabled': '1',
        'data-emit-metadata': '0',
        'data-input-position': 'top',
        'data-theme': currentTheme(),
        'data-lang': 'zh-CN',
        'data-loading': 'lazy',
        crossorigin: 'anonymous',
        async: ''
      };

      var script = document.createElement('script');
      Object.keys(attributes).forEach(function (key) {
        script.setAttribute(key, attributes[key]);
      });
      mount.appendChild(script);
    }

    function updateTheme(theme) {
      var frame = mount.querySelector('.giscus-frame');
      if (!frame || !frame.contentWindow) return;
      frame.contentWindow.postMessage(
        { giscus: { setConfig: { theme: theme } } },
        origin
      );
    }

    window.addEventListener('message', function (event) {
      if (event.source !== window || !event.data) return;
      if (event.data.direction !== 'mode-toggle') return;
      updateTheme(event.data.message === 'dark' ? 'dark_dimmed' : 'light');
    });

    darkQuery.addEventListener('change', function () {
      if (!document.documentElement.hasAttribute('data-mode')) {
        updateTheme(currentTheme());
      }
    });

    if (!details) {
      load();
      return;
    }

    if (details.open || window.location.hash === '#comments') {
      details.open = true;
      load();
    }

    details.addEventListener('toggle', function () {
      if (details.open) load();
    });
  })();
})();
