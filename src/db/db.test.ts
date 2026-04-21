import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Database } from 'sql.js'
import { initDb, closeDb } from './index.js'

describe('数据库', () => {
  let db: Database

  beforeEach(async () => {
    db = await initDb(':memory:')
  })

  afterEach(() => {
    closeDb(db)
  })

  it('应该成功创建所有表', () => {
    const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    const names = tables[0]?.values?.flat() as string[] || []

    expect(names).toContain('accounts')
    expect(names).toContain('api_keys')
    expect(names).toContain('usage_logs')
  })

  it('应该能插入和查询 account', () => {
    db.run(
      'INSERT INTO accounts (name, api_key, base_url) VALUES (?, ?, ?)',
      ['测试账号', 'sk-test-key', 'https://api.moonshot.cn/v1']
    )

    const stmt = db.prepare('SELECT * FROM accounts WHERE name = ?')
    stmt.bind(['测试账号'])
    expect(stmt.step()).toBe(true)
    const account = stmt.getAsObject()
    stmt.free()

    expect(account).toBeDefined()
    expect(account.name).toBe('测试账号')
    expect(account.api_key).toBe('sk-test-key')
    expect(account.status).toBe('active')
    expect(account.priority).toBe(0)
  })

  it('api_key 应该唯一', () => {
    db.run('INSERT INTO accounts (name, api_key) VALUES (?, ?)', ['账号1', 'sk-duplicate'])

    expect(() => {
      db.run('INSERT INTO accounts (name, api_key) VALUES (?, ?)', ['账号2', 'sk-duplicate'])
    }).toThrow()
  })

  it('应该能插入和查询 api_key', () => {
    db.run('INSERT INTO api_keys (key, name) VALUES (?, ?)', ['sk-relay-key-1', '我的设备'])

    const stmt = db.prepare('SELECT * FROM api_keys WHERE key = ?')
    stmt.bind(['sk-relay-key-1'])
    expect(stmt.step()).toBe(true)
    const key = stmt.getAsObject()
    stmt.free()

    expect(key).toBeDefined()
    expect(key.name).toBe('我的设备')
    expect(key.is_active).toBe(1)
    expect(key.rate_limit).toBe(60)
  })

  it('应该能记录使用日志', () => {
    db.run(
      'INSERT INTO usage_logs (api_key_id, account_id, model, prompt_tokens, completion_tokens, is_success, duration_ms) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [1, 1, 'kimi-k2.5', 100, 200, 1, 500]
    )

    const stmt = db.prepare('SELECT * FROM usage_logs')
    expect(stmt.step()).toBe(true)
    const log = stmt.getAsObject()
    stmt.free()

    expect(log.model).toBe('kimi-k2.5')
    expect(log.prompt_tokens).toBe(100)
    expect(log.is_success).toBe(1)
  })
})
