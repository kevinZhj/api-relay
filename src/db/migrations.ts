export const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    api_key TEXT NOT NULL UNIQUE,
    base_url TEXT DEFAULT 'https://api.moonshot.cn/v1',
    status TEXT DEFAULT 'active',
    priority INTEGER DEFAULT 0,
    total_quota INTEGER,
    used_quota INTEGER DEFAULT 0,
    last_error TEXT,
    last_error_at TEXT,
    last_used_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    rate_limit INTEGER DEFAULT 60,
    created_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS usage_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    api_key_id INTEGER,
    account_id INTEGER,
    model TEXT,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    cache_creation_tokens INTEGER DEFAULT 0,
    cache_read_tokens INTEGER DEFAULT 0,
    is_success INTEGER,
    error_code TEXT,
    duration_ms INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
  )`,
  // 迁移：为已有的 usage_logs 表添加缓存字段
  `ALTER TABLE usage_logs ADD COLUMN cache_creation_tokens INTEGER DEFAULT 0`,
  `ALTER TABLE usage_logs ADD COLUMN cache_read_tokens INTEGER DEFAULT 0`,
  // 迁移：为 accounts 表添加模型字段
  `ALTER TABLE accounts ADD COLUMN models TEXT DEFAULT ''`,
]
