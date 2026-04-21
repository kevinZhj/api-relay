# 智能路由优化实现计划

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 在现有 api-relay 中转站上实现智能路由引擎、双协议入口、主动健康探测，并修复现有基线测试失败。

**Architecture:** 基于 EWMA 响应时间的加权路由算法 + 双协议入口（OpenAI/Anthropic） + 定时健康探测。

**Tech Stack:** Fastify 5.x, TypeScript, sql.js (SQLite), Vitest, pnpm

**Worktree:** `/mnt/e/中转站/.worktrees/feature-smart-router`

---

## 任务清单

| 任务 | 内容 | 预估 |
|-------|------|------|
| T1 | 数据库迁移与字段扩展 | 5min |
| T2 | 实现 account_stats 服务 | 5min |
| T3 | 实现智能路由选择器 | 5min |
| T4 | 修复现有测试失败 (health + proxy 503) | 5min |
| T5 | 集成响应时间追踪到 proxy.service | 5min |
| T6 | 新增 Anthropic 入口路由 (/v1/messages) | 5min |
| T7 | 扩展格式转换器（Anthropic↔OpenAI双向） | 10min |
| T8 | proxy.service 协议分支与模型映射 | 5min |
| T9 | 更新 models 路由与服务器注册 | 5min |
| T10 | 主动健康探测服务 | 5min |
| T11 | 管理面板增强（响应时间、成功率、路由分数） | 10min |
| T12 | 配置与环境变量更新 | 5min |

---

### Task 1: 数据库迁移与字段扩展

**Objective:** 新增 account_stats 表、health_probes 表，并为 accounts 表扩展字段。

**Files:**
- Modify: `src/db/migrations.ts`

**Step 1: 扩展迁移**

在 `MIGRATIONS` 数组末尾添加：

```typescript
  // 账号性能统计表
  `CREATE TABLE IF NOT EXISTS account_stats (
    account_id INTEGER PRIMARY KEY,
    ewma_latency_ms REAL DEFAULT 0,
    request_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    consecutive_failures INTEGER DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now'))
  )`,
  // 主动健康探测日志
  `CREATE TABLE IF NOT EXISTS health_probes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    is_success INTEGER DEFAULT 0,
    latency_ms INTEGER,
    error_code TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`,
  // accounts 表扩展
  `ALTER TABLE accounts ADD COLUMN brand TEXT DEFAULT ''`,
  `ALTER TABLE accounts ADD COLUMN protocol TEXT DEFAULT 'auto'`,
  `ALTER TABLE accounts ADD COLUMN weight INTEGER DEFAULT 100`,
  `ALTER TABLE accounts ADD COLUMN is_default INTEGER DEFAULT 0`,
```

**Step 2: 验证**

Run: `pnpm test src/db/db.test.ts`
Expected: PASS (5 tests)

**Step 3: Commit**

```bash
git add src/db/migrations.ts
git commit -m "feat(db): add account_stats, health_probes tables and extend accounts"
```

---

### Task 2: 实现 account_stats 服务

**Objective:** 实现账号性能统计的创建、更新、查询。

**Files:**
- Create: `src/modules/account/account.stats.ts`
- Create: `src/modules/account/account.stats.test.ts`

**Step 1: 创建服务**

