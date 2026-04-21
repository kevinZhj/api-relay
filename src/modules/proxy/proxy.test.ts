import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Database } from 'sql.js'
import { initDb, closeDb } from '../../db/index.js'
import { createAccount } from '../account/account.service.js'
import { updateAccountStatus } from '../account/account.service.js'

describe('请求代理', () => {
  let db: Database

  beforeEach(async () => {
    db = await initDb(':memory:')
  })

  afterEach(() => {
    closeDb(db)
  })

  describe('账号选择与重试', () => {
    it('没有账号时应该返回 503', async () => {
      const { forwardRequest } = await import('./proxy.service.js')
      const result = await forwardRequest(db, {
        method: 'POST',
        path: '/chat/completions',
        headers: { 'content-type': 'application/json' },
        body: { model: 'kimi-k2.5', messages: [] },
      }, 1)

      expect(result.status).toBe(503)
      expect(result.body.error.message).toContain('没有可用的后端账号')
    })

    it('所有账号都不可用时应该返回 503', async () => {
      const acc1 = createAccount(db, { name: '账号1', api_key: 'sk-1' })
      updateAccountStatus(db, acc1.id, 'disabled')

      const { forwardRequest } = await import('./proxy.service.js')
      const result = await forwardRequest(db, {
        method: 'POST',
        path: '/chat/completions',
        headers: { 'content-type': 'application/json' },
        body: { model: 'kimi-k2.5', messages: [] },
      }, 1)

      expect(result.status).toBe(503)
    })
  })
})
