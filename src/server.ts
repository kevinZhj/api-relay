import Fastify from 'fastify'
import cors from '@fastify/cors'
import { Database } from 'sql.js'
import { registerChatRoutes } from './routes/chat.js'
import { registerMessagesRoutes } from './routes/messages.js'
import { registerModelRoutes } from './routes/models.js'
import { registerAdminRoutes } from './routes/admin.js'
import { registerAdminPage } from './routes/admin_page.js'

export const createServer = (db: Database, markDirty: () => void) => {
  const app = Fastify({ logger: false, bodyLimit: 10 * 1024 * 1024 })

  app.register(cors, { origin: true })

  registerAdminPage(app, db)
  registerChatRoutes(app, db, markDirty)
  registerMessagesRoutes(app, db, markDirty)
  registerModelRoutes(app)
  registerAdminRoutes(app, db, markDirty)

  return app
}
