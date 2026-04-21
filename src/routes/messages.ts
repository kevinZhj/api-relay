import { FastifyInstance } from 'fastify'
import { Database } from 'sql.js'
import { validateApiKey } from '../modules/api_key/api_key.service.js'
import { forwardRequest } from '../modules/proxy/proxy.service.js'
import { run } from '../db/index.js'

export const registerMessagesRoutes = (app: FastifyInstance, db: Database, markDirty: () => void) => {
  app.post('/v1/messages', async (request, reply) => {
    const apiKeyHeader = request.headers['x-api-key'] as string
    const authHeader = request.headers.authorization as string
    const key = apiKeyHeader || authHeader?.replace('Bearer ', '')
    if (!key) {
      return reply.status(401).send({ error: { message: '缺少 API Key', type: 'auth_error' } })
    }

    const apiKey = validateApiKey(db, key)
    if (!apiKey) {
      return reply.status(401).send({ error: { message: '无效的 API Key', type: 'auth_error' } })
    }

    const body = request.body as any
    const result = await forwardRequest(
      db,
      {
        method: 'POST',
        path: '/v1/messages',
        headers: {
          'content-type': 'application/json',
          'anthropic-version': '2023-06-01',
        },
        body,
      },
      apiKey.id,
      apiKey.brand || undefined,
      (log) => {
        run(db,
          `INSERT INTO usage_logs (api_key_id, account_id, model, prompt_tokens, completion_tokens, cache_creation_tokens, cache_read_tokens, is_success, error_code, duration_ms)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [log.api_key_id, log.account_id, log.model, log.prompt_tokens, log.completion_tokens, log.cache_creation_tokens, log.cache_read_tokens, log.is_success, log.error_code, log.duration_ms]
        )
        markDirty()
      },
    )

    // 流式响应（SSE）
    if (result.stream && result.streamGenerator) {
      reply.raw.writeHead(result.status, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      })
      try {
        for await (const chunk of result.streamGenerator) {
          reply.raw.write(chunk)
        }
      } catch {
        // 客户端断开连接等错误
      }
      // 流结束后记录日志（此时 usage 已从 SSE 中提取完毕）
      result.pendingLog?.()
      reply.raw.end()
      return
    }

    return reply.status(result.status).headers(result.headers).send(result.body)
  })
}
