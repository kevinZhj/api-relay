import { Database } from 'sql.js'
import { Account } from './account.service.js'
import { queryOne, queryAll } from '../../db/index.js'

export const selectAccount = (db: Database): Account | null => {
  return queryOne(db,
    `SELECT * FROM accounts
     WHERE status = 'active'
     ORDER BY priority DESC, CASE WHEN last_used_at IS NULL THEN 0 ELSE 1 END, last_used_at ASC, id ASC
     LIMIT 1`
  ) as Account || null
}

export const selectNextAccount = (db: Database, excludeIds: number[]): Account | null => {
  if (excludeIds.length === 0) return selectAccount(db)
  const placeholders = excludeIds.map(() => '?').join(',')
  return queryOne(db,
    `SELECT * FROM accounts
     WHERE status = 'active' AND id NOT IN (${placeholders})
     ORDER BY priority DESC, CASE WHEN last_used_at IS NULL THEN 0 ELSE 1 END, last_used_at ASC, id ASC
     LIMIT 1`,
    excludeIds
  ) as Account || null
}
