/**
 * 极简剧情运行时（给「对话游戏」用）
 * ---------------------------------------------------------------------------
 * 为什么自己写：这个站是纯静态、无构建的。为了一个 15 分钟的聊天游戏引入
 * inkle/ink + 编译步骤，体积和维护成本都不划算。这里的语法是「扁平节点 +
 * 变量 + 条件 + 结局」，思想借鉴了 ink 的 knot/stitch 与 Yarn Spinner 的
 * 变量系统，但只保留聊天式叙事真正用得到的部分。
 *
 * 剧本文件格式（JSON）：
 *
 * {
 *   "meta":    { "id", "title", "subtitle", "start", "author", "credits" },
 *   "vars":    { "close": 0, "truth": false },
 *   "endings": { "e_warm": { "title", "summary", "quote" } },
 *   "nodes": {
 *     "n0": {
 *       "time": "02:17",                  // 可选：给这条消息打时间戳
 *       "messages": [
 *         "直接写字符串就是对方发的消息",
 *         { "who": "them", "text": "还醒着吗？", "typing": 900 },
 *         { "who": "system", "text": "柚子 上线了" },
 *         { "who": "them", "image": "img/photo-1.jpg", "caption": "旧照片" }
 *       ],
 *       "choices": [                      // 二选一或更多
 *         { "text": "在的。", "goto": "n1", "set": { "close": "+=1" } },
 *         { "text": "你是谁？", "goto": "n2", "when": "close < 2" }
 *       ],
 *       "next": "n1",                     // 没有 choices 时自动继续
 *       "branch": [                       // 更复杂的自动跳转
 *         { "when": "truth && close >= 3", "goto": "n9" },
 *         { "goto": "n10" }
 *       ],
 *       "end": "e_warm",                  // 该节点即结局
 *       "set": { "met": true }            // 进入节点时结算
 *     }
 *   }
 * }
 *
 * 条件表达式是安全的（不 eval），支持：数字 / 字符串 / true / false / 变量名、
 * 比较（> >= < <= == !=）、逻辑（&& || !）和括号。
 */

