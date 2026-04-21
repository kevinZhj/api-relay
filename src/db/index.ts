import initSqlJs, { Database } from 'sql.js'
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, unlinkSync } from 'node:fs'
import { dirname } from 'node:path'
import { MIGRATIONS } from './migrations.js'

export const initDb = async (dbPath: string): Promise<Database> => {
  const SQL = await initSqlJs()
  const dir = dirname(dbPath)
  if (dir && dir !== '.' && dir !== ':memory:') {
    mkdirSync(dir, { recursive: true })
  }

  let db: Database
  if (dbPath === ':memory:') {
    db = new SQL.Database()
  } else if (existsSync(dbPath)) {
    const buf = readFileSync(dbPath)
    db = new SQL.Database(buf)
  } else {
    db = new SQL.Database()
  }

  db.run('PRAGMA foreign_keys = ON')
  for (const sql of MIGRATIONS) {
    try {
      db.run(sql)
    } catch {
      // ALTER TABLE 已存在列等可忽略的错误
    }
  }

  return db
}

export const saveDb = (db: Database, dbPath: string): void => {
  if (dbPath === ':memory:') return
  const data = db.export()
  const buf = Buffer.from(data)
  const tmpPath = dbPath + '.tmp'
  writeFileSync(tmpPath, buf)
  renameSync(tmpPath, dbPath)
}

export const closeDb = (db: Database, dbPath?: string): void => {
  if (dbPath && dbPath !== ':memory:') {
    try {
      saveDb(db, dbPath)
    } catch (err) {
      console.error('数据库保存失败:', err)
    }
  }
  db.close()
}

// 工具函数：运行 SQL 并返回所有结果
export const queryAll = (db: Database, sql: string, params: any[] = []): any[] => {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const results: any[] = []
  while (stmt.step()) {
    results.push(stmt.getAsObject())
  }
  stmt.free()
  return results
}

// 工具函数：运行 SQL 并返回第一条
export const queryOne = (db: Database, sql: string, params: any[] = []): any | null => {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  let result: any = null
  if (stmt.step()) {
    result = stmt.getAsObject()
  }
  stmt.free()
  return result
}

// 工具函数：运行写操作
export const run = (db: Database, sql: string, params: any[] = []): void => {
  db.run(sql, params)
}

// 工具函数：运行写操作并返回最后插入的 rowid
export const runInsert = (db: Database, sql: string, params: any[] = []): number => {
  db.run(sql, params)
  const result = queryOne(db, 'SELECT last_insert_rowid() as id')
  return result ? result.id : 0
}
