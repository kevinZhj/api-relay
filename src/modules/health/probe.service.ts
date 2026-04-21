import { Database } from 'sql.js'
import { config } from '../../config.js'
import { queryAll, run } from '../../db/index.js'
import { listAccounts, updateAccountStatus } from '../account/account.service.js'
import { recordSuccess, recordFailure, resetConsecutiveFailures } from '../account/account.stats.js'

export const probeAccount = async (db: Database, accountId: number): Promise<{ success: boolean; latency: number }> => {
  const accounts = listAccounts(db)
  const account = accounts.find(a => a.id === accountId)
  if (!account || account.status !== 'active') return { success: false, latency: 0 }

  const isAnthropicBackend = account.protocol === 'anthropic' || (account.protocol === 'auto' && (account.base_url.includes('moonshot') || account.base_url.includes('kimi')))
  const url = isAnthropicBackend
    ? `${account.base_url}/v1/models`
    : `${account.base_url}/v1/models`

  const headers: Record<string, string> = {
    'authorization': `Bearer ${account.api_key}`,
    'x-api-key': account.api_key,
  }

  const startTime = Date.now()
  try {
    const resp = await fetch(url, { method: 'GET', headers, signal: AbortSignal.timeout(10000) })
    const latency = Date.now() - startTime

    run(db,
      'INSERT INTO health_probes (account_id, is_success, latency_ms, error_code) VALUES (?, ?, ?, ?)',
      [accountId, resp.ok ? 1 : 0, latency, resp.ok ? null : String(resp.status)]
    )

    if (resp.ok) {
      recordSuccess(db, accountId, latency)
      resetConsecutiveFailures(db, accountId)
      return { success: true, latency }
    } else {
      recordFailure(db, accountId)
      return { success: false, latency }
    }
  } catch (err: any) {
    const latency = Date.now() - startTime
    run(db,
      'INSERT INTO health_probes (account_id, is_success, latency_ms, error_code) VALUES (?, ?, ?, ?)',
      [accountId, 0, latency, err.name || 'network_error']
    )
    recordFailure(db, accountId)
    return { success: false, latency }
  }
}

export const startHealthProbes = (db: Database): NodeJS.Timeout => {
  const interval = (config.healthProbeInterval || 60) * 1000
  return setInterval(() => {
    const accounts = listAccounts(db)
    for (const account of accounts) {
      // 对非 active 账号强制探测；对 active 账号随机抽样 30%
      if (account.status !== 'active' || Math.random() < 0.3) {
        probeAccount(db, account.id).then(result => {
          if (result.success && account.status !== 'active') {
            updateAccountStatus(db, account.id, 'active')
          }
        }).catch(() => {})
      }
    }
  }, interval)
}
