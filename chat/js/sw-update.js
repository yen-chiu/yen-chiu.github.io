/**
 * 让聊天子站也能自己接上新版 Service Worker
 * ---------------------------------------------------------------------------
 * 博客主站有 pwa/app.js 负责弹「新版本，点我刷新」；聊天页是独立页面，没接这套，
 * 于是新版 SW 会一直停在 waiting，缓存优先的老 SW 继续喂旧 JS——改了界面也看不见。
 *
 * 这里只做一件事：发现有新版本在等，就让它立刻接管；接管后刷新一次。
 * 配合 _config.yml 里 pwa.cache.deny_paths 的 "/chat"，之后聊天页永远走网络。
 */
(function () {
  if (!('serviceWorker' in navigator)) return;

  var reloading = false;

  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });

  navigator.serviceWorker
    .getRegistration()
    .then(function (reg) {
      if (!reg) return;

      function promote(worker) {
        if (worker) worker.postMessage('SKIP_WAITING');
      }

      if (reg.waiting) promote(reg.waiting);

      reg.addEventListener('updatefound', function () {
        var installing = reg.installing;
        if (!installing) return;
        installing.addEventListener('statechange', function () {
          if (installing.state === 'installed' && reg.waiting) promote(reg.waiting);
        });
      });
    })
    .catch(function () {
      /* 拿不到注册信息就安静地算了 */
    });
})();
