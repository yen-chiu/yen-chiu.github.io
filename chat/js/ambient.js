/**
 * 氛围背景运行时
 * ---------------------------------------------------------------------------
 * 只做四件事：
 *   1. 把背景 DOM 挂到 body（幂等），并把 html 标记成 data-ambient="on"
 *   2. 在 canvas 上画 24 粒光尘（30fps、DPR≤1.5、预渲染 sprite）
 *   3. 管理启停：页面隐藏 / 抽屉打开 / 省流量 / 减少动效 / 窄屏
 *   4. 监听主题变化，重建 sprite；监听「念真在打字」让房间亮一点
 *
 * 约定：
 *   - 所有暂停原因放进 reasons 集合，只有 tick() 决定启停，避免双 rAF。
 *   - 帧内不读布局（getComputedStyle / getBoundingClientRect / innerWidth）。
 *   - 粒子坐标归一化到 0..1，resize 不重新播种（iOS 地址栏不会让粒子瞬移）。
 *   - 没有 canvas / 没有 2d 上下文时静默降级，只留 CSS 层。
 */

(function () {
  'use strict';

  var STORE_KEY = 'wd.ambient';
  var MODES = { auto: 1, still: 1, firefly: 1 };
  var PARTS = 24;
  var FRAME = 33; /* ~30fps */

  var root = null;
  var canvas = null;
  var ctx = null;
  var sprites = [];
  var parts = [];
  var raf = 0;
  var lastDraw = 0;
  var mounted = false;
  var themeAtBuild = '';

  var state = {
    mode: 'auto',
    effect: 'static',
    theme: 'dark',
    w: 0,
    h: 0,
    dpr: 1
  };

  var reasons = {
    hidden: false,
    drawer: false,
    reduced: false,
    saveData: false,
    small: false
  };

  var mqReduced = null;
  var mqSmall = null;
  var resizeTimer = 0;
  var listeners = [];

  function on(target, type, fn, opts) {
    target.addEventListener(type, fn, opts || false);
    listeners.push([target, type, fn, opts]);
  }

  function readMode() {
    try {
      var v = window.localStorage.getItem(STORE_KEY);
      return MODES[v] ? v : 'auto';
    } catch (e) {
      return 'auto';
    }
  }

  function writeMode(mode) {
    try {
      window.localStorage.setItem(STORE_KEY, mode);
    } catch (e) {
      /* 隐私模式存不进去也没关系 */
    }
  }

  function setMode(mode) {
    if (!MODES[mode]) return state.mode;
    state.mode = mode;
    writeMode(mode);
    document.documentElement.setAttribute('data-ambient-mode', mode);
    resolve();
    return state.mode;
  }

  function getMode() {
    return state.mode;
  }

  function resolve() {
    var staticOnly =
      state.mode === 'still' ||
      reasons.reduced ||
      reasons.small ||
      reasons.saveData;

    state.effect = staticOnly ? 'static' : 'full';
    document.documentElement.setAttribute('data-ambient-effect', state.effect);
    tick();
  }

  function want() {
    // 浅色下光尘会像屏幕上的灰点，直接不画；极光仍然由 CSS 负责
    return mounted && state.effect === 'full' && state.theme !== 'light' &&
      !reasons.hidden && !reasons.drawer;
  }

  function tick() {
    if (want()) start();
    else stop();
  }

  /* ---------------- canvas ---------------- */

  function readDustColor(name, fallback) {
    var v = '';
    try {
      v = getComputedStyle(root || document.documentElement).getPropertyValue(name);
    } catch (e) {
      v = '';
    }
    return (v || fallback).replace(/^\s+|\s+$/g, '');
  }

  function sprite(rgb) {
    var s = document.createElement('canvas');
    s.width = s.height = 64;
    var g = s.getContext('2d');
    if (!g) return s;
    var grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(' + rgb + ',0.95)');
    grad.addColorStop(0.32, 'rgba(' + rgb + ',0.42)');
    grad.addColorStop(1, 'rgba(' + rgb + ',0)');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(32, 32, 32, 0, Math.PI * 2);
    g.fill();
    return s;
  }

  function buildSprites() {
    sprites[0] = sprite(readDustColor('--wd-amb-dust', '110, 235, 208'));
    sprites[1] = sprite(readDustColor('--wd-amb-dust-warm', '242, 201, 155'));
    themeAtBuild = document.documentElement.getAttribute('data-theme') || 'light';
  }

  function seed() {
    parts = [];
    for (var i = 0; i < PARTS; i++) {
      parts.push({
        x: Math.random(),
        y: Math.random(),
        r: 5 + Math.random() * 6,
        vy: 0.0006 + Math.random() * 0.0014,
        sway: 0.4 + Math.random() * 0.9,
        phase: Math.random() * Math.PI * 2,
        a: 0.08 + Math.random() * 0.14,
        warm: Math.random() < 0.1 ? 1 : 0
      });
    }
  }

  function measure() {
    if (!canvas) return;
    var w = root.clientWidth;
    var h = root.clientHeight;
    var dpr = Math.min(1.5, window.devicePixelRatio || 1);
    if (!w || !h) return;
    if (w === state.w && h === state.h && dpr === state.dpr) return;

    state.w = w;
    state.h = h;
    state.dpr = dpr;

    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(0);
  }

  function draw(t) {
    if (!ctx || !sprites[0]) return;
    var w = state.w;
    var h = state.h;
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';

    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      var x = (p.x + Math.sin(t * 0.00016 * p.sway + p.phase) * 0.006) % 1;
      var y = (p.y - (t * p.vy) % 1 + 1) % 1;
      var r = p.r;
      ctx.globalAlpha = p.a;
      ctx.drawImage(sprites[p.warm], x * w - r, y * h - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
  }

  function frame(now) {
    raf = 0;
    if (!want()) return;
    if (now - lastDraw >= FRAME) {
      lastDraw = now;
      draw(now);
    }
    raf = window.requestAnimationFrame(frame);
  }

  function start() {
    if (raf || !want() || !ctx) return;
    lastDraw = 0;
    raf = window.requestAnimationFrame(frame);
  }

  function stop() {
    if (raf) window.cancelAnimationFrame(raf);
    raf = 0;
    if (ctx && state.w) ctx.clearRect(0, 0, state.w, state.h);
  }

  /* ---------------- DOM ---------------- */

  function build() {
    var el = document.createElement('div');
    el.className = 'wd-ambient';
    el.id = 'wd-ambient';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML =
      '<div class="wd-ambient__wash"></div>' +
      '<div class="wd-ambient__aurora"><i></i><i></i><i></i><i></i></div>' +
      '<div class="wd-ambient__lamp"></div>' +
      '<canvas class="wd-ambient__dust"></canvas>' +
      '<div class="wd-ambient__grain"></div>' +
      '<div class="wd-ambient__vignette"></div>';
    return el;
  }

  function mount() {
    if (mounted) return api;
    if (document.getElementById('wd-ambient')) {
      mounted = true;
      return api;
    }

    root = build();
    /* 必须挂到 body：任何 transform 容器都会把 fixed 子元素变成局部坐标系 */
    document.body.insertBefore(root, document.body.firstChild);

    canvas = root.querySelector('.wd-ambient__dust');
    try {
      ctx = canvas.getContext('2d');
    } catch (e) {
      ctx = null;
    }

    state.mode = readMode();
    state.theme = document.documentElement.getAttribute('data-theme') || 'light';
    document.documentElement.setAttribute('data-ambient-mode', state.mode);
    document.documentElement.setAttribute('data-ambient', 'on');

    mqReduced = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    mqSmall = window.matchMedia ? window.matchMedia('(max-width: 520px)') : null;

    reasons.reduced = !!(mqReduced && mqReduced.matches);
    reasons.small = !!(mqSmall && mqSmall.matches);
    reasons.saveData = !!(navigator.connection && navigator.connection.saveData);

    if (ctx) {
      buildSprites();
      seed();
      measure();
    } else {
      root.classList.add('wd-ambient--no-canvas');
    }

    var media = function (mq, fn) {
      if (!mq) return;
      if (mq.addEventListener) mq.addEventListener('change', fn);
      else if (mq.addListener) mq.addListener(fn);
    };

    media(mqReduced, function (e) {
      reasons.reduced = e.matches;
      resolve();
    });

    media(mqSmall, function (e) {
      reasons.small = e.matches;
      resolve();
    });

    on(document, 'visibilitychange', function () {
      reasons.hidden = document.hidden;
      tick();
    });

    on(window, 'resize', function () {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        resizeTimer = 0;
        measure();
      }, 150);
    });

    on(window, 'orientationchange', function () {
      setTimeout(measure, 250);
    });

    /* 主题切换：shell.js 在 applyTheme() 里派发 */
    on(document, 'wd:themechange', function (e) {
      state.theme = (e && e.detail && e.detail.theme) ||
        document.documentElement.getAttribute('data-theme') || 'light';
      if (!ctx) return;
      buildSprites();
      draw(0);
      tick();
    });

    /* 念真在打字：只观察 DOM，不改旧聊天逻辑 */
    var hint = document.getElementById('input-hint');
    if (hint && window.MutationObserver) {
      var syncTyping = function () {
        var text = hint.textContent || '';
        document.documentElement.classList.toggle('wd-typing', text.indexOf('正在输入') > -1);
      };
      new MutationObserver(syncTyping).observe(hint, {
        childList: true,
        subtree: true,
        characterData: true
      });
      syncTyping();
    }

    mounted = true;
    resolve();
    return api;
  }

  function destroy() {
    stop();
    if (resizeTimer) clearTimeout(resizeTimer);
    for (var i = 0; i < listeners.length; i++) {
      var l = listeners[i];
      l[0].removeEventListener(l[1], l[2], l[3] || false);
    }
    listeners = [];
    if (root && root.parentNode) root.parentNode.removeChild(root);
    root = null;
    canvas = null;
    ctx = null;
    sprites = [];
    parts = [];
    mounted = false;
    document.documentElement.removeAttribute('data-ambient');
    document.documentElement.classList.remove('wd-typing');
  }

  var api = {
    mount: mount,
    destroy: destroy,
    setMode: setMode,
    getMode: getMode,
    suspend: function (reason) {
      reasons[reason || 'drawer'] = true;
      tick();
    },
    resume: function (reason) {
      reasons[reason || 'drawer'] = false;
      tick();
    },
    refresh: function () {
      if (!mounted) return;
      buildSprites();
      measure();
      resolve();
    },
    debug: function () {
      return {
        mounted: mounted,
        mode: state.mode,
        effect: state.effect,
        running: !!raf,
        raf: raf,
        dpr: state.dpr,
        particles: parts.length,
        theme: state.theme,
        themeAtBuild: themeAtBuild,
        lastDrawAt: lastDraw
      };
    }
  };

  window.WDAmbient = api;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
