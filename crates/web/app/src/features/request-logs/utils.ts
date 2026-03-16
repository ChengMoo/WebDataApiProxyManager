import type { RequestLogFilters } from './types'

export function compactTail(value: string, visible = 8) {
  if (value.length <= visible) return value
  return `...${value.slice(-visible)}`
}

export function buildRequestLogFilters({
  provider,
  statusRange,
  latencyMin,
  latencyMax,
  since,
  until,
  apiKeyName,
  limit,
}: {
  provider: string
  statusRange: string
  latencyMin: string
  latencyMax: string
  since: string
  until: string
  apiKeyName: string
  limit: string
}) {
  const filters: RequestLogFilters = {}
  if (provider) filters.provider = provider

  if (statusRange === '2xx') {
    filters.status_min = 200
    filters.status_max = 299
  } else if (statusRange === '4xx') {
    filters.status_min = 400
    filters.status_max = 499
  } else if (statusRange === '5xx') {
    filters.status_min = 500
    filters.status_max = 599
  }

  if (latencyMin) filters.latency_min = Number(latencyMin)
  if (latencyMax) filters.latency_max = Number(latencyMax)
  if (since) filters.since = since
  if (until) filters.until = until
  if (apiKeyName) filters.api_key_name = apiKeyName
  filters.limit = Number(limit || '100')

  return filters
}
