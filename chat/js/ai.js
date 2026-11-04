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
    tools: false
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
    return Object.assign({}, DEFAULT_CONFIG, readJSON(CONFIG_KEY, {}));
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

  function appendAssistantNode(msg) {
    var row = document.createElement('div');
    row.className = 'wd-msg';

    var avatar = document.createElement('div');
    avatar.className = 'wd-msg__avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = avatarText();

    var body = document.createElement('div');
    body.className = 'wd-msg__body';

    (msg.tools || []).forEach(function (tool) {
      body.appendChild(toolCard(tool));
    });

    // 助手回复统一装进气泡，形状照「念真」的来客气泡
    var bubble = document.createElement('div');
    bubble.className = 'wd-msg__bubble wd-msg__bubble--ai';

    var content = document.createElement('div');
    content.className = 'wd-msg__content';
    content.innerHTML = window.WDMarkdown.render(msg.content || '');
    bubble.appendChild(content);
    body.appendChild(bubble);

    row.appendChild(avatar);
    row.appendChild(body);
    el.chat.appendChild(row);

    return { row: row, content: content, body: body, bubble: bubble };
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
    var label = document.createElement('span');
    label.textContent = '⚙ 本地工具';
    var name = document.createElement('code');
    name.textContent = tool.name + '(' + (tool.args || '') + ')';
    var result = document.createElement('code');
    result.textContent = '→ ' + (tool.result || '');
    node.appendChild(label);
    node.appendChild(name);
    node.appendChild(result);
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

  /* ======================= 人格 ======================= */

  function effectiveSystem() {
    if (config.system && config.system.trim()) return config.system.trim();
    if (config.persona === 'nianzhen') {
      return NIANZHEN_PROMPT.replace('{{samples}}', samples || '（暂时没读到样本，按上面的语气自己把握）');
    }
    return PERSONA_PROMPTS[config.persona] || PERSONA_PROMPTS.assistant;
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

  function runTool(call) {
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

  function buildApiMessages(extra) {
    var list = [{ role: 'system', content: effectiveSystem() }];
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

    var reply = { role: 'assistant', content: '', tools: [], ts: Date.now() };
    var node = appendAssistantNode(reply);
    node.content.innerHTML = typingMarkup();
    chat.messages.push(reply);
    scrollToBottom();

    var stick = nearBottom();
    var renderQueued = false;

    function paint() {
      renderQueued = false;
      if (reply.content) {
        node.content.innerHTML = window.WDMarkdown.render(reply.content);
        node.content.classList.add('is-streaming');
      } else {
        // 还没吐字，就继续亮着三个点
        node.content.innerHTML = typingMarkup();
      }
      if (stick) scrollToBottom();
    }

    function queuePaint() {
      if (renderQueued) return;
      renderQueued = true;
      requestAnimationFrame(paint);
    }

    controller = new AbortController();
    sending = true;
    updateSendUI(true);

    try {
      var apiMessages = buildApiMessages([{ role: 'user', content: userText }]);
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
          tools: config.tools ? TOOLS : null,
          signal: controller.signal,
          onDelta: function (delta) {
            reply.content += delta;
            queuePaint();
          }
        });

        if (result.toolCalls && result.toolCalls.length) {
          apiMessages.push({
            role: 'assistant',
            content: result.content || '',
            tool_calls: result.toolCalls
          });

          var calls = result.toolCalls.map(runTool);
          result.toolCalls.forEach(function (call, index) {
            var applied = calls[index];
            reply.tools.push({ name: applied.name, args: applied.args, result: applied.result });
            node.body.insertBefore(toolCard(applied), node.content);
            apiMessages.push({
              role: 'tool',
              tool_call_id: call.id || 'call_' + index,
              content: JSON.stringify(applied.payload)
            });
          });

          if (result.content) {
            reply.content += result.content;
            queuePaint();
          }
          scrollToBottom();
          continue;
        }

        if (result.content && !reply.content) reply.content = result.content;
        break;
      }

      if (!reply.content) reply.content = '（模型没有返回内容，可能是被截断或触发了内容过滤。）';
      node.content.innerHTML = window.WDMarkdown.render(reply.content);
      node.content.classList.remove('is-streaming');
      chat.updatedAt = Date.now();
      reply.ts = Date.now();
      saveChats();
      renderChatList();
    } catch (err) {
      node.content.classList.remove('is-streaming');
      node.content.innerHTML = window.WDMarkdown.render(reply.content || '');
      // 一个字都没拿到时，别留一个空气泡，错误卡自己会说明
      if (!reply.content) node.bubble.hidden = true;

      var box = document.createElement('div');
      box.className = 'wd-error';
      var title = document.createElement('strong');
      title.textContent = err && err.name === 'AbortError' ? '已停止' : '请求失败';
      var lines = document.createElement('span');
      lines.textContent = (err && err.message ? err.message : '未知错误') + (err && err.hint ? ' · ' + err.hint : '');
      box.appendChild(title);
      box.appendChild(lines);

      var retry = document.createElement('button');
      retry.type = 'button';
      retry.textContent = '打开设置';
      retry.addEventListener('click', function () {
        openSheet(el.settingsSheet);
      });
      box.appendChild(retry);
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
    el.form.stream.checked = config.stream !== false;
    el.form.tools.checked = Boolean(config.tools);
    el.form.presetNote.textContent = preset ? preset.note : '';
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
      apiKey: el.form.key.value.trim(),
      model: el.form.model.value.trim(),
      temperature: Number(el.form.temp.value),
      maxTokens: Number(el.form.max.value),
      persona: el.form.persona.value,
      system: el.form.system.value,
      stream: el.form.stream.checked,
      tools: el.form.tools.checked
    };
  }

  function applyForm() {
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
    setStatus('已保存。', 'ok');
    if (config.persona === 'nianzhen') loadSamples();
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
      if (config.persona === 'nianzhen') loadSamples();
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

  function boot() {
    bindEvents();
    updateModelChip();
    syncPersonaButtons();
    renderChatList();
    renderChat();
    if (config.persona === 'nianzhen') loadSamples();

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
