import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Database } from 'sql.js'
import { initDb, closeDb } from '../../db/index.js'
import {
  generateApiKey,
  createApiKey,
  validateApiKey,
  listApiKeys,
  deleteApiKey,
  toggleApiKey,
} from './api_key.service.js'

describe('API Key 管理', () => {
  let db: Database

  beforeEach(async () => {
    db = await initDb(':memory:')
  })

  afterEach(() => {
    closeDb(db)
  })

  describe('generateApiKey', () => {
    it('应该生成 sk-relay- 前缀的 key', () => {
      const key = generateApiKey()
      expect(key).toMatch(/^sk-relay-[a-f0-9]{48}$/)
    })

    it('每次生成的 key 应该不同', () => {
      const key1 = generateApiKey()
      const key2 = generateApiKey()
      expect(key1).not.toBe(key2)
    })
  })

  describe('createApiKey', () => {
    it('应该创建并返回 API Key', () => {
      const apiKey = createApiKey(db, '测试设备')
      expect(apiKey).toBeDefined()
      expect(apiKey.name).toBe('测试设备')
      expect(apiKey.key).toMatch(/^sk-relay-/)
      expect(apiKey.is_active).toBe(1)
      expect(apiKey.rate_limit).toBe(60)
    })

    it('应该支持自定义速率限制', () => {
      const apiKey = createApiKey(db, '高速设备', '', 120)
      expect(apiKey.rate_limit).toBe(120)
    })
  })

  describe('validateApiKey', () => {
    it('有效的 key 应该返回记录', () => {
      const created = createApiKey(db, '设备1')
      const validated = validateApiKey(db, created.key)
      expect(validated).toBeDefined()
      expect(validated!.id).toBe(created.id)
    })

    it('不存在的 key 应该返回 null', () => {
      const result = validateApiKey(db, 'sk-relay-notexist')
      expect(result).toBeNull()
    })

    it('已禁用的 key 应该返回 null', () => {
      const created = createApiKey(db, '设备1')
      toggleApiKey(db, created.id)
      const result = validateApiKey(db, created.key)
      expect(result).toBeNull()
    })
  })

  describe('listApiKeys', () => {
    it('应该返回所有 API Key', () => {
      createApiKey(db, '设备1')
      createApiKey(db, '设备2')
      const keys = listApiKeys(db)
      expect(keys).toHaveLength(2)
    })
  })

  describe('deleteApiKey', () => {
    it('应该删除指定 key', () => {
      const created = createApiKey(db, '设备1')
      const result = deleteApiKey(db, created.id)
      expect(result).toBe(true)
      expect(validateApiKey(db, created.key)).toBeNull()
    })

    it('删除不存在的 key 返回 false', () => {
      const result = deleteApiKey(db, 999)
      expect(result).toBe(false)
    })
  })

  describe('toggleApiKey', () => {
    it('应该切换启用/禁用状态', () => {
      const created = createApiKey(db, '设备1')
      expect(created.is_active).toBe(1)

      const toggled = toggleApiKey(db, created.id)
      expect(toggled!.is_active).toBe(0)

      const toggledBack = toggleApiKey(db, created.id)
      expect(toggledBack!.is_active).toBe(1)
    })
  })
})
