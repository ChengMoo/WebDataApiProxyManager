import type { RequestLogRecord } from '../types'
import { buildSearchParams, request } from './core'

export type RequestLogFilters = {
  provider?: string
  status_min?: number
  status_max?: number
  latency_min?: number
  latency_max?: number
  since?: string
  until?: string
  api_key_name?: string
  limit?: number
}

export const requestLogsApi = {
  listRequestLogs(token: string, filters: RequestLogFilters) {
    return request<RequestLogRecord[]>(`/request-logs${buildSearchParams(filters)}`, { token })
  },
}
