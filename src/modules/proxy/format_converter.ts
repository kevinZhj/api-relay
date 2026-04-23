// OpenAI 格式 ↔ Anthropic 格式 转换器
// Kimi Code API 只支持 Anthropic 格式，需要把 OpenAI 请求转换后转发
// 完整支持 tools/function_calls 的双向转换

// ─── OpenAI 请求 → Anthropic 请求 ───
export const openaiToAnthropic = (openaiBody: any): any => {
  const messages = openaiBody.messages || []
  let system: string | undefined
  const converted: any[] = []

  for (const msg of messages) {
    if (msg.role === 'system') {
      system = system ? system + '\n' + msg.content : msg.content
    } else if (msg.role === 'assistant') {
      // 处理 assistant 消息中的 tool_calls
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        const content: any[] = []
        // 如果有文本内容，先加入文本块
        if (msg.content) {
          content.push({ type: 'text', text: msg.content })
        }
        // 转换每个 tool_call 为 tool_use content block
        for (const tc of msg.tool_calls) {
          content.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.function.name,
            input: parseJson(tc.function.arguments),
          })
        }
        converted.push({ role: 'assistant', content })
      } else {
        converted.push({ role: 'assistant', content: msg.content })
      }
    } else if (msg.role === 'user') {
      converted.push({ role: 'user', content: msg.content })
    } else if (msg.role === 'tool') {
      // tool 消息转为 user 消息中的 tool_result content block
      converted.push({
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: msg.tool_call_id,
          content: msg.content,
        }],
      })
    }
  }

  const anthropic: any = {
    model: openaiBody.model,
    messages: converted,
    max_tokens: openaiBody.max_tokens || 16384,
  }
  if (system) anthropic.system = system
  if (openaiBody.stream) anthropic.stream = true
  if (openaiBody.temperature !== undefined) anthropic.temperature = openaiBody.temperature
  if (openaiBody.top_p !== undefined) anthropic.top_p = openaiBody.top_p
  if (openaiBody.stop) anthropic.stop_sequences = Array.isArray(openaiBody.stop) ? openaiBody.stop : [openaiBody.stop]

  // 转换 tools 定义
  if (openaiBody.tools && openaiBody.tools.length > 0) {
    anthropic.tools = openaiBody.tools.map((t: any) => ({
      name: t.function.name,
      description: t.function.description,
      input_schema: t.function.parameters,
    }))
  }

  // 转换 tool_choice
  if (openaiBody.tool_choice !== undefined) {
    if (openaiBody.tool_choice === 'auto') {
      anthropic.tool_choice = { type: 'auto' }
    } else if (openaiBody.tool_choice === 'none') {
      // Anthropic 没有 none，通过不给 tools 实现；如果给了 tools 则不设 tool_choice
    } else if (typeof openaiBody.tool_choice === 'object') {
      anthropic.tool_choice = {
        type: 'tool',
        name: openaiBody.tool_choice.function?.name,
      }
    }
  }

  return anthropic
}

// ─── Anthropic 非流式响应 → OpenAI 响应 ───
export const anthropicToOpenai = (anthropicResp: any, model: string): any => {
  const contentBlocks = anthropicResp.content || []
  const textParts: string[] = []
  const toolCalls: any[] = []
  let toolCallIndex = 0

  for (const block of contentBlocks) {
    if (block.type === 'text') {
      textParts.push(block.text)
    } else if (block.type === 'tool_use') {
      toolCalls.push({
        index: toolCallIndex,
        id: block.id,
        type: 'function',
        function: {
          name: block.name,
          arguments: typeof block.input === 'string' ? block.input : JSON.stringify(block.input),
        },
      })
      toolCallIndex++
    }
  }

  const message: any = {
    role: 'assistant',
    content: textParts.join('') || null,
  }
  if (toolCalls.length > 0) {
    message.tool_calls = toolCalls
  }

  const usage = anthropicResp.usage || {}

  // stop_reason 映射：tool_use → tool_calls
  let finishReason = mapStopReason(anthropicResp.stop_reason)
  if (anthropicResp.stop_reason === 'tool_use') {
    finishReason = 'tool_calls'
  }

  return {
    id: anthropicResp.id || 'chatcmpl-relay',
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: model,
    choices: [{
      index: 0,
      message,
      finish_reason: finishReason,
    }],
    usage: {
      prompt_tokens: usage.input_tokens || usage.prompt_tokens || 0,
      completion_tokens: usage.output_tokens || usage.completion_tokens || 0,
      total_tokens: (usage.input_tokens || usage.prompt_tokens || 0) + (usage.output_tokens || usage.completion_tokens || 0),
    },
  }
}

