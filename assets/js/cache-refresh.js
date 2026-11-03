/**
 * 手动刷新站点缓存
 * ---------------------------------------------------------------------------
 * 手机浏览器/PWA 经常把旧的 CSS、JS、甚至整页 HTML 缓存住，改完内容看不到，
 * 只能去「设置 → 网站数据 → 删除」。
 *
 * 这个脚本提供三种入口，做同一件事：
 *   1. 页脚「刷新缓存」按钮
 *   2. 直接访问 /refresh/
 *   3. 任意页面加 ?refresh=1
 *
 * 做的事情：
 *   - 删除所有 CacheStorage（Service Worker 的缓存）
 *   - 注销所有 Service Worker（避免它继续接管请求）
 *   - 用带时间戳的地址重新加载首页，绕过 HTTP 缓存里的 HTML
 *
 * 不碰 localStorage / sessionStorage —— 写作台的登录态不会被清掉。
 */
(function () {
  'use strict';

  var REDIRECT = '/';

  function clearCaches() {
    if (!('caches' in window)) return Promise.resolve(0);
    return caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys.map(function (key) {
            return caches.delete(key);
          })
        ).then(function () {
          return keys.length;
        });
      })
      .catch(function () {
        return 0;
      });
  }

  /**
   * CacheStorage 只是缓存的一层：浏览器的 HTTP 缓存（max-age）不在里面。
   * 这里用 cache: 'reload' 把当前页面的 CSS/JS 重新拉一遍，
   * 等于把这一层也顶掉，否则「刷新」之后样式可能还是旧的。
   */
  function primeAssets() {
    if (typeof fetch !== 'function') return Promise.resolve(0);
    var urls = [];
    document
      .querySelectorAll('link[rel="stylesheet"][href], script[src]')
      .forEach(function (el) {
        var url = el.href || el.src;
        if (!url) return;
        try {
          if (new URL(url).origin !== location.origin) return;
        } catch (e) {
          return;
        }
        urls.push(url);
      });
    urls = urls.filter(function (u) {
      return u.indexOf(location.origin) === 0;
    });
    return Promise.all(
      urls.map(function (url) {
        return fetch(url, { cache: 'reload' }).catch(function () {
          return null;
        });
      })
    ).then(function () {
      return urls.length;
    });
  }

  function unregisterWorkers() {
    if (!('serviceWorker' in navigator)) return Promise.resolve(0);
    return navigator.serviceWorker
      .getRegistrations()
      .then(function (regs) {
        return Promise.all(
          regs.map(function (reg) {
            return reg.unregister();
          })
        ).then(function () {
          return regs.length;
        });
      })
      .catch(function () {
        return 0;
      });
  }

  /** 清缓存 + 注销 SW；reload=false 时只清理不跳转 */
  function refresh(options) {
    options = options || {};
    var button = document.getElementById('wx-cache-refresh');
    if (button) {
      button.disabled = true;
      button.textContent = '刷新中…';
    }

    return Promise.all([clearCaches(), unregisterWorkers(), primeAssets()]).then(function (result) {
      var cleared = result[0];
      var workers = result[1];
      try {
        sessionStorage.setItem('wx-cache-cleared-at', String(Date.now()));
      } catch (e) {
        /* 隐私模式下忽略 */
      }

      if (options.onDone) options.onDone(cleared, workers);
      if (options.reload === false) return result;

      // 带上时间戳，确保拿到的是新的 HTML 而不是浏览器缓存
      var target = options.target || REDIRECT;
      var url = new URL(target, location.origin);
      url.searchParams.set('v', String(Date.now()));
      location.replace(url.toString());
      return result;
    });
  }

  window.wxRefreshCache = refresh;

  document.addEventListener('DOMContentLoaded', function () {
    var button = document.getElementById('wx-cache-refresh');
    if (button) {
      button.addEventListener('click', function (e) {
        e.preventDefault();
        refresh();
      });
    }

    // 地址栏加了 ?refresh=1 → 自动清一次，然后把参数抹掉（避免循环）
    var params = new URLSearchParams(location.search);
    if (params.get('refresh') === '1') {
      refresh({ reload: !params.get('stay') });
    }

    // 刷新跳转回来后，把 ?v= 抹掉，地址栏保持干净
    if (params.get('v')) {
      params.delete('v');
      var qs = params.toString();
      history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
    }
  });
})();
