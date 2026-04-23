import 'dotenv/config'
import { config } from './config.js'
import { initDb, saveDb } from './db/index.js'
import { existsSync, copyFileSync } from 'node:fs'
import { Database } from 'sql.js'
import { startHealthProbes } from './modules/health/probe.service.js'

const start = async () => {
  // 启动前备份现有数据库
  if (existsSync(config.dbPath)) {
    const backupPath = config.dbPath + '.backup'
    try {
      copyFileSync(config.dbPath, backupPath)
    } catch (err) {
      console.error('数据库备份失败:', err)
    }
  }

  const db = await initDb(config.dbPath)

  // 脏位追踪：写操作标记 dirty，定时器只在有变更时才写盘
  let dirty = false
  const markDirty = () => { dirty = true }

  const { createServer } = await import('./server.js')
  const app = createServer(db, markDirty)

  // 定时保存数据库到磁盘（30秒，仅在脏时保存）
  const saveInterval = setInterval(() => {
    if (!dirty) return
    dirty = false
    try {
      saveDb(db, config.dbPath)
    } catch (err) {
      console.error('数据库自动保存失败:', err)
    }
  }, 30000)

  // 启动主动健康探测
  const probeTimer = startHealthProbes(db)

  try {
    await app.listen({ port: config.port, host: config.host })
    console.log(`中转站已启动: http://${config.host}:${config.port}`)
    console.log(`管理面板: http://${config.host}:${config.port}/admin/accounts`)
  } catch (err) {
    console.error('启动失败:', err)
    process.exit(1)
  }

  let shuttingDown = false

  const shutdown = async () => {
    if (shuttingDown) return
    shuttingDown = true
    clearInterval(saveInterval)
    clearInterval(probeTimer)
    console.log('正在关闭...')

    // 等待进行中的请求完成，最多 10s
    const forceTimer = setTimeout(() => {
      console.log('关闭超时，强制退出')
      try { saveDb(db, config.dbPath) } catch {}
      db.close()
      process.exit(1)
    }, 10_000)

    try {
      await app.close()
      clearTimeout(forceTimer)
    } catch {}

    try {
      saveDb(db, config.dbPath)
    } catch (err) {
      console.error('关闭时保存失败:', err)
    }
    db.close()
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

start()