const mapStopReason = (reason: string | null): string => {
  if (reason === 'end_turn' || reason === 'stop') return 'stop'
  if (reason === 'max_tokens') return 'length'
  if (reason === 'tool_use') return 'tool_calls'
  return 'stop'
}

// ─── Anthropic SSE 流式事件 → OpenAI SSE 流式事件 ───
export const convertStreamChunk = (line: string, model: string): string | null => {
  if (!line.startsWith('data:')) return null
  const data = line.slice(5).trim()
  if (!data) return null

  let event: any
  try { event = JSON.parse(data) } catch { return null }

  const timestamp = Math.floor(Date.now() / 1000)

  if (event.type === 'message_start') {
    return formatChunk({
      id: event.message?.id || 'chatcmpl-relay',
      object: 'chat.completion.chunk',
      created: timestamp,
      model,
      choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }],
    })
  }

  // tool_use 块开始：发出 tool_calls delta（含 function name + id）
  if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
    return formatChunk({
      id: 'chatcmpl-relay',
      object: 'chat.completion.chunk',
      created: timestamp,
      model,
      choices: [{
        index: 0,
        delta: {
          tool_calls: [{
            index: event.index,
            id: event.content_block.id,
            type: 'function',
            function: { name: event.content_block.name, arguments: '' },
          }],
        },
        finish_reason: null,
      }],
    })
  }

  // text 块的增量文本
  if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
    const text = event.delta.text || ''
    if (!text) return null
    return formatChunk({
      id: 'chatcmpl-relay',
      object: 'chat.completion.chunk',
      created: timestamp,
      model,
      choices: [{ index: 0, delta: { content: text }, finish_reason: null }],
    })
  }

  // tool_use 块的增量参数
  if (event.type === 'content_block_delta' && event.delta?.type === 'input_json_delta') {
    const partialJson = event.delta.partial_json || ''
    return formatChunk({
      id: 'chatcmpl-relay',
      object: 'chat.completion.chunk',
      created: timestamp,
      model,
      choices: [{
        index: 0,
        delta: {
          tool_calls: [{
            index: event.index,
            function: { arguments: partialJson },
          }],
        },
        finish_reason: null,
      }],
    })
  }

  if (event.type === 'message_delta') {
    const reason = event.delta?.stop_reason
    return formatChunk({
      id: 'chatcmpl-relay',
      object: 'chat.completion.chunk',
      created: timestamp,
      model,
      choices: [{ index: 0, delta: {}, finish_reason: mapStopReason(reason) }],
    })
  }

  if (event.type === 'message_stop') {
    return 'data: [DONE]\n\n'
  }

  return null
}

const formatChunk = (obj: any): string => {
  return 'data: ' + JSON.stringify(obj) + '\n\n'
}

// ─── Anthropic 请求 → OpenAI 请求（用于 Anthropic 入口 → OpenAI 后端）───
export const anthropicToOpenaiRequest = (anthropicBody: any): any => {
  const messages: any[] = []
  if (anthropicBody.system) {
    messages.push({ role: 'system', content: anthropicBody.system })
  }
  for (const msg of anthropicBody.messages || []) {
    // content 可能是字符串或 content block 数组
    const content = msg.content
    if (msg.role === 'assistant' && Array.isArray(content)) {
      // 分离 text 和 tool_use
      const textParts: string[] = []
      const toolCalls: any[] = []
      let tcIndex = 0
      for (const block of content) {
        if (block.type === 'text') {
          textParts.push(block.text)
        } else if (block.type === 'tool_use') {
          toolCalls.push({
            index: tcIndex,
            id: block.id,
            type: 'function',
            function: {
              name: block.name,
              arguments: typeof block.input === 'string' ? block.input : JSON.stringify(block.input),
            },
          })
          tcIndex++
        }
      }
      const assistantMsg: any = { role: 'assistant', content: textParts.join('') || null }
      if (toolCalls.length > 0) assistantMsg.tool_calls = toolCalls
      messages.push(assistantMsg)
    } else if (msg.role === 'user' && Array.isArray(content)) {
      // 检查是否有 tool_result
      const toolResults = content.filter((b: any) => b.type === 'tool_result')
      const textParts = content.filter((b: any) => b.type === 'text').map((b: any) => b.text)
      if (toolResults.length > 0) {
        // 每个 tool_result 转为一条 tool 消息
        for (const tr of toolResults) {
          messages.push({
            role: 'tool',
            tool_call_id: tr.tool_use_id,
            content: typeof tr.content === 'string' ? tr.content : JSON.stringify(tr.content),
          })
        }
        // 如果同时有文本内容，额外插入一条 user 消息
        if (textParts.length > 0) {
          messages.push({ role: 'user', content: textParts.join('') })
        }
      } else if (textParts.length > 0) {
        messages.push({ role: 'user', content: textParts.join('') })
      }
    } else {
      messages.push({ role: msg.role, content })
    }
  }

  const openai: any = {
    model: anthropicBody.model,
    messages,
    max_tokens: anthropicBody.max_tokens || 16384,
  }
  if (anthropicBody.stream) openai.stream = true
  if (anthropicBody.temperature !== undefined) openai.temperature = anthropicBody.temperature
  if (anthropicBody.top_p !== undefined) openai.top_p = anthropicBody.top_p

  // 转换 tools 定义
  if (anthropicBody.tools && anthropicBody.tools.length > 0) {
    openai.tools = anthropicBody.tools.map((t: any) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.input_schema,
      },
    }))
  }

  // 转换 tool_choice
  if (anthropicBody.tool_choice !== undefined) {
    if (anthropicBody.tool_choice.type === 'auto') {
      openai.tool_choice = 'auto'
    } else if (anthropicBody.tool_choice.type === 'tool') {
      openai.tool_choice = {
        type: 'function',
        function: { name: anthropicBody.tool_choice.name },
      }
    }
  }

  return openai
}

