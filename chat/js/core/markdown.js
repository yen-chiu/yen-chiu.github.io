/**
 * 一个够用就好的 Markdown 渲染器
 * ---------------------------------------------------------------------------
 * 为什么不用 marked / markdown-it：这个站没有构建步骤，也不想为了几十行需求
 * 多塞一个几十 KB 的库，更不想引 CDN。安全策略是「先转义、再排版」：
 * 结构（标题/列表/代码块）在原始文本上识别，进入正文的每一段文本都先 escape，
 * 所以模型输出里的 HTML 一律变成字面量，不存在 XSS 面。
 *
 * 支持：标题、段落、粗体/斜体/删除线、行内代码、代码块（带复制）、有序/无序
 *      列表、引用、分割线、链接、裸链接。表格和图片故意不支持——聊天里很少用，
 *      远程图片还会带来隐私问题。
 */

(function (global) {
  'use strict';

  function escapeHTML(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function safeUrl(url) {
    var u = String(url || '').trim();
    if (/^https?:\/\//i.test(u) || /^mailto:/i.test(u)) return u;
    return '';
  }

  function renderInline(raw) {
    var text = escapeHTML(raw == null ? '' : raw);

    var codes = [];
    text = text.replace(/`([^`\n]+)`/g, function (_, code) {
      codes.push('<code class="wd-inline-code">' + code + '</code>');
      return '\u0000' + (codes.length - 1) + '\u0000';
    });

    text = text.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, function (whole, label, url) {
      var href = safeUrl(url);
      if (!href) return label;
      return '<a href="' + href + '" target="_blank" rel="noopener noreferrer">' + label + '</a>';
    });

    text = text.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, function (whole, prefix, url) {
      var clean = url.replace(/[.,;:!?。，、）]+$/, '');
      var tail = url.slice(clean.length);
      return (
        prefix + '<a href="' + clean + '" target="_blank" rel="noopener noreferrer">' + clean + '</a>' + tail
      );
    });

    text = text
      .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
      .replace(/~~([^~\n]+)~~/g, '<del>$1</del>');

    return text.replace(/\u0000(\d+)\u0000/g, function (_, index) {
      return codes[Number(index)] || '';
    });
  }

  function isBlockStart(line) {
    return (
      /^```/.test(line) ||
      /^#{1,6}\s+/.test(line) ||
      /^\s*([-*+]|\d+[.)])\s+/.test(line) ||
      /^>\s?/.test(line) ||
      /^---+$/.test(line)
    );
  }

  function render(source) {
    if (!source) return '';
    var lines = String(source).replace(/\r\n?/g, '\n').split('\n');
    var out = [];
    var i = 0;

    while (i < lines.length) {
      var line = lines[i];

      // 代码块
      var fence = /^```\s*([\w+-]*)\s*$/.exec(line);
      if (fence) {
        var lang = fence[1] || '';
        var code = [];
        i++;
        while (i < lines.length && !/^```\s*$/.test(lines[i])) {
          code.push(lines[i]);
          i++;
        }
        i++; // 跳过收尾的 ```
        out.push(
          '<div class="wd-code-block">' +
            '<div class="wd-code-block__bar"><span>' + (lang || 'code') + '</span>' +
            '<button type="button" class="wd-code-copy" data-copy>复制</button></div>' +
            '<pre><code' + (lang ? ' class="language-' + lang + '"' : '') + '>' +
            escapeHTML(code.join('\n')) +
            '</code></pre></div>'
        );
        continue;
      }

      if (/^\s*$/.test(line)) {
        i++;
        continue;
      }

      if (/^---+$/.test(line)) {
        out.push('<hr>');
        i++;
        continue;
      }

      var heading = /^(#{1,6})\s+(.*)$/.exec(line);
      if (heading) {
        var level = Math.min(heading[1].length + 2, 6); // 聊天里 markdown 的 h1 太大
        out.push('<h' + level + '>' + renderInline(heading[2]) + '</h' + level + '>');
        i++;
        continue;
      }

      if (/^>\s?/.test(line)) {
        var quote = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) {
          quote.push(renderInline(lines[i].replace(/^>\s?/, '')));
          i++;
        }
        out.push('<blockquote>' + quote.join('<br>') + '</blockquote>');
        continue;
      }

      if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) {
        var ordered = /^\s*\d+[.)]\s+/.test(line);
        var items = [];
        while (i < lines.length && /^\s*([-*+]|\d+[.)])\s+/.test(lines[i])) {
          items.push('<li>' + renderInline(lines[i].replace(/^\s*([-*+]|\d+[.)])\s+/, '')) + '</li>');
          i++;
        }
        out.push(
          '<' + (ordered ? 'ol' : 'ul') + ' class="wd-md-list">' +
            items.join('') +
            '</' + (ordered ? 'ol' : 'ul') + '>'
        );
        continue;
      }

      // 段落：吃到空行或下一个块级元素为止
      var para = [line];
      i++;
      while (i < lines.length && !/^\s*$/.test(lines[i]) && !isBlockStart(lines[i])) {
        para.push(lines[i]);
        i++;
      }
      out.push('<p>' + renderInline(para.join('\n')).replace(/\n/g, '<br>') + '</p>');
    }

    return out.join('');
  }

  global.WDMarkdown = {
    render: render,
    inline: renderInline,
    escape: escapeHTML
  };
})(window);
