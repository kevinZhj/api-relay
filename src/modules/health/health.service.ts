import { Database } from 'sql.js'
import { config } from '../../config.js'
import { queryAll, run } from '../../db/index.js'

export type AccountStatus = 'active' | 'disabled' | 'rate_limited' | 'quota_exceeded'

export const mapErrorToStatus = (statusCode: number): AccountStatus => {
  if (statusCode === 401 || statusCode === 403) return 'disabled'
  if (statusCode === 429) return 'rate_limited'
  if (statusCode === 402) return 'quota_exceeded'
  return 'active'
}

export const shouldRetry = (statusCode: number): boolean => {
  return statusCode >= 500 || statusCode === 429
}

export const shouldMarkAccount = (statusCode: number): boolean => {
  return [401, 402, 403, 429].includes(statusCode)
}

export const recoverRateLimited = (db: Database): number => {
  // 用 SQLite 的时间函数确保格式一致
  const minutes = config.rateLimitRecoveryMinutes
  const limited = queryAll(db,
    "SELECT id FROM accounts WHERE status = 'rate_limited' AND last_error_at <= datetime('now', '-' || ? || ' minutes')",
    [minutes]
  )
  if (limited.length === 0) return 0
  run(db,
    "UPDATE accounts SET status = 'active', last_error = NULL, last_error_at = NULL, updated_at = datetime('now') WHERE status = 'rate_limited' AND last_error_at <= datetime('now', '-' || ? || ' minutes')",
    [minutes]
  )
  return limited.length
}

export const getAccountHealth = (db: Database) => {
  const accounts = queryAll(db, 'SELECT id, name, status, used_quota, total_quota, last_error, last_error_at FROM accounts')
  const summary = {
    total: accounts.length,
    active: 0,
    disabled: 0,
    rate_limited: 0,
    quota_exceeded: 0,
  }
  for (const acc of accounts) {
    const s = acc.status as keyof typeof summary
    if (s in summary) summary[s]++
  }
  return { summary, accounts }
}
