import crypto from 'node:crypto'
import { Database } from 'sql.js'
import { queryAll, queryOne, run, runInsert } from '../../db/index.js'

export interface ApiKey {
  id: number
  key: string
  name: string
  is_active: number
  rate_limit: number
  brand: string
  expires_at: string | null
  token_quota: number
  used_tokens: number
  allowed_models: string
  created_at: string
}

export const generateApiKey = (): string => {
  return 'sk-relay-' + crypto.randomBytes(24).toString('hex')
}

export const createApiKey = (db: Database, name: string, brand = '', rateLimit = 60, expiresAt: string | null = null, tokenQuota = 0, allowedModels = ''): ApiKey => {
  const key = generateApiKey()
  const id = runInsert(db,
    'INSERT INTO api_keys (key, name, brand, rate_limit, expires_at, token_quota, allowed_models) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [key, name, brand, rateLimit, expiresAt, tokenQuota, allowedModels]
  )
  return queryOne(db, 'SELECT * FROM api_keys WHERE id = ?', [id]) as ApiKey
}

export const validateApiKey = (db: Database, key: string): ApiKey | null => {
  const record = queryOne(db, 'SELECT * FROM api_keys WHERE key = ?', [key]) as ApiKey | undefined
  if (!record || !record.is_active) return null
  // 检查是否过期
  if (record.expires_at && new Date(record.expires_at) < new Date()) return null
  // 检查 token 配额（token_quota > 0 表示有限额）
  if (record.token_quota > 0 && record.used_tokens >= record.token_quota) return null
  return record
}

export const listApiKeys = (db: Database): ApiKey[] => {
  return queryAll(db, 'SELECT * FROM api_keys ORDER BY created_at DESC') as ApiKey[]
}

export const deleteApiKey = (db: Database, id: number): boolean => {
  const before = queryOne(db, 'SELECT id FROM api_keys WHERE id = ?', [id])
  if (!before) return false
  run(db, 'DELETE FROM api_keys WHERE id = ?', [id])
  return true
}

export const updateApiKey = (db: Database, id: number, input: { name?: string; brand?: string; rate_limit?: number; expires_at?: string | null; token_quota?: number; allowed_models?: string }): ApiKey | null => {
  const current = queryOne(db, 'SELECT * FROM api_keys WHERE id = ?', [id]) as ApiKey | undefined
  if (!current) return null
  const fields: string[] = []
  const values: any[] = []
  if (input.name !== undefined) { fields.push('name = ?'); values.push(input.name) }
  if (input.brand !== undefined) { fields.push('brand = ?'); values.push(input.brand) }
  if (input.rate_limit !== undefined) { fields.push('rate_limit = ?'); values.push(input.rate_limit) }
  if (input.expires_at !== undefined) { fields.push('expires_at = ?'); values.push(input.expires_at) }
  if (input.token_quota !== undefined) { fields.push('token_quota = ?'); values.push(input.token_quota) }
  if (input.allowed_models !== undefined) { fields.push('allowed_models = ?'); values.push(input.allowed_models) }
  if (fields.length === 0) return current
  values.push(id)
  run(db, 'UPDATE api_keys SET ' + fields.join(', ') + ' WHERE id = ?', values)
  return queryOne(db, 'SELECT * FROM api_keys WHERE id = ?', [id]) as ApiKey
}

export const toggleApiKey = (db: Database, id: number): ApiKey | null => {
  const current = queryOne(db, 'SELECT * FROM api_keys WHERE id = ?', [id]) as ApiKey | undefined
  if (!current) return null
  run(db, 'UPDATE api_keys SET is_active = ? WHERE id = ?', [current.is_active ? 0 : 1, id])
  return queryOne(db, 'SELECT * FROM api_keys WHERE id = ?', [id]) as ApiKey
}

// 累加已使用 token
export const addUsedTokens = (db: Database, id: number, tokens: number) => {
  run(db, 'UPDATE api_keys SET used_tokens = used_tokens + ? WHERE id = ?', [tokens, id])
}

// 重置已使用 token
export const resetUsedTokens = (db: Database, id: number): ApiKey | null => {
  const current = queryOne(db, 'SELECT * FROM api_keys WHERE id = ?', [id]) as ApiKey | undefined
  if (!current) return null
  run(db, 'UPDATE api_keys SET used_tokens = 0 WHERE id = ?', [id])
  return queryOne(db, 'SELECT * FROM api_keys WHERE id = ?', [id]) as ApiKey
}
