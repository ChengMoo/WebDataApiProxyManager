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
