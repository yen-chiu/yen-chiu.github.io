/**
 * 小站的「壳」：手机式应用抽屉 + 主题
 * ---------------------------------------------------------------------------
 * 三件事：
 *   1. 在 <head> 里同步解析主题（避免深色模式先白后黑闪一下）
 *   2. 往页面里注入一个「应用」入口 + 抽屉（有标题栏的塞进标题栏，没有的用悬浮按钮）
 *   3. 抽屉里统一管理主题切换、站外链接
 *
 * 设计取舍：不做 hash 路由、不引入框架。每个模块是独立 HTML 页，
 * 抽屉只负责跳转，这样任何一页崩了都不会拖垮别的模块，也方便单独分享链接。
 */

(function () {
  'use strict';

  var THEME_KEY = 'wd.theme';
  var AMBIENT_KEY = 'wd.ambient';
  var AMBIENT_MODES = { auto: 1, still: 1, firefly: 1 };

  /* ---------------- 主题：尽量早执行，且不阻塞渲染 ---------------- */

  var media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function readTheme() {
    try {
      var v = window.localStorage.getItem(THEME_KEY);
      return v === 'light' || v === 'dark' ? v : 'auto';
    } catch (e) {
      return 'auto';
    }
  }

  function resolveTheme(mode) {
    if (mode === 'light' || mode === 'dark') return mode;
    return media && media.matches ? 'dark' : 'light';
  }

  function applyTheme(mode) {
    var resolved = resolveTheme(mode);
    document.documentElement.setAttribute('data-theme', resolved);
    document.documentElement.setAttribute('data-theme-mode', mode);
    try {
      // 背景层只需要知道「现在是深还是浅」，不必自己去读属性
      document.dispatchEvent(new CustomEvent('wd:themechange', { detail: { theme: resolved } }));
    } catch (e) {
      /* 老浏览器没有 CustomEvent 构造器，背景层保持首帧颜色即可 */
    }
  }

  var themeMode = readTheme();
  applyTheme(themeMode);

  /* 氛围模式要在首帧之前落成属性，否则「静」会先闪一下动效 */
  function readAmbientMode() {
    try {
      var v = window.localStorage.getItem(AMBIENT_KEY);
      return AMBIENT_MODES[v] ? v : 'auto';
    } catch (e) {
      return 'auto';
    }
  }

  var ambientMode = readAmbientMode();
  document.documentElement.setAttribute('data-ambient-mode', ambientMode);

  function setAmbientMode(mode) {
    if (!AMBIENT_MODES[mode]) return;
    ambientMode = mode;
    try {
      window.localStorage.setItem(AMBIENT_KEY, mode);
    } catch (e) {
      /* 隐私模式下只在本次会话生效 */
    }
    document.documentElement.setAttribute('data-ambient-mode', mode);
    if (window.WDAmbient) window.WDAmbient.setMode(mode);
    syncThemeButtons();
  }

  function setThemeMode(mode) {
    themeMode = mode;
    try {
      window.localStorage.setItem(THEME_KEY, mode);
    } catch (e) {
      /* 隐私模式下存不进去也没关系，本次会话生效 */
    }
    applyTheme(mode);
    syncThemeButtons();
  }

  if (media) {
    var onSchemeChange = function () {
      if (themeMode === 'auto') applyTheme('auto');
    };
    if (media.addEventListener) media.addEventListener('change', onSchemeChange);
    else if (media.addListener) media.addListener(onSchemeChange);
  }

  /* ---------------- 模块注册表 ---------------- */

  var ICONS = {
    chat:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H9l-4 3.2v-3.2A2.5 2.5 0 0 1 4 13.5z"/><path d="M8.5 8.5h7M8.5 12h4.5"/></svg>',
    game:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 13.5a7.5 7.5 0 0 1 15 0v3.2a2.3 2.3 0 0 1-4.1 1.4l-1-1.3h-3.4l-1 1.3A2.3 2.3 0 0 1 5 16.7z"/><circle cx="9" cy="13" r=".9" fill="currentColor" stroke="none"/><circle cx="12.4" cy="10.4" r=".9" fill="currentColor" stroke="none"/></svg>',
    ai:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l1.7 4.3 4.3 1.7-4.3 1.7L12 15.5l-1.7-4.3L6 9.5l4.3-1.7z"/><path d="M17.5 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/></svg>',
    credits:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H18a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6.5A1.5 1.5 0 0 1 5 19.5z"/><path d="M5 17.5h14M9 7.5h6M9 11h6"/></svg>',
    story:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/><path d="M17.5 3.5v4M15.5 5.5h4"/></svg>',
    stories:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/><path d="M17.5 3.5v4M15.5 5.5h4"/></svg>',
    miko:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H9l-4 3.2v-3.2A2.5 2.5 0 0 1 4 13.5z"/><path d="M12 7.4l.85 2.15L15 10.4l-2.15.85L12 13.4l-.85-2.15L9 10.4l2.15-.85z"/></svg>',
    lifeline:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12.4h3.6l1.9-4.2 2.6 7.9 2.3-5.4 1.7 1.7H21"/><circle cx="12" cy="12" r="9.2" opacity=".45"/></svg>'
  };

  var APPS = [
    {
      id: 'chat',
      name: '与念真聊天',
      href: 'index.html',
      tone: 'teal',
      icon: 'img/apps/nianzhen.webp',
      note: '脚本对话',
      desc: '原来的那个聊天页，她按写好的剧本回你。'
    },
    {
      id: 'ai',
      name: '念真 · AI',
      href: 'ai.html',
      tone: 'amber',
      badge: 'BYOK',
      note: '自带模型',
      desc: '填自己的 API Key，接任何 OpenAI 兼容接口，还带本地工具。'
    },
    {
      id: 'stories',
      name: '三个夜晚',
      href: 'stories.html',
      tone: 'indigo',
      icon: 'img/apps/stories.webp',
      badge: '三季',
      note: '对话故事',
      desc: '三个夜晚，一盏没关的灯。第一夜到第七夜，三季都在里面。'
    },
    {
      id: 'miko',
      name: '异次元通讯',
      href: 'play.html?a=miko',
      tone: 'violet',
      icon: 'img/apps/miko.webp',
      note: '网页版',
      desc: '和 Miko 的跨次元对话，原版与「次元复苏」的剧情都在里面。'
    },
    {
      id: 'lifeline',
      name: '生命线',
      href: 'play.html?a=lifeline',
      tone: 'space',
      icon: 'img/apps/lifeline.webp',
      note: '网页版',
      desc: '坠毁在陌生星球上的泰勒，只能靠一条断断续续的信号和你说话。'
    },
    {
      id: 'game',
      name: '凌晨两点十七分',
      href: 'game.html',
      tone: 'indigo',
      badge: '新',
      note: '对话游戏',
      desc: '一个随手就能玩完的即时通讯式剧情，4 个结局。'
    },
    {
      id: 'credits',
      name: '致谢',
      href: 'credits.html',
      tone: 'slate',
      note: '开源清单',
      desc: '这个小站站着的那些开源项目，以及各自帮了什么忙。'
    }
  ];

  var LINKS = [
    { label: '博客', href: 'https://yenchiu.com/' },
    { label: '源码', href: 'https://github.com/yen-chiu/Chat' },
    { label: '联系', href: 'mailto:yenchiu.he@gmail.com' }
  ];

  function currentAppId() {
    var file = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
    if (!file || file === 'index.html') return 'chat';
    // 内嵌应用页：一个页面装两个游戏，靠 ?a= 区分
    if (file === 'play.html') {
      var m = /[?&]a=([\w-]+)/.exec(window.location.search);
      return m ? m[1] : '';
    }
    // 三季共用一个图标：入口页与三个季页都算「三个夜晚」
    if (file === 'stories.html' || /^story(-s[23])?\.html$/.test(file)) return 'stories';
    return file.replace(/\.html$/, '');
  }

  /* ---------------- 注入入口按钮 + 抽屉 ---------------- */

  var trigger = null;
  var drawer = null;
  var lastFocused = null;

  function buildTrigger() {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'wd-apps-trigger';
    btn.setAttribute('aria-label', '打开应用抽屉');
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/>' +
      '<rect x="13.5" y="3.5" width="7" height="7" rx="2"/>' +
      '<rect x="3.5" y="13.5" width="7" height="7" rx="2"/>' +
      '<rect x="13.5" y="13.5" width="7" height="7" rx="2"/>' +
      '</svg>';

    var head = document.getElementById('mobile-head');
    var slot = document.querySelector('[data-wd-apps-slot]');
    if (slot) {
      // 独立模块页：标题栏里留了位置
      slot.appendChild(btn);
    } else if (head) {
      // 聊天页：塞进原标题栏，排在「重新开始」前面
      var restart = document.getElementById('restart-btn');
      if (restart && restart.parentNode === head) head.insertBefore(btn, restart);
      else head.appendChild(btn);
    } else {
      btn.className = 'wd-floating';
      document.body.appendChild(btn);
    }
    return btn;
  }

  function escapeAttr(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  function buildDrawer() {
    var wrap = document.createElement('div');
    wrap.className = 'wd-drawer';
    wrap.id = 'wd-drawer';
    wrap.setAttribute('aria-hidden', 'true');

    var appItems = APPS.map(function (app) {
      var active = app.id === currentAppId();
      // 有图用图（游戏/念真自己的图标），没图回落到内联字形
      var isImg = !!app.icon;
      var face = isImg
        ? '<img class="wd-tile__img" src="' + app.icon + '" alt="" width="60" height="60" loading="lazy" decoding="async">'
        : (ICONS[app.id] || '');
      return (
        '<li>' +
        '<a class="wd-tile" data-tone="' + app.tone + '"' + (isImg ? ' data-icon="img"' : '') +
        ' href="' + app.href + '"' +
        ' data-app="' + app.id + '" title="' + escapeAttr(app.desc) + '"' +
        (active ? ' aria-current="page"' : '') + '>' +
        '<span class="wd-tile__icon">' + face +
        (app.badge ? '<span class="wd-tile__badge">' + app.badge + '</span>' : '') +
        '</span>' +
        '<span class="wd-tile__name">' + app.name + '</span>' +
        '</a>' +
        '</li>'
      );
    }).join('');

    var links = LINKS.map(function (l) {
      var external = /^https?:/.test(l.href);
      return (
        '<a href="' + l.href + '"' +
        (external ? ' target="_blank" rel="noopener noreferrer"' : '') +
        '>' + l.label + '</a>'
      );
    }).join('');

    wrap.innerHTML =
      '<div class="wd-drawer__backdrop" data-wd-close></div>' +
      '<section class="wd-drawer__sheet" role="dialog" aria-modal="true" aria-labelledby="wd-drawer-title">' +
      '<div class="wd-drawer__grabber" aria-hidden="true"></div>' +
      '<header class="wd-drawer__head">' +
      '<img class="wd-drawer__avatar" src="img/apps/nianzhen.webp" alt="" width="40" height="40" decoding="async">' +
      '<div class="wd-drawer__intro">' +
      '<h2 class="wd-drawer__title" id="wd-drawer-title">念真的小站</h2>' +
      '<p class="wd-drawer__sub">她住在这里 · 纯静态 · 不登录、不上传</p>' +
      '</div>' +
      '<button type="button" class="wd-icon-btn" data-wd-close aria-label="关闭">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
      '</button>' +
      '</header>' +
      '<ul class="wd-app-grid">' + appItems + '</ul>' +
      '<footer class="wd-drawer__foot">' +
      '<div class="wd-drawer__modes">' +
      '<div class="wd-mode">' +
      '<span class="wd-mode__label">配色</span>' +
      '<div class="wd-theme-switch" role="group" aria-label="配色">' +
      '<button type="button" data-theme-mode="auto" aria-pressed="false">自动</button>' +
      '<button type="button" data-theme-mode="light" aria-pressed="false">浅色</button>' +
      '<button type="button" data-theme-mode="dark" aria-pressed="false">深色</button>' +
      '</div>' +
      '</div>' +
      '<div class="wd-mode">' +
      '<span class="wd-mode__label">氛围</span>' +
      '<div class="wd-theme-switch" role="group" aria-label="氛围">' +
      '<button type="button" data-ambient-mode="auto" aria-pressed="false">自动</button>' +
      '<button type="button" data-ambient-mode="still" aria-pressed="false">静</button>' +
      '<button type="button" data-ambient-mode="firefly" aria-pressed="false">萤火</button>' +
      '</div>' +
      '</div>' +
      '</div>' +
      '<div class="wd-drawer__links">' + links + '</div>' +
      '</footer>' +
      '</section>';

    return wrap;
  }

  function syncThemeButtons() {
    if (!drawer) return;
    Array.prototype.forEach.call(
      drawer.querySelectorAll('[data-theme-mode]'),
      function (btn) {
        btn.setAttribute('aria-pressed', String(btn.getAttribute('data-theme-mode') === themeMode));
      }
    );
    Array.prototype.forEach.call(
      drawer.querySelectorAll('[data-ambient-mode]'),
      function (btn) {
        btn.setAttribute('aria-pressed', String(btn.getAttribute('data-ambient-mode') === ambientMode));
      }
    );
  }

  function openDrawer() {
    if (!drawer) return;
    lastFocused = document.activeElement;
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    document.documentElement.style.overflow = 'hidden';
    // 抽屉背后有一层全屏 backdrop-filter，底下再跑动画就是每帧重算整屏模糊
    if (window.WDAmbient) window.WDAmbient.suspend('drawer');
    syncThemeButtons();
    var first = drawer.querySelector('.wd-tile');
    if (first) first.focus({ preventScroll: true });
  }

  function closeDrawer() {
    if (!drawer) return;
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    document.documentElement.style.overflow = '';
    if (window.WDAmbient) window.WDAmbient.resume('drawer');
    if (lastFocused && lastFocused.focus) lastFocused.focus({ preventScroll: true });
  }

  function toggleDrawer() {
    if (!drawer) return;
    if (drawer.classList.contains('is-open')) closeDrawer();
    else openDrawer();
  }

  function init() {
    trigger = buildTrigger();
    drawer = buildDrawer();
    document.body.appendChild(drawer);

    trigger.addEventListener('click', toggleDrawer);
    drawer.addEventListener('click', function (e) {
      if (e.target.closest('[data-wd-close]')) {
        closeDrawer();
        return;
      }
      var themeBtn = e.target.closest('[data-theme-mode]');
      if (themeBtn) {
        setThemeMode(themeBtn.getAttribute('data-theme-mode'));
        return;
      }
      var ambientBtn = e.target.closest('[data-ambient-mode]');
      if (ambientBtn) {
        setAmbientMode(ambientBtn.getAttribute('data-ambient-mode'));
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && drawer.classList.contains('is-open')) {
        e.preventDefault();
        closeDrawer();
        return;
      }
      // 抽屉开着时把 Tab 关在抽屉里
      if (e.key === 'Tab' && drawer.classList.contains('is-open')) {
        var focusables = drawer.querySelectorAll(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (!focusables.length) return;
        var first = focusables[0];
        var last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });

    syncThemeButtons();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.WDShell = {
    apps: APPS,
    open: openDrawer,
    close: closeDrawer,
    toggle: toggleDrawer,
    theme: function (mode) {
      if (mode) setThemeMode(mode);
      return themeMode;
    },
    ambient: function (mode) {
      if (mode) setAmbientMode(mode);
      return ambientMode;
    }
  };
})();