```typescript
import { Database } from 'sql.js'
import { queryOne, run } from '../../db/index.js'

export interface AccountStats {
  account_id: number
  ewma_latency_ms: number
  request_count: number
  failure_count: number
  consecutive_failures: number
  updated_at: string
}

const HALF_LIFE = 10 // EWMA 半衰期以请求次数计
const ALPHA = 1 - Math.exp(-Math.LN2 / HALF_LIFE)

export const getOrCreateStats = (db: Database, accountId: number): AccountStats => {
  const stats = queryOne(db, 'SELECT * FROM account_stats WHERE account_id = ?', [accountId]) as AccountStats | null
  if (stats) return stats
  run(db, 'INSERT INTO account_stats (account_id) VALUES (?)', [accountId])
  return {
    account_id: accountId,
    ewma_latency_ms: 0,
    request_count: 0,
    failure_count: 0,
    consecutive_failures: 0,
    updated_at: new Date().toISOString(),
  }
}

export const recordSuccess = (db: Database, accountId: number, latencyMs: number): void => {
  const stats = getOrCreateStats(db, accountId)
  const newEwma = stats.ewma_latency_ms === 0
    ? latencyMs
    : stats.ewma_latency_ms * (1 - ALPHA) + latencyMs * ALPHA
  const newCount = Math.min(stats.request_count + 1, 100)
  run(db,
    `UPDATE account_stats
     SET ewma_latency_ms = ?, request_count = ?, consecutive_failures = 0,
         updated_at = datetime('now')
     WHERE account_id = ?`,
    [newEwma, newCount, accountId]
  )
}

export const recordFailure = (db: Database, accountId: number): void => {
  const stats = getOrCreateStats(db, accountId)
  const newFailureCount = Math.min(stats.failure_count + 1, 100)
  const newConsecutive = stats.consecutive_failures + 1
  const newCount = Math.min(stats.request_count + 1, 100)
  run(db,
    `UPDATE account_stats
     SET failure_count = ?, consecutive_failures = ?, request_count = ?,
         updated_at = datetime('now')
     WHERE account_id = ?`,
    [newFailureCount, newConsecutive, newCount, accountId]
  )
}

export const getAllStats = (db: Database): AccountStats[] => {
  return queryOne(db, 'SELECT * FROM account_stats') as AccountStats[] || []
}

export const resetConsecutiveFailures = (db: Database, accountId: number): void => {
  run(db, 'UPDATE account_stats SET consecutive_failures = 0 WHERE account_id = ?', [accountId])
}
```

**Step 2: 创建测试**

```typescript
import { describe, it, expect } from 'vitest'
import { Database } from 'sql.js'
import { initDb } from '../../db/index.js'
import { getOrCreateStats, recordSuccess, recordFailure } from './account.stats.js'

describe('account.stats', () => {
  const setup = () => {
    const db = initDb(':memory:')
    return db
  }

  it('应该创建新的 stats', () => {
    const db = setup()
    const stats = getOrCreateStats(db, 1)
    expect(stats.account_id).toBe(1)
    expect(stats.ewma_latency_ms).toBe(0)
  })

  it('记录成功应该更新 EWMA', () => {
    const db = setup()
    recordSuccess(db, 1, 100)
    const stats = getOrCreateStats(db, 1)
    expect(stats.ewma_latency_ms).toBe(100)
    recordSuccess(db, 1, 200)
    const stats2 = getOrCreateStats(db, 1)
    expect(stats2.ewma_latency_ms).toBeGreaterThan(100)
    expect(stats2.ewma_latency_ms).toBeLessThan(200)
  })

  it('记录失败应该增加失败计数', () => {
    const db = setup()
    recordFailure(db, 1)
    const stats = getOrCreateStats(db, 1)
    expect(stats.failure_count).toBe(1)
    expect(stats.consecutive_failures).toBe(1)
  })
})
```

**Step 3: 验证**

Run: `pnpm test src/modules/account/account.stats.test.ts`
Expected: PASS (3 tests)

**Step 4: Commit**

```bash
git add src/modules/account/account.stats.ts src/modules/account/account.stats.test.ts
git commit -m "feat(routing): add account stats service with EWMA latency tracking"
```

---

### Task 3: 实现智能路由选择器

**Objective:** 替换简单的 priority+last_used 排序，实现加权路由算法。

**Files:**
- Modify: `src/modules/account/account.selector.ts`
- Create: `src/modules/account/account.selector.test.ts`

**Step 1: 重写选择器**

