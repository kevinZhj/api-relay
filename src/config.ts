import 'dotenv/config'

export const config = {
  port: Number(process.env.PORT),
  host: process.env.HOST,
  dbPath: process.env.DB_PATH,
  adminKey: process.env.ADMIN_KEY,
  defaultBaseUrl: process.env.DEFAULT_BASE_URL,
  maxRetry: Number(process.env.MAX_RETRY),
  rateLimitRecoveryMinutes: Number(process.env.RATE_LIMIT_RECOVERY_MINUTES) || 30,
  routingStrategy: process.env.ROUTING_STRATEGY ?? 'latency',
  latencyWeight: Number(process.env.LATENCY_WEIGHT) || 1.0,
  healthProbeInterval: Number(process.env.HEALTH_PROBE_INTERVAL) || 60,
  consecutiveFailureThreshold: Number(process.env.CONSECUTIVE_FAILURE_THRESHOLD) || 3,
}

// 根据 base_url 构建完整的 API URL
// 如果 base_url 已包含版本路径 (如 /v1, /v4)，则去掉 path 中的 /v1 前缀
export const buildApiUrl = (baseUrl: string, path: string): string => {
  if (/\/v\d+\/?$/.test(baseUrl)) {
    return `${baseUrl}${path.replace(/^\/v\d+/, '')}`
  }
  return `${baseUrl}${path}`
}
