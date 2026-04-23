import { Database } from 'sql.js'
import { selectAccount, selectNextAccount } from '../account/account.selector.js'
import { updateAccountStatus, updateAccountUsage, Account } from '../account/account.service.js'
import { recordSuccess, recordFailure } from '../account/account.stats.js'
import { recordCircuitSuccess, recordCircuitFailure } from '../account/account.circuit.js'
import { mapErrorToStatus, shouldRetry, shouldMarkAccount, recoverRateLimited } from '../health/health.service.js'
import {
  openaiToAnthropic,
  anthropicToOpenai,
  convertStreamChunk,
  anthropicToOpenaiRequest,
  openaiToAnthropicResponse,
  convertStreamChunkOpenaiToAnthropic,
} from './format_converter.js'
import { config, buildApiUrl } from '../../config.js'

export interface ProxyRequest {
  method: string
  path: string
  headers: Record<string, string>
  body: any
}

export interface ProxyResult {
  status: number
  headers: Record<string, string>
  body: any
  stream: boolean
  streamGenerator?: AsyncGenerator<Uint8Array>
  usedAccountId: number | null
  pendingLog?: () => void
}

const normalizeModelName = (model: string | undefined): string => {
  if (!model) return ''
  const lower = model.toLowerCase().replace(/[_\-]/g, '.')
  if (lower === 'k2.6.code.preview') return 'K2.6-code-preview'
  if (lower === 'kimi.k2.5') return 'K2.6-code-preview'
  return model
}

export const forwardRequest = async (
  db: Database,
  proxyReq: ProxyRequest,
  apiKeyId: number,
  brand?: string,
  onLog?: (log: Record<string, any>) => void,
): Promise<ProxyResult> => {
  const startTime = Date.now()
  recoverRateLimited(db)

  const triedIds: number[] = []
  let lastError: any = null
  let lastStatus = 0

  for (let attempt = 0; attempt < config.maxRetry; attempt++) {
    // 重试间加入延迟抖动（429: 1-3s, 其他: 0-500ms）
    if (attempt > 0) {
      const delay = lastStatus === 429
        ? 1000 + Math.random() * 2000
        : Math.random() * 500
      await new Promise(r => setTimeout(r, delay))
    }
    const normalizedModel = normalizeModelName(proxyReq.body?.model)
    const account = triedIds.length === 0
      ? selectAccount(db, { modelName: normalizedModel, brand })
      : selectNextAccount(db, triedIds, normalizedModel, brand)

    if (!account) {
      return {
        status: 503,
        headers: { 'content-type': 'application/json' },
        body: { error: { message: '没有可用的后端账号', type: 'server_error' } },
        stream: false,
        usedAccountId: null,
      }
    }

    triedIds.push(account.id)

    try {
      const result = await doForward(account, proxyReq)
      const duration = Date.now() - startTime

      if (result.status >= 200 && result.status < 300) {
        recordCircuitSuccess(account.id)
        if (!result.stream) {
          const usage = result.body?.usage
          const tokens = extractTokenUsage(usage)
          if (tokens > 0) updateAccountUsage(db, account.id, tokens)
          recordSuccess(db, account.id, duration)

          onLog?.({
            api_key_id: apiKeyId,
            account_id: account.id,
            model: normalizeModelName(proxyReq.body?.model),
            prompt_tokens: usage?.prompt_tokens || usage?.input_tokens || null,
            completion_tokens: usage?.completion_tokens || usage?.output_tokens || null,
            cache_creation_tokens: usage?.cache_creation_input_tokens || null,
            cache_read_tokens: usage?.cache_read_input_tokens || null,
            is_success: 1,
            error_code: null,
            duration_ms: duration,
          })
        } else {
          result.pendingLog = () => {
            const usage = result.streamUsage
            const tokens = extractTokenUsage(usage)
            if (tokens > 0) updateAccountUsage(db, account.id, tokens)
            recordSuccess(db, account.id, Date.now() - startTime)

            onLog?.({
              api_key_id: apiKeyId,
              account_id: account.id,
              model: normalizeModelName(proxyReq.body?.model),
              prompt_tokens: usage?.prompt_tokens || usage?.input_tokens || null,
              completion_tokens: usage?.completion_tokens || usage?.output_tokens || null,
              cache_creation_tokens: usage?.cache_creation_input_tokens || null,
              cache_read_tokens: usage?.cache_read_input_tokens || null,
              is_success: 1,
              error_code: null,
              duration_ms: Date.now() - startTime,
            })
          }
        }

        return result
      }

      lastError = result
      lastStatus = result.status
      recordFailure(db, account.id)
      recordCircuitFailure(account.id)
      if (shouldMarkAccount(result.status)) {
        const newStatus = mapErrorToStatus(result.status)
        updateAccountStatus(db, account.id, newStatus, `HTTP ${result.status}`)
      }

      if (!shouldRetry(result.status)) {
        onLog?.({
          api_key_id: apiKeyId,
          account_id: account.id,
          model: normalizeModelName(proxyReq.body?.model),
          prompt_tokens: null,
          completion_tokens: null,
          is_success: 0,
          error_code: String(result.status),
          duration_ms: duration,
        })
        return result
      }
    } catch (err: any) {
      lastError = err
      recordFailure(db, account.id)
    }
  }

  const duration = Date.now() - startTime
  onLog?.({
    api_key_id: apiKeyId,
    account_id: null,
    model: normalizeModelName(proxyReq.body?.model),
    prompt_tokens: null,
    completion_tokens: null,
    is_success: 0,
    error_code: lastError?.status ? String(lastError.status) : 'network_error',
    duration_ms: duration,
  })

  if (lastError?.status) return lastError

  return {
    status: 502,
    headers: { 'content-type': 'application/json' },
    body: { error: { message: '后端请求失败', type: 'server_error' } },
    stream: false,
    usedAccountId: null,
  }
}