```typescript
import { Database } from 'sql.js'
import { Account } from './account.service.js'
import { queryOne, queryAll } from '../../db/index.js'
import { getOrCreateStats } from './account.stats.js'
import { config } from '../../config.js'

export interface RoutingOptions {
  excludeIds?: number[]
  modelName?: string
}

const calculateScore = (
  account: Account,
  stats: ReturnType<typeof getOrCreateStats>,
): number => {
  if (config.routingStrategy === 'round_robin') return Math.random()
  if (config.routingStrategy === 'priority') return -account.priority
  if (config.routingStrategy === 'random') return Math.random()

  // latency strategy (default)
  const latency = stats.ewma_latency_ms || 1000
  const normalizedLatency = latency / 1000 // 归一化到秒级

  const failureRate = stats.request_count > 0
    ? stats.failure_count / stats.request_count
    : 0
  const failurePenalty = 1 + failureRate * 10

  let quotaPenalty = 1
  if (account.total_quota && account.total_quota > 0) {
    const remaining = 1 - account.used_quota / account.total_quota
    if (remaining < 0.05) quotaPenalty = 3.0
    else if (remaining < 0.2) quotaPenalty = 1.5
  }

  const priorityBoost = Math.pow(2, account.priority / 10)

  return (normalizedLatency * (config.latencyWeight || 1.0))
    * failurePenalty
    * quotaPenalty
    / priorityBoost
}

export const selectAccount = (db: Database, options?: RoutingOptions): Account | null => {
  const accounts = queryAll(db, `SELECT * FROM accounts WHERE status = 'active'`) as Account[]
  if (accounts.length === 0) return null

  let candidates = accounts

  if (options?.excludeIds?.length) {
    candidates = candidates.filter(a => !options.excludeIds!.includes(a.id))
  }

  if (options?.modelName) {
    const normalizedModel = options.modelName.toLowerCase()
    candidates = candidates.filter(a => {
      if (!a.models) return true
      const supported = a.models.split(',').map(m => m.trim().toLowerCase())
      return supported.includes(normalizedModel) || supported.length === 0
    })
  }

  if (candidates.length === 0) return null

  // 计算分数并排序，分数低的优先
  const scored = candidates.map(account => {
    const stats = getOrCreateStats(db, account.id)
    return { account, score: calculateScore(account, stats) }
  })

  scored.sort((a, b) => a.score - b.score)
  return scored[0]?.account || null
}

export const selectNextAccount = (db: Database, excludeIds: number[], modelName?: string): Account | null => {
  return selectAccount(db, { excludeIds, modelName })
}
```

**Step 2: 测试**

```typescript
import { describe, it, expect } from 'vitest'
import { initDb } from '../../db/index.js'
import { createAccount } from './account.service.js'
import { selectAccount, selectNextAccount } from './account.selector.js'

describe('account.selector smart routing', () => {
  const setup = () => {
    const db = initDb(':memory:')
    // 创建两个账号，一个优先级高，一个优先级低
    createAccount(db, { name: 'A', api_key: 'sk-a', priority: 10 })
    createAccount(db, { name: 'B', api_key: 'sk-b', priority: 0 })
    return db
  }

  it('应该选择优先级更高的账号', () => {
    const db = setup()
    const acc = selectAccount(db)
    expect(acc?.name).toBe('A')
  })

  it('excludeIds 应该排除已尝试的账号', () => {
    const db = setup()
    const acc = selectNextAccount(db, [1])
    expect(acc?.name).toBe('B')
  })

  it('没有可用账号时返回 null', () => {
    const db = initDb(':memory:')
    const acc = selectAccount(db)
    expect(acc).toBeNull()
  })
})
```

**Step 3: 验证**

Run: `pnpm test src/modules/account/account.selector.test.ts`
Expected: PASS (3 tests)

**Step 4: Commit**

```bash
git add src/modules/account/account.selector.ts src/modules/account/account.selector.test.ts
git commit -m "feat(routing): implement latency-weighted smart account selector"
```

---

### Task 4: 修复现有测试失败

**Objective:** 修复 health.recoverRateLimited 时间比较问题和 proxy 503 回退问题。

**Files:**
- Modify: `src/modules/health/health.service.ts`
- Modify: `src/modules/proxy/proxy.service.ts`

**Step 1: 修复 recoverRateLimited**

问题：SQLite `datetime('now')` 返回 `YYYY-MM-DD HH:MM:SS`，但测试中手动设置的 `last_error_at` 可能格式不一致或时区不同。

修改 `health.service.ts`：

