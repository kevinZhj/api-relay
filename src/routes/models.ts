import { FastifyInstance } from 'fastify'

const SUPPORTED_MODELS = [
  { id: 'kimi-k2.5', object: 'model', owned_by: 'moonshot', permission: [] },
  { id: 'moonshot-v1-8k', object: 'model', owned_by: 'moonshot', permission: [] },
  { id: 'moonshot-v1-32k', object: 'model', owned_by: 'moonshot', permission: [] },
  { id: 'moonshot-v1-128k', object: 'model', owned_by: 'moonshot', permission: [] },
]

export const registerModelRoutes = (app: FastifyInstance) => {
  app.get('/v1/models', async () => {
    return { object: 'list', data: SUPPORTED_MODELS }
  })
}