(function (global) {
  'use strict';

  /* ======================= 表达式 ======================= */

  var OPERATORS = ['>=', '<=', '==', '!=', '&&', '||', '>', '<', '!', '(', ')'];

  function tokenize(src) {
    var tokens = [];
    var i = 0;
    while (i < src.length) {
      var ch = src[i];

      if (/\s/.test(ch)) {
        i++;
        continue;
      }

      var op = null;
      for (var k = 0; k < OPERATORS.length; k++) {
        if (src.startsWith(OPERATORS[k], i)) {
          op = OPERATORS[k];
          break;
        }
      }
      if (op) {
        tokens.push({ type: 'op', value: op });
        i += op.length;
        continue;
      }

      if (ch === '"' || ch === "'") {
        var quote = ch;
        var j = i + 1;
        var buf = '';
        while (j < src.length && src[j] !== quote) {
          if (src[j] === '\\' && j + 1 < src.length) {
            buf += src[j + 1];
            j += 2;
          } else {
            buf += src[j];
            j++;
          }
        }
        if (j >= src.length) throw new Error('字符串没有闭合：' + src);
        tokens.push({ type: 'value', value: buf });
        i = j + 1;
        continue;
      }

      var num = /^-?\d+(\.\d+)?/.exec(src.slice(i));
      if (num) {
        tokens.push({ type: 'value', value: Number(num[0]) });
        i += num[0].length;
        continue;
      }

      var id = /^[A-Za-z_$][\w$]*/.exec(src.slice(i));
      if (id) {
        var word = id[0];
        if (word === 'true') tokens.push({ type: 'value', value: true });
        else if (word === 'false') tokens.push({ type: 'value', value: false });
        else if (word === 'null') tokens.push({ type: 'value', value: null });
        else tokens.push({ type: 'ident', value: word });
        i += word.length;
        continue;
      }

      throw new Error('无法识别的字符：' + ch + '（在 ' + src + ' 里）');
    }
    return tokens;
  }

  function parseExpression(src) {
    var tokens = tokenize(src);
    var pos = 0;

    function peek() {
      return tokens[pos];
    }
    function eat(value) {
      var t = tokens[pos];
      if (!t || t.value !== value) throw new Error('期望 “' + value + '”，实际是 “' + (t ? t.value : '结尾') + '”');
      pos++;
      return t;
    }
    function isOp(v) {
      var t = peek();
      return t && t.type === 'op' && t.value === v;
    }

    function parseOr() {
      var left = parseAnd();
      while (isOp('||')) {
        eat('||');
        var right = parseAnd();
        left = { type: 'or', left: left, right: right };
      }
      return left;
    }

    function parseAnd() {
      var left = parseCompare();
      while (isOp('&&')) {
        eat('&&');
        var right = parseCompare();
        left = { type: 'and', left: left, right: right };
      }
      return left;
    }

    function parseCompare() {
      var left = parseUnary();
      var ops = ['>=', '<=', '==', '!=', '>', '<'];
      for (var k = 0; k < ops.length; k++) {
        if (isOp(ops[k])) {
          var op = ops[k];
          eat(op);
          var right = parseUnary();
          return { type: 'compare', op: op, left: left, right: right };
        }
      }
      return left;
    }

    function parseUnary() {
      if (isOp('!')) {
        eat('!');
        return { type: 'not', value: parseUnary() };
      }
      return parsePrimary();
    }

    function parsePrimary() {
      var t = peek();
      if (!t) throw new Error('表达式不完整：' + src);
      if (t.type === 'value') {
        pos++;
        return { type: 'literal', value: t.value };
      }
      if (t.type === 'ident') {
        pos++;
        return { type: 'var', name: t.value };
      }
      if (t.type === 'op' && t.value === '(') {
        eat('(');
        var expr = parseOr();
        eat(')');
        return expr;
      }
      throw new Error('表达式里多了一个 “' + t.value + '”');
    }

    var ast = parseOr();
    if (pos < tokens.length) throw new Error('表达式没有解析完：' + src);
    return ast;
  }

  function evaluate(ast, vars) {
    switch (ast.type) {
      case 'literal':
        return ast.value;
      case 'var':
        return vars[ast.name];
      case 'not':
        return !evaluate(ast.value, vars);
      case 'and':
        return Boolean(evaluate(ast.left, vars)) && Boolean(evaluate(ast.right, vars));
      case 'or':
        return Boolean(evaluate(ast.left, vars)) || Boolean(evaluate(ast.right, vars));
      case 'compare': {
        var a = evaluate(ast.left, vars);
        var b = evaluate(ast.right, vars);
        switch (ast.op) {
          case '>=': return a >= b;
          case '<=': return a <= b;
          case '>': return a > b;
          case '<': return a < b;
          case '==': return a === b;
          case '!=': return a !== b;
          default: return false;
        }
      }
      default:
        return undefined;
    }
  }

  var astCache = Object.create(null);

  function checkCondition(src, vars) {
    if (src == null || src === '') return true;
    if (String(src).trim() === 'true') return true;
    if (String(src).trim() === 'false') return false;
    try {
      if (!astCache[src]) astCache[src] = parseExpression(String(src));
      return Boolean(evaluate(astCache[src], vars));
    } catch (e) {
      // 剧本写错了不应该白屏：当成「不满足」，并在控制台留下线索
      if (global.console) console.warn('[narrative] 条件解析失败：', src, e.message);
      return false;
    }
  }

  /* ======================= 变量写入 ======================= */

  function applySet(effects, vars) {
    if (!effects) return;
    Object.keys(effects).forEach(function (key) {
      var raw = effects[key];
      if (typeof raw === 'number' || typeof raw === 'boolean') {
        vars[key] = raw;
        return;
      }
      var text = String(raw).trim();
      var delta = /^([+-])=?\s*(-?\d+(?:\.\d+)?)$/.exec(text);
      if (delta) {
        var current = Number(vars[key]) || 0;
        vars[key] = current + (delta[1] === '-' ? -Number(delta[2]) : Number(delta[2]));
        return;
      }
      if (text.charAt(0) === '=') {
        var literal = text.slice(1).trim();
        if (literal === 'true') vars[key] = true;
        else if (literal === 'false') vars[key] = false;
        else if (literal === 'null') vars[key] = null;
        else if (/^-?\d+(\.\d+)?$/.test(literal)) vars[key] = Number(literal);
        else vars[key] = literal.replace(/^['"]|['"]$/g, '');
        return;
      }
      // 不认识的写法就原样存着，别把作者的意图吃掉
      vars[key] = raw;
    });
  }

  /* ======================= 运行时 ======================= */

  function Story(data, handlers) {
    this.data = data;
    this.handlers = handlers || {};
    this.speed = 1; // 1 = 正常，0 = 立刻（「快速模式」）
    this.token = 0;
    this.timers = [];
    this.nodeId = null;
    this.ending = null;
    this.choices = [];
    this.finished = false;
    this.vars = clone(data.vars || {});
    this.messages = [];
    this.snapshots = [];
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj || {}));
  }

  Story.prototype.text = function (tpl) {
    if (typeof tpl !== 'string') return '';
    var vars = this.vars;
    return tpl.replace(/\{\{\s*([\w$]+)\s*\}\}/g, function (_, name) {
      return vars[name] == null ? '' : String(vars[name]);
    });
  };

  Story.prototype.normMessage = function (raw) {
    var msg = typeof raw === 'string' ? { who: 'them', text: raw } : Object.assign({}, raw);
    msg.who = msg.who || 'them';
    msg.text = this.text(msg.text || '');
    msg.caption = msg.caption ? this.text(msg.caption) : '';
    return msg;
  };

  Story.prototype.sleep = function (ms) {
    var self = this;
    if (this.speed <= 0 || !ms) return Promise.resolve();
    var wait = ms / this.speed;
    return new Promise(function (resolve) {
      var id = setTimeout(function () {
        self.timers = self.timers.filter(function (t) { return t !== id; });
        resolve();
      }, wait);
      self.timers.push(id);
    });
  };

  Story.prototype.clearTimers = function () {
    this.timers.forEach(function (id) { clearTimeout(id); });
    this.timers = [];
  };

  Story.prototype.emit = function (name) {
    var fn = this.handlers[name];
    if (typeof fn === 'function') {
      var args = Array.prototype.slice.call(arguments, 1);
      try {
        fn.apply(this, args);
      } catch (e) {
        if (global.console) console.error('[narrative] handler ' + name + ' 出错：', e);
      }
    }
  };

  Story.prototype.reset = function () {
    this.token++;
    this.clearTimers();
    this.vars = clone(this.data.vars || {});
    this.messages = [];
    this.snapshots = [];
    this.ending = null;
    this.choices = [];
    this.finished = false;
    this.nodeId = null;
  };

  Story.prototype.start = function () {
    this.reset();
    this.goto(this.data.meta && this.data.meta.start ? this.data.meta.start : this.data.start);
  };

  Story.prototype.goto = function (nodeId) {
    var node = this.data.nodes[nodeId];
    if (!node) {
      if (global.console) console.error('[narrative] 找不到节点：' + nodeId);
      this.emit('onEnding', null, this.getState());
      return;
    }

    var token = ++this.token;
    var self = this;
    this.nodeId = nodeId;
    applySet(node.set, this.vars);

    var queue = (node.messages || []).map(function (m) { return self.normMessage(m); });
    var baseDelay = typeof node.delay === 'number' ? node.delay : 420;

    function step(index) {
      if (token !== self.token) return; // 已经重启/回退了
      if (index >= queue.length) return done();
      var msg = queue[index];
      var typing = msg.typing == null
        ? (msg.who === 'them' ? Math.min(1500, 260 + msg.text.length * 42) : 0)
        : msg.typing;
      if (typing > 0) self.emit('onTyping', msg.who, typing);
      self.sleep(typing + (node.delay == null ? baseDelay : 0)).then(function () {
        if (token !== self.token) return;
        self.emit('onTyping', null, 0);
        if (node.time && index === 0) self.emit('onTime', node.time);
        self.messages.push(msg);
        self.emit('onMessage', msg, self.messages.length - 1);
        step(index + 1);
      });
    }

    function done() {
      if (token !== self.token) return;

      if (node.end && self.data.endings && self.data.endings[node.end]) {
        self.finished = true;
        self.ending = Object.assign({ id: node.end }, self.data.endings[node.end]);
        self.choices = [];
        self.emit('onChoices', []);
        self.emit('onEnding', self.ending, self.getState());
        return;
      }

      var options = (node.choices || []).filter(function (choice) {
        return checkCondition(choice.when, self.vars);
      });

      if (options.length) {
        self.choices = options;
        self.emit('onChoices', options);
        return;
      }

      self.choices = [];
      self.emit('onChoices', []);

      if (node.branch && node.branch.length) {
        for (var i = 0; i < node.branch.length; i++) {
          if (checkCondition(node.branch[i].when, self.vars)) {
            self.goto(node.branch[i].goto);
            return;
          }
        }
      }

      if (node.next) {
        self.goto(node.next);
        return;
      }

      self.finished = true;
      self.emit('onEnding', null, self.getState());
    }

    step(0);
  };

  Story.prototype.choose = function (index) {
    var choice = this.choices[index];
    if (!choice || this.finished) return;

    this.snapshots.push({
      nodeId: this.nodeId,
      vars: clone(this.vars),
      messageCount: this.messages.length
    });
    if (this.snapshots.length > 40) this.snapshots.shift();

    this.choices = [];
    this.emit('onChoices', []);

    var self = this;
    var token = this.token;

    if (!choice.silent) {
      // 选项本身就是「我」说出口的那句话（除非作者标了 silent）
      var line = this.normMessage({ who: 'me', text: choice.line || choice.text });
      this.sleep(120).then(function () {
        if (token !== self.token) return;
        self.messages.push(line);
        self.emit('onMessage', line, self.messages.length - 1);
        self.sleep(300).then(function () {
          if (token !== self.token) return;
          applySet(choice.set, self.vars);
          self.goto(choice.goto || choice.next);
        });
      });
      return;
    }

    applySet(choice.set, this.vars);
    this.goto(choice.goto || choice.next);
  };

  Story.prototype.canRewind = function () {
    return this.snapshots.length > 0;
  };

  /**
   * 回到某个节点，但不重播它的消息——因为那几句刚刚还在屏幕上。
   * 只把选项重新列出来。
   */
  Story.prototype.resumeAt = function (nodeId) {
    var node = this.data.nodes[nodeId];
    if (!node) return false;
    this.token++;
    this.clearTimers();
    this.nodeId = nodeId;
    this.finished = false;
    this.ending = null;

    var options = (node.choices || []).filter(function (choice) {
      return checkCondition(choice.when, this.vars);
    }, this);

    this.choices = options;
    this.emit('onChoices', options);
    return true;
  };

  Story.prototype.rewind = function () {
    var snap = this.snapshots.pop();
    if (!snap) return null;
    this.messages = this.messages.slice(0, snap.messageCount);
    this.vars = clone(snap.vars);
    this.resumeAt(snap.nodeId);
    return { nodeId: snap.nodeId, messageCount: snap.messageCount };
  };

  Story.prototype.getState = function () {
    return {
      nodeId: this.nodeId,
      vars: clone(this.vars),
      ending: this.ending,
      finished: this.finished,
      messageCount: this.messages.length,
      canRewind: this.canRewind()
    };
  };

  /**
   * 从存档恢复：消息内容原样还原（不再插值），然后停在选项上。
   * 若存档停在结局，则直接还原结局。
   */
  Story.prototype.resume = function (save) {
    if (!save || !save.nodeId) return false;
    this.reset();
    this.vars = clone(save.vars || {});
    this.messages = clone(save.messages || []);
    this.snapshots = clone(save.snapshots || []);
    this.nodeId = save.nodeId;

    if (save.finished && save.ending && this.data.endings && this.data.endings[save.ending.id || save.ending]) {
      var id = save.ending.id || save.ending;
      this.finished = true;
      this.ending = Object.assign({ id: id }, this.data.endings[id]);
      this.choices = [];
      this.emit('onChoices', []);
      this.emit('onEnding', this.ending, this.getState());
      return true;
    }

    return this.resumeAt(save.nodeId);
  };

  global.WDNarrative = {
    Story: Story,
    check: checkCondition,
    applySet: applySet,
    parse: parseExpression
  };
})(window);
