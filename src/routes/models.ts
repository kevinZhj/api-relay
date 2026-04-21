import { FastifyInstance } from 'fastify'

const SUPPORTED_MODELS = [
  { id: 'kimi-k2.5', object: 'model', owned_by: 'moonshot', permission: [] },
  { id: 'moonshot-v1-8k', object: 'model', owned_by: 'moonshot', permission: [] },
  { id: 'moonshot-v1-32k', object: 'model', owned_by: 'moonshot', permission: [] },
  { id: 'moonshot-v1-128k', object: 'model', owned_by: 'moonshot', permission: [] },
  { id: 'glm-4-plus', object: 'model', owned_by: 'zhipu', permission: [] },
  { id: 'glm-4-flash', object: 'model', owned_by: 'zhipu', permission: [] },
  { id: 'claude-sonnet-4-20250514', object: 'model', owned_by: 'anthropic', permission: [] },
  { id: 'claude-opus-4-20250514', object: 'model', owned_by: 'anthropic', permission: [] },
]

export const registerModelRoutes = (app: FastifyInstance) => {
  app.get('/v1/models', async () => {
    return { object: 'list', data: SUPPORTED_MODELS }
  })
}
