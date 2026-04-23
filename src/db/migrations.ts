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
  // 迁移：新增账号统计表
  `CREATE TABLE IF NOT EXISTS account_stats (
    account_id INTEGER PRIMARY KEY,
    ewma_latency_ms REAL DEFAULT 0,
    request_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    consecutive_failures INTEGER DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now'))
  )`,
  // 迁移：新增健康探测日志表
  `CREATE TABLE IF NOT EXISTS health_probes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    is_success INTEGER DEFAULT 0,
    latency_ms INTEGER,
    error_code TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`,
  // 迁移：为 accounts 表扩展字段
  `ALTER TABLE accounts ADD COLUMN brand TEXT DEFAULT ''`,
  `ALTER TABLE accounts ADD COLUMN protocol TEXT DEFAULT 'auto'`,
  `ALTER TABLE accounts ADD COLUMN weight INTEGER DEFAULT 100`,
  `ALTER TABLE accounts ADD COLUMN is_default INTEGER DEFAULT 0`,
  `ALTER TABLE api_keys ADD COLUMN brand TEXT DEFAULT ''`,
  // 迁移：为 usage_logs 添加设备名称字段
  `ALTER TABLE usage_logs ADD COLUMN device_name TEXT DEFAULT ''`,
  `UPDATE usage_logs SET device_name = COALESCE((SELECT name FROM api_keys WHERE api_keys.id = usage_logs.api_key_id), '') WHERE device_name = '' OR device_name IS NULL`,
  // 迁移：为 api_keys 添加过期时间字段
  `ALTER TABLE api_keys ADD COLUMN expires_at TEXT DEFAULT NULL`,
  // 迁移：创建分组表
  `CREATE TABLE IF NOT EXISTS brands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  )`,
  // 迁移：为 api_keys 添加 Token 配额字段
  `ALTER TABLE api_keys ADD COLUMN token_quota INTEGER DEFAULT 0`,
  `ALTER TABLE api_keys ADD COLUMN used_tokens INTEGER DEFAULT 0`,
  // 迁移：为 api_keys 添加模型白名单字段
  `ALTER TABLE api_keys ADD COLUMN allowed_models TEXT DEFAULT ''`,
  // 迁移：创建审计日志表
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id INTEGER,
    detail TEXT DEFAULT '',
    ip TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  )`,
]