```typescript
export const recoverRateLimited = (db: Database): number => {
  const minutes = config.rateLimitRecoveryMinutes
  // 使用 julianday 进行精确的时间比较，避免格式问题
  const limited = queryAll(db,
    `SELECT id FROM accounts WHERE status = 'rate_limited'
     AND julianday('now') - julianday(last_error_at) * 86400 >= ? * 60`,
    [minutes]
  )
  if (limited.length === 0) return 0
  run(db,
    `UPDATE accounts SET status = 'active', last_error = NULL, last_error_at = NULL,
     updated_at = datetime('now')
     WHERE status = 'rate_limited'
     AND julianday('now') - julianday(last_error_at) * 86400 >= ? * 60`,
    [minutes]
  )
  return limited.length
}
```

**Step 2: 修复 proxy 503 回退**

问题：当 `selectAccount` 返回 null（没有可用账号）时，`forwardRequest` 没有正确处理，走到了最后的网络错误回退，返回了 502。

修改 `proxy.service.ts`，在 `forwardRequest` 函数中，当 `selectAccount` 返回 null 时立即返回 503：

在循环之前添加：

```typescript
  // 第一次尝试前先检查是否有可用账号
  const firstAccount = selectAccount(db, { modelName: proxyReq.body?.model })
  if (!firstAccount) {
    return {
      status: 503,
      headers: { 'content-type': 'application/json' },
      body: { error: { message: '没有可用的后端账号', type: 'server_error' } },
      stream: false,
      usedAccountId: null,
    }
  }
```

然后在循环中使用 `selectNextAccount`。

**Step 3: 验证**

Run: `pnpm test`
Expected: 45 tests PASS (0 failed)

**Step 4: Commit**

```bash
git add src/modules/health/health.service.ts src/modules/proxy/proxy.service.ts
git commit -m "fix: recoverRateLimited time comparison and proxy 503 fallback"
```

---

### Task 5: 集成响应时间追踪到 proxy.service

**Objective:** 在请求成功/失败时记录到 account_stats。

**Files:**
- Modify: `src/modules/proxy/proxy.service.ts`

**Step 1: 导入并集成**

在 `proxy.service.ts` 引入：
```typescript
import { recordSuccess, recordFailure } from '../account/account.stats.js'
```

在 `forwardRequest` 中，成功时：
```typescript
recordSuccess(db, account.id, duration)
```

在失败 catch 中和标记状态时：
```typescript
recordFailure(db, account.id)
```

**Step 2: 验证**

Run: `pnpm test src/modules/proxy/proxy.test.ts`
Expected: PASS (2 tests)

**Step 3: Commit**

```bash
git add src/modules/proxy/proxy.service.ts
git commit -m "feat(routing): integrate latency tracking into proxy requests"
```

---

### Task 6: 新增 Anthropic 入口路由 (/v1/messages)

**Objective:** 创建处理 Anthropic 格式请求的路由。

**Files:**
- Create: `src/routes/messages.ts` (存在，但是空的或需要重写)
- Modify: `src/server.ts`

**Step 1: 实现 messages 路由**

```typescript
import { FastifyInstance } from 'fastify'
import { Database } from 'sql.js'
import { validateApiKey } from '../modules/api_key/api_key.service.js'
import { forwardRequest } from '../modules/proxy/proxy.service.js'
import { run } from '../db/index.js'

export const registerMessagesRoutes = (app: FastifyInstance, db: Database, markDirty: () => void) => {
  app.post('/v1/messages', async (request, reply) => {
    const authHeader = request.headers.authorization as string
    const key = authHeader?.replace('Bearer ', '')
    if (!key) {
      return reply.status(401).send({ error: { message: '缺少 API Key', type: 'auth_error' } })
    }

    const apiKey = validateApiKey(db, key)
    if (!apiKey) {
      return reply.status(401).send({ error: { message: '无效的 API Key', type: 'auth_error' } })
    }

    const anthropicBody = request.body as any
    const originalModel = anthropicBody.model || 'claude-sonnet-4-20250514'

    // 注意：path 使用 /v1/messages，这是 Anthropic 原生路径
    const result = await forwardRequest(
      db,
      {
        method: 'POST',
        path: '/v1/messages',
        headers: {
          'content-type': 'application/json',
          'anthropic-version': request.headers['anthropic-version'] as string || '2023-06-01',
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
      } catch {}
      result.pendingLog?.()
      reply.raw.end()
      return
    }

    return reply.status(result.status).send(result.body)
  })
}
```

