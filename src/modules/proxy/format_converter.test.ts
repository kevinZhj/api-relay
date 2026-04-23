import { describe, it, expect } from 'vitest'
import {
  openaiToAnthropic,
  anthropicToOpenai,
  convertStreamChunk,
  anthropicToOpenaiRequest,
  openaiToAnthropicResponse,
  convertStreamChunkOpenaiToAnthropic,
} from './format_converter.js'

describe('openaiToAnthropic 请求转换', () => {
  it('转换基本消息', () => {
    const result = openaiToAnthropic({
      model: 'kimi-k2.5',
      messages: [
        { role: 'system', content: '你是助手' },
        { role: 'user', content: '你好' },
      ],
    })
    expect(result.model).toBe('kimi-k2.5')
    expect(result.system).toBe('你是助手')
    expect(result.messages).toEqual([{ role: 'user', content: '你好' }])
  })

  it('转换 tools 定义', () => {
    const result = openaiToAnthropic({
      model: 'kimi-k2.5',
      messages: [],
      tools: [{
        type: 'function',
        function: {
          name: 'edit_file',
          description: '编辑文件',
          parameters: { type: 'object', properties: { path: { type: 'string' } } },
        },
      }],
    })
    expect(result.tools).toEqual([{
      name: 'edit_file',
      description: '编辑文件',
      input_schema: { type: 'object', properties: { path: { type: 'string' } } },
    }])
  })

  it('转换 tool_choice', () => {
    const auto = openaiToAnthropic({ model: 'k', messages: [], tool_choice: 'auto' })
    expect(auto.tool_choice).toEqual({ type: 'auto' })

    const named = openaiToAnthropic({
      model: 'k', messages: [],
      tool_choice: { type: 'function', function: { name: 'edit_file' } },
    })
    expect(named.tool_choice).toEqual({ type: 'tool', name: 'edit_file' })
  })

  it('转换 assistant 的 tool_calls', () => {
    const result = openaiToAnthropic({
      model: 'k',
      messages: [{
        role: 'assistant',
        content: null,
        tool_calls: [{
          id: 'call_123',
          type: 'function',
          function: { name: 'edit_file', arguments: '{"path":"/a.txt","content":"hello"}' },
        }],
      }],
    })
    expect(result.messages).toEqual([{
      role: 'assistant',
      content: [{
        type: 'tool_use',
        id: 'call_123',
        name: 'edit_file',
        input: { path: '/a.txt', content: 'hello' },
      }],
    }])
  })

  it('转换 assistant 同时有文本和 tool_calls', () => {
    const result = openaiToAnthropic({
      model: 'k',
      messages: [{
        role: 'assistant',
        content: '我来修改这个文件',
        tool_calls: [{
          id: 'call_456',
          type: 'function',
          function: { name: 'edit_file', arguments: '{"path":"/b.txt"}' },
        }],
      }],
    })
    expect(result.messages[0].content).toEqual([
      { type: 'text', text: '我来修改这个文件' },
      { type: 'tool_use', id: 'call_456', name: 'edit_file', input: { path: '/b.txt' } },
    ])
  })

  it('转换 tool 消息为 tool_result', () => {
    const result = openaiToAnthropic({
      model: 'k',
      messages: [{
        role: 'tool',
        tool_call_id: 'call_123',
        content: '文件已修改',
      }],
    })
    expect(result.messages).toEqual([{
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: 'call_123', content: '文件已修改' }],
    }])
  })

  it('完整对话含 tool 调用流程', () => {
    const result = openaiToAnthropic({
      model: 'k',
      messages: [
        { role: 'system', content: '你是代码助手' },
        { role: 'user', content: '修改 a.txt' },
        {
          role: 'assistant',
          content: null,
          tool_calls: [{
            id: 'call_1',
            type: 'function',
            function: { name: 'edit_file', arguments: '{"path":"a.txt","content":"new"}' },
          }],
        },
        { role: 'tool', tool_call_id: 'call_1', content: 'OK' },
        { role: 'assistant', content: '已完成修改' },
      ],
      tools: [{
        type: 'function',
        function: { name: 'edit_file', description: '编辑文件', parameters: { type: 'object', properties: {} } },
      }],
    })

    expect(result.system).toBe('你是代码助手')
    expect(result.tools).toHaveLength(1)
    expect(result.tools[0].name).toBe('edit_file')
    // user -> assistant(tool_use) -> user(tool_result) -> assistant(text)
    expect(result.messages).toHaveLength(4)
    expect(result.messages[0]).toEqual({ role: 'user', content: '修改 a.txt' })
    expect(result.messages[1].content[0].type).toBe('tool_use')
    expect(result.messages[2].content[0].type).toBe('tool_result')
    expect(result.messages[3]).toEqual({ role: 'assistant', content: '已完成修改' })
  })
})

