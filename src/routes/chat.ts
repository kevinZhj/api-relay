import { FastifyInstance } from 'fastify'
import { Database } from 'sql.js'
import { validateApiKey, addUsedTokens } from '../modules/api_key/api_key.service.js'
import { forwardRequest } from '../modules/proxy/proxy.service.js'
import { run, getLocalDateTime } from '../db/index.js'

// 检查模型是否在白名单中（空字符串表示不限制）
const isModelAllowed = (apiKey: any, model: string): boolean => {
  if (!apiKey.allowed_models) return true
  const allowed = apiKey.allowed_models.split(',').map((m: string) => m.trim().toLowerCase()).filter(Boolean)
  if (allowed.length === 0) return true
  return allowed.includes(model.toLowerCase())
}

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

    // 模型白名单检查
    if (openaiBody?.model && !isModelAllowed(apiKey, openaiBody.model)) {
      return reply.status(403).send({ error: { message: `无权使用模型: ${openaiBody.model}`, type: 'permission_error' } })
    }

    const result = await forwardRequest(
      db,
      {
        method: 'POST',
        path: '/v1/chat/completions',
        headers: {
          'content-type': 'application/json',
          'anthropic-version': request.headers['anthropic-version'] as string || '2023-06-01',
          ...(request.headers['anthropic-beta'] ? { 'anthropic-beta': request.headers['anthropic-beta'] } : {}),
        },
        body: openaiBody,
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

    if (result.status >= 400) {
      return reply.status(result.status).send(result.body)
    }

    // 流式响应：直接透传（doForward 已处理格式转换）
    if (result.stream && result.streamGenerator) {
      const streamHeaders: Record<string, string> = {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      }
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
      result.pendingLog?.()
      reply.raw.end()
      return
    }

    // 非流式响应：直接返回（doForward 已处理格式转换）
    return reply.status(result.status).send(result.body)
  })
}