// ─── OpenAI 响应 → Anthropic 响应（用于 Anthropic 入口 → OpenAI 后端）───
export const openaiToAnthropicResponse = (openaiResp: any, model: string): any => {
  const choice = openaiResp.choices?.[0]
  const usage = openaiResp.usage || {}
  const content: any[] = []

  // 文本内容
  if (choice?.message?.content) {
    content.push({ type: 'text', text: choice.message.content })
  }

  // tool_calls 转为 tool_use blocks
  if (choice?.message?.tool_calls) {
    for (const tc of choice.message.tool_calls) {
      content.push({
        type: 'tool_use',
        id: tc.id,
        name: tc.function.name,
        input: parseJson(tc.function.arguments),
      })
    }
  }

  return {
    id: openaiResp.id || `msg_${Date.now()}`,
    type: 'message',
    role: 'assistant',
    model,
    content: content.length > 0 ? content : [{ type: 'text', text: '' }],
    stop_reason: choice?.finish_reason === 'tool_calls' ? 'tool_use' : (choice?.finish_reason === 'stop' ? 'end_turn' : choice?.finish_reason),
    usage: {
      input_tokens: usage.prompt_tokens || 0,
      output_tokens: usage.completion_tokens || 0,
    },
  }
}

// ─── OpenAI SSE chunk → Anthropic SSE chunk ───
export const convertStreamChunkOpenaiToAnthropic = (line: string): string | null => {
  if (!line.startsWith('data:')) return null
  const data = line.slice(5).trim()
  if (!data || data === '[DONE]') return null

  let event: any
  try { event = JSON.parse(data) } catch { return null }

  const choice = event.choices?.[0]
  if (!choice) return null

  // 首个 chunk：返回 message_start
  if (choice.delta?.role) {
    return formatChunk({
      type: 'message_start',
      message: { id: event.id, type: 'message', role: 'assistant', model: event.model, content: [] },
    })
  }

  // tool_calls：处理所有项，拼接为多个 SSE 事件
  if (choice.delta?.tool_calls) {
    const parts: string[] = []
    for (const tc of choice.delta.tool_calls) {
      if (tc.function?.name) {
        // tool_use 块开始
        parts.push(formatChunk({
          type: 'content_block_start',
          index: tc.index,
          content_block: { type: 'tool_use', id: tc.id, name: tc.function.name },
        }))
      }
      if (tc.function?.arguments) {
        // tool_use 增量参数
        parts.push(formatChunk({
          type: 'content_block_delta',
          index: tc.index,
          delta: { type: 'input_json_delta', partial_json: tc.function.arguments },
        }))
      }
    }
    return parts.length > 0 ? parts.join('') : null
  }

  // 文本内容 chunk
  if (choice.delta?.content) {
    return formatChunk({
      type: 'content_block_delta',
      delta: { type: 'text_delta', text: choice.delta.content },
      index: 0,
    })
  }

  // 结束 chunk
  if (choice.finish_reason) {
    return formatChunk({
      type: 'message_delta',
      delta: {
        stop_reason: choice.finish_reason === 'tool_calls' ? 'tool_use' : (choice.finish_reason === 'stop' ? 'end_turn' : choice.finish_reason),
        stop_sequence: null,
      },
      usage: { output_tokens: 0 },
    })
  }

  return null
}

// ─── 工具函数 ───
const parseJson = (str: string): any => {
  if (!str) return {}
  try { return JSON.parse(str) } catch { return {} }
}
