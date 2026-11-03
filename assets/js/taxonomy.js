/* ==========================================================================
   分类 / 标签 / 档案的本地交互
   --------------------------------------------------------------------------
   - 档案时间线：滚动到视口时逐条浮现
   - 标签云：根据站内文章的共同标签计算关联，悬停 / 聚焦时高亮
   全部在浏览器本地完成，不请求任何外部服务，也不依赖 AI。
   ========================================================================== */

(function () {
  'use strict';

  /* ---------- 档案时间线：滚动入场 ---------- */
  (function () {
    var items = document.querySelectorAll('[data-wx-reveal]');
    if (items.length === 0) return;

    window.__wxTaxonomyReady = true;

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function revealAll() {
      items.forEach(function (item) {
        item.classList.add('is-in');
      });
      document.documentElement.classList.remove('wx-reveal-ready');
    }

    if (reduceMotion || !('IntersectionObserver' in window)) {
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

    items.forEach(function (item) {
      observer.observe(item);
    });
  })();

  /* ---------- 标签云：共同标签关联 ---------- */
  (function () {
    var graphScript = document.getElementById('wx-tag-graph');
    var cloud = document.getElementById('tags');
    if (!graphScript || !cloud) return;

    var graph;
    try {
      graph = JSON.parse(graphScript.textContent);
    } catch (error) {
      return;
    }

    if (!Array.isArray(graph)) return;

    var relation = {};

    graph.forEach(function (tags) {
      if (!Array.isArray(tags) || tags.length < 2) return;

      for (var i = 0; i < tags.length; i += 1) {
        for (var j = i + 1; j < tags.length; j += 1) {
          var a = tags[i];
          var b = tags[j];
          if (!a || !b || a === b) continue;

          relation[a] = relation[a] || {};
          relation[b] = relation[b] || {};
          relation[a][b] = (relation[a][b] || 0) + 1;
          relation[b][a] = (relation[b][a] || 0) + 1;
        }
      }
    });

    var tags = Array.prototype.slice.call(cloud.querySelectorAll('.tag[data-tag]'));
    if (tags.length === 0) return;

    var panel = document.getElementById('wx-tag-related');
    var defaultText = panel ? panel.textContent.trim() : '';

    function clear() {
      tags.forEach(function (tag) {
        tag.classList.remove('is-related', 'is-dimmed');
      });
      if (panel) panel.textContent = defaultText;
    }

    function show(tagElement) {
      var name = tagElement.getAttribute('data-tag');
      var linked = relation[name] || {};
      var related = Object.keys(linked)
        .sort(function (a, b) {
          return linked[b] - linked[a] || a.localeCompare(b, 'zh-CN');
        })
        .slice(0, 5);

      tags.forEach(function (tag) {
        var tagName = tag.getAttribute('data-tag');
        var isRelated = related.indexOf(tagName) !== -1;
        tag.classList.toggle('is-related', isRelated);
        tag.classList.toggle('is-dimmed', tagName !== name && !isRelated);
      });

      if (panel) {
        panel.textContent = related.length
          ? '「' + name + '」常和 ' + related.join('、') + ' 一起出现。'
          : '「' + name + '」暂时没有明显关联标签。';
      }
    }

    tags.forEach(function (tag) {
      tag.addEventListener('mouseenter', function () {
        show(tag);
      });
      tag.addEventListener('mouseleave', clear);
      tag.addEventListener('focus', function () {
        show(tag);
      });
      tag.addEventListener('blur', clear);
    });
  })();
})();
