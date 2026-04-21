import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Database } from 'sql.js'
import { initDb, closeDb } from '../../db/index.js'
import {
  createAccount,
  getAccount,
  updateAccount,
  deleteAccount,
  updateAccountStatus,
  updateAccountUsage,
} from './account.service.js'
import { selectAccount, selectNextAccount } from './account.selector.js'

describe('账号池管理', () => {
  let db: Database

  beforeEach(async () => {
    db = await initDb(':memory:')
  })

  afterEach(() => {
    closeDb(db)
  })

  describe('createAccount', () => {
    it('应该创建账号', () => {
      const account = createAccount(db, { name: '账号1', api_key: 'sk-kimi-1' })
      expect(account).toBeDefined()
      expect(account.name).toBe('账号1')
      expect(account.api_key).toBe('sk-kimi-1')
      expect(account.status).toBe('active')
      expect(account.base_url).toBe('https://api.moonshot.cn/v1')
      expect(account.models).toBe('')
    })

    it('应该支持自定义 base_url 和优先级', () => {
      const account = createAccount(db, {
        name: '账号2',
        api_key: 'sk-kimi-2',
        base_url: 'https://custom.api.com/v1',
        priority: 10,
      })
      expect(account.base_url).toBe('https://custom.api.com/v1')
      expect(account.priority).toBe(10)
    })

    it('应该支持设置模型', () => {
      const account = createAccount(db, {
        name: '账号3',
        api_key: 'sk-kimi-3',
        models: 'kimi-k2.5,claude-sonnet-4-6',
      })
      expect(account.models).toBe('kimi-k2.5,claude-sonnet-4-6')
    })
  })

  describe('updateAccount', () => {
    it('应该更新指定字段', () => {
      const account = createAccount(db, { name: '账号1', api_key: 'sk-kimi-1' })
      const updated = updateAccount(db, account.id, { name: '新名称', priority: 5 })
      expect(updated!.name).toBe('新名称')
      expect(updated!.priority).toBe(5)
    })

    it('应该更新模型字段', () => {
      const account = createAccount(db, { name: '账号1', api_key: 'sk-kimi-1' })
      const updated = updateAccount(db, account.id, { models: 'kimi-k2.5' })
      expect(updated!.models).toBe('kimi-k2.5')
    })
  })

  describe('deleteAccount', () => {
    it('应该删除账号', () => {
      const account = createAccount(db, { name: '账号1', api_key: 'sk-kimi-1' })
      expect(deleteAccount(db, account.id)).toBe(true)
      expect(getAccount(db, account.id)).toBeNull()
    })
  })

  describe('updateAccountStatus', () => {
    it('应该更新状态和错误信息', () => {
      const account = createAccount(db, { name: '账号1', api_key: 'sk-kimi-1' })
      updateAccountStatus(db, account.id, 'rate_limited', 'Too many requests')
      const updated = getAccount(db, account.id)
      expect(updated!.status).toBe('rate_limited')
      expect(updated!.last_error).toBe('Too many requests')
      expect(updated!.last_error_at).not.toBeNull()
    })
  })

  describe('updateAccountUsage', () => {
    it('应该累加已用额度', () => {
      const account = createAccount(db, { name: '账号1', api_key: 'sk-kimi-1' })
      updateAccountUsage(db, account.id, 100)
      updateAccountUsage(db, account.id, 50)
      const updated = getAccount(db, account.id)
      expect(updated!.used_quota).toBe(150)
      expect(updated!.last_used_at).not.toBeNull()
    })
  })

  describe('selectAccount', () => {
    it('应该选择 active 且优先级最高的账号', () => {
      createAccount(db, { name: '低优先', api_key: 'sk-1', priority: 0 })
      createAccount(db, { name: '高优先', api_key: 'sk-2', priority: 10 })

      const selected = selectAccount(db)
      expect(selected!.name).toBe('高优先')
    })

    it('同优先级应该选择最近最少使用的', () => {
      const acc1 = createAccount(db, { name: '账号1', api_key: 'sk-1' })
      createAccount(db, { name: '账号2', api_key: 'sk-2' })

      updateAccountUsage(db, acc1.id, 10)

      const selected = selectAccount(db)
      expect(selected!.name).toBe('账号2')
    })

    it('没有可用账号时返回 null', () => {
      expect(selectAccount(db)).toBeNull()
    })

    it('应该跳过非 active 状态的账号', () => {
      const acc = createAccount(db, { name: '账号1', api_key: 'sk-1' })
      updateAccountStatus(db, acc.id, 'disabled')
      expect(selectAccount(db)).toBeNull()
    })
  })

  describe('selectNextAccount', () => {
    it('应该排除指定 id 的账号', () => {
      createAccount(db, { name: '账号1', api_key: 'sk-1' })
      createAccount(db, { name: '账号2', api_key: 'sk-2' })
      createAccount(db, { name: '账号3', api_key: 'sk-3' })

      const next = selectNextAccount(db, [1, 2])
      expect(next!.name).toBe('账号3')
    })

    it('排除所有后返回 null', () => {
      createAccount(db, { name: '账号1', api_key: 'sk-1' })
      expect(selectNextAccount(db, [1])).toBeNull()
    })
  })
})
