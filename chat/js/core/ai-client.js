/**
 * OpenAI 兼容接口的最小客户端
 * ---------------------------------------------------------------------------
 * 只做一件事：把「一句话 + 聊天记录」发出去，把流式返回的增量吐回来。
 * 支持任何遵循 /v1/chat/completions 的服务（DeepSeek、OpenAI、硅基流动、
 * OpenRouter、Ollama、vLLM、自己的 Worker 代理……）。
 *
 * 关于 Key：请求由浏览器直接发往你填的地址，本站没有后端，也不经手任何数据。
 * 因此也可以用「代理地址」把一个不带 Key 的 Worker 填进来，自己决定额度策略。
 */

(function (global) {
  'use strict';

  var PRESETS = [
    {
      id: 'deepseek',
      name: 'DeepSeek',
      baseUrl: 'https://api.deepseek.com/v1',
      models: ['deepseek-flash', 'deepseek-v4-pro'],
      note: '官方接口对浏览器直连的 CORS 支持不稳定，必要时把「代理地址」填成自己的 Worker。'
    },
    {
      id: 'openai',
      name: 'OpenAI',
      baseUrl: 'https://api.openai.com/v1',
      models: ['gpt-4o-mini', 'gpt-4.1-mini', 'gpt-4.1'],
      note: '官方接口不允许浏览器直接调用（CORS），请填代理地址，或换一个允许直连的服务。'
    },
    {
      id: 'siliconflow',
      name: '硅基流动',
      baseUrl: 'https://api.siliconflow.cn/v1',
      models: ['deepseek-ai/DeepSeek-V3', 'Qwen/Qwen2.5-72B-Instruct', 'THUDM/glm-4-9b-chat'],
      note: '国内直连，通常可以直接用。'
    },
    {
      id: 'openrouter',
      name: 'OpenRouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      models: ['deepseek/deepseek-chat-v3-0324:free', 'google/gemini-2.0-flash-001'],
      note: '支持浏览器直连；:free 结尾的模型有速率限制。'
    },
    {
      id: 'ollama',
      name: 'Ollama（本机）',
      baseUrl: 'http://localhost:11434/v1',
      models: ['qwen2.5:7b', 'llama3.1:8b', 'gemma2:9b'],
      note: '需要设置 OLLAMA_ORIGINS 允许本站来源，例如 OLLAMA_ORIGINS=* 。本机模型不需要 Key。'
    },
    {
      id: 'custom',
      name: '自定义 / 代理',
      baseUrl: '',
      models: [],
      note: '填任何 OpenAI 兼容的地址。若地址以 /v1 结尾，这里会自动补上 /chat/completions。'
    }
  ];

  function normalizeBase(input) {
    var base = String(input || '').trim();
    base = base.replace(/\/+$/, '');
    base = base.replace(/\/chat\/completions$/i, '');
    return base;
  }

  function friendlyError(err, config) {
    var message = err && err.message ? err.message : String(err);
    var status = err && err.status;
    var hint = '';

    if (err && err.name === 'AbortError') {
      hint = '已停止。';
    } else if (/Failed to fetch|NetworkError|Load failed/i.test(message)) {
      hint =
        '请求没有到达服务器，最常见的原因是 CORS 或地址写错。' +
        '大多数厂商的官方接口不允许浏览器直连，可以填自己的代理地址再试。';
    } else if (status === 401 || status === 403) {
      hint = 'Key 无效或没有权限。检查一下 Key、以及它属于哪个服务商。';
    } else if (status === 404) {
      hint = '地址或模型名不对。确认「接口地址」是 …/v1，模型名和提供方一致。';
    } else if (status === 429) {
      hint = '触发了限流或额度用尽，等一会儿再试，或者换一个模型。';
    } else if (status >= 500) {
      hint = '服务端出错了，这通常不是你的配置问题，稍后再试。';
    } else if (status === 400) {
      hint = '请求被拒绝：可能是模型名不对、上下文太长，或该服务不支持工具调用。';
    }

    var error = new Error(message);
    error.status = status;
    error.hint = hint;
    error.config = config;
    return error;
  }

  async function readError(response) {
    var text = '';
    try {
      text = await response.text();
    } catch (e) {
      text = '';
    }
    var message = '';
    if (text) {
      try {
        var body = JSON.parse(text);
        message = (body.error && (body.error.message || body.error.code)) || body.message || text;
      } catch (e) {
        message = text.slice(0, 400);
      }
    }
    var error = new Error(message || 'HTTP ' + response.status);
    error.status = response.status;
    return error;
  }

  function parseChunk(payload, state) {
    var choice = payload.choices && payload.choices[0];
    if (!choice) return;

    var delta = choice.delta || choice.message || {};
    if (delta.content) {
      state.content += delta.content;
      if (state.onDelta) state.onDelta(delta.content);
    }

    (delta.tool_calls || []).forEach(function (call) {
      var index = call.index == null ? 0 : call.index;
      if (!state.toolCalls[index]) {
        state.toolCalls[index] = { id: '', type: 'function', function: { name: '', arguments: '' } };
      }
      var slot = state.toolCalls[index];
      if (call.id) slot.id = call.id;
      if (call.function) {
        if (call.function.name) slot.function.name += call.function.name;
        if (call.function.arguments) slot.function.arguments += call.function.arguments;
      }
    });

    if (choice.finish_reason) state.finishReason = choice.finish_reason;
    if (payload.usage) state.usage = payload.usage;
  }

  function cleanToolCalls(list) {
    return (list || []).filter(Boolean).map(function (call) {
      return {
        id: call.id || 'call_' + Math.random().toString(36).slice(2, 8),
        type: 'function',
        function: {
          name: call.function && call.function.name,
          arguments: call.function && call.function.arguments ? call.function.arguments : '{}'
        }
      };
    });
  }

  /**
   * @param {object} options
   * @param {string} options.baseUrl
   * @param {string} options.apiKey
   * @param {string} options.model
   * @param {Array}  options.messages
   * @param {Array}  [options.tools]
   * @param {boolean}[options.stream=true]
   * @param {number} [options.temperature]
   * @param {number} [options.maxTokens]
   * @param {AbortSignal} [options.signal]
   * @param {(text:string)=>void} [options.onDelta]
   * @returns {Promise<{content:string, toolCalls:Array, usage:object, finishReason:string}>}
   */
  async function chat(options) {
    var base = normalizeBase(options.baseUrl);
    if (!base) throw friendlyError(new Error('还没有填接口地址'), options);

    var body = {
      model: options.model,
      messages: options.messages,
      stream: options.stream !== false
    };
    if (typeof options.temperature === 'number') body.temperature = options.temperature;
    if (typeof options.maxTokens === 'number' && options.maxTokens > 0) body.max_tokens = options.maxTokens;
    if (options.tools && options.tools.length) {
      body.tools = options.tools;
      body.tool_choice = 'auto';
    }

    var headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
    if (options.apiKey) headers.Authorization = 'Bearer ' + options.apiKey;

    var response;
    try {
      response = await fetch(base + '/chat/completions', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body),
        signal: options.signal
      });
    } catch (err) {
      throw friendlyError(err, options);
    }

    if (!response.ok) {
      throw friendlyError(await readError(response), options);
    }

    var state = {
      content: '',
      toolCalls: [],
      usage: null,
      finishReason: '',
      onDelta: options.onDelta
    };

    // 有些代理会说 stream:true 但返回一整个 JSON
    var contentType = response.headers.get('content-type') || '';
    if (options.stream === false || contentType.indexOf('text/event-stream') === -1) {
      var payload;
      try {
        payload = await response.json();
      } catch (err) {
        throw friendlyError(new Error('返回的不是 JSON，可能是代理地址指向了网页'), options);
      }
      var choice = payload.choices && payload.choices[0];
      var message = (choice && choice.message) || {};
      state.content = message.content || '';
      state.toolCalls = cleanToolCalls(message.tool_calls);
      state.usage = payload.usage || null;
      if (state.content && state.onDelta) state.onDelta(state.content);
      return state;
    }

    var reader = response.body.getReader();
    var decoder = new TextDecoder('utf-8');
    var buffer = '';

    try {
      while (true) {
        var chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });

        var lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (var i = 0; i < lines.length; i++) {
          var line = lines[i].trim();
          if (!line || line.indexOf('data:') !== 0) continue;
          var data = line.slice(5).trim();
          if (data === '[DONE]') continue;
          try {
            parseChunk(JSON.parse(data), state);
          } catch (e) {
            // 个别服务会插注释行或 keep-alive，忽略解析不了的行
          }
        }
      }
    } catch (err) {
      if (err && err.name === 'AbortError') {
        state.finishReason = 'aborted';
        return state;
      }
      throw friendlyError(err, options);
    }

    state.toolCalls = cleanToolCalls(state.toolCalls);
    return state;
  }

  async function listModels(options) {
    var base = normalizeBase(options.baseUrl);
    if (!base) throw friendlyError(new Error('还没有填接口地址'), options);
    var headers = { Accept: 'application/json' };
    if (options.apiKey) headers.Authorization = 'Bearer ' + options.apiKey;

    var response;
    try {
      response = await fetch(base + '/models', { headers: headers, signal: options.signal });
    } catch (err) {
      throw friendlyError(err, options);
    }
    if (!response.ok) throw friendlyError(await readError(response), options);

    var payload = await response.json();
    var list = (payload.data || payload.models || []).map(function (item) {
      return typeof item === 'string' ? item : item.id || item.name;
    });
    return list.filter(Boolean);
  }

  global.WDai = {
    presets: PRESETS,
    chat: chat,
    models: listModels,
    normalizeBase: normalizeBase
  };
})(window);
