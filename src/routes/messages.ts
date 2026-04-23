import { FastifyInstance } from 'fastify'
import { Database } from 'sql.js'
import { validateApiKey, addUsedTokens } from '../modules/api_key/api_key.service.js'
import { forwardRequest } from '../modules/proxy/proxy.service.js'
import { run, getLocalDateTime } from '../db/index.js'

// 检查模型是否在白名单中
const isModelAllowed = (apiKey: any, model: string): boolean => {
  if (!apiKey.allowed_models) return true
  const allowed = apiKey.allowed_models.split(',').map((m: string) => m.trim().toLowerCase()).filter(Boolean)
  if (allowed.length === 0) return true
  return allowed.includes(model.toLowerCase())
}

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

    // 模型白名单检查
    if (body?.model && !isModelAllowed(apiKey, body.model)) {
      return reply.status(403).send({ error: { message: `无权使用模型: ${body.model}`, type: 'permission_error' } })
    }
    const result = await forwardRequest(
      db,
      {
        method: 'POST',
        path: '/v1/messages',
        headers: {
          'content-type': 'application/json',
          'anthropic-version': request.headers['anthropic-version'] as string || '2023-06-01',
          ...(request.headers['anthropic-beta'] ? { 'anthropic-beta': request.headers['anthropic-beta'] } : {}),
        },
        body,
      },
      apiKey.id,
      apiKey.brand || undefined,
      (log) => {
        run(db,
          `INSERT INTO usage_logs (api_key_id, account_id, model, prompt_tokens, completion_tokens, cache_creation_tokens, cache_read_tokens, is_success, error_code, duration_ms, device_name, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [log.api_key_id, log.account_id, log.model, log.prompt_tokens, log.completion_tokens, log.cache_creation_tokens, log.cache_read_tokens, log.is_success, log.error_code, log.duration_ms, apiKey.name, getLocalDateTime()]
        )
        // 成功时累加 token 配额
        if (log.is_success) {
          const tokens = (log.prompt_tokens || 0) + (log.completion_tokens || 0)
          if (tokens > 0) addUsedTokens(db, apiKey.id, tokens)
        }
        markDirty()
      },
    )

    // 流式响应（SSE）
    if (result.stream && result.streamGenerator) {
      const streamHeaders: Record<string, string> = {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      }
      // 透传后端重要响应头
      if (result.headers['x-request-id']) streamHeaders['x-request-id'] = result.headers['x-request-id']
      if (result.headers['retry-after']) streamHeaders['retry-after'] = result.headers['retry-after']
      reply.raw.writeHead(result.status, streamHeaders)
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