interface StreamResult {
  generator: AsyncGenerator<Uint8Array>
  usage: Record<string, any>
}

const doForward = async (account: Account, proxyReq: ProxyRequest): Promise<ProxyResult & { streamUsage?: Record<string, any> }> => {
  const isAnthropicEntry = proxyReq.path === '/v1/messages'
  const protocol = account.protocol || 'auto'
  const isAnthropicBackend = protocol === 'anthropic' || (protocol === 'auto' && (account.base_url.includes('moonshot') || account.base_url.includes('kimi')))

  let url: string
  let body: any = proxyReq.body
  const headers: Record<string, string> = { ...proxyReq.headers }
  delete headers['authorization']
  delete headers['x-api-key']

  if (isAnthropicEntry) {
    // Anthropic 入口
    if (isAnthropicBackend) {
      url = buildApiUrl(account.base_url, '/v1/messages')
      headers['x-api-key'] = account.api_key
      headers['anthropic-version'] = headers['anthropic-version'] || '2023-06-01'
    } else {
      // Anthropic → OpenAI 后端
      body = anthropicToOpenaiRequest(proxyReq.body)
      url = buildApiUrl(account.base_url, '/v1/chat/completions')
      headers['authorization'] = `Bearer ${account.api_key}`
    }
  } else {
    // OpenAI 入口
    if (isAnthropicBackend) {
      // OpenAI → Anthropic 后端
      body = openaiToAnthropic(proxyReq.body)
      url = buildApiUrl(account.base_url, '/v1/messages')
      headers['x-api-key'] = account.api_key
      headers['anthropic-version'] = '2023-06-01'
    } else {
      // OpenAI → OpenAI 后端
      url = buildApiUrl(account.base_url, '/v1/chat/completions')
      headers['authorization'] = `Bearer ${account.api_key}`
    }
  }

  headers['host'] = new URL(account.base_url).host
  headers['user-agent'] = 'Claude-Code/1.0'

  const isStream = body?.stream === true

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 60_000)

  let resp: Response
  try {
    resp = await fetch(url, {
      method: proxyReq.method,
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (err: any) {
    clearTimeout(timeout)
    if (err.name === 'AbortError') {
      return {
        status: 504,
        headers: { 'content-type': 'application/json' },
        body: { error: { message: '上游请求超时', type: 'timeout_error' } },
        stream: false,
        usedAccountId: account.id,
      }
    }
    throw err
  }
  clearTimeout(timeout)

  if (isStream && resp.ok && resp.body) {
    const { generator, usage } = createStreamWithUsage(resp.body, isAnthropicEntry, isAnthropicBackend)
    return {
      status: resp.status,
      headers: Object.fromEntries(resp.headers.entries()),
      body: null,
      stream: true,
      streamGenerator: generator,
      usedAccountId: account.id,
      streamUsage: usage,
    }
  }

  let respBody: any
  try {
    respBody = await resp.json()
  } catch {
    respBody = { error: { message: await resp.text().catch(() => 'Unknown error') } }
  }

  // 非流式响应协议转换
  if (resp.ok) {
    if (isAnthropicEntry && !isAnthropicBackend) {
      respBody = openaiToAnthropicResponse(respBody, proxyReq.body?.model || '')
    } else if (!isAnthropicEntry && isAnthropicBackend) {
      respBody = anthropicToOpenai(respBody, proxyReq.body?.model || '')
    }
  }

  return {
    status: resp.status,
    headers: Object.fromEntries(resp.headers.entries()),
    body: respBody,
    stream: false,
    usedAccountId: account.id,
  }
}

// 从流式 SSE 中提取 usage，同时根据协议方向选择转换器
const createStreamWithUsage = (
  body: ReadableStream<Uint8Array>,
  isAnthropicEntry: boolean,
  isAnthropicBackend: boolean,
): StreamResult => {
  const usage: Record<string, any> = {}
  let buffer = ''

  const needsConversion = (isAnthropicEntry && !isAnthropicBackend) || (!isAnthropicEntry && isAnthropicBackend)

  async function* generator(): AsyncGenerator<Uint8Array> {
    const reader = body.getReader()
    const decoder = new TextDecoder()
    const encoder = new TextEncoder()
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data:')) {
            try {
              const data = JSON.parse(line.slice(5).trim())
              if (isAnthropicBackend) {
                // Anthropic 格式 usage
                if (data.type === 'message_start' && data.message?.usage) {
                  Object.assign(usage, data.message.usage)
                }
                if (data.type === 'message_delta' && data.usage) {
                  Object.assign(usage, data.usage)
                }
              } else {
                // OpenAI 格式 usage（最后一个 chunk 携带 usage）
                if (data.usage) {
                  Object.assign(usage, {
                    input_tokens: data.usage.prompt_tokens,
                    output_tokens: data.usage.completion_tokens,
                  })
                }
              }
            } catch {}
          }

          // 协议转换
          if (needsConversion) {
            let converted: string | null = null
            if (isAnthropicEntry && !isAnthropicBackend) {
              // OpenAI SSE → Anthropic SSE
              converted = convertStreamChunkOpenaiToAnthropic(line)
            } else {
              // Anthropic SSE → OpenAI SSE
              converted = convertStreamChunk(line, '')
            }
            if (converted) {
              yield encoder.encode(converted)
            }
          } else {
            yield encoder.encode(line + '\n')
          }
        }
      }

      // 处理剩余 buffer
      if (buffer.trim().startsWith('data:')) {
        try {
          const data = JSON.parse(buffer.trim().slice(5).trim())
          if (data.type === 'message_delta' && data.usage) {
            Object.assign(usage, data.usage)
          }
        } catch {}

        if (needsConversion) {
          let converted: string | null = null
          if (isAnthropicEntry && !isAnthropicBackend) {
            converted = convertStreamChunkOpenaiToAnthropic(buffer)
          } else {
            converted = convertStreamChunk(buffer, '')
          }
          if (converted) {
            yield encoder.encode(converted)
          }
        } else {
          yield encoder.encode(buffer + '\n')
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  return { generator: generator(), usage }
}

const extractTokenUsage = (usage: any): number => {
  if (!usage) return 0
  const input = usage.prompt_tokens || usage.input_tokens || 0
  const output = usage.completion_tokens || usage.output_tokens || 0
  return input + output
}
