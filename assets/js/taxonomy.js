/* ==========================================================================
   分类 / 标签 / 档案的本地交互
   --------------------------------------------------------------------------
   - 档案时间线：滚动到视口时逐条浮现
   - 标签：词云 / SVG 关系图双视图
   - 标签关联由 _plugins/tag_graph.rb 在构建时算好，这里只负责展示
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

  /* ---------- 标签：词云 + 关系图 ---------- */
  (function () {
    var dataScript = document.getElementById('wx-tag-graph');
    var cloud = document.getElementById('tags');
    if (!dataScript || !cloud) return;

    var data;
    try {
      data = JSON.parse(dataScript.textContent);
    } catch (error) {
      return;
    }

    if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.edges) || data.nodes.length === 0) {
      return;
    }

    var nodes = data.nodes;
    var edges = data.edges;
    var graphButton = document.getElementById('wx-tag-tab-graph');
    var graphView = document.getElementById('wx-tag-graph-view');
    var graphSvg = document.getElementById('wx-tag-network');
    var graphPanel = document.getElementById('wx-tag-graph-related');
    var graphTip = document.getElementById('wx-tag-graph-tip');
    if (!graphButton || !graphView || !graphSvg) return;

    var graphDefaultText = graphPanel ? graphPanel.textContent.trim() : '';
    var nodeByName = Object.create(null);
    nodes.forEach(function (node) {
      nodeByName[node.name] = node;
    });

    var adjacency = Object.create(null);
    nodes.forEach(function (node) {
      adjacency[node.name] = [];
    });
    edges.forEach(function (edge) {
      if (!nodeByName[edge.source] || !nodeByName[edge.target]) return;
      adjacency[edge.source].push({ name: edge.target, edge: edge });
      adjacency[edge.target].push({ name: edge.source, edge: edge });
    });

    function relatedFor(name, limit) {
      return (adjacency[name] || [])
        .slice()
        .sort(function (a, b) {
          return (
            b.edge.cosine - a.edge.cosine ||
            b.edge.cooccurrence - a.edge.cooccurrence ||
            a.name.localeCompare(b.name, 'zh-CN')
          );
        })
        .slice(0, limit || 5);
    }

    /* ---------- 词云 ---------- */
    var tagElements = Array.prototype.slice.call(cloud.querySelectorAll('.tag[data-tag]'));
    var cloudPanel = document.getElementById('wx-tag-related');
    var cloudDefaultText = cloudPanel ? cloudPanel.textContent.trim() : '';

    function clearCloud() {
      tagElements.forEach(function (tag) {
        tag.classList.remove('is-related', 'is-dimmed');
      });
      if (cloudPanel) cloudPanel.textContent = cloudDefaultText;
    }

    function showCloud(tagElement) {
      var name = tagElement.getAttribute('data-tag');
      var related = relatedFor(name, 5);

      tagElements.forEach(function (tag) {
        var tagName = tag.getAttribute('data-tag');
        var isRelated = related.some(function (item) {
          return item.name === tagName;
        });
        tag.classList.toggle('is-related', isRelated);
        tag.classList.toggle('is-dimmed', tagName !== name && !isRelated);
      });

      if (cloudPanel) {
        cloudPanel.textContent = related.length
          ? '「' + name + '」常和 ' + related.map(function (item) {
              return item.name;
            }).join('、') + ' 一起出现。'
          : '「' + name + '」暂时没有明显关联标签。';
      }
    }

    tagElements.forEach(function (tag) {
      tag.addEventListener('mouseenter', function () {
        showCloud(tag);
      });
      tag.addEventListener('mouseleave', clearCloud);
      tag.addEventListener('focus', function () {
        showCloud(tag);
      });
      tag.addEventListener('blur', clearCloud);
    });

    /* ---------- 视图切换 ---------- */
    var viewButtons = Array.prototype.slice.call(document.querySelectorAll('.wx-tag-view-btn'));
    var viewPanels = Array.prototype.slice.call(document.querySelectorAll('[data-tag-view-panel]'));

    function setView(view, persist) {
      if (view === 'graph' && !graphSvg) {
        view = 'cloud';
      }

      viewButtons.forEach(function (button) {
        var active = button.getAttribute('data-tag-view') === view;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-selected', active ? 'true' : 'false');
        button.tabIndex = active ? 0 : -1;
      });

      viewPanels.forEach(function (panel) {
        panel.hidden = panel.getAttribute('data-tag-view-panel') !== view;
      });

      if (view === 'graph') {
        buildGraph();
      } else {
        clearGraph();
      }

      if (persist !== false) {
        try {
          localStorage.setItem('wx-tag-view', view);
        } catch (error) {
          // localStorage 不可用时静默降级
        }
      }
    }

    viewButtons.forEach(function (button, index) {
      button.addEventListener('click', function () {
        setView(button.getAttribute('data-tag-view'));
      });

      button.addEventListener('keydown', function (event) {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        var direction = event.key === 'ArrowRight' ? 1 : -1;
        var target = viewButtons[(index + direction + viewButtons.length) % viewButtons.length];
        target.focus();
        setView(target.getAttribute('data-tag-view'));
      });
    });

    var storedView = null;
    try {
      storedView = localStorage.getItem('wx-tag-view');
    } catch (error) {
      storedView = null;
    }

    var defaultView =
      storedView === 'graph' || storedView === 'cloud'
        ? storedView
        : window.matchMedia('(min-width: 768px)').matches
          ? 'graph'
          : 'cloud';

    /* ---------- SVG 关系图 ---------- */
    var graphState = null;
    var SVG_NS = 'http://www.w3.org/2000/svg';
    var isCompact = window.matchMedia('(max-width: 767px)').matches;
    var WIDTH = isCompact ? 700 : 1000;
    var HEIGHT = isCompact ? 700 : 560;

    function buildGraph() {
      if (graphState || !graphSvg) return;

      graphSvg.innerHTML = '';
      graphSvg.setAttribute('viewBox', '0 0 ' + WIDTH + ' ' + HEIGHT);

      var graphNodes = nodes.map(function (node, index) {
        var angle = (index / nodes.length) * Math.PI * 2 - Math.PI / 2;
        var radius = 165 + (index % 3) * 15;
        return {
          name: node.name,
          slug: node.slug,
          count: node.count,
          url: node.url,
          x: WIDTH / 2 + Math.cos(angle) * radius,
          y: HEIGHT / 2 + Math.sin(angle) * radius * 0.72,
          vx: 0,
          vy: 0,
          r: (isCompact ? 18 : 10) + Math.sqrt(node.count) * 5
        };
      });

      var graphNodeMap = Object.create(null);
      graphNodes.forEach(function (node) {
        graphNodeMap[node.name] = node;
      });

      var links = edges
        .map(function (edge) {
          return {
            edge: edge,
            source: graphNodeMap[edge.source],
            target: graphNodeMap[edge.target]
          };
        })
        .filter(function (link) {
          return link.source && link.target;
        });

      // 简单力导向：让标签自然散开，同时让有关联的节点靠近。
      for (var step = 0; step < 300; step += 1) {
        for (var i = 0; i < graphNodes.length; i += 1) {
          for (var j = i + 1; j < graphNodes.length; j += 1) {
            var a = graphNodes[i];
            var b = graphNodes[j];
            var dx = b.x - a.x;
            var dy = b.y - a.y;
            var distance = Math.sqrt(dx * dx + dy * dy) || 0.01;
            var minDistance = a.r + b.r + 44;
            if (distance < minDistance) {
              distance = minDistance;
            }
            var force = 2600 / (distance * distance);
            var fx = (dx / distance) * force;
            var fy = (dy / distance) * force;
            a.vx -= fx;
            a.vy -= fy;
            b.vx += fx;
            b.vy += fy;
          }
        }

        links.forEach(function (link) {
          var dx = link.target.x - link.source.x;
          var dy = link.target.y - link.source.y;
          var distance = Math.sqrt(dx * dx + dy * dy) || 1;
          var force = (distance - 110) * 0.003 * (0.45 + link.edge.cosine);
          var fx = (dx / distance) * force;
          var fy = (dy / distance) * force;
          link.source.vx += fx;
          link.source.vy += fy;
          link.target.vx -= fx;
          link.target.vy -= fy;
        });

        graphNodes.forEach(function (node) {
          node.vx += (WIDTH / 2 - node.x) * 0.0015;
          node.vy += (HEIGHT / 2 - node.y) * 0.0015;
          node.x += node.vx * 0.55;
          node.y += node.vy * 0.55;
          node.vx *= 0.78;
          node.vy *= 0.78;
          node.x = Math.max(60, Math.min(WIDTH - 60, node.x));
          node.y = Math.max(48, Math.min(HEIGHT - 54, node.y));
        });
      }

      var linkLayer = document.createElementNS(SVG_NS, 'g');
      linkLayer.setAttribute('class', 'wx-graph-links');
      graphSvg.appendChild(linkLayer);

      var nodeLayer = document.createElementNS(SVG_NS, 'g');
      nodeLayer.setAttribute('class', 'wx-graph-nodes');
      graphSvg.appendChild(nodeLayer);

      var edgeElements = Object.create(null);
      var maxPpmi = 1;
      edges.forEach(function (edge) {
        maxPpmi = Math.max(maxPpmi, Number(edge.ppmi) || 0);
      });

      links.forEach(function (link) {
        var line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('x1', link.source.x.toFixed(2));
        line.setAttribute('y1', link.source.y.toFixed(2));
        line.setAttribute('x2', link.target.x.toFixed(2));
        line.setAttribute('y2', link.target.y.toFixed(2));
        line.setAttribute('class', 'wx-graph-edge');
        line.style.setProperty('--wx-edge-width', (0.6 + link.edge.cosine * 3.2).toFixed(2) + 'px');
        line.style.setProperty(
          '--wx-edge-opacity',
          (0.12 + ((Number(link.edge.ppmi) || 0) / maxPpmi) * 0.38).toFixed(2)
        );
        line.dataset.source = link.edge.source;
        line.dataset.target = link.edge.target;
        linkLayer.appendChild(line);
        edgeElements[[link.edge.source, link.edge.target].sort().join('|')] = line;
      });

      var nodeElements = Object.create(null);
      graphNodes.forEach(function (node) {
        var group = document.createElementNS(SVG_NS, 'a');
        group.setAttribute('href', node.url);
        group.setAttribute('class', 'wx-graph-node');
        group.setAttribute('aria-label', node.name + '，' + node.count + ' 篇文章');
        group.setAttribute('tabindex', '0');
        group.dataset.name = node.name;
        group.dataset.count = String(node.count);

        var circle = document.createElementNS(SVG_NS, 'circle');
        circle.setAttribute('cx', node.x.toFixed(2));
        circle.setAttribute('cy', node.y.toFixed(2));
        circle.setAttribute('r', node.r.toFixed(2));

        var label = document.createElementNS(SVG_NS, 'text');
        label.setAttribute('x', node.x.toFixed(2));
        label.setAttribute(
          'y',
          (node.y > HEIGHT * 0.68 ? node.y - node.r - 8 : node.y + node.r + 15).toFixed(2)
        );
        var labelLimit = isCompact ? 9 : 13;
        label.textContent =
          node.name.length > labelLimit ? node.name.slice(0, labelLimit - 1) + '…' : node.name;

        group.appendChild(circle);
        group.appendChild(label);
        group.addEventListener('mouseenter', function () {
          showGraph(node);
        });
        group.addEventListener('mouseleave', clearGraph);
        group.addEventListener('focus', function () {
          showGraph(node);
        });
        group.addEventListener('blur', clearGraph);
        nodeLayer.appendChild(group);
        nodeElements[node.name] = group;
      });

      graphState = {
        nodes: graphNodes,
        links: links,
        edgeElements: edgeElements,
        nodeElements: nodeElements
      };
    }

    function clearGraph() {
      if (!graphState) return;

      Object.keys(graphState.nodeElements).forEach(function (name) {
        var node = graphState.nodeElements[name];
        node.classList.remove('is-active', 'is-related', 'is-dimmed');
      });

      Object.keys(graphState.edgeElements).forEach(function (key) {
        var edge = graphState.edgeElements[key];
        edge.classList.remove('is-active', 'is-dimmed');
      });

      if (graphPanel) graphPanel.textContent = graphDefaultText;
      if (graphTip) graphTip.hidden = true;
    }

    function showGraph(node) {
      if (!graphState) return;

      var related = relatedFor(node.name, 5);
      var relatedNames = Object.create(null);
      related.forEach(function (item) {
        relatedNames[item.name] = true;
      });

      Object.keys(graphState.nodeElements).forEach(function (name) {
        var element = graphState.nodeElements[name];
        element.classList.toggle('is-active', name === node.name);
        element.classList.toggle('is-related', relatedNames[name] === true);
        element.classList.toggle('is-dimmed', name !== node.name && relatedNames[name] !== true);
      });

      graphState.links.forEach(function (link) {
        var key = [link.edge.source, link.edge.target].sort().join('|');
        var line = graphState.edgeElements[key];
        if (!line) return;
        var active = link.edge.source === node.name || link.edge.target === node.name;
        line.classList.toggle('is-active', active);
        line.classList.toggle('is-dimmed', !active);
      });

      if (graphPanel) {
        graphPanel.textContent = related.length
          ? '「' + node.name + '」' + node.count + ' 篇文章；关联：' +
            related.map(function (item) {
              return item.name + '（余弦 ' + item.edge.cosine.toFixed(2) + '）';
            }).join('、') + '。'
          : '「' + node.name + '」' + node.count + ' 篇文章，暂时没有明显关联标签。';
      }

      if (graphTip) {
        graphTip.textContent = node.name + ' · ' + node.count + ' 篇文章';
        graphTip.style.left = (node.x / WIDTH) * 100 + '%';
        graphTip.style.top = (node.y / HEIGHT) * 100 + '%';
        graphTip.hidden = false;
      }
    }

    /* 默认桌面看关系图，手机先看词云；用户选择会记住。 */
    setView(defaultView, false);
  })();
})();
