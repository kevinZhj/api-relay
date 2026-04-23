// 熔断器：连续失败超过阈值时自动熔断，防止反复请求失败的账号

interface CircuitState {
  failures: number
  lastFailureAt: number
  state: 'closed' | 'open' | 'half-open'
}

const circuits = new Map<number, CircuitState>()

const FAILURE_THRESHOLD = 5
const OPEN_DURATION = 60_000 // 熔断 60s

export const isCircuitOpen = (accountId: number): boolean => {
  const circuit = circuits.get(accountId)
  if (!circuit) return false

  if (circuit.state === 'closed') return false

  // 检查是否过了熔断期
  if (circuit.state === 'open' && Date.now() - circuit.lastFailureAt > OPEN_DURATION) {
    circuit.state = 'half-open'
    return false
  }

  return circuit.state === 'open'
}

export const recordCircuitSuccess = (accountId: number) => {
  const circuit = circuits.get(accountId)
  if (circuit) {
    circuit.failures = 0
    circuit.state = 'closed'
  }
}

export const recordCircuitFailure = (accountId: number) => {
  let circuit = circuits.get(accountId)
  if (!circuit) {
    circuit = { failures: 0, lastFailureAt: 0, state: 'closed' }
    circuits.set(accountId, circuit)
  }

  circuit.failures++
  circuit.lastFailureAt = Date.now()

  if (circuit.failures >= FAILURE_THRESHOLD) {
    circuit.state = 'open'
  }
}