describe('anthropicToOpenai 响应转换', () => {
  it('转换纯文本响应', () => {
    const result = anthropicToOpenai({
      id: 'msg_1',
      content: [{ type: 'text', text: '你好' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 10, output_tokens: 5 },
    }, 'kimi-k2.5')

    expect(result.choices[0].message.content).toBe('你好')
    expect(result.choices[0].message.tool_calls).toBeUndefined()
    expect(result.choices[0].finish_reason).toBe('stop')
  })

  it('转换 tool_use 响应', () => {
    const result = anthropicToOpenai({
      id: 'msg_2',
      content: [
        { type: 'text', text: '我来修改' },
        { type: 'tool_use', id: 'tu_1', name: 'edit_file', input: { path: 'a.txt', content: 'new' } },
      ],
      stop_reason: 'tool_use',
      usage: { input_tokens: 20, output_tokens: 10 },
    }, 'kimi-k2.5')

    expect(result.choices[0].message.content).toBe('我来修改')
    expect(result.choices[0].message.tool_calls).toEqual([{
      index: 0,
      id: 'tu_1',
      type: 'function',
      function: { name: 'edit_file', arguments: '{"path":"a.txt","content":"new"}' },
    }])
    expect(result.choices[0].finish_reason).toBe('tool_calls')
  })

  it('转换多个 tool_use', () => {
    const result = anthropicToOpenai({
      id: 'msg_3',
      content: [
        { type: 'tool_use', id: 'tu_1', name: 'read_file', input: { path: 'a.txt' } },
        { type: 'tool_use', id: 'tu_2', name: 'edit_file', input: { path: 'b.txt' } },
      ],
      stop_reason: 'tool_use',
      usage: {},
    }, 'k')

    expect(result.choices[0].message.tool_calls).toHaveLength(2)
    expect(result.choices[0].message.tool_calls[0].function.name).toBe('read_file')
    expect(result.choices[0].message.tool_calls[1].function.name).toBe('edit_file')
    expect(result.choices[0].message.tool_calls[1].index).toBe(1)
  })
})

describe('convertStreamChunk 流式转换', () => {
  it('转换 message_start', () => {
    const result = convertStreamChunk('data: {"type":"message_start","message":{"id":"msg_1"}}', 'k')
    expect(result).toContain('"role":"assistant"')
  })

  it('转换 text_delta', () => {
    const result = convertStreamChunk('data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"hello"}}', 'k')
    expect(result).toContain('"content":"hello"')
    expect(result).not.toContain('tool_calls')
  })

  it('转换 tool_use 的 content_block_start', () => {
    const result = convertStreamChunk('data: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"tu_1","name":"edit_file"}}', 'k')
    expect(result).toContain('"tool_calls"')
    expect(result).toContain('"name":"edit_file"')
    expect(result).toContain('"id":"tu_1"')
    expect(result).toContain('"arguments":""')
  })

  it('转换 tool_use 的 input_json_delta', () => {
    const result = convertStreamChunk('data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\\"path\\":\\"a.txt\\"}"}}', 'k')
    expect(result).toContain('"tool_calls"')
    expect(result).toContain('"arguments":"')
    // 不应包含 name 或 id（增量只有 arguments）
    const parsed = JSON.parse(result!.slice(6))
    expect(parsed.choices[0].delta.tool_calls[0].function).not.toHaveProperty('name')
  })

  it('转换 tool_use 的 stop_reason', () => {
    const result = convertStreamChunk('data: {"type":"message_delta","delta":{"stop_reason":"tool_use"}}', 'k')
    expect(result).toContain('"finish_reason":"tool_calls"')
  })

  it('转换 message_stop 为 [DONE]', () => {
    const result = convertStreamChunk('data: {"type":"message_stop"}', 'k')
    expect(result).toBe('data: [DONE]\n\n')
  })

  it('忽略非 data 行', () => {
    expect(convertStreamChunk('event: content_block_delta', 'k')).toBeNull()
    expect(convertStreamChunk('', 'k')).toBeNull()
  })
})

describe('anthropicToOpenaiRequest 反向请求转换', () => {
  it('转换 tools 定义', () => {
    const result = anthropicToOpenaiRequest({
      model: 'k',
      messages: [],
      tools: [{
        name: 'edit_file',
        description: '编辑文件',
        input_schema: { type: 'object', properties: { path: { type: 'string' } } },
      }],
    })
    expect(result.tools).toEqual([{
      type: 'function',
      function: {
        name: 'edit_file',
        description: '编辑文件',
        parameters: { type: 'object', properties: { path: { type: 'string' } } },
      },
    }])
  })

  it('转换 assistant 中的 tool_use blocks', () => {
    const result = anthropicToOpenaiRequest({
      model: 'k',
      messages: [{
        role: 'assistant',
        content: [
          { type: 'text', text: '修改中' },
          { type: 'tool_use', id: 'tu_1', name: 'edit_file', input: { path: 'a.txt' } },
        ],
      }],
    })
    const msg = result.messages[0]
    expect(msg.role).toBe('assistant')
    expect(msg.content).toBe('修改中')
    expect(msg.tool_calls).toEqual([{
      index: 0,
      id: 'tu_1',
      type: 'function',
      function: { name: 'edit_file', arguments: '{"path":"a.txt"}' },
    }])
  })

  it('转换 tool_result 为 tool 消息', () => {
    const result = anthropicToOpenaiRequest({
      model: 'k',
      messages: [{
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: 'tu_1', content: 'OK' }],
      }],
    })
    expect(result.messages).toEqual([{
      role: 'tool',
      tool_call_id: 'tu_1',
      content: 'OK',
    }])
  })

  it('user 消息同时含 text 和 tool_result 时都保留', () => {
    const result = anthropicToOpenaiRequest({
      model: 'k',
      messages: [{
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: 'tu_1', content: 'OK' },
          { type: 'text', text: '继续修改' },
        ],
      }],
    })
    expect(result.messages).toEqual([
      { role: 'tool', tool_call_id: 'tu_1', content: 'OK' },
      { role: 'user', content: '继续修改' },
    ])
  })
})

