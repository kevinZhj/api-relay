// OpenAI 格式 ↔ Anthropic 格式 转换器
// Kimi Code API 只支持 Anthropic 格式，需要把 OpenAI 请求转换后转发

// OpenAI 请求 → Anthropic 请求
export const openaiToAnthropic = (openaiBody: any): any => {
  const messages = openaiBody.messages || []
  let system: string | undefined
  const converted: any[] = []

  for (const msg of messages) {
    if (msg.role === 'system') {
      system = system ? system + '\n' + msg.content : msg.content
    } else if (msg.role === 'assistant') {
      converted.push({ role: 'assistant', content: msg.content })
    } else if (msg.role === 'user') {
      converted.push({ role: 'user', content: msg.content })
    } else if (msg.role === 'tool') {
      // tool 消息转为 user 消息
      converted.push({ role: 'user', content: JSON.stringify(msg) })
    }
  }

  const anthropic: any = {
    model: openaiBody.model,
    messages: converted,
    max_tokens: openaiBody.max_tokens || 4096,
  }
  if (system) anthropic.system = system
  if (openaiBody.stream) anthropic.stream = true
  if (openaiBody.temperature !== undefined) anthropic.temperature = openaiBody.temperature
  if (openaiBody.top_p !== undefined) anthropic.top_p = openaiBody.top_p
  if (openaiBody.stop) anthropic.stop_sequences = Array.isArray(openaiBody.stop) ? openaiBody.stop : [openaiBody.stop]

  return anthropic
}

// Anthropic 非流式响应 → OpenAI 响应
export const anthropicToOpenai = (anthropicResp: any, model: string): any => {
  const content = (anthropicResp.content || [])
    .filter((c: any) => c.type === 'text')
    .map((c: any) => c.text)
    .join('')

  const usage = anthropicResp.usage || {}

  return {
    id: anthropicResp.id || 'chatcmpl-relay',
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: model,
    choices: [{
      index: 0,
      message: { role: 'assistant', content },
      finish_reason: mapStopReason(anthropicResp.stop_reason),
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
  return 'stop'
}

// Anthropic SSE 流式事件 → OpenAI SSE 流式事件
export const convertStreamChunk = (line: string, model: string): string | null => {
  if (!line.startsWith('data:')) return null
  const data = line.slice(5).trim()
  if (!data) return null

  let event: any
  try { event = JSON.parse(data) } catch { return null }

  const timestamp = Math.floor(Date.now() / 1000)

  if (event.type === 'message_start') {
    return formatChunk({ id: event.message?.id || 'chatcmpl-relay', object: 'chat.completion.chunk', created: timestamp, model, choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }] })
  }

  if (event.type === 'content_block_delta') {
    const text = event.delta?.text || ''
    if (!text) return null
    return formatChunk({ id: 'chatcmpl-relay', object: 'chat.completion.chunk', created: timestamp, model, choices: [{ index: 0, delta: { content: text }, finish_reason: null }] })
  }

  if (event.type === 'message_delta') {
    const reason = event.delta?.stop_reason
    return formatChunk({ id: 'chatcmpl-relay', object: 'chat.completion.chunk', created: timestamp, model, choices: [{ index: 0, delta: {}, finish_reason: mapStopReason(reason) }] })
  }

  if (event.type === 'message_stop') {
    return 'data: [DONE]\n\n'
  }

  return null
}

const formatChunk = (obj: any): string => {
  return 'data: ' + JSON.stringify(obj) + '\n\n'
}
