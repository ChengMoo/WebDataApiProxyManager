import type { AccountHealthReport, ProviderRequestReport } from '../types'
import { buildSearchParams, request } from './core'

export const reportsApi = {
  reportRequestsByProvider(token: string, params?: { since?: string; until?: string }) {
    return request<ProviderRequestReport[]>(`/reports/requests-by-provider${buildSearchParams(params ?? {})}`, { token })
  },
  reportAccountHealth(token: string) {
    return request<AccountHealthReport[]>('/reports/account-health', { token })
  },
}
