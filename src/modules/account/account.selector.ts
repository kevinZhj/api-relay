import { Database } from 'sql.js'
import { Account } from './account.service.js'
import { queryAll } from '../../db/index.js'
import { getOrCreateStats } from './account.stats.js'
import { isCircuitOpen } from './account.circuit.js'
import { config } from '../../config.js'

export interface RoutingOptions {
  excludeIds?: number[]
  modelName?: string
  brand?: string
}

const ALPHA = 1 - Math.exp(-Math.LN2 / 10)

const calculateScore = (
  account: Account,
  stats: ReturnType<typeof getOrCreateStats>,
): number => {
  if (config.routingStrategy === 'round_robin') return Math.random()
  if (config.routingStrategy === 'priority') return -account.priority
  if (config.routingStrategy === 'random') return Math.random()

  // latency strategy (default)
  const latency = stats.ewma_latency_ms || 1000
  const normalizedLatency = latency / 1000

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

  return (normalizedLatency * (config.latencyWeight ?? 1.0))
    * failurePenalty
    * quotaPenalty
    / priorityBoost
}

export const selectAccount = (db: Database, options?: RoutingOptions): Account | null => {
  const accounts = queryAll(db, `SELECT * FROM accounts WHERE status = 'active'`) as Account[]
  if (accounts.length === 0) return null

  let candidates = accounts.filter(a => !isCircuitOpen(a.id))

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

  if (options?.brand) {
    candidates = candidates.filter(a => a.brand === options.brand)
  }

  if (candidates.length === 0) return null

  // 计算分数并排序，分数低的优先
  const scored = candidates.map(account => {
    const stats = getOrCreateStats(db, account.id)
    return { account, score: calculateScore(account, stats) }
  })

  scored.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score
    // Tie-breaker: 优先选择优先级更高的
    if (a.account.priority !== b.account.priority) return b.account.priority - a.account.priority
    // Tie-breaker: 同优先级时选择最近最少使用的
    const aLast = a.account.last_used_at ? new Date(a.account.last_used_at).getTime() : 0
    const bLast = b.account.last_used_at ? new Date(b.account.last_used_at).getTime() : 0
    if (aLast !== bLast) return aLast - bLast
    return a.account.id - b.account.id
  })
  return scored[0]?.account || null
}

export const selectNextAccount = (db: Database, excludeIds: number[], modelName?: string, brand?: string): Account | null => {
  return selectAccount(db, { excludeIds, modelName, brand })
}
