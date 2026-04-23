import { FastifyInstance } from 'fastify'
import { Database } from 'sql.js'
import { timingSafeEqual } from 'crypto'
import { config, buildApiUrl } from '../config.js'
import { queryAll, queryOne, run, runInsert } from '../db/index.js'
import {
  createApiKey,
  listApiKeys,
  deleteApiKey,
  toggleApiKey,
  updateApiKey,
  resetUsedTokens,
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
  const key = (auth?.replace('Bearer ', '') ?? '') as string
  const expected = config.adminKey
  if (key.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(key), Buffer.from(expected))
}

export const registerAdminRoutes = (app: FastifyInstance, db: Database, markDirty: () => void) => {
  // 审计日志记录
  const auditLog = (action: string, targetType: string, targetId: number | null, detail: string, ip = '') => {
    run(db, 'INSERT INTO audit_logs (action, target_type, target_id, detail, ip) VALUES (?, ?, ?, ?, ?)',
      [action, targetType, targetId, detail, ip])
  }

  app.addHook('onRequest', async (request, reply) => {
    if ((request.url as string).startsWith('/admin/') && !adminAuth(request)) {
      return reply.status(401).send({ error: { message: '需要管理员认证' } })
    }
  })

  // API Key 管理
  app.post('/admin/api-keys', async (request, reply) => {
    try {
      const { name, rate_limit, brand, expires_at, token_quota, allowed_models } = request.body as any
      const result = createApiKey(db, name, brand, rate_limit, expires_at ?? null, token_quota ?? 0, allowed_models ?? '')
      auditLog('create', 'api_key', result.id, name)
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
    auditLog('delete', 'api_key', Number(id), '')
    markDirty()
    return { success: true }
  })

  app.post('/admin/api-keys/:id/toggle', async (request) => {
    const { id } = request.params as any
    const result = toggleApiKey(db, Number(id))
    auditLog('toggle', 'api_key', Number(id), '')
    markDirty()
    return result
  })

  app.post('/admin/api-keys/:id/reset-quota', async (request, reply) => {
    const { id } = request.params as any
    const result = resetUsedTokens(db, Number(id))
    if (!result) return reply.status(404).send({ error: '未找到' })
    auditLog('reset_quota', 'api_key', Number(id), '')
    markDirty()
    return result
  })

  app.put('/admin/api-keys/:id', async (request, reply) => {
    const { id } = request.params as any
    const body = request.body as any
    const updated = updateApiKey(db, Number(id), body)
    if (!updated) return reply.status(404).send({ error: '未找到' })
    auditLog('update', 'api_key', Number(id), '')
    markDirty()
    return updated
  })

  // 账号管理
  app.post('/admin/accounts', async (request, reply) => {
    try {
      const body = request.body as any
      const result = createAccount(db, body)
      auditLog('create', 'account', result.id, body.name || '')
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
      auditLog('update', 'account', Number(id), '')
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
    auditLog('delete', 'account', Number(id), '')
    markDirty()
    return { success: true }
  })

  app.post('/admin/accounts/:id/toggle', async (request, reply) => {
    const { id } = request.params as any
    const account = getAccount(db, Number(id))
    if (!account) return reply.status(404).send({ error: '未找到' })
    const newStatus = account.status === 'active' ? 'disabled' : 'active'
    updateAccountStatus(db, Number(id), newStatus)
    auditLog('toggle', 'account', Number(id), newStatus)
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
      const isAnthropic = account.protocol === 'anthropic' || (account.protocol === 'auto' && (account.base_url.includes('moonshot') || account.base_url.includes('kimi')))
      const url = isAnthropic
        ? buildApiUrl(account.base_url, '/v1/messages')
        : buildApiUrl(account.base_url, '/v1/chat/completions')
      const testModel = account.models?.split(',').map((m: string) => m.trim()).find(Boolean) ?? 'kimi-k2.5'
      const startTime = Date.now()
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(isAnthropic
            ? { 'x-api-key': account.api_key, 'anthropic-version': '2023-06-01' }
            : { 'authorization': `Bearer ${account.api_key}` }),
          'user-agent': 'Claude-Code/1.0',
        },
        body: JSON.stringify(isAnthropic
          ? { model: testModel, messages: [{ role: 'user', content: 'hi' }], max_tokens: 1 }
          : { model: testModel, messages: [{ role: 'user', content: 'hi' }], max_tokens: 1 }),
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

  // 上游模型自动发现
  app.post('/admin/accounts/:id/models', async (request, reply) => {
    const { id } = request.params as any
    const account = getAccount(db, Number(id))
    if (!account) return reply.status(404).send({ error: '未找到' })
    try {
      const url = buildApiUrl(account.base_url, '/v1/models')
      const resp = await fetch(url, {
        headers: { 'authorization': `Bearer ${account.api_key}`, 'user-agent': 'Claude-Code/1.0' },
      })
      if (!resp.ok) {
        return { ok: false, error: `上游返回 ${resp.status}` }
      }
      const body = await resp.json() as any
      const models = (body.data || []).map((m: any) => m.id).filter(Boolean)
      if (models.length === 0) {
        return { ok: false, error: '上游未返回模型列表' }
      }
      // 与现有模型合并
      const existing = (account.models || '').split(',').map((m: string) => m.trim()).filter(Boolean)
      const merged = [...new Set([...existing, ...models])]
      const modelsStr = merged.join(',')
      run(db, 'UPDATE accounts SET models = ? WHERE id = ?', [modelsStr, account.id])
      markDirty()
      return { ok: true, found: models.length, models: modelsStr }
    } catch (err: any) {
      return { ok: false, error: err.message }
    }
  })

  // 分组管理
  app.get('/admin/brands', async () => {
    return queryAll(db, 'SELECT * FROM brands ORDER BY id')
  })

  app.post('/admin/brands', async (request, reply) => {
    const { name } = request.body as any
    if (!name) return reply.status(400).send({ error: { message: '请填写分组名称' } })
    try {
      const id = runInsert(db, 'INSERT INTO brands (name) VALUES (?)', [name.trim()])
      auditLog('create', 'brand', id, name.trim())
      markDirty()
      return queryOne(db, 'SELECT * FROM brands WHERE id = ?', [id])
    } catch {
      return reply.status(400).send({ error: { message: '分组已存在' } })
    }
  })

  app.delete('/admin/brands/:id', async (request, reply) => {
    const { id } = request.params as any
    const before = queryOne(db, 'SELECT id FROM brands WHERE id = ?', [Number(id)])
    if (!before) return reply.status(404).send({ error: '未找到' })
    run(db, 'DELETE FROM brands WHERE id = ?', [Number(id)])
    auditLog('delete', 'brand', Number(id), '')
    markDirty()
    return { success: true }
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
    const { limit = 50, offset = 0, model, device, is_success, date_from, date_to } = request.query as any
    const conditions: string[] = []
    const params: any[] = []
    if (model) { conditions.push('l.model = ?'); params.push(model) }
    if (device) { conditions.push("COALESCE(NULLIF(l.device_name, ''), k.name) = ?"); params.push(device) }
    if (is_success !== undefined && is_success !== '') { conditions.push('l.is_success = ?'); params.push(Number(is_success)) }
    if (date_from) { conditions.push("l.created_at >= ?"); params.push(date_from) }
    if (date_to) { conditions.push("l.created_at <= ?"); params.push(date_to + ' 23:59:59') }
    const where = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : ''
    const logs = queryAll(db,
      `SELECT l.*, COALESCE(NULLIF(l.device_name, ''), k.name) as device_name FROM usage_logs l LEFT JOIN api_keys k ON l.api_key_id = k.id ${where} ORDER BY l.created_at DESC LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    )
    // 时间校准
    for (const log of logs) {
      const createdAt = log.created_at
      if (createdAt && createdAt.includes('+')) {
        log.created_at = createdAt.replace(/\+08:00$/, '')
      } else if (createdAt) {
        const d = new Date(createdAt.replace(' ', 'T') + 'Z')
        const pad = (n: number) => String(n).padStart(2, '0')
        log.created_at = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
      }
    }
    const totalRow = queryOne(db, `SELECT COUNT(*) as count FROM usage_logs l LEFT JOIN api_keys k ON l.api_key_id = k.id ${where}`, params)
    return { total: totalRow?.count ?? 0, logs }
  })

  // 配置导出
  app.get('/admin/export', async () => {
    const accounts = queryAll(db, 'SELECT * FROM accounts')
    const keys = queryAll(db, 'SELECT * FROM api_keys')
    const brands = queryAll(db, 'SELECT * FROM brands')
    // 脱敏：账号 API Key 只保留前后几位
    const safeAccounts = accounts.map(a => ({
      ...a,
      api_key: a.api_key.slice(0, 8) + '***' + a.api_key.slice(-4),
    }))
    // 脱敏：Key 只保留前后几位
    const safeKeys = keys.map(k => ({
      ...k,
      key: k.key.slice(0, 8) + '***' + k.key.slice(-4),
    }))
    return {
      version: 1,
      exported_at: new Date().toISOString(),
      accounts: safeAccounts,
      api_keys: safeKeys,
      brands,
    }
  })

  // 配置导入（追加模式）
  app.post('/admin/import', async (request, reply) => {
    const data = request.body as any
    if (!data || !data.version) {
      return reply.status(400).send({ error: { message: '无效的导入文件' } })
    }
    let imported = { accounts: 0, keys: 0, brands: 0 }

    // 导入分组
    if (Array.isArray(data.brands)) {
      for (const b of data.brands) {
        if (!b.name) continue
        const exists = queryOne(db, 'SELECT id FROM brands WHERE name = ?', [b.name])
        if (!exists) {
          runInsert(db, 'INSERT INTO brands (name) VALUES (?)', [b.name])
          imported.brands++
        }
      }
    }

    // 导入账号（需要原始 API Key，脱敏的跳过）
    if (Array.isArray(data.accounts)) {
      for (const a of data.accounts) {
        if (!a.name || !a.api_key || a.api_key.includes('***')) continue
        const exists = queryOne(db, 'SELECT id FROM accounts WHERE api_key = ?', [a.api_key])
        if (!exists) {
          run(db, 'INSERT INTO accounts (name, api_key, base_url, status, priority, total_quota, used_quota, models, brand, protocol, weight, is_default) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
            [a.name, a.api_key, a.base_url || '', a.status || 'active', a.priority || 0, a.total_quota || null, a.used_quota || 0, a.models || '', a.brand || '', a.protocol || 'auto', a.weight || 100, a.is_default || 0])
          imported.accounts++
        }
      }
    }

    // 导入 Key（需要原始 Key，脱敏的跳过）
    if (Array.isArray(data.api_keys)) {
      for (const k of data.api_keys) {
        if (!k.name || !k.key || k.key.includes('***')) continue
        const exists = queryOne(db, 'SELECT id FROM api_keys WHERE key = ?', [k.key])
        if (!exists) {
          run(db, 'INSERT INTO api_keys (key, name, brand, rate_limit, is_active, expires_at, token_quota, allowed_models) VALUES (?,?,?,?,?,?,?,?)',
            [k.key, k.name, k.brand || '', k.rate_limit || 60, k.is_active ?? 1, k.expires_at || null, k.token_quota || 0, k.allowed_models || ''])
          imported.keys++
        }
      }
    }

    markDirty()
    return { success: true, imported }
  })

  // 审计日志查询
  app.get('/admin/audit-logs', async (request) => {
    const { limit = 100 } = request.query as any
    return queryAll(db, 'SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?', [Number(limit)])
  })
}
