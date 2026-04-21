import { FastifyInstance } from 'fastify'
import { Database } from 'sql.js'
import { validateApiKey } from '../modules/api_key/api_key.service.js'
import { forwardRequest } from '../modules/proxy/proxy.service.js'
import { openaiToAnthropic, anthropicToOpenai, convertStreamChunk } from '../modules/proxy/format_converter.js'
import { run } from '../db/index.js'

export const registerChatRoutes = (app: FastifyInstance, db: Database, markDirty: () => void) => {
  app.post('/v1/chat/completions', async (request, reply) => {
    const authHeader = request.headers.authorization as string
    const key = authHeader?.replace('Bearer ', '')
    if (!key) {
      return reply.status(401).send({ error: { message: '缺少 API Key', type: 'auth_error' } })
    }

    const apiKey = validateApiKey(db, key)
    if (!apiKey) {
      return reply.status(401).send({ error: { message: '无效的 API Key', type: 'auth_error' } })
    }

    const openaiBody = request.body as any
    const anthropicBody = openaiToAnthropic(openaiBody)
    const originalModel = openaiBody.model || 'kimi-k2.5'

    const result = await forwardRequest(
      db,
      {
        method: 'POST',
        path: '/v1/messages',
        headers: {
          'content-type': 'application/json',
          'anthropic-version': '2023-06-01',
        },
        body: anthropicBody,
      },
      apiKey.id,
      (log) => {
        run(db,
          `INSERT INTO usage_logs (api_key_id, account_id, model, prompt_tokens, completion_tokens, cache_creation_tokens, cache_read_tokens, is_success, error_code, duration_ms)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [log.api_key_id, log.account_id, log.model, log.prompt_tokens, log.completion_tokens, log.cache_creation_tokens, log.cache_read_tokens, log.is_success, log.error_code, log.duration_ms]
        )
        markDirty()
      },
    )

    if (result.status >= 400) {
      return reply.status(result.status).send(result.body)
    }

    // 流式响应：转换 Anthropic SSE -> OpenAI SSE
    if (result.stream && result.streamGenerator) {
      reply.raw.writeHead(result.status, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      })
      const decoder = new TextDecoder()
      let buffer = ''
      try {
        for await (const chunk of result.streamGenerator) {
          buffer += decoder.decode(chunk, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''
          for (const line of lines) {
            const converted = convertStreamChunk(line, originalModel)
            if (converted) {
              reply.raw.write(converted)
            }
          }
        }
        buffer += decoder.decode(undefined, { stream: false })
        if (buffer.trim()) {
          const converted = convertStreamChunk(buffer, originalModel)
          if (converted) reply.raw.write(converted)
        }
      } catch {
        // 客户端断开连接等错误
      }
      result.pendingLog?.()
      reply.raw.end()
      return
    }

    // 非流式响应：转换 Anthropic -> OpenAI
    const openaiResp = anthropicToOpenai(result.body, originalModel)
    return reply.status(result.status).send(openaiResp)
  })
}
