import { FastifyInstance } from 'fastify'
import { Database } from 'sql.js'
import { config } from '../config.js'
import { queryAll, queryOne, run } from '../db/index.js'
import {
  createApiKey,
  listApiKeys,
  deleteApiKey,
  toggleApiKey,
} from '../modules/api_key/api_key.service.js'
import {
  createAccount,
  listAccounts,
  updateAccount,
  deleteAccount,
  getAccount,
  updateAccountStatus,
} from '../modules/account/account.service.js'
import { getAccountHealth } from '../modules/health/health.service.js'
import { getOrCreateStats } from '../modules/account/account.stats.js'

const adminAuth = (request: any): boolean => {
  if (!config.adminKey) return false
  const auth = request.headers.authorization as string
  const key = auth?.replace('Bearer ', '')
  return key === config.adminKey
}

export const registerAdminRoutes = (app: FastifyInstance, db: Database, markDirty: () => void) => {
  app.addHook('onRequest', async (request, reply) => {
    if ((request.url as string).startsWith('/admin/') && !adminAuth(request)) {
      return reply.status(401).send({ error: { message: '需要管理员认证' } })
    }
  })

  // API Key 管理
  app.post('/admin/api-keys', async (request, reply) => {
    try {
      const { name, rate_limit, brand } = request.body as any
      const result = createApiKey(db, name, brand, rate_limit)
      markDirty()
      return result
    } catch (err: any) {
      return reply.status(400).send({ error: { message: err.message || '创建失败' } })
    }
  })

  app.get('/admin/api-keys', async () => {
    return listApiKeys(db)
  })

  app.delete('/admin/api-keys/:id', async (request, reply) => {
    const { id } = request.params as any
    const ok = deleteApiKey(db, Number(id))
    if (!ok) return reply.status(404).send({ error: '未找到' })
    markDirty()
    return { success: true }
  })

  app.post('/admin/api-keys/:id/toggle', async (request) => {
    const { id } = request.params as any
    const result = toggleApiKey(db, Number(id))
    markDirty()
    return result
  })

  // 账号管理
  app.post('/admin/accounts', async (request, reply) => {
    try {
      const body = request.body as any
      const result = createAccount(db, body)
      markDirty()
      return result
    } catch (err: any) {
      return reply.status(400).send({ error: { message: err.message || '创建失败' } })
    }
  })

  app.get('/admin/accounts', async () => {
    return listAccounts(db)
  })

  app.get('/admin/accounts/:id', async (request, reply) => {
    const { id } = request.params as any
    const account = getAccount(db, Number(id))
    if (!account) return reply.status(404).send({ error: '未找到' })
    return account
  })

  app.put('/admin/accounts/:id', async (request, reply) => {
    try {
      const { id } = request.params as any
      const body = request.body as any
      const updated = updateAccount(db, Number(id), body)
      if (!updated) return reply.status(404).send({ error: '未找到' })
      markDirty()
      return updated
    } catch (err: any) {
      return reply.status(400).send({ error: { message: err.message || '更新失败' } })
    }
  })

  app.delete('/admin/accounts/:id', async (request, reply) => {
    const { id } = request.params as any
    const ok = deleteAccount(db, Number(id))
    if (!ok) return reply.status(404).send({ error: '未找到' })
    markDirty()
    return { success: true }
  })

  app.post('/admin/accounts/:id/toggle', async (request, reply) => {
    const { id } = request.params as any
    const account = getAccount(db, Number(id))
    if (!account) return reply.status(404).send({ error: '未找到' })
    const newStatus = account.status === 'active' ? 'disabled' : 'active'
    updateAccountStatus(db, Number(id), newStatus)
    markDirty()
    return getAccount(db, Number(id))
  })

  // 路由统计
  app.get('/admin/routing-stats', async () => {
    const accounts = listAccounts(db)
    return accounts.map(acc => {
      const stats = getOrCreateStats(db, acc.id)
      const failureRate = stats.request_count > 0
        ? (stats.failure_count / stats.request_count * 100).toFixed(1)
        : '0.0'
      return {
        ...acc,
        ewma_latency_ms: Math.round(stats.ewma_latency_ms),
        request_count: stats.request_count,
        failure_rate: `${failureRate}%`,
        consecutive_failures: stats.consecutive_failures,
      }
    })
  })

  // 测试账号连通性
  app.post('/admin/accounts/:id/test', async (request, reply) => {
    const { id } = request.params as any
    const account = getAccount(db, Number(id))
    if (!account) return reply.status(404).send({ error: '未找到' })
    try {
      const url = `${account.base_url}/v1/messages`
      const startTime = Date.now()
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': account.api_key,
          'anthropic-version': '2023-06-01',
          'user-agent': 'Claude-Code/1.0',
        },
        body: JSON.stringify({
          model: account.models?.split(',').map((m: string) => m.trim()).find(Boolean) || 'kimi-k2.5',
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 1,
        }),
      })
      const duration = Date.now() - startTime
      const body = await resp.json().catch(() => null)
      return {
        ok: resp.ok,
        status: resp.status,
        duration_ms: duration,
        response: body,
      }
    } catch (err: any) {
      return { ok: false, error: err.message }
    }
  })

  // 健康和统计
  app.get('/admin/health', async () => {
    return getAccountHealth(db)
  })

  // API Key 统计
  app.get('/admin/stats', async () => {
    const stats = queryAll(db, `
      SELECT
        api_key_id,
        model,
        COUNT(*) as request_count,
        SUM(COALESCE(prompt_tokens, 0)) as total_input,
        SUM(COALESCE(completion_tokens, 0)) as total_output,
        SUM(COALESCE(cache_creation_tokens, 0)) as total_cache_write,
        SUM(COALESCE(cache_read_tokens, 0)) as total_cache_read,
        SUM(COALESCE(prompt_tokens, 0) + COALESCE(completion_tokens, 0)) as total_tokens
      FROM usage_logs
      WHERE is_success = 1
      GROUP BY api_key_id, model
      ORDER BY api_key_id, model
    `)
    return stats
  })

  app.get('/admin/usage', async (request) => {
    const { limit = 100, offset = 0 } = request.query as any
    const logs = queryAll(db,
      'SELECT * FROM usage_logs ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [Number(limit), Number(offset)]
    )
    const total = queryOne(db, 'SELECT COUNT(*) as count FROM usage_logs')
    return { total: total?.count || 0, logs }
  })
}