**Step 2: 注册路由**

在 `server.ts` 中确保：
```typescript
import { registerMessagesRoutes } from './routes/messages.js'
// ...
registerMessagesRoutes(app, db, markDirty)
```

**Step 3: Commit**

```bash
git add src/routes/messages.ts src/server.ts
git commit -m "feat(api): add Anthropic /v1/messages entrypoint"
```

---

### Task 7: 扩展格式转换器（双向）

**Objective:** 补全格式转换，支持 Anthropic↔OpenAI 双向转换。

**Files:**
- Modify: `src/modules/proxy/format_converter.ts`

**Step 1: 添加新转换函数**

在 `format_converter.ts` 末尾添加：

```typescript
// Anthropic 请求 → OpenAI 请求（用于 Anthropic 入口 → OpenAI 后端）
export const anthropicToOpenaiRequest = (anthropicBody: any): any => {
  const messages = (anthropicBody.messages || []).map((m: any) => ({
    role: m.role,
    content: m.content,
  }))
  if (anthropicBody.system) {
    messages.unshift({ role: 'system', content: anthropicBody.system })
  }

  const openai: any = {
    model: anthropicBody.model,
    messages,
    max_tokens: anthropicBody.max_tokens || 4096,
  }
  if (anthropicBody.stream) openai.stream = true
  if (anthropicBody.temperature !== undefined) openai.temperature = anthropicBody.temperature
  if (anthropicBody.top_p !== undefined) openai.top_p = anthropicBody.top_p
  return openai
}

// OpenAI 响应 → Anthropic 响应（用于 Anthropic 入口 → OpenAI 后端）
export const openaiToAnthropicResponse = (openaiResp: any, model: string): any => {
  const choice = openaiResp.choices?.[0]
  const usage = openaiResp.usage || {}

  return {
    id: openaiResp.id || `msg_${Date.now()}`,
    type: 'message',
    role: 'assistant',
    model,
    content: [{ type: 'text', text: choice?.message?.content || '' }],
    stop_reason: choice?.finish_reason === 'stop' ? 'end_turn' : choice?.finish_reason,
    usage: {
      input_tokens: usage.prompt_tokens || 0,
      output_tokens: usage.completion_tokens || 0,
    },
  }
}

// OpenAI SSE chunk → Anthropic SSE chunk
export const convertStreamChunkOpenaiToAnthropic = (line: string, model: string): string | null => {
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
      message: { id: event.id, type: 'message', role: 'assistant', model, content: [] },
    })
  }

  // 内容 chunk
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
      delta: { stop_reason: choice.finish_reason === 'stop' ? 'end_turn' : choice.finish_reason, stop_sequence: null },
      usage: { output_tokens: 0 },
    })
  }

  return null
}
```

**Step 2: Commit**

```bash
git add src/modules/proxy/format_converter.ts
git commit -m "feat(protocol): add Anthropic↔OpenAI bidirectional converters"
```

---

### Task 8: proxy.service 协议分支与模型映射

**Objective:** 根据后端 protocol 和入口协议自动决定是否转换。

**Files:**
- Modify: `src/modules/proxy/proxy.service.ts`

**Step 1: 更新 doForward**

