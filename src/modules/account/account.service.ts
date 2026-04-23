import { Database } from 'sql.js'
import { queryAll, queryOne, run, runInsert } from '../../db/index.js'

export interface Account {
  id: number
  name: string
  api_key: string
  base_url: string
  models: string
  status: string
  priority: number
  total_quota: number | null
  used_quota: number
  last_error: string | null
  last_error_at: string | null
  last_used_at: string | null
  created_at: string
  updated_at: string
  brand: string
  protocol: string
  weight: number
  is_default: number
}

export interface CreateAccountInput {
  name: string
  api_key: string
  base_url?: string
  models?: string
  priority?: number
  brand?: string
}

export const createAccount = (db: Database, input: CreateAccountInput): Account => {
  const id = runInsert(db,
    'INSERT INTO accounts (name, api_key, base_url, models, brand, priority) VALUES (?, ?, ?, ?, ?, ?)',
    [input.name, input.api_key, input.base_url ?? 'https://api.moonshot.cn/v1', input.models ?? '', input.brand ?? '', input.priority ?? 0]
  )
  return queryOne(db, 'SELECT * FROM accounts WHERE id = ?', [id]) as Account
}

export const getAccount = (db: Database, id: number): Account | null => {
  return queryOne(db, 'SELECT * FROM accounts WHERE id = ?', [id]) as Account || null
}

export const listAccounts = (db: Database): Account[] => {
  return queryAll(db, 'SELECT * FROM accounts ORDER BY priority DESC, id ASC') as Account[]
}

export const updateAccount = (db: Database, id: number, input: Partial<CreateAccountInput>): Account | null => {
  const account = getAccount(db, id)
  if (!account) return null
  const fields: string[] = []
  const values: any[] = []
  if (input.name !== undefined) { fields.push('name = ?'); values.push(input.name) }
  if (input.api_key !== undefined) { fields.push('api_key = ?'); values.push(input.api_key) }
  if (input.base_url !== undefined) { fields.push('base_url = ?'); values.push(input.base_url) }
  if (input.models !== undefined) { fields.push('models = ?'); values.push(input.models) }
  if (input.brand !== undefined) { fields.push('brand = ?'); values.push(input.brand) }
  if (input.priority !== undefined) { fields.push('priority = ?'); values.push(input.priority) }
  if (fields.length === 0) return account
  fields.push("updated_at = datetime('now')")
  values.push(id)
  run(db, `UPDATE accounts SET ${fields.join(', ')} WHERE id = ?`, values)
  return getAccount(db, id)
}

export const deleteAccount = (db: Database, id: number): boolean => {
  const before = queryOne(db, 'SELECT id FROM accounts WHERE id = ?', [id])
  if (!before) return false
  run(db, 'DELETE FROM accounts WHERE id = ?', [id])
  return true
}

export const updateAccountStatus = (db: Database, id: number, status: string, error?: string): void => {
  run(db,
    "UPDATE accounts SET status = ?, last_error = ?, last_error_at = datetime('now'), updated_at = datetime('now') WHERE id = ?",
    [status, error || null, id]
  )
}

export const updateAccountUsage = (db: Database, id: number, tokens: number): void => {
  run(db,
    "UPDATE accounts SET used_quota = used_quota + ?, last_used_at = datetime('now'), updated_at = datetime('now') WHERE id = ?",
    [tokens, id]
  )
}
