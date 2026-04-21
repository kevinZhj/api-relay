import 'dotenv/config'

export const config = {
  port: Number(process.env.PORT),
  host: process.env.HOST,
  dbPath: process.env.DB_PATH,
  adminKey: process.env.ADMIN_KEY,
  defaultBaseUrl: process.env.DEFAULT_BASE_URL,
  maxRetry: Number(process.env.MAX_RETRY),
  rateLimitRecoveryMinutes: Number(process.env.RATE_LIMIT_RECOVERY_MINUTES),
}