```typescript
// 在 doForward 中，根据 account.protocol 和入口格式决定是否转换

interface ForwardContext {
  account: Account
  proxyReq: ProxyRequest
  isAnthropicEntry: boolean // 是否从 /v1/messages 进来的
}

const doForward = async (account: Account, proxyReq: ProxyRequest, isAnthropicEntry: boolean = false): Promise<ProxyResult & { streamUsage?: Record<string, any> }> => {
  const protocol = account.protocol || 'auto'
  const isAnthropicBackend = protocol === 'anthropic' || (protocol === 'auto' && account.base_url.includes('kimi'))

  let url: string
  let headers: Record<string, string>
  let body: any = proxyReq.body

  if (isAnthropicEntry) {
    // 入口是 Anthropic 格式
    if (!isAnthropicBackend) {
      // Anthropic → OpenAI 后端
      body = anthropicToOpenaiRequest(proxyReq.body)
      url = `${account.base_url}/v1/chat/completions`
      headers = {
        ...proxyReq.headers,
        'authorization': `Bearer ${account.api_key}`,
        host: new URL(account.base_url).host,
      }
    } else {
      // Anthropic → Anthropic 后端，直接转发
      url = `${account.base_url}${proxyReq.path}`
      headers = {
        ...proxyReq.headers,
        'x-api-key': account.api_key,
        host: new URL(account.base_url).host,
      }
    }
  } else {
    // 入口是 OpenAI 格式
    if (isAnthropicBackend) {
      // OpenAI → Anthropic 后端
      body = openaiToAnthropic(proxyReq.body)
      url = `${account.base_url}/v1/messages`
      headers = {
        ...proxyReq.headers,
        'x-api-key': account.api_key,
        'anthropic-version': '2023-06-01',
        host: new URL(account.base_url).host,
      }
    } else {
      // OpenAI → OpenAI 后端，直接转发
      url = `${account.base_url}${proxyReq.path}`
      headers = {
        ...proxyReq.headers,
        'authorization': `Bearer ${account.api_key}`,
        host: new URL(account.base_url).host,
      }
    }
  }

  delete headers['authorization'] // 删除下游传来的 authorization，用后端的

  // ... 之后的 fetch 和流式处理保持不变
```

**Step 2: 更新流式响应转换**

根据方向选择不同的 stream chunk 转换器。

**Step 3: Commit**

```bash
git add src/modules/proxy/proxy.service.ts
git commit -m "feat(proxy): auto protocol detection and bidirectional conversion"
```

---

### Task 9: 更新 models 路由与服务器注册

**Objective:** 更新 /v1/models 返回双协议支持的模型列表。

**Files:**
- Modify: `src/routes/models.ts`

**Step 1: 更新模型列表**

```typescript
const SUPPORTED_MODELS = [
  // OpenAI 格式模型
  { id: 'kimi-k2.5', object: 'model', owned_by: 'moonshot', permission: [] },
  { id: 'moonshot-v1-8k', object: 'model', owned_by: 'moonshot', permission: [] },
  { id: 'glm-4-plus', object: 'model', owned_by: 'zhipu', permission: [] },
  // Anthropic 格式模型
  { id: 'claude-sonnet-4-20250514', object: 'model', owned_by: 'anthropic', permission: [] },
  { id: 'claude-opus-4-20250514', object: 'model', owned_by: 'anthropic', permission: [] },
]
```

**Step 2: Commit**

```bash
git add src/routes/models.ts
git commit -m "feat(models): update supported models for dual protocol"
```

---

### Task 10: 主动健康探测服务

**Objective:** 实现定时健康探测，检测账号可用性。

**Files:**
- Create: `src/modules/health/probe.service.ts`
- Modify: `src/index.ts`

**Step 1: 创建健康探测服务**

```typescript
import { Database } from 'sql.js'
import { config } from '../../config.js'
import { queryAll, run } from '../../db/index.js'
import { listAccounts, updateAccountStatus } from '../account/account.service.js'
import { recordSuccess, recordFailure, resetConsecutiveFailures } from '../account/account.stats.js'

export const probeAccount = async (db: Database, accountId: number): Promise<{ success: boolean; latency: number }> => {
  const accounts = listAccounts(db)
  const account = accounts.find(a => a.id === accountId)
  if (!account || account.status !== 'active') return { success: false, latency: 0 }

  const url = `${account.base_url}/v1/models`
  const headers: Record<string, string> = {
    'authorization': `Bearer ${account.api_key}`,
    'x-api-key': account.api_key,
  }

  const startTime = Date.now()
  try {
    const resp = await fetch(url, { method: 'GET', headers, signal: AbortSignal.timeout(10000) })
    const latency = Date.now() - startTime

    run(db,
      'INSERT INTO health_probes (account_id, is_success, latency_ms, error_code) VALUES (?, ?, ?, ?)',
      [accountId, resp.ok ? 1 : 0, latency, resp.ok ? null : String(resp.status)]
    )

    if (resp.ok) {
      recordSuccess(db, accountId, latency)
      resetConsecutiveFailures(db, accountId)
      return { success: true, latency }
    } else {
      recordFailure(db, accountId)
      return { success: false, latency }
    }
  } catch (err: any) {
    const latency = Date.now() - startTime
    run(db,
      'INSERT INTO health_probes (account_id, is_success, latency_ms, error_code) VALUES (?, ?, ?, ?)',
      [accountId, 0, latency, err.name || 'network_error']
    )
    recordFailure(db, accountId)
    return { success: false, latency }
  }
}

export const startHealthProbes = (db: Database): NodeJS.Timeout => {
  const interval = (config.healthProbeInterval || 60) * 1000
  return setInterval(() => {
    const accounts = listAccounts(db)
    for (const account of accounts) {
      // 只对非 active 或随机抽样的 active 账号进行探测
      if (account.status !== 'active' || Math.random() < 0.3) {
        probeAccount(db, account.id).then(result => {
          if (result.success && account.status !== 'active') {
            updateAccountStatus(db, account.id, 'active')
          }
        }).catch(() => {})
      }
    }
  }, interval)
}
```

