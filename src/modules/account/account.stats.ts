import { Database } from 'sql.js'
import { queryOne, queryAll, run } from '../../db/index.js'

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
  return queryAll(db, 'SELECT * FROM account_stats') as AccountStats[]
}

export const resetConsecutiveFailures = (db: Database, accountId: number): void => {
  run(db, 'UPDATE account_stats SET consecutive_failures = 0 WHERE account_id = ?', [accountId])
}
