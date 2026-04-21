import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Database } from 'sql.js'
import { initDb, closeDb } from '../../db/index.js'
import { createAccount, updateAccountStatus } from '../account/account.service.js'
import { mapErrorToStatus, shouldRetry, shouldMarkAccount, recoverRateLimited, getAccountHealth } from './health.service.js'

describe('健康检测', () => {
  let db: Database

  beforeEach(async () => {
    db = await initDb(':memory:')
  })

  afterEach(() => {
    closeDb(db)
  })

  describe('mapErrorToStatus', () => {
    it('401 应该映射到 disabled', () => {
      expect(mapErrorToStatus(401)).toBe('disabled')
    })

    it('403 应该映射到 disabled', () => {
      expect(mapErrorToStatus(403)).toBe('disabled')
    })

    it('429 应该映射到 rate_limited', () => {
      expect(mapErrorToStatus(429)).toBe('rate_limited')
    })

    it('402 应该映射到 quota_exceeded', () => {
      expect(mapErrorToStatus(402)).toBe('quota_exceeded')
    })

    it('其他错误码应该返回 active', () => {
      expect(mapErrorToStatus(500)).toBe('active')
      expect(mapErrorToStatus(200)).toBe('active')
    })
  })

  describe('shouldRetry', () => {
    it('服务端错误应该重试', () => {
      expect(shouldRetry(500)).toBe(true)
      expect(shouldRetry(502)).toBe(true)
      expect(shouldRetry(503)).toBe(true)
    })

    it('429 应该重试（切换账号后）', () => {
      expect(shouldRetry(429)).toBe(true)
    })

    it('客户端错误不应该重试', () => {
      expect(shouldRetry(400)).toBe(false)
      expect(shouldRetry(401)).toBe(false)
      expect(shouldRetry(403)).toBe(false)
    })
  })

  describe('shouldMarkAccount', () => {
    it('401/402/403/429 应该标记', () => {
      expect(shouldMarkAccount(401)).toBe(true)
      expect(shouldMarkAccount(402)).toBe(true)
      expect(shouldMarkAccount(403)).toBe(true)
      expect(shouldMarkAccount(429)).toBe(true)
    })

    it('其他状态码不应该标记', () => {
      expect(shouldMarkAccount(500)).toBe(false)
      expect(shouldMarkAccount(200)).toBe(false)
    })
  })

  describe('recoverRateLimited', () => {
    it('应该恢复超时的 rate_limited 账号', () => {
      const acc = createAccount(db, { name: '账号1', api_key: 'sk-1' })
      // 设置一个很早的错误时间
      db.run(
        "UPDATE accounts SET status = 'rate_limited', last_error_at = '2000-01-01 00:00:00' WHERE id = ?",
        [acc.id]
      )

      const recovered = recoverRateLimited(db)
      expect(recovered).toBe(1)

      const stmt = db.prepare('SELECT status FROM accounts WHERE id = ?')
      stmt.bind([acc.id])
      stmt.step()
      const updated = stmt.getAsObject()
      stmt.free()
      expect(updated.status).toBe('active')
    })

    it('不应该恢复未超时的 rate_limited 账号', () => {
      const acc = createAccount(db, { name: '账号1', api_key: 'sk-1' })
      db.run(
        "UPDATE accounts SET status = 'rate_limited', last_error_at = datetime('now') WHERE id = ?",
        [acc.id]
      )

      const recovered = recoverRateLimited(db)
      expect(recovered).toBe(0)
    })
  })

  describe('getAccountHealth', () => {
    it('应该返回正确的健康摘要', () => {
      const acc1 = createAccount(db, { name: '账号1', api_key: 'sk-1' })
      const acc2 = createAccount(db, { name: '账号2', api_key: 'sk-2' })
      createAccount(db, { name: '账号3', api_key: 'sk-3' })
      updateAccountStatus(db, acc1.id, 'disabled')
      updateAccountStatus(db, acc2.id, 'rate_limited')

      const health = getAccountHealth(db)
      expect(health.summary.total).toBe(3)
      expect(health.summary.active).toBe(1)
      expect(health.summary.disabled).toBe(1)
      expect(health.summary.rate_limited).toBe(1)
    })
  })
})