**Step 2: 在 index.ts 中启动**

```typescript
import { startHealthProbes } from './modules/health/probe.service.js'
// ...
const probeTimer = startHealthProbes(db)
// 在 shutdown 中 clearInterval(probeTimer)
```

**Step 3: Commit**

```bash
git add src/modules/health/probe.service.ts src/index.ts
git commit -m "feat(health): add active health probing service"
```

---

### Task 11: 管理面板增强

**Objective:** 在管理面板显示响应时间、成功率、连续失败次数、路由分数。

**Files:**
- Modify: `src/routes/admin.ts` (新增统计接口)
- Modify: `src/routes/admin_page.ts` (增加展示列和面板)

**Step 1: 新增统计接口**

在 `admin.ts` 添加：

```typescript
import { getOrCreateStats } from '../modules/account/account.stats.js'

// 在 registerAdminRoutes 中添加
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
```

**Step 2: 更新管理面板**

在 `admin_page.ts` 的账号列表表头添加：
```html
<th>响应时间</th><th>请求数</th><th>失败率</th><th>连续失败</th>
```

在表格行中填充这些字段。

**Step 3: Commit**

```bash
git add src/routes/admin.ts src/routes/admin_page.ts
git commit -m "feat(admin): add routing stats to dashboard"
```

---

### Task 12: 配置与环境变量更新

**Objective:** 更新 .env.example 和 config.ts，支持新配置项。

**Files:**
- Modify: `.env.example`
- Modify: `src/config.ts`

**Step 1: 更新 .env.example**

在末尾添加：
```bash
# 路由策略: latency | round_robin | priority | random
ROUTING_STRATEGY=latency
# 响应时间权重（0.0-2.0）
LATENCY_WEIGHT=1.0
# 健康探测间隔（秒）
HEALTH_PROBE_INTERVAL=60
# 连续失败禁用阈值
CONSECUTIVE_FAILURE_THRESHOLD=3
```

**Step 2: 更新 config.ts**

```typescript
export const config = {
  // ... 现有字段
  routingStrategy: process.env.ROUTING_STRATEGY || 'latency',
  latencyWeight: Number(process.env.LATENCY_WEIGHT) || 1.0,
  healthProbeInterval: Number(process.env.HEALTH_PROBE_INTERVAL) || 60,
  consecutiveFailureThreshold: Number(process.env.CONSECUTIVE_FAILURE_THRESHOLD) || 3,
}
```

**Step 3: Commit**

```bash
git add .env.example src/config.ts
git commit -m "feat(config): add routing strategy and health probe env vars"
```

---

## 验证清单

全部实现完成后运行：

```bash
# 1. 所有测试通过
pnpm test
# Expected: 50+ tests, 0 failed

# 2. 编译无错误
pnpm exec tsc --noEmit
# Expected: 无类型错误

# 3. 手动启动验证
pnpm start
# 访问 http://localhost:3000/admin/accounts 确认面板正常
```

## 后续优化（本计划不包含）

- 模型别名映射系统
- 额度查询插件框架
- WebSocket 实时状态
- 按模型名过滤的进阶路由
