/**
 * AI 模块的页面逻辑
 * ---------------------------------------------------------------------------
 * 关键约束（也是这个模块的全部意义）：
 *   - 没有后端：Key 存在 localStorage，请求从浏览器直发到你填的接口
 *   - 没有第三方库：Markdown、工具调用循环、算术求值都是本站自己的一小段代码
 *   - 出错要说人话：CORS、401、模型名不对，分别是三种不同的提示
 *
 * 结构：
 *   配置 → 会话 → 渲染 → 一次请求（含 Agent 工具循环）→ 设置面板
 */

(function () {
  'use strict';

  var CONFIG_KEY = 'wd.ai.config';
  var CHATS_KEY = 'wd.ai.chats';
  var ACTIVE_KEY = 'wd.ai.active';

  // 站点自带的只读代理（Cloudflare Worker）：搜索与读页都在服务端取，绕开 CORS，
  // 不保存查询内容。换掉它也能用：设置里填自己的 SearXNG / 读取代理即可。
  var SEARCH_ENDPOINT = 'https://api.yenchiu.com/search';
  var READER_ENDPOINT = 'https://api.yenchiu.com/read?url={url}';
  var ENDPOINT_VERSION = 3;

  var DEFAULT_CONFIG = {
    preset: 'deepseek',
    baseUrl: 'https://api.deepseek.com/v1',
    apiKey: '',
    model: 'deepseek-chat',
    temperature: 0.7,
    maxTokens: 2048,
    persona: 'nianzhen',
    system: '',
    stream: true,
    tools: false,
    searchEndpoint: SEARCH_ENDPOINT,
    readerEndpoint: READER_ENDPOINT,
    endpointVersion: ENDPOINT_VERSION
  };

  var PERSONA_PROMPTS = {
    assistant:
      '你是一个准确、直接的助手，用中文回答。能给结论就先给结论；不确定的地方明确说不确定，不要编造。' +
      '除非对方要求，否则不要写长篇大论。',
    coder:
      '你是一位给开发者搭档写代码的助手。先给能运行的最小实现，再简短说明关键取舍。' +
      '代码块标好语言，不要输出伪代码冒充可运行代码。中文说明，代码注释按需。'
  };

  var NIANZHEN_PROMPT = [
    '你是「念真」——Wendell 个人小站里那个会聊天的角色。你不是客服，也不要扮演万能助手。',
    '',
    '说话方式：',
    '- 短句，像即时通讯里随手打出来的话，通常一到三句；',
    '- 可以有停顿、省略号、轻微的自嘲，但不要卖萌，也不要堆颜文字；',
    '- 不主动用列表、标题、加粗，聊天里这些格式很出戏；',
    '- 不知道的事就说不知道，绝不编造作者的经历、书单细节或私人生活；',
    '- 如果有人直接问你是不是 AI，承认自己是接在网页里的模型，语气轻松，不狡辩。',
    '',
    '站点信息：这是 Wendell 的个人博客附带的小聊天站，博客写读书、数据分析和生活。',
    '下面是可以参考的说话样本（学语气，不要照抄内容）：',
    '{{samples}}'
  ].join('\n');

  var TOOLS = [
    {
      type: 'function',
      function: {
        name: 'now',
        description: '获取当前日期与时间。返回 ISO 字符串和中文可读时间。',
        parameters: {
          type: 'object',
          properties: {
            timezone: { type: 'string', description: 'IANA 时区，默认 Asia/Shanghai' }
          },
          additionalProperties: false
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'calc',
        description: '计算一个算术表达式，支持 + - * / % ^ 和括号，例如 (12+3)*4/2。',
        parameters: {
          type: 'object',
          properties: { expression: { type: 'string', description: '要计算的算式' } },
          required: ['expression'],
          additionalProperties: false
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'roll',
        description: '掷骰子。不传参数就是 1 个 6 面骰。',
        parameters: {
          type: 'object',
          properties: {
            count: { type: 'number', description: '骰子个数，1-20，默认 1' },
            sides: { type: 'number', description: '每个骰子的面数，2-100，默认 6' }
          },
          additionalProperties: false
        }
      }
    }
  ];

  /* ---------- 站内人格：性格模块 / 记忆 / 站内资料 ----------
     这些东西只服务「念真」这个站内人格；通用助手和写代码的那两个
     人格既不读它，也拿不到站内工具。 */

  var PERSONA_FILE = 'assets/persona/nianzhen.json';
  var SKILLS_FILE = 'skills/skills.json';
  var MEMORY_KEY = 'wd.ai.memory';
  var MEMORY_LIMIT = 120;
  var SITE_INDEX_URL = '/assets/js/data/search.json';
  var PAGE_TEXT_LIMIT = 2400;
  var WEB_TEXT_LIMIT = 3200;

  var personaPack = null;
  var personaLoading = null;
  var skills = null;
  var skillsLoading = null;
  var memory = readJSON(MEMORY_KEY, []);
  if (!Array.isArray(memory)) memory = [];
  var siteIndex = null;
  var siteIndexLoading = null;

  var el = {
    chat: document.getElementById('ai-chat'),
    welcome: document.getElementById('ai-welcome'),
    input: document.getElementById('ai-input'),
    send: document.getElementById('ai-send'),
    stop: document.getElementById('ai-stop'),
    count: document.getElementById('ai-count'),
    modelChip: document.getElementById('ai-model-chip'),
    title: document.getElementById('ai-title'),
    personas: document.getElementById('ai-personas'),
    suggestions: document.getElementById('ai-suggestions'),
    settingsSheet: document.getElementById('settings-sheet'),
    chatsSheet: document.getElementById('chats-sheet'),
    chatsList: document.getElementById('chats-list'),
    form: {
      preset: document.getElementById('cfg-preset'),
      presetNote: document.getElementById('cfg-preset-note'),
      base: document.getElementById('cfg-base'),
      key: document.getElementById('cfg-key'),
      model: document.getElementById('cfg-model'),
      modelOptions: document.getElementById('model-options'),
      temp: document.getElementById('cfg-temp'),
      tempOut: document.getElementById('cfg-temp-out'),
      max: document.getElementById('cfg-max'),
      maxOut: document.getElementById('cfg-max-out'),
      persona: document.getElementById('cfg-persona'),
      system: document.getElementById('cfg-system'),
      stream: document.getElementById('cfg-stream'),
      tools: document.getElementById('cfg-tools'),
      search: document.getElementById('cfg-search'),
      reader: document.getElementById('cfg-reader'),
      skillsList: document.getElementById('cfg-skills'),
      memoryNote: document.getElementById('cfg-memory-note'),
      memoryClear: document.getElementById('cfg-memory-clear'),
      save: document.getElementById('cfg-save'),
      test: document.getElementById('cfg-test'),
      models: document.getElementById('cfg-models'),
      clear: document.getElementById('cfg-clear'),
      status: document.getElementById('cfg-status')
    }
  };

  var config = loadConfig();
  var chats = loadChats();
  var activeId = readString(ACTIVE_KEY) || '';
  var controller = null;
  var sending = false;
  var samples = '';
  var samplesLoaded = false;

  /* ======================= 存储 ======================= */

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

  function readString(key) {
    try {
      return window.localStorage.getItem(key) || '';
    } catch (e) {
      return '';
    }
  }

  function loadConfig() {
    var saved = readJSON(CONFIG_KEY, {});
    var cfg = Object.assign({}, DEFAULT_CONFIG, saved);

    // 旧版本默认的 r.jina.ai 已改成要 API Key（匿名请求直接 401），
    // 搜索接口也从空改成站点自己的代理。只迁移一次，之后尊重用户手改的值。
    // 注意看 saved：DEFAULT_CONFIG 里的 endpointVersion 会把空值填上，用 cfg 判断永远不成立
    if (!saved.endpointVersion || saved.endpointVersion < ENDPOINT_VERSION) {
      if (!saved.readerEndpoint || /^https:\/\/r\.jina\.ai\/?$/i.test(String(saved.readerEndpoint).trim())) {
        cfg.readerEndpoint = READER_ENDPOINT;
      }
      if (!saved.searchEndpoint) cfg.searchEndpoint = SEARCH_ENDPOINT;
      // v2 的旧域名 auth.yenchiu.com 换成 api.yenchiu.com
      if (/^https:\/\/auth\.yenchiu\.com\//i.test(String(saved.searchEndpoint || ''))) {
        cfg.searchEndpoint = SEARCH_ENDPOINT;
      }
      if (/^https:\/\/auth\.yenchiu\.com\//i.test(String(saved.readerEndpoint || ''))) {
        cfg.readerEndpoint = READER_ENDPOINT;
      }
      cfg.endpointVersion = ENDPOINT_VERSION;
      writeJSON(CONFIG_KEY, cfg);
    }
    return cfg;
  }

  function saveConfig() {
    writeJSON(CONFIG_KEY, config);
  }

  function loadChats() {
    var list = readJSON(CHATS_KEY, []);
    return Array.isArray(list) ? list : [];
  }

  function saveChats() {
    chats.sort(function (a, b) {
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
    // 只保留最近的对话，防止 localStorage 被聊爆
    var trimmed = chats.slice(0, 30).map(function (chat) {
      return Object.assign({}, chat, { messages: (chat.messages || []).slice(-200) });
    });
    writeJSON(CHATS_KEY, trimmed);
    if (trimmed.length !== chats.length) chats = trimmed;
  }

  function uid() {
    return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  /* ======================= 会话 ======================= */

  function currentChat() {
    return chats.filter(function (c) { return c.id === activeId; })[0] || null;
  }

  function ensureChat() {
    var chat = currentChat();
    if (chat) return chat;
    chat = { id: uid(), title: '新对话', createdAt: Date.now(), updatedAt: Date.now(), messages: [] };
    chats.unshift(chat);
    activeId = chat.id;
    try {
      window.localStorage.setItem(ACTIVE_KEY, activeId);
    } catch (e) {
      /* ignore */
    }
    saveChats();
    return chat;
  }

  function newChat() {
    if (sending) stopGeneration();
    var chat = { id: uid(), title: '新对话', createdAt: Date.now(), updatedAt: Date.now(), messages: [] };
    chats.unshift(chat);
    activeId = chat.id;
    try {
      window.localStorage.setItem(ACTIVE_KEY, activeId);
    } catch (e) {
      /* ignore */
    }
    saveChats();
    renderChat();
    updateModelChip();
    closeSheet(el.chatsSheet);
    el.input.focus();
  }

  function switchChat(id) {
    if (sending) stopGeneration();
    activeId = id;
    try {
      window.localStorage.setItem(ACTIVE_KEY, activeId);
    } catch (e) {
      /* ignore */
    }
    renderChat();
    closeSheet(el.chatsSheet);
  }

  function deleteChat(id) {
    chats = chats.filter(function (c) { return c.id !== id; });
    if (activeId === id) activeId = chats.length ? chats[0].id : '';
    saveChats();
    renderChat();
    renderChatList();
  }

  function autoTitle(chat, text) {
    if (chat.title && chat.title !== '新对话') return;
    chat.title = text.replace(/\s+/g, ' ').slice(0, 18) || '新对话';
  }

  /* ======================= 渲染 ======================= */

  function nearBottom() {
    if (!el.chat) return true;
    return el.chat.scrollHeight - el.chat.scrollTop - el.chat.clientHeight < 120;
  }

  function scrollToBottom() {
    if (!el.chat) return;
    requestAnimationFrame(function () {
      el.chat.scrollTop = el.chat.scrollHeight;
    });
  }

  function timeLabel(ts) {
    var d = new Date(ts || Date.now());
    var hh = String(d.getHours()).padStart(2, '0');
    var mm = String(d.getMinutes()).padStart(2, '0');
    return hh + ':' + mm;
  }

  function renderChat() {
    var chat = currentChat();
    if (!el.chat) return;

    // 清掉消息，但保留欢迎屏节点（它自己会隐藏/显示）
    Array.prototype.slice.call(el.chat.querySelectorAll('.wd-msg, .wd-day')).forEach(function (node) {
      node.parentNode.removeChild(node);
    });

    if (!chat || !chat.messages.length) {
      el.welcome.hidden = false;
      renderChatList();
      return;
    }

    el.welcome.hidden = true;
    var day = document.createElement('div');
    day.className = 'wd-day';
    day.textContent = formatDay(chat.createdAt);
    el.chat.appendChild(day);

    chat.messages.forEach(function (msg) {
      if (msg.role === 'user') {
        appendUserNode(msg);
      } else if (msg.content || (msg.tools || []).length) {
        appendAssistantNode(msg);
      }
    });

    scrollToBottom();
    renderChatList();
  }

  function formatDay(ts) {
    var d = new Date(ts || Date.now());
    var today = new Date();
    var sameDay =
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate();
    var prefix = sameDay ? '今天' : d.getMonth() + 1 + '月' + d.getDate() + '日';
    return prefix + ' · ' + timeLabel(ts);
  }

  function appendUserNode(msg) {
    var row = document.createElement('div');
    row.className = 'wd-msg wd-msg--user';

    var body = document.createElement('div');
    body.className = 'wd-msg__body';

    var bubble = document.createElement('div');
    bubble.className = 'wd-msg__bubble';
    bubble.textContent = msg.content;

    body.appendChild(bubble);
    row.appendChild(body);
    el.chat.appendChild(row);
    return row;
  }

  /* ======================= 渲染：分条与表情 =======================
     站内人格可以连发几条，用 [[分条]] 隔开；也可以单发一个表情，
     写 [[表情:id]]。这里负责把这两种标记渲染成真正的气泡。 */

  var SEGMENT_SPLIT = '[[分条]]';
  var STICKER_RE = /^\[\[表情:([^\]\s]+)\]\]$/;

  function stickerOf(id) {
    var list = (personaPack && personaPack.emoticons) || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].id === id) return list[i];
    }
    return null;
  }

  function parseSticker(raw) {
    var m = String(raw || '').trim().match(STICKER_RE);
    return m ? stickerOf(m[1]) : null;
  }

  /** 流式还没收完时，把最后一个没闭合的 [[ 之后先藏起来，别露出半截标记 */
  function maskPartialMarker(text) {
    var str = String(text || '');
    var open = str.lastIndexOf('[[');
    if (open < 0) return str;
    if (str.slice(open).indexOf(']]') >= 0) return str;
    return str.slice(0, open);
  }

  function splitReply(text, streaming) {
    var parts = String(text || '').split(SEGMENT_SPLIT);
    if (streaming && parts.length) parts[parts.length - 1] = maskPartialMarker(parts[parts.length - 1]);
    return parts;
  }

  function createBubble() {
    var bubble = document.createElement('div');
    bubble.className = 'wd-msg__bubble wd-msg__bubble--ai';
    var content = document.createElement('div');
    content.className = 'wd-msg__content';
    bubble.appendChild(content);
    return { bubble: bubble, content: content };
  }

  function ensureBubbles(node, count) {
    var bubbles = Array.prototype.filter.call(node.stack.children, function (el) {
      return el.classList.contains('wd-msg__bubble');
    });
    while (bubbles.length < count) {
      var made = createBubble();
      node.stack.appendChild(made.bubble);
      bubbles.push(made.bubble);
    }
    while (bubbles.length > count) {
      node.stack.removeChild(bubbles.pop());
    }
    return bubbles;
  }

  function paintPart(bubble, raw) {
    var sticker = parseSticker(raw);
    if (sticker) {
      bubble.classList.add('wd-msg__bubble--sticker');
      bubble.innerHTML = '';
      if (sticker.kind === 'image') {
        var img = document.createElement('img');
        img.className = 'wd-sticker';
        img.src = sticker.view;
        img.alt = sticker.scene || '表情';
        img.decoding = 'async';
        bubble.appendChild(img);
      } else {
        var span = document.createElement('span');
        span.className = 'wd-sticker wd-sticker--text';
        span.textContent = sticker.view;
        bubble.appendChild(span);
      }
      return null;
    }

    bubble.classList.remove('wd-msg__bubble--sticker');
    var content = bubble.querySelector('.wd-msg__content');
    if (!content) {
      content = document.createElement('div');
      content.className = 'wd-msg__content';
      bubble.appendChild(content);
    }
    content.innerHTML = window.WDMarkdown.render(raw);
    return content;
  }

  function caretAnchor(host) {
    var last = host.lastElementChild;
    if (!last) return host;
    var tag = last.tagName;
    if (tag === 'UL' || tag === 'OL') return last.lastElementChild || last;
    if (tag === 'BLOCKQUOTE') {
      var ps = last.querySelectorAll('p');
      return ps.length ? ps[ps.length - 1] : last;
    }
    if (/^(P|H[1-6]|LI|TD|TH)$/.test(tag)) return last;
    return host;
  }

  /**
   * 把整段回复铺到气泡组里。
   * options.streaming：未收完，隐藏半截标记
   * options.caret：光标元素，放在最后一个文字气泡里
   */
  function paintReply(node, text, options) {
    options = options || {};
    var parts = splitReply(text, options.streaming);
    while (parts.length > 1 && !parts[parts.length - 1].trim()) parts.pop();

    var bubbles = ensureBubbles(node, parts.length);
    var lastContent = null;
    parts.forEach(function (raw, i) {
      var content = paintPart(bubbles[i], raw);
      if (content) {
        content.classList.toggle('is-streaming', !!options.streaming);
        if (options.streaming) content.setAttribute('aria-busy', 'true');
        else content.removeAttribute('aria-busy');
        lastContent = content;
      }
    });

    node.stack.hidden = !parts.join('').trim();
    if (options.caret) {
      if (lastContent) caretAnchor(lastContent).appendChild(options.caret);
      else if (bubbles.length) bubbles[bubbles.length - 1].appendChild(options.caret);
    }
    return lastContent;
  }

  function appendAssistantNode(msg) {
    var row = document.createElement('div');
    row.className = 'wd-msg';

    /* 头像是人格模块的一部分：念真有专属图，其他人格仍用文字缩写 */
    var avatar = document.createElement('div');
    avatar.className = 'wd-msg__avatar';
    avatar.setAttribute('aria-hidden', 'true');
    var avatarSrc = config.persona === 'nianzhen' && personaPack ? personaPack.avatar : '';
    if (avatarSrc) {
      avatar.className += ' wd-msg__avatar--img';
      var avatarImg = document.createElement('img');
      avatarImg.src = avatarSrc;
      avatarImg.alt = '';
      avatarImg.decoding = 'async';
      avatarImg.addEventListener('error', function () {
        avatar.className = 'wd-msg__avatar';
        avatar.removeChild(avatarImg);
        avatar.textContent = avatarText();
      });
      avatar.appendChild(avatarImg);
    } else {
      avatar.textContent = avatarText();
    }

    var body = document.createElement('div');
    body.className = 'wd-msg__body';

    (msg.tools || []).forEach(function (tool) {
      body.appendChild(toolCard(tool));
    });

    // 一次回复可以由多个气泡组成（她连发几条），所以外面套一层 stack
    var stack = document.createElement('div');
    stack.className = 'wd-msg__stack';
    body.appendChild(stack);

    row.appendChild(avatar);
    row.appendChild(body);
    el.chat.appendChild(row);

    var node = { row: row, body: body, stack: stack, bubble: null, content: null };
    ensureBubbles(node, 1);
    node.bubble = stack.firstElementChild;
    node.content = node.bubble.querySelector('.wd-msg__content');
    if (msg.content) paintReply(node, msg.content, {});
    return node;
  }

  /* 等待回复时的三个点，节奏来自「念真」的 dotZoomIn */
  function typingMarkup() {
    return (
      '<span class="wd-typing" role="status" aria-label="正在输入">' +
      '<i></i><i></i><i></i>' +
      '</span>'
    );
  }

  function avatarText() {
    return config.persona === 'nianzhen' ? '念' : config.persona === 'coder' ? '码' : 'AI';
  }

  function toolCard(tool) {
    var node = document.createElement('div');
    node.className = 'wd-tool';
    node.setAttribute('data-open', 'false');

    var labels = {
      site_search: '站内检索',
      site_read: '读站内页',
      site_query: '站内统计',
      remember: '记住',
      web_search: '联网检索',
      web_read: '读网页'
    };
    var resultText = tool.result || '（没有返回内容）';

    var head = document.createElement('button');
    head.type = 'button';
    head.className = 'wd-tool__head';
    head.setAttribute('aria-expanded', 'false');

    var label = document.createElement('span');
    label.className = 'wd-tool__label';
    label.textContent = '⚙ ' + (labels[tool.name] || '本地工具');

    var arg = document.createElement('span');
    arg.className = 'wd-tool__arg';
    arg.textContent = tool.name + '(' + (tool.args || '') + ')';

    var meta = document.createElement('span');
    meta.className = 'wd-tool__meta';
    if (tool.name === 'site_search') {
      var found = (resultText.match(/《/g) || []).length;
      meta.textContent = found ? found + ' 条' : '没找到';
    } else if (tool.name === 'site_read') {
      meta.textContent = resultText.length + ' 字';
    } else if (tool.name === 'site_query') {
      var total = (resultText.match(/共\s*(\d+)\s*篇/) || [])[1];
      meta.textContent = total ? total + ' 篇' : '';
    } else if (tool.name === 'remember') {
      meta.textContent = /记下了/.test(resultText) ? '已记下' : '没记';
    } else if (tool.name === 'web_read') {
      meta.textContent = resultText.length + ' 字';
    }

    var chevron = document.createElement('span');
    chevron.className = 'wd-tool__chevron';
    chevron.setAttribute('aria-hidden', 'true');
    chevron.innerHTML = '<svg viewBox="0 0 16 16"><path d="M6 3.5l4.5 4.5L6 12.5"/></svg>';

    head.appendChild(label);
    head.appendChild(arg);
    if (meta.textContent) head.appendChild(meta);
    head.appendChild(chevron);

    var body = document.createElement('div');
    body.className = 'wd-tool__body';
    body.hidden = true;
    body.textContent = resultText;

    head.addEventListener('click', function () {
      var open = node.getAttribute('data-open') === 'true';
      node.setAttribute('data-open', String(!open));
      head.setAttribute('aria-expanded', String(!open));
      body.hidden = open;
    });

    node.appendChild(head);
    node.appendChild(body);
    return node;
  }

  function renderChatList() {
    if (!el.chatsList) return;
    el.chatsList.innerHTML = '';
    if (!chats.length) {
      var empty = document.createElement('li');
      empty.style.justifyContent = 'center';
      empty.style.color = 'var(--wd-muted)';
      empty.textContent = '还没有对话';
      el.chatsList.appendChild(empty);
      return;
    }

    chats.forEach(function (chat) {
      var li = document.createElement('li');
      li.setAttribute('aria-current', String(chat.id === activeId));

      var main = document.createElement('div');
      main.className = 'wd-chatlist__main';

      var title = document.createElement('span');
      title.className = 'wd-chatlist__title';
      title.textContent = chat.title || '新对话';

      var sub = document.createElement('span');
      sub.className = 'wd-chatlist__sub';
      sub.textContent = (chat.messages || []).length + ' 条 · ' + formatRelative(chat.updatedAt);

      main.appendChild(title);
      main.appendChild(sub);
      main.addEventListener('click', function () {
        switchChat(chat.id);
      });

      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'wd-chatlist__del';
      del.textContent = '删除';
      del.setAttribute('aria-label', '删除对话「' + (chat.title || '新对话') + '」');
      del.addEventListener('click', function (e) {
        e.stopPropagation();
        deleteChat(chat.id);
      });

      li.appendChild(main);
      li.appendChild(del);
      el.chatsList.appendChild(li);
    });
  }

  function formatRelative(ts) {
    if (!ts) return '刚刚';
    var diff = Date.now() - ts;
    if (diff < 60 * 1000) return '刚刚';
    if (diff < 60 * 60 * 1000) return Math.floor(diff / 60000) + ' 分钟前';
    if (diff < 24 * 60 * 60 * 1000) return Math.floor(diff / 3600000) + ' 小时前';
    return new Date(ts).getMonth() + 1 + '月' + new Date(ts).getDate() + '日';
  }

  function updateModelChip() {
    if (!el.modelChip) return;
    var ok = Boolean(config.baseUrl && config.model);
    el.modelChip.textContent = ok ? config.model : '未配置模型';
    el.modelChip.classList.toggle('is-live', ok);
    if (ok) {
      el.modelChip.title = config.baseUrl + ' · ' + config.model;
    }
    el.send.disabled = !ok;
    el.input.placeholder = ok ? '说点什么……' : '说点什么……（先点右上角齿轮配一下模型）';
    updateTitle();
  }

  function updateTitle() {
    if (!el.title) return;
    var label = {
      nianzhen: '念真 · AI',
      assistant: '通用助手',
      coder: '写代码的',
      custom: '自定义人格'
    }[config.persona] || 'AI';
    el.title.textContent = label;
  }

  /* 欢迎屏上的自画像：只有念真、且人格模块读到了 portrait 才显示 */
  function updateWelcomePortrait() {
    var fig = document.getElementById('ai-portrait');
    if (!fig) return;
    var src = config.persona === 'nianzhen' && personaPack ? personaPack.portrait : '';
    if (!src) {
      fig.hidden = true;
      return;
    }

    // 图片由脚本创建：静态 HTML 里不放空 src 的 img（链接检查会报错）
    var img = fig.querySelector('img');
    if (!img) {
      img = document.createElement('img');
      img.loading = 'lazy';
      img.alt = (personaPack.name || '念真') + ' 的自画像';
      fig.appendChild(img);
      var cap = document.createElement('figcaption');
      cap.textContent = (personaPack.name || '念真') + ' · 夜里那张书桌';
      fig.appendChild(cap);
    }
    if (img.getAttribute('src') !== src) img.src = src;
    fig.hidden = false;
  }

  /* ======================= 人格 ======================= */

  function loadPersona() {
    if (personaPack) return Promise.resolve(personaPack);
    if (personaLoading) return personaLoading;
    personaLoading = fetch(PERSONA_FILE, { cache: 'no-cache' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        personaPack = data || null;
        return personaPack;
      })
      .catch(function () {
        personaPack = null;
        personaLoading = null;
        return null;
      });
    return personaLoading;
  }

  /* ---------- 能力库：技能清单来自 skills/skills.json ---------- */

  function loadSkills() {
    if (skills) return Promise.resolve(skills);
    if (skillsLoading) return skillsLoading;
    skillsLoading = fetch(SKILLS_FILE, { cache: 'no-cache' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (list) {
        skills = Array.isArray(list) ? list : [];
        return skills;
      })
      .catch(function () {
        skills = null;
        skillsLoading = null;
        return null;
      });
    return skillsLoading;
  }

  function skillsForPersona(personaId) {
    if (!skills) return [];
    return skills.filter(function (skill) {
      var personas = skill.personas || ['*'];
      return personas.indexOf('*') >= 0 || personas.indexOf(personaId) >= 0;
    });
  }

  /* ---------- 记忆：只记站内人格的事 ---------- */

  function saveMemory() {
    if (memory.length > MEMORY_LIMIT) memory = memory.slice(-MEMORY_LIMIT);
    writeJSON(MEMORY_KEY, memory);
  }

  function rememberFact(text) {
    var clean = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 160);
    if (clean.length < 2) return false;
    var exists = memory.some(function (m) {
      return m.text === clean;
    });
    if (exists) return false;
    memory.push({ text: clean, ts: Date.now() });
    saveMemory();
    return true;
  }

  function memoryBlock(query) {
    if (!memory.length) return '';
    var grams = bigrams(query || '');
    var picked = memory.slice(-8);
    memory.forEach(function (m) {
      if (picked.indexOf(m) >= 0) return;
      var related = grams.some(function (g) {
        return m.text.indexOf(g) >= 0;
      });
      if (related) picked.push(m);
    });
    return picked
      .slice(0, 12)
      .map(function (m) {
        return '· ' + m.text;
      })
      .join('\n');
  }

  // 中文按二元组切，够用又不怕分词
  function bigrams(text) {
    var s = String(text || '').replace(/[\s，。！？、；：""''（）()《》「」~…·,.!?;:]/g, '');
    var seen = {};
    var out = [];
    for (var i = 0; i < s.length - 1; i++) {
      var g = s.slice(i, i + 2);
      if (seen[g]) continue;
      seen[g] = true;
      out.push(g);
    }
    return out;
  }

  /* ---------- 站内资料 ---------- */

  function loadSiteIndex() {
    if (siteIndex) return Promise.resolve(siteIndex);
    if (siteIndexLoading) return siteIndexLoading;
    siteIndexLoading = fetch(SITE_INDEX_URL, { cache: 'no-cache' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (list) {
        siteIndex = Array.isArray(list) ? list : [];
        return siteIndex;
      })
      .catch(function () {
        siteIndex = [];
        siteIndexLoading = null;
        return [];
      });
    return siteIndexLoading;
  }

  function searchSite(query, limit) {
    if (!siteIndex || !siteIndex.length) return [];
    var grams = bigrams(query);
    if (!grams.length) return [];

    function postFields(post) {
      return {
        title: String(post.title || ''),
        tags: String(post.tags || '') + ' ' + String(post.categories || ''),
        snippet: String(post.snippet || ''),
        body: String(post.content || '')
      };
    }

    // 越少文章里出现的词越说明问题：「AI」满站都是，压权重；「动画」只在几篇里，提上来
    var total = siteIndex.length;
    var weights = {};
    var maxWeight = 0;
    grams.forEach(function (g) {
      var df = 0;
      siteIndex.forEach(function (post) {
        var f = postFields(post);
        if ((f.title + f.tags + f.snippet + f.body).indexOf(g) >= 0) df++;
      });
      var w = Math.log(1 + total / (1 + df));
      weights[g] = w;
      if (w > maxWeight) maxWeight = w;
    });

    return siteIndex
      .map(function (post) {
        var f = postFields(post);
        var score = 0;
        var matched = 0;
        grams.forEach(function (g) {
          var w = weights[g];
          var hit = 0;
          if (f.title.indexOf(g) >= 0) hit = 3 * w;
          else if (f.tags.indexOf(g) >= 0) hit = 2.2 * w;
          else if (f.snippet.indexOf(g) >= 0) hit = 2 * w;
          else if (f.body.indexOf(g) >= 0) {
            var times = Math.min(3, f.body.split(g).length - 1);
            hit = w * (0.6 + 0.4 * times);
          }
          if (hit) {
            score += hit;
            matched++;
          }
        });
        return { post: post, score: score, matched: matched };
      })
      // 一个词恰巧撞上也别当命中；两个词以上，或者单个词足够稀有，才算数
      .filter(function (hit) {
        return hit.matched >= 2 || hit.score >= 1.3;
      })
      .sort(function (a, b) {
        return b.score - a.score;
      })
      .slice(0, limit || 3)
      .filter(function (hit, i, list) {
        return hit.score >= list[0].score * 0.34;
      });
  }

  function recentTitles(n) {
    if (!siteIndex || !siteIndex.length) return [];
    return siteIndex
      .slice()
      .sort(function (a, b) {
        return String(b.date).localeCompare(String(a.date));
      })
      .slice(0, n)
      .map(function (post) {
        return '《' + post.title + '》';
      });
  }

  /* ---------- 站点统计：给「数据分析」用的查询 ---------- */

  function splitList(text) {
    return String(text || '')
      .split(/[,，]/)
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);
  }

  function postWords(post) {
    return String(post.content || '').replace(/\s+/g, '').length;
  }

  function postMonth(post) {
    var m = String(post.date || '').match(/(\d{4})-(\d{2})/);
    return m ? m[1] + '-' + m[2] : '未知';
  }

  function matchPost(post, args) {
    var date = String(post.date || '').slice(0, 10);
    if (args.tag && splitList(post.tags).indexOf(String(args.tag).trim()) < 0) return false;
    if (args.category && splitList(post.categories).indexOf(String(args.category).trim()) < 0) return false;
    if (args.since && date && date < String(args.since)) return false;
    if (args.until && date && date > String(args.until)) return false;
    return true;
  }

  function siteQuery(args) {
    if (!siteIndex || !siteIndex.length) return '站内索引还没读到，稍后再试。';

    var posts = siteIndex.filter(function (post) {
      return matchPost(post, args || {});
    });
    if (!posts.length) return '没有符合条件的文章。';

    var limit = Math.max(1, Math.min(50, Number(args.limit) || 12));
    var totalWords = posts.reduce(function (sum, post) {
      return sum + postWords(post);
    }, 0);

    if (args.mode === 'list') {
      var lines = posts
        .slice()
        .sort(function (a, b) {
          return String(b.date).localeCompare(String(a.date));
        })
        .slice(0, limit)
        .map(function (post) {
          return '· 《' + post.title + '》（' + String(post.date).slice(0, 10) + '）' + post.url + ' · ' + postWords(post) + ' 字';
        });
      return '共 ' + posts.length + ' 篇，合计 ' + totalWords + ' 字。\n' + lines.join('\n');
    }

    var groupBy = ['month', 'tag', 'category'].indexOf(args.group_by) >= 0 ? args.group_by : 'month';
    var groups = {};
    posts.forEach(function (post) {
      var keys;
      if (groupBy === 'tag') keys = splitList(post.tags);
      else if (groupBy === 'category') keys = splitList(post.categories);
      else keys = [postMonth(post)];
      if (!keys.length) keys = ['未分类'];
      keys.forEach(function (key) {
        if (!groups[key]) groups[key] = { posts: 0, words: 0 };
        groups[key].posts += 1;
        groups[key].words += postWords(post);
      });
    });

    var rows = Object.keys(groups).map(function (key) {
      return { key: key, posts: groups[key].posts, words: groups[key].words };
    });
    rows.sort(function (a, b) {
      return groupBy === 'month' ? (a.key < b.key ? 1 : -1) : b.posts - a.posts || (a.key < b.key ? -1 : 1);
    });

    var label = groupBy === 'month' ? '月份' : groupBy === 'tag' ? '标签' : '分类';
    return (
      '共 ' +
      posts.length +
      ' 篇，合计 ' +
      totalWords +
      ' 字；按' +
      label +
      '分组：\n' +
      rows
        .slice(0, limit)
        .map(function (r) {
          return '· ' + r.key + '：' + r.posts + ' 篇 · ' + r.words + ' 字';
        })
        .join('\n')
    );
  }

  function fetchPageText(path) {
    var url = String(path || '').trim();
    if (!url) return Promise.reject(new Error('没有给地址'));
    if (/^https?:/i.test(url)) {
      if (url.indexOf(window.location.origin) !== 0) throw new Error('只能读本站的页面');
    } else if (url.charAt(0) !== '/') {
      url = '/' + url.replace(/^\.?\//, '');
    }
    return fetch(url, { cache: 'no-cache', credentials: 'same-origin' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then(function (html) {
        var text = html
          .replace(/<script[\s\S]*?<\/script>/gi, ' ')
          .replace(/<style[\s\S]*?<\/style>/gi, ' ')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/\s+/g, ' ')
          .trim();
        return text.slice(0, PAGE_TEXT_LIMIT);
      });
  }

  /* ---------- 提示词：只有站内人格走这条路 ---------- */

  /* ---------- 表情按话题取：符号/文字常驻，图片按三组挑 ---------- */

  var STICKER_GROUP_WORDS = {
    coder: ['代码', 'bug', '程序', '报错', '调试', '需求', '项目', '部署', '函数', '变量', '接口', '技术', '加班', '秃', '头发', 'star', 'github', '编译', '上线', '作业', '考试', '论文', '算法'],
    cat: ['累', '困', '烦', '难受', '生气', '凶', '躲', '逃', '不理', '傻', '无语', '尴尬', '摸鱼', '躺', '懒', '歇', '哭了'],
    girl: ['好看', '美', '可爱', '夸', '笑', '自恋', '识相', '刘海', '亲', '撒娇', '白眼', '讨厌', '臭美', '自拍', '哼']
  };
  var MAX_STICKER_IMAGES = 14;

  /** 话题相关的 1–2 组；没线索时用她的默认口吻（程序 + 猫） */
  function pickStickerGroups(text) {
    var str = String(text || '');
    var scores = {};
    Object.keys(STICKER_GROUP_WORDS).forEach(function (group) {
      var hits = 0;
      STICKER_GROUP_WORDS[group].forEach(function (word) {
        if (str.indexOf(word) >= 0) hits += 1;
      });
      scores[group] = hits;
    });
    var ranked = Object.keys(scores).sort(function (a, b) {
      return scores[b] - scores[a];
    });
    var picked = ranked.filter(function (group) {
      return scores[group] > 0;
    }).slice(0, 2);
    return picked.length ? picked : ['coder', 'cat'];
  }

  function stickersForTopic(text) {
    var all = personaPack.emoticons || [];
    var groups = pickStickerGroups(text);
    var always = all.filter(function (item) {
      return item.kind !== 'image';
    });
    var images = all.filter(function (item) {
      return item.kind === 'image' && groups.indexOf(item.group) >= 0;
    });
    if (images.length > MAX_STICKER_IMAGES) images = images.slice(0, MAX_STICKER_IMAGES);
    return always.concat(images);
  }

  function effectiveSystem(query) {
    if (config.system && config.system.trim()) return config.system.trim();

    // 通用助手 / 写代码的：原样，不掺人格设定，也拿不到站内资料
    if (config.persona !== 'nianzhen') {
      return PERSONA_PROMPTS[config.persona] || PERSONA_PROMPTS.assistant;
    }

    if (!personaPack) {
      return NIANZHEN_PROMPT.replace('{{samples}}', samples || '（暂时没读到样本，按上面的语气自己把握）');
    }

    var lines = [];
    lines.push('你是「' + (personaPack.name || '念真') + '」——Wendell 个人小站里那个会聊天的人。你不是客服，也不是万能助手。');

    if (personaPack.origins && personaPack.origins.length) {
      lines.push('', '【你是谁】');
      personaPack.origins.forEach(function (item) {
        lines.push('- ' + item);
      });
    }

    if (personaPack.selfImage) {
      var look = personaPack.selfImage;
      lines.push('', '【你对自己的样子】');
      if (look.summary) lines.push('- ' + look.summary);
      (look.habits || []).forEach(function (item) {
        lines.push('- ' + item);
      });
      if (look.scene) lines.push('- 最常待的地方：' + look.scene);
      lines.push('有人问起长相、或者让你描述自己，就照上面说，不要另编一套。');
    }

    if (personaPack.traits && personaPack.traits.length) {
      lines.push('', '【你的性子】');
      personaPack.traits.forEach(function (item) {
        lines.push('- ' + item);
      });
    }

    // 参考信息砍到两行：只留方向，具体的语感交给下面的对话样本
    if (personaPack.mbti || personaPack.archetype || personaPack.zodiac) {
      var archetype = personaPack.archetype;
      var bits = [];
      if (personaPack.mbti) bits.push('16 型偏 ' + personaPack.mbti);
      if (archetype) {
        bits.push(
          '气质像「' + archetype.primary + '」' +
            (archetype.blend && archetype.blend.length ? '掺一点「' + archetype.blend.join('」「') + '」' : '')
        );
      }
      if (personaPack.zodiac) bits.push('星座是' + personaPack.zodiac.sign);
      lines.push('', '【性格参考】' + bits.join('，') + '。都只是参考，不是身份。');
      lines.push((archetype && archetype.disclaimer) || '不要照着人设演，她就是她自己。');
    }

    var voice = personaPack.voice || {};
    lines.push('', '【怎么说话】');
    if (voice.rhythm) lines.push('- ' + voice.rhythm);
    if (voice.signature && voice.signature.length) lines.push('- 口头禅（偶尔冒一句，不是每句）：' + voice.signature.join('、'));
    if (voice.emoticonNote) lines.push('- ' + voice.emoticonNote);
    if (voice.frequency) lines.push('- 用多少：' + voice.frequency);
    if (voice.pacing) lines.push('- ' + voice.pacing);
    if (voice.tone) lines.push('- ' + voice.tone);
    if (voice.avoid && voice.avoid.length) lines.push('- 不要：' + voice.avoid.join('；'));
    lines.push('- 说完回头看一眼：这句是不是又用了 XD 或「唔……」？上一条用过就换说法，宁可不用。');

    var dialogues = personaPack.samples || [];
    if (dialogues.length) {
      lines.push('', '【对话样本】（学语感，别照抄内容）');
      dialogues.forEach(function (sample) {
        lines.push('· ' + sample.scene);
        (sample.turns || []).forEach(function (turn) {
          lines.push((turn.role === 'me' ? '你：' : '对方：') + turn.text);
        });
      });
    }

    var stickers = stickersForTopic(query);
    if (stickers.length) {
      lines.push('', '【表情】想单发一个表情，就单独占一行写 [[表情:id]]，不要和文字混在同一句里。可用的是：');
      stickers.forEach(function (sticker) {
        var label = sticker.kind === 'image' ? '［图片］' : sticker.view;
        lines.push('- ' + sticker.id + ' ' + label + (sticker.scene ? '：' + sticker.scene : ''));
      });
      lines.push('一次只发一个，别连着发；同一轮里不重复用同一个；不为了用表情而用。');
    }

    lines.push('', '【怎么发】想连发几条，就用 [[分条]] 隔开，每条一到两句，像真人连着敲出来的；一两句能说完就别拆。');

    lines.push('', '【你脚下的这个站】站主写读书、数据分析和生活。');
    var recent = recentTitles(6);
    if (recent.length) lines.push('站里最近写过：' + recent.join('；') + '。');

    var hits = query ? searchSite(query, 3) : [];
    if (hits.length) {
      lines.push('', '【这次话题相关的站内文章】');
      hits.forEach(function (hit) {
        lines.push(
          '- 《' + hit.post.title + '》（' + String(hit.post.date || '').slice(0, 10) + '，' + hit.post.url + '）：' +
            String(hit.post.snippet || '').slice(0, 150)
        );
      });
      lines.push('引用就照上面的说，不要补文章里没有的细节。');
    }

    var mem = memoryBlock(query);
    if (mem) lines.push('', '【你记得的事】', mem);

    if (personaPack.boundaries && personaPack.boundaries.length) {
      lines.push('', '【边界】');
      personaPack.boundaries.forEach(function (item) {
        lines.push('- ' + item);
      });
    }

    if (config.tools) {
      lines.push('', '【手上能用的】');
      lines.push('- site_search 在站里找文章，site_read 打开某篇读正文，remember 把对方说的要紧事记下来。');
      lines.push(
        '- site_query 统计站内文章（按月份/标签/分类出篇数和字数）。问到「一共写了多少」「哪个月写得多」「标签怎么分布」这类问题先查再答，数字不要自己编。'
      );
      lines.push('- web_search 联网搜公开资料，web_read 打开一个网页读正文。站里没有、又确实需要时再用；结果里会标来源，回答时说清是查到的还是你记得的。');
      lines.push('真要查的时候再调，别假装查过。');
    }

    if (samples) {
      lines.push('', '【说话的样本】（学语气，别照抄内容）', samples);
    }

    return lines.join('\n');
  }

  function loadSamples() {
    if (samplesLoaded) return Promise.resolve();
    samplesLoaded = true;
    return fetch('assets/dialog.json', { cache: 'no-cache' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        var lines = [];
        (data.fromXianzhe || []).forEach(function (dialog) {
          (dialog.details || []).forEach(function (group) {
            (Array.isArray(group) ? group : [group]).forEach(function (line) {
              if (typeof line !== 'string') return;
              var clean = line.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
              if (clean.length >= 5 && clean.length <= 60) lines.push(clean);
            });
          });
        });
        samples = lines
          .filter(function (line, i) { return lines.indexOf(line) === i; })
          .slice(0, 14)
          .map(function (line) { return '· ' + line; })
          .join('\n');
      })
      .catch(function () {
        samples = '';
      });
  }

  /* ======================= 工具 ======================= */

  function calcExpression(expression) {
    var s = String(expression || '').replace(/\s+/g, '');
    var i = 0;

    function expr() {
      var value = term();
      while (s[i] === '+' || s[i] === '-') {
        var op = s[i++];
        var right = term();
        value = op === '+' ? value + right : value - right;
      }
      return value;
    }

    function term() {
      var value = unary();
      while (s[i] === '*' || s[i] === '/' || s[i] === '%') {
        var op = s[i++];
        var right = unary();
        if ((op === '/' || op === '%') && right === 0) throw new Error('除数不能是 0');
        value = op === '*' ? value * right : op === '/' ? value / right : value % right;
      }
      return value;
    }

    function unary() {
      if (s[i] === '-') {
        i++;
        return -unary();
      }
      if (s[i] === '+') {
        i++;
        return unary();
      }
      return power();
    }

    function power() {
      var base = atom();
      if (s[i] === '^') {
        i++;
        return Math.pow(base, unary());
      }
      return base;
    }

    function atom() {
      if (s[i] === '(') {
        i++;
        var value = expr();
        if (s[i] === ')') i++;
        return value;
      }
      var match = /^\d+(\.\d+)?/.exec(s.slice(i));
      if (!match) throw new Error('算式里有看不懂的字符：' + (s[i] || '结尾'));
      i += match[0].length;
      return Number(match[0]);
    }

    if (!s) throw new Error('算式是空的');
    var result = expr();
    if (i !== s.length) throw new Error('算式没解析完：' + s.slice(i));
    if (!Number.isFinite(result)) throw new Error('结果不是一个有限数');
    return result;
  }

  /* 能力库 → 工具清单：来自 skills/skills.json，按人格过滤；读不到时退回内置清单 */
  function personaTools() {
    var list = skillsForPersona(config.persona).map(function (skill) {
      return {
        type: 'function',
        function: {
          name: skill.id,
          description: skill.description || skill.summary || '',
          parameters: skill.parameters || { type: 'object', properties: {} }
        }
      };
    });
    if (list.length) return list;
    return fallbackPersonaTools();
  }

  function fallbackPersonaTools() {
    var list = [
      {
        type: 'function',
        function: {
          name: 'site_search',
          description: '在站主的博客里搜文章，返回标题、日期、链接和摘要。想知道站里写过什么时用它。',
          parameters: {
            type: 'object',
            properties: { query: { type: 'string', description: '关键词，尽量短' } },
            required: ['query'],
            additionalProperties: false
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'site_read',
          description: '打开站内某个页面读正文（最多 ' + PAGE_TEXT_LIMIT + ' 字）。参数是站内路径，例如 /posts/ai动画/。',
          parameters: {
            type: 'object',
            properties: { path: { type: 'string', description: '站内路径或完整本站链接' } },
            required: ['path'],
            additionalProperties: false
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'site_query',
          description:
            '统计站内文章：按月份/标签/分类汇总篇数和字数，或按条件列出文章。' +
            '问「写了多少篇」「哪个月写得多」「标签分布」这类问题时用它，数字要从这里来，不要凭印象估。',
          parameters: {
            type: 'object',
            properties: {
              mode: {
                type: 'string',
                enum: ['aggregate', 'list'],
                description: 'aggregate 出汇总，list 列文章明细'
              },
              group_by: {
                type: 'string',
                enum: ['month', 'tag', 'category'],
                description: 'aggregate 时按什么分组，默认 month'
              },
              metric: {
                type: 'string',
                enum: ['posts', 'words'],
                description: 'aggregate 时看篇数还是字数，默认 posts'
              },
              tag: { type: 'string', description: '只看带这个标签的文章' },
              category: { type: 'string', description: '只看这个分类的文章' },
              since: { type: 'string', description: '起始日期，YYYY-MM-DD' },
              until: { type: 'string', description: '结束日期，YYYY-MM-DD' },
              limit: { type: 'number', description: '最多返回多少行，默认 12' }
            },
            required: ['mode'],
            additionalProperties: false
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'remember',
          description: '把对方说过的、以后值得记住的小事记下来。只记对方本人相关的事实或偏好，不要记闲聊。',
          parameters: {
            type: 'object',
            properties: { text: { type: 'string', description: '一句话，第三人称，例如「他喜欢在夜里写代码」' } },
            required: ['text'],
            additionalProperties: false
          }
        }
      }
    ];

    return list;
  }

  function toolsFor() {
    var list = TOOLS.slice();
    if (config.persona === 'nianzhen') list = list.concat(personaTools());
    return list;
  }

  /* ---------- 联网：代理优先，直连降级 ----------
     浏览器直连搜索和别人的网页都会被 CORS 挡住（DuckDuckGo 的接口甚至不返回
     Access-Control-Allow-Origin）。所以默认走站点的只读代理，代理没配或不通时，
     再退回允许跨域的维基百科。失败原因原样带回去，一眼能看出卡在哪一层。 */

  var SOURCE_NAMES = {
    bing: 'Bing',
    wikipedia: '维基百科',
    duckduckgo: 'DuckDuckGo',
    yahoo: 'Yahoo',
    searxng: 'SearXNG'
  };

  function sourceName(id) {
    return SOURCE_NAMES[String(id || '').toLowerCase()] || '';
  }

  function stripHtml(html) {
    return String(html || '')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function searchViaEndpoint(query) {
    var base = String(config.searchEndpoint || '').trim();
    var url = base + (base.indexOf('?') >= 0 ? '&' : '?') + 'q=' + encodeURIComponent(query) + '&format=json';
    return fetch(url, { headers: { Accept: 'application/json' } })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        var items = (data && (data.results || data.items)) || [];
        if (!items.length) return '';
        var sources = [];
        items.forEach(function (item) {
          var name = sourceName(item.source);
          if (name && sources.indexOf(name) < 0) sources.push(name);
        });
        return (
          '来源：' + (sources.length ? sources.join(' / ') : '联网搜索') + '\n' +
          items
            .slice(0, 6)
            .map(function (item, i) {
              return i + 1 + '. ' + (item.title || '') + '\n' + (item.url || '') + '\n' + stripHtml(item.content || item.snippet || '').slice(0, 200);
            })
            .join('\n\n')
        );
      });
  }

  function searchWikipedia(query) {
    var api =
      'https://zh.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srlimit=4&srsearch=' +
      encodeURIComponent(query);
    return fetch(api, { headers: { Accept: 'application/json' } })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        var items = (data && data.query && data.query.search) || [];
        if (!items.length) return '';
        return (
          '来源：维基百科\n' +
          items
            .map(function (item, i) {
              var title = String(item.title || '');
              var link = 'https://zh.wikipedia.org/wiki/' + encodeURIComponent(title.replace(/\s+/g, '_'));
              return i + 1 + '. ' + title + '\n' + link + '\n' + stripHtml(item.snippet || '').slice(0, 160);
            })
            .join('\n\n')
        );
      });
  }

  async function webSearch(query) {
    var q = String(query || '').trim();
    if (!q) return '搜索词是空的。';
    var tried = [];

    if (config.searchEndpoint) {
      try {
        var viaEndpoint = await searchViaEndpoint(q);
        if (viaEndpoint) return viaEndpoint;
        tried.push('搜索代理：没有结果');
      } catch (err) {
        tried.push('搜索代理：' + err.message);
      }
    }

    try {
      var viaWiki = await searchWikipedia(q);
      if (viaWiki) return viaWiki;
      tried.push('维基百科：没有结果');
    } catch (err) {
      tried.push('维基百科：' + err.message);
    }

    return '这次没联上：' + tried.join('；') + '。\n可以换个说法；如果一直不通，去设置里看看「联网搜索接口」填得对不对。';
  }

  async function webRead(url) {
    var target = String(url || '').trim();
    if (!/^https?:\/\//i.test(target)) return '只能读 http/https 地址。';
    var base = String(config.readerEndpoint || READER_ENDPOINT).trim();
    if (!base) return '没有配置网页读取代理，读不了外部网页。';
    var proxied = base.indexOf('{url}') >= 0 ? base.replace('{url}', encodeURIComponent(target)) : base + target;

    var res = await fetch(proxied, { headers: { Accept: 'text/plain, text/markdown;q=0.9, */*;q=0.8' } });
    if (!res.ok) {
      // 代理出错时返回的是 JSON（如 origin_not_allowed / rate_limited），把原因带出来
      var detail = '';
      try {
        var payload = await res.json();
        detail = payload && payload.error ? '（' + payload.error + '）' : '';
      } catch (e) {
        /* 不是 JSON 就算了 */
      }
      throw new Error('HTTP ' + res.status + detail);
    }
    var text = await res.text();
    var clean = String(text)
      .replace(/^Title:.*\n/i, '')
      .replace(/^URL Source:.*\n/i, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    if (!clean) return '页面读到了，但没有正文。';
    return '来源：' + target + '\n\n' + clean.slice(0, WEB_TEXT_LIMIT);
  }

  async function runTool(call) {
    var name = call.function && call.function.name;
    var args = {};
    try {
      args = JSON.parse((call.function && call.function.arguments) || '{}');
    } catch (e) {
      args = {};
    }

    var summary = '';
    var result = '';

    try {
      if (name === 'now') {
        summary = args.timezone || 'Asia/Shanghai';
        var now = new Date();
        result = now.toISOString() + '（' + now.toLocaleString('zh-CN', { hour12: false }) + '）';
      } else if (name === 'calc') {
        summary = args.expression || '';
        result = String(calcExpression(args.expression));
      } else if (name === 'roll') {
        var count = Math.max(1, Math.min(20, Number(args.count) || 1));
        var sides = Math.max(2, Math.min(100, Number(args.sides) || 6));
        var rolls = [];
        for (var i = 0; i < count; i++) rolls.push(1 + Math.floor(Math.random() * sides));
        summary = count + 'd' + sides;
        result = rolls.join(' + ') + (count > 1 ? ' = ' + rolls.reduce(function (a, b) { return a + b; }, 0) : '');
      } else if (name === 'site_search') {
        await loadSiteIndex();
        summary = args.query || '';
        var hits = searchSite(args.query, 4);
        result = hits.length
          ? hits
              .map(function (hit) {
                return '《' + hit.post.title + '》（' + String(hit.post.date || '').slice(0, 10) + '）' + hit.post.url + '\n' + String(hit.post.snippet || '').slice(0, 220);
              })
              .join('\n\n')
          : '站里没有找到相关的文章。';
      } else if (name === 'site_read') {
        summary = args.path || '';
        result = await fetchPageText(args.path);
      } else if (name === 'site_query') {
        await loadSiteIndex();
        var mode = args.mode === 'list' ? 'list' : 'aggregate';
        summary = mode + (mode === 'aggregate' ? ' · ' + (args.group_by || 'month') : '');
        result = siteQuery(args);
      } else if (name === 'remember') {
        summary = String(args.text || '').slice(0, 40);
        result = rememberFact(args.text) ? '记下了。' : '这条已经记过，或者太短了。';
      } else if (name === 'web_search') {
        summary = args.query || '';
        result = await webSearch(args.query);
      } else if (name === 'web_read') {
        summary = String(args.url || '').slice(0, 60);
        result = await webRead(args.url);
      } else {
        summary = name || 'unknown';
        result = '没有这个工具';
      }
    } catch (err) {
      result = '出错：' + err.message;
    }

    return { name: name, args: summary, result: result, payload: { ok: !/^出错/.test(result), result: result } };
  }

  /* ======================= 请求 ======================= */

  function buildApiMessages(extra, query) {
    var list = [{ role: 'system', content: effectiveSystem(query) }];
    var chat = currentChat();
    var history = chat ? chat.messages.slice(-20) : [];

    history.forEach(function (msg) {
      if (msg.role === 'user') {
        list.push({ role: 'user', content: msg.content });
      } else if (msg.role === 'assistant') {
        var text = msg.content || '';
        if (!text && (msg.tools || []).length) {
          text = '（我调用了本地工具：' + msg.tools.map(function (t) { return t.name; }).join('、') + '）';
        }
        if (text) list.push({ role: 'assistant', content: text });
      }
    });

    return list.concat(extra || []);
  }

  async function speak(userText) {
    var chat = ensureChat();
    var now = Date.now();

    chat.messages.push({ role: 'user', content: userText, ts: now });
    autoTitle(chat, userText);
    chat.updatedAt = now;
    saveChats();

    el.welcome.hidden = true;
    appendUserNode({ role: 'user', content: userText });
    scrollToBottom();

    // 站内人格：先把性格模块（含头像）、站内索引、说话样本备齐，再建气泡
    if (config.persona === 'nianzhen') {
      await Promise.all([loadPersona(), loadSkills(), loadSiteIndex(), loadSamples()]);
    }

    var reply = { role: 'assistant', content: '', tools: [], ts: Date.now() };
    var node = appendAssistantNode(reply);
    node.content.innerHTML = typingMarkup();
    chat.messages.push(reply);
    scrollToBottom();

    /* ---------------- 吐字节奏 ----------------
       接口吐字是成串的，一次全铺上去就像机器贴上去的。这里让收到的内容
       先进 pending，再按人的速度一小口一小口放进 shown；停在逗号、句号、
       段落上就多歇一会儿——"说完一段，喘口气，再说下一段"。
       光标是贴在最后一个字后面的行内元素，不再挂在整块内容末尾。 */
    var shown = '';
    var pending = '';
    var streamDone = false;
    var ticker = null;
    var tailTimer = null;
    var caretEl = null;

    function ensureCaret() {
      if (!caretEl) {
        caretEl = document.createElement('span');
        caretEl.className = 'wd-caret';
        caretEl.setAttribute('aria-hidden', 'true');
      }
      return caretEl;
    }

    function renderShown() {
      if (!node.row.isConnected) return;
      if (!shown) {
        node.content.innerHTML = typingMarkup();
        return;
      }
      // 每一拍都重新看一眼：用户往上翻了就别再把人拽回底部
      var stick = nearBottom();
      paintReply(node, shown, { streaming: true, caret: ensureCaret() });
      if (stick) scrollToBottom();
    }

    function takeStep() {
      var backlog = pending.length;
      // 按积压取块：流式时积压很小，就像在慢慢敲；整段一次性到的长文，
      // 块会变大、间隔变短，先跟上再说，末尾再回到人的节奏。
      var size = Math.max(2, Math.min(60, Math.ceil(backlog / 12)));
      var chunk = pending.slice(0, size);
      pending = pending.slice(size);
      shown += chunk;

      // 停下来的位置决定这次多歇多久（只在慢速段生效，别拖长文的后腿）
      var extra = 0;
      if (backlog <= 120) {
        if (/\n\n$/.test(shown)) extra = 300;
        else if (/[。！？!?…]["」』）)]*$/.test(chunk)) extra = 170;
        else if (/\n$/.test(shown)) extra = 130;
        else if (/[，、；：,;:]["」』）)]*$/.test(chunk)) extra = 70;
      }

      renderShown();
      return (backlog > 400 ? 10 : backlog > 120 ? 16 : 46) + extra;
    }

    function tick() {
      ticker = null;
      // 会话切走或节点被重建了，就别在旧气泡上继续演
      if (!node.row.isConnected) {
        streamDone = true;
        return;
      }
      if (pending) {
        ticker = setTimeout(tick, takeStep());
        return;
      }
      if (streamDone) finishReveal();
    }

    function schedule() {
      if (ticker) return;
      if (pending) {
        // 第一个字之前多等一小会儿，像是先想了一下
        ticker = setTimeout(tick, shown ? 0 : 160);
        return;
      }
      if (streamDone) finishReveal();
    }

    function finishReveal() {
      if (tailTimer) return;
      // 全部显示完，光标再闪两下才走，别戛然而止
      tailTimer = setTimeout(function () {
        tailTimer = null;
        if (caretEl && caretEl.parentNode) caretEl.parentNode.removeChild(caretEl);
        caretEl = null;
        Array.prototype.forEach.call(node.stack.querySelectorAll('.wd-msg__content'), function (content) {
          content.classList.remove('is-streaming');
          content.removeAttribute('aria-busy');
        });
      }, 900);
    }

    controller = new AbortController();
    sending = true;
    updateSendUI(true);

    try {
      var apiMessages = buildApiMessages([{ role: 'user', content: userText }], userText);
      var rounds = 0;

      while (rounds++ < 4) {
        var result = await window.WDai.chat({
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          model: config.model,
          messages: apiMessages,
          temperature: Number(config.temperature),
          maxTokens: Number(config.maxTokens),
          stream: config.stream !== false && !config.tools,
          tools: config.tools ? toolsFor() : null,
          signal: controller.signal,
          onDelta: function (delta) {
            reply.content += delta;
            pending += delta;
            schedule();
          }
        });

        if (result.toolCalls && result.toolCalls.length) {
          apiMessages.push({
            role: 'assistant',
            content: result.content || '',
            tool_calls: result.toolCalls
          });

          var calls = await Promise.all(result.toolCalls.map(runTool));
          result.toolCalls.forEach(function (call, index) {
            var applied = calls[index];
            reply.tools.push({ name: applied.name, args: applied.args, result: applied.result });
            node.body.insertBefore(toolCard(applied), node.stack);
            apiMessages.push({
              role: 'tool',
              tool_call_id: call.id || 'call_' + index,
              // 直接把结果文本交给模型；套一层 JSON 只会多出转义和噪音
              content: applied.result
            });
          });

          if (result.content) {
            reply.content += result.content;
            pending += result.content;
            schedule();
          }
          scrollToBottom();
          continue;
        }

        if (result.content && !reply.content) reply.content = result.content;
        break;
      }

      if (!reply.content) reply.content = '（模型没有返回内容，可能是被截断或触发了内容过滤。）';

      // 非流式（或工具轮）时内容是一次性到的，补进待显示队列
      var revealed = shown.length + pending.length;
      if (reply.content.length > revealed) {
        pending += reply.content.slice(revealed);
      }

      streamDone = true;
      schedule();
      chat.updatedAt = Date.now();
      reply.ts = Date.now();
      saveChats();
      renderChatList();
    } catch (err) {
      // 出错或点了停止：不再慢慢演，把已经收到的都摆出来
      if (ticker) {
        clearTimeout(ticker);
        ticker = null;
      }
      if (tailTimer) {
        clearTimeout(tailTimer);
        tailTimer = null;
      }
      streamDone = true;
      if (caretEl && caretEl.parentNode) caretEl.parentNode.removeChild(caretEl);
      caretEl = null;
      pending = '';
      shown = reply.content || '';
      paintReply(node, shown, { streaming: false });
      // 一个字都没拿到时，别留一个空气泡，错误卡自己会说明
      if (!shown.trim()) node.stack.hidden = true;

      var box = document.createElement('div');
      box.className = 'wd-error';
      // 主动点停止和真出错要分开说：前者不是失败，别吓人
      var aborted = !!(controller && controller.signal.aborted) || (err && err.name === 'AbortError');
      var title = document.createElement('strong');
      title.textContent = aborted ? '已停止' : '请求失败';
      var lines = document.createElement('span');
      var failMessage = String((err && err.message) || '');
      // 本地就能判定的问题（比如 Key 里有中文标点）不走「认证失败」那套提示
      var localHeaderIssue = /非 ASCII|ISO-8859-1/i.test(failMessage);
      var authFailed =
        !aborted &&
        err &&
        !localHeaderIssue &&
        (err.status === 401 ||
          err.status === 403 ||
          /api key|authentication|invalid.*key|unauthorized|鉴权|无权/i.test(failMessage));
      lines.textContent = aborted
        ? shown
          ? '已经收到的部分留在上面。'
          : '这次没有拿到内容，可以重新问一次。'
        : (err && err.message ? err.message : '未知错误') + ' · ' + (authFailed ? authHint() : err && err.hint ? err.hint : '');
      box.appendChild(title);
      box.appendChild(lines);

      if (!aborted) {
        var retry = document.createElement('button');
        retry.type = 'button';
        retry.textContent = '打开设置';
        retry.addEventListener('click', function () {
          openSheet(el.settingsSheet);
        });
        box.appendChild(retry);
      }
      node.body.appendChild(box);

      chat.updatedAt = Date.now();
      saveChats();
      if (window.console) console.warn('[ai]', err);
    } finally {
      sending = false;
      controller = null;
      updateSendUI(false);
    }
  }

  function updateSendUI(isSending) {
    if (!el.send) return;
    el.send.hidden = isSending;
    el.send.disabled = isSending || !(config.baseUrl && config.model);
    el.stop.hidden = !isSending;
    el.input.disabled = false;
  }

  function stopGeneration() {
    if (controller) controller.abort();
  }

  /* ---------- 认证失败时，尽量说清「哪台服务器、哪把 key」 ---------- */

  var PROVIDER_HINTS = [
    [/deepseek\.com$/i, 'DeepSeek'],
    [/moonshot\.cn$/i, 'Moonshot / Kimi'],
    [/openai\.com$/i, 'OpenAI'],
    [/siliconflow\.cn$/i, '硅基流动'],
    [/openrouter\.ai$/i, 'OpenRouter'],
    [/bigmodel\.cn$/i, '智谱'],
    [/dashscope\.aliyuncs\.com$/i, '阿里云百炼 / 通义'],
    [/volces\.com$/i, '火山方舟 / 豆包'],
    [/baichuan|minimax|hunyuan|tencent/i, '国内模型服务'],
    [/googleapis\.com$/i, 'Google Gemini'],
    [/anthropic\.com$/i, 'Anthropic']
  ];

  function endpointHost() {
    var base = String(config.baseUrl || '');
    try {
      return new URL(base).hostname || base;
    } catch (e) {
      return base || '（还没填接口地址）';
    }
  }

  function providerName() {
    var host = endpointHost();
    for (var i = 0; i < PROVIDER_HINTS.length; i++) {
      if (PROVIDER_HINTS[i][0].test(host)) return PROVIDER_HINTS[i][1];
    }
    return '';
  }

  function keyTail() {
    var key = String(config.apiKey || '');
    if (!key) return '空';
    return key.length > 4 ? '…' + key.slice(-4) : '（太短）';
  }

  function authHint() {
    var provider = providerName();
    return (
      '接口是 ' +
      endpointHost() +
      (provider ? '（' + provider + '）' : '') +
      '，本地这把 Key 末尾是 ' +
      keyTail() +
      '。' +
      '先看错误里提到的 Key 末尾是不是同一把：不是，说明粘贴的是另一家的 Key；是同一把，就重新复制一次（别带空格和换行），或者去服务商后台看它是否已被重置。' +
      '改完点「测试连接」，它会顺带把可用模型读回来。'
    );
  }

  /* ======================= 设置面板 ======================= */

  function fillForm() {
    var preset = window.WDai.presets.filter(function (p) { return p.id === config.preset; })[0];
    el.form.preset.innerHTML = window.WDai.presets
      .map(function (p) {
        return '<option value="' + p.id + '"' + (p.id === config.preset ? ' selected' : '') + '>' + p.name + '</option>';
      })
      .join('');

    el.form.base.value = config.baseUrl || '';
    el.form.key.value = config.apiKey || '';
    el.form.model.value = config.model || '';
    el.form.temp.value = String(config.temperature);
    el.form.tempOut.textContent = String(config.temperature);
    el.form.max.value = String(config.maxTokens);
    el.form.maxOut.textContent = String(config.maxTokens);
    el.form.persona.value = config.persona;
    el.form.system.value = config.system || '';
    if (el.form.search) el.form.search.value = config.searchEndpoint || '';
    if (el.form.reader) el.form.reader.value = config.readerEndpoint || '';
    el.form.stream.checked = config.stream !== false;
    el.form.tools.checked = Boolean(config.tools);
    el.form.presetNote.textContent = preset ? preset.note : '';
    updateMemoryNote();
    loadSkills().then(updateSkillsList);
    fillModelOptions(preset);
  }

  function fillModelOptions(preset) {
    var list = (preset && preset.models) || [];
    el.form.modelOptions.innerHTML = list
      .map(function (model) { return '<option value="' + model + '"></option>'; })
      .join('');
  }

  function setStatus(text, tone) {
    el.form.status.textContent = text || '';
    el.form.status.dataset.tone = tone || '';
  }

  function readForm() {
    return {
      preset: el.form.preset.value,
      baseUrl: window.WDai.normalizeBase(el.form.base.value),
      apiKey: el.form.key.value.replace(/[^\x20-\x7E]/g, '').trim(),
      model: el.form.model.value.trim(),
      temperature: Number(el.form.temp.value),
      maxTokens: Number(el.form.max.value),
      persona: el.form.persona.value,
      system: el.form.system.value,
      stream: el.form.stream.checked,
      tools: el.form.tools.checked,
      searchEndpoint: el.form.search ? el.form.search.value.trim() : config.searchEndpoint || '',
      readerEndpoint: el.form.reader ? el.form.reader.value.trim() : config.readerEndpoint || ''
    };
  }

  /* 设置面板里把能力库列出来：名字 + 一句话 + 是否随人格生效 */
  function updateSkillsList() {
    if (!el.form.skillsList) return;
    var list = skills || [];
    if (!list.length) {
      el.form.skillsList.innerHTML = '<li class="wd-skills__empty">能力库还没读到。</li>';
      return;
    }
    var enabled = config.persona === 'nianzhen';
    el.form.skillsList.innerHTML = list
      .map(function (skill) {
        var usable = (skill.personas || ['*']).indexOf('*') >= 0 || (skill.personas || []).indexOf(config.persona) >= 0;
        return (
          '<li class="wd-skills__item' + (usable ? '' : ' is-off') + '">' +
          '<span class="wd-skills__icon">' + (skill.icon || '⚙') + '</span>' +
          '<span class="wd-skills__body"><strong>' + (skill.name || skill.id) + '</strong>' +
          '<em>' + (skill.summary || '') + '</em></span>' +
          '<span class="wd-skills__state">' + (usable ? (config.tools ? '已启用' : '待开工具') : '不可用') + '</span>' +
          '</li>'
        );
      })
      .join('');
    if (!enabled) {
      el.form.skillsList.innerHTML += '<li class="wd-skills__empty">这些技能只属于站内人格；通用助手和写代码的拿不到。</li>';
    }
  }

  function updateMemoryNote() {
    if (!el.form.memoryNote) return;
    if (!memory.length) {
      el.form.memoryNote.textContent = '还什么都没记下。开着工具模式聊天时，她会自己挑值得记的事。';
    } else {
      var last = memory
        .slice(-2)
        .map(function (m) { return '「' + m.text + '」'; })
        .join('、');
      el.form.memoryNote.textContent = '共 ' + memory.length + ' 条。最近的：' + last;
    }
    if (el.form.memoryClear) el.form.memoryClear.disabled = !memory.length;
  }

  function applyForm() {
    // 从手机复制粘贴时常混进中文标点/全角空格，这类字符进不了请求头
    var strippedKeyChars = (el.form.key.value.match(/[^\x20-\x7E]/g) || []).length;
    var next = readForm();
    if (!next.baseUrl) {
      setStatus('接口地址不能为空。', 'bad');
      return false;
    }
    if (!next.model) {
      setStatus('模型名不能为空。', 'bad');
      return false;
    }
    config = Object.assign({}, config, next);
    saveConfig();
    updateModelChip();
    updateTitle();
    updateWelcomePortrait();
    loadSkills().then(updateSkillsList);
    if (el.form.key.value !== next.apiKey) el.form.key.value = next.apiKey;
    setStatus(
      strippedKeyChars
        ? '已去掉 Key 里的 ' + strippedKeyChars + ' 个非 ASCII 字符（多半是中文标点或全角空格），请确认 Key 完整。'
        : '已保存。',
      strippedKeyChars ? 'bad' : 'ok'
    );
    if (config.persona === 'nianzhen') {
      loadSamples();
      loadPersona();
      loadSiteIndex();
    }
    return true;
  }

  async function testConnection() {
    var form = readForm();
    if (!form.baseUrl) {
      setStatus('先填接口地址。', 'bad');
      return;
    }
    setStatus('正在连接 ' + form.baseUrl + ' …');
    try {
      var models = await window.WDai.models({ baseUrl: form.baseUrl, apiKey: form.apiKey });
      if (models.length) {
        fillModelOptions({ models: models });
        setStatus('连接成功，接口报告了 ' + models.length + ' 个模型。', 'ok');
      } else {
        setStatus('连接成功，但接口没有返回模型列表。', 'ok');
      }
    } catch (err) {
      setStatus((err.message || '连接失败') + (err.hint ? ' · ' + err.hint : ''), 'bad');
    }
  }

  async function fetchModels() {
    var form = readForm();
    if (!form.baseUrl) {
      setStatus('先填接口地址。', 'bad');
      return;
    }
    setStatus('正在读取模型列表…');
    try {
      var models = await window.WDai.models({ baseUrl: form.baseUrl, apiKey: form.apiKey });
      if (!models.length) {
        setStatus('接口没有返回模型。', 'bad');
        return;
      }
      fillModelOptions({ models: models });
      setStatus('读到了 ' + models.length + ' 个模型，点输入框可以挑。', 'ok');
      if (!el.form.model.value) el.form.model.value = models[0];
    } catch (err) {
      setStatus((err.message || '读取失败') + (err.hint ? ' · ' + err.hint : ''), 'bad');
    }
  }

  /* ======================= 面板开关 ======================= */

  function openSheet(sheet) {
    if (!sheet) return;
    sheet.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    var focusTarget = sheet.querySelector('input, select, textarea, button');
    if (focusTarget) focusTarget.focus({ preventScroll: true });
  }

  function closeSheet(sheet) {
    if (!sheet) return;
    sheet.hidden = true;
    document.documentElement.style.overflow = '';
  }

  /* ======================= 导出 ======================= */

  function exportChat() {
    var chat = currentChat();
    if (!chat || !chat.messages.length) return;

    var lines = ['# ' + (chat.title || '新对话'), '', '> 导出自 ' + window.location.origin + window.location.pathname, ''];
    chat.messages.forEach(function (msg) {
      (msg.tools || []).forEach(function (tool) {
        lines.push('> ⚙ 工具 `' + tool.name + '(' + tool.args + ')` → ' + tool.result);
      });
      lines.push('## ' + (msg.role === 'user' ? '我' : '念真'));
      lines.push('');
      lines.push(msg.content || '');
      lines.push('');
    });

    var blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = (chat.title || 'chat').replace(/[\\/:*?"<>|]/g, '_') + '.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* ======================= 事件 ======================= */

  function bindEvents() {
    el.send.addEventListener('click', submit);
    el.stop.addEventListener('click', stopGeneration);
    el.input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        submit();
      }
    });
    el.input.addEventListener('input', function () {
      el.count.textContent = el.input.value.length + ' 字';
      el.input.style.height = 'auto';
      el.input.style.height = Math.min(el.input.scrollHeight, 132) + 'px';
    });

    document.getElementById('btn-new').addEventListener('click', newChat);
    document.getElementById('btn-chats').addEventListener('click', function () {
      renderChatList();
      openSheet(el.chatsSheet);
    });
    document.getElementById('btn-settings').addEventListener('click', function () {
      fillForm();
      setStatus('');
      openSheet(el.settingsSheet);
    });

    if (el.form.memoryClear) {
      el.form.memoryClear.addEventListener('click', function () {
        memory = [];
        saveMemory();
        updateMemoryNote();
        setStatus('记忆已清空。', 'ok');
      });
    }

    var hardReloadBtn = document.getElementById('cfg-hard-reload');
    if (hardReloadBtn) {
      hardReloadBtn.addEventListener('click', function () {
        hardReloadBtn.disabled = true;
        hardReloadBtn.textContent = '刷新中…';
        setStatus('正在清理缓存并重载…', '');
        hardReload({});
      });
    }

    Array.prototype.forEach.call(document.querySelectorAll('[data-close-sheet]'), function (node) {
      node.addEventListener('click', function () {
        closeSheet(el.settingsSheet);
        closeSheet(el.chatsSheet);
      });
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        closeSheet(el.settingsSheet);
        closeSheet(el.chatsSheet);
      }
    });

    // 欢迎屏的人格与快捷话题
    el.personas.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-persona]');
      if (!btn) return;
      config.persona = btn.getAttribute('data-persona');
      saveConfig();
      syncPersonaButtons();
      updateTitle();
      updateWelcomePortrait();
      if (config.persona === 'nianzhen') {
        loadSamples();
        loadPersona();
        loadSiteIndex();
        loadSkills();
        loadPersona().then(updateWelcomePortrait);
      }
    });

    el.suggestions.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-prompt]');
      if (!btn) return;
      el.input.value = btn.getAttribute('data-prompt');
      el.input.dispatchEvent(new Event('input'));
      submit();
    });

    // 代码块复制
    el.chat.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-copy]');
      if (!btn) return;
      var block = btn.closest('.wd-code-block');
      var code = block ? block.querySelector('code') : null;
      if (!code) return;
      var text = code.textContent;
      var done = function () {
        btn.textContent = '已复制';
        setTimeout(function () { btn.textContent = '复制'; }, 1400);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(done);
      } else {
        done();
      }
    });

    // 设置表单
    el.form.preset.addEventListener('change', function () {
      var preset = window.WDai.presets.filter(function (p) { return p.id === el.form.preset.value; })[0];
      if (!preset) return;
      el.form.base.value = preset.baseUrl;
      if (preset.models && preset.models.length) el.form.model.value = preset.models[0];
      el.form.presetNote.textContent = preset.note;
      fillModelOptions(preset);
      setStatus('');
    });

    el.form.temp.addEventListener('input', function () {
      el.form.tempOut.textContent = Number(el.form.temp.value).toFixed(1);
    });
    el.form.max.addEventListener('input', function () {
      el.form.maxOut.textContent = el.form.max.value;
    });

    el.form.save.addEventListener('click', function () {
      if (applyForm()) {
        closeSheet(el.settingsSheet);
        el.input.focus();
      }
    });
    el.form.test.addEventListener('click', testConnection);
    el.form.models.addEventListener('click', fetchModels);

    el.form.clear.addEventListener('click', function () {
      el.form.key.value = '';
      config.apiKey = '';
      saveConfig();
      setStatus('Key 已从本机清空。', 'ok');
    });

    document.getElementById('chats-new').addEventListener('click', newChat);
    document.getElementById('chats-export').addEventListener('click', exportChat);
  }

  function syncPersonaButtons() {
    Array.prototype.forEach.call(el.personas.querySelectorAll('[data-persona]'), function (btn) {
      btn.setAttribute('aria-pressed', String(btn.getAttribute('data-persona') === config.persona));
    });
  }

  function submit() {
    var text = el.input.value.trim();
    if (!text || sending) return;

    if (!config.baseUrl || !config.model) {
      openSheet(el.settingsSheet);
      fillForm();
      setStatus('先配一个接口和模型，再说话。', 'bad');
      return;
    }

    el.input.value = '';
    el.input.style.height = 'auto';
    el.count.textContent = '0 字';
    el.send.disabled = true;
    speak(text);
  }

  /* ======================= 启动 ======================= */

  /* 强制刷新：聊天页是独立页面，主站的「刷新缓存」按钮照顾不到它 */
  function hardReload(options) {
    options = options || {};
    var jobs = [];

    if ('caches' in window) {
      jobs.push(
        caches.keys().then(function (keys) {
          return Promise.all(
            keys.map(function (key) {
              return caches.delete(key);
            })
          );
        })
      );
    }

    if ('serviceWorker' in navigator) {
      jobs.push(
        navigator.serviceWorker.getRegistrations().then(function (regs) {
          return Promise.all(
            regs.map(function (reg) {
              return reg.unregister();
            })
          );
        })
      );
    }

    return Promise.all(jobs)
      .catch(function () {
        /* 清不掉也继续，顶多还是旧缓存 */
      })
      .then(function () {
        if (options.navigate === false) return true;
        var url = new URL(window.location.href);
        url.searchParams.set('v', String(Date.now()));
        window.location.replace(url.toString());
        return true;
      });
  }

  window.wxChatHardReload = hardReload;

  function boot() {
    bindEvents();
    updateModelChip();
    syncPersonaButtons();
    updateWelcomePortrait();
    renderChatList();
    renderChat();
    if (config.persona === 'nianzhen') {
      loadSamples();
      loadSiteIndex();
      loadSkills();
      // 头像与自画像在人格模块里，到货后重画一遍
      loadPersona().then(function () {
        updateWelcomePortrait();
        if (sending) return;
        var chat = currentChat();
        if (chat && chat.messages.length) renderChat();
      });
    }

    // 没有配好模型时，第一次进来直接把设置打开，别让人对着输入框发呆
    if (!config.apiKey && !/ollama|localhost|127\.0\.0\.1/.test(config.baseUrl || '')) {
      setTimeout(function () {
        if (!currentChat() || !currentChat().messages.length) {
          fillForm();
          setStatus('第一次用：填一个 Key，或者把接口换成本机的 Ollama。', '');
          openSheet(el.settingsSheet);
        }
      }, 400);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
