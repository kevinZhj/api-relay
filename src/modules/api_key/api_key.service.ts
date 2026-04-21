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
  created_at: string
}

export const generateApiKey = (): string => {
  return `sk-relay-${crypto.randomBytes(24).toString('hex')}`
}

export const createApiKey = (db: Database, name: string, brand = '', rateLimit = 60): ApiKey => {
  const key = generateApiKey()
  const id = runInsert(db,
    'INSERT INTO api_keys (key, name, brand, rate_limit) VALUES (?, ?, ?, ?)',
    [key, name, brand, rateLimit]
  )
  return queryOne(db, 'SELECT * FROM api_keys WHERE id = ?', [id]) as ApiKey
}

export const validateApiKey = (db: Database, key: string): ApiKey | null => {
  const record = queryOne(db, 'SELECT * FROM api_keys WHERE key = ?', [key]) as ApiKey | undefined
  if (!record || !record.is_active) return null
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

export const toggleApiKey = (db: Database, id: number): ApiKey | null => {
  const current = queryOne(db, 'SELECT * FROM api_keys WHERE id = ?', [id]) as ApiKey | undefined
  if (!current) return null
  run(db, 'UPDATE api_keys SET is_active = ? WHERE id = ?', [current.is_active ? 0 : 1, id])
  return queryOne(db, 'SELECT * FROM api_keys WHERE id = ?', [id]) as ApiKey
}
