import { FastifyInstance } from 'fastify'

const SUPPORTED_MODELS = [
  // Kimi 模型 (Anthropic 协议)
  { id: 'kimi-k2.6', object: 'model', owned_by: 'moonshot', permission: [] },
  { id: 'kimi-k2.5', object: 'model', owned_by: 'moonshot', permission: [] },
  { id: 'moonshot-v1-8k', object: 'model', owned_by: 'moonshot', permission: [] },
  { id: 'moonshot-v1-32k', object: 'model', owned_by: 'moonshot', permission: [] },
  { id: 'moonshot-v1-128k', object: 'model', owned_by: 'moonshot', permission: [] },
  { id: 'moonshot-v1-8k-vision-preview', object: 'model', owned_by: 'moonshot', permission: [] },
  { id: 'moonshot-v1-32k-vision-preview', object: 'model', owned_by: 'moonshot', permission: [] },
  { id: 'moonshot-v1-128k-vision-preview', object: 'model', owned_by: 'moonshot', permission: [] },
  // GLM 模型 (OpenAI 协议)
  { id: 'glm-4-plus', object: 'model', owned_by: 'zhipu', permission: [] },
  { id: 'glm-4-0520', object: 'model', owned_by: 'zhipu', permission: [] },
  { id: 'glm-4-air', object: 'model', owned_by: 'zhipu', permission: [] },
  { id: 'glm-4-air-250414', object: 'model', owned_by: 'zhipu', permission: [] },
  { id: 'glm-4-airx', object: 'model', owned_by: 'zhipu', permission: [] },
  { id: 'glm-4-long', object: 'model', owned_by: 'zhipu', permission: [] },
  { id: 'glm-4-flash', object: 'model', owned_by: 'zhipu', permission: [] },
  { id: 'glm-4-flash-250414', object: 'model', owned_by: 'zhipu', permission: [] },
  { id: 'glm-4-flashx', object: 'model', owned_by: 'zhipu', permission: [] },
]

export const registerModelRoutes = (app: FastifyInstance) => {
  app.get('/v1/models', async () => {
    return { object: 'list', data: SUPPORTED_MODELS }
  })
}
