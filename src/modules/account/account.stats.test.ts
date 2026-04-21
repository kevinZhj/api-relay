import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Database } from 'sql.js'
import { initDb, closeDb } from '../../db/index.js'
import { createAccount } from './account.service.js'
import { getOrCreateStats, recordSuccess, recordFailure } from './account.stats.js'

describe('account.stats', () => {
  let db: Database

  beforeEach(async () => {
    db = await initDb(':memory:')
    createAccount(db, { name: 'Test', api_key: 'sk-test' })
  })

  afterEach(() => {
    closeDb(db)
  })

  it('应该创建新的 stats', () => {
    const stats = getOrCreateStats(db, 1)
    expect(stats.account_id).toBe(1)
    expect(stats.ewma_latency_ms).toBe(0)
  })

  it('记录成功应该更新 EWMA', () => {
    recordSuccess(db, 1, 100)
    const stats = getOrCreateStats(db, 1)
    expect(stats.ewma_latency_ms).toBe(100)
    recordSuccess(db, 1, 200)
    const stats2 = getOrCreateStats(db, 1)
    expect(stats2.ewma_latency_ms).toBeGreaterThan(100)
    expect(stats2.ewma_latency_ms).toBeLessThan(200)
  })

  it('记录失败应该增加失败计数', () => {
    recordFailure(db, 1)
    const stats = getOrCreateStats(db, 1)
    expect(stats.failure_count).toBe(1)
    expect(stats.consecutive_failures).toBe(1)
  })
})