describe('openaiToAnthropicResponse 反向响应转换', () => {
  it('转换 tool_calls 响应', () => {
    const result = openaiToAnthropicResponse({
      id: 'chatcmpl-1',
      choices: [{
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [{
            id: 'call_1',
            type: 'function',
            function: { name: 'edit_file', arguments: '{"path":"a.txt"}' },
          }],
        },
        finish_reason: 'tool_calls',
      }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    }, 'k')

    expect(result.content).toEqual([
      { type: 'tool_use', id: 'call_1', name: 'edit_file', input: { path: 'a.txt' } },
    ])
    expect(result.stop_reason).toBe('tool_use')
  })
})

describe('convertStreamChunkOpenaiToAnthropic 反向流式转换', () => {
  it('转换 tool_calls 开始（含 name）', () => {
    const result = convertStreamChunkOpenaiToAnthropic(
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"edit_file","arguments":""}}]}}]}',
    )
    expect(result).toContain('"type":"content_block_start"')
    expect(result).toContain('"type":"tool_use"')
    expect(result).toContain('"name":"edit_file"')
  })

  it('转换 tool_calls 增量参数', () => {
    const result = convertStreamChunkOpenaiToAnthropic(
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"path\\":\\"a.txt\\"}"}}]}}]}',
    )
    expect(result).toContain('"type":"input_json_delta"')
    expect(result).toContain('"partial_json":"')
  })

  it('转换多个 tool_calls 不丢失', () => {
    const result = convertStreamChunkOpenaiToAnthropic(
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"read_file","arguments":""}},{"index":1,"id":"call_2","type":"function","function":{"name":"edit_file","arguments":""}}]}}]}',
    )
    expect(result).toContain('"name":"read_file"')
    expect(result).toContain('"name":"edit_file"')
    // 应该包含两个 content_block_start 事件
    const matches = result!.match(/"type":"content_block_start"/g)
    expect(matches).toHaveLength(2)
  })

  it('转换 tool_calls 的 finish_reason', () => {
    const result = convertStreamChunkOpenaiToAnthropic(
      'data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}',
    )
    expect(result).toContain('"stop_reason":"tool_use"')
  })

  it('忽略 [DONE]', () => {
    const result = convertStreamChunkOpenaiToAnthropic('data: [DONE]')
    expect(result).toBeNull()
  })
})
