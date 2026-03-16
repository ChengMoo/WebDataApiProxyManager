import type { ProviderAsyncJobRecord, ProviderAsyncJobState, ProviderId, ReconcileReport } from '../types'
import { buildSearchParams, request } from './core'

export const asyncJobsApi = {
  listAsyncJobs(
    token: string,
    params: { provider?: ProviderId; state?: ProviderAsyncJobState; limit: number },
  ) {
    return request<ProviderAsyncJobRecord[]>(`/async-jobs${buildSearchParams(params)}`, { token })
  },
  reconcileFirecrawl(token: string, limit: number) {
    return request<ReconcileReport>('/async-jobs/reconcile/firecrawl', {
      method: 'POST',
      token,
      body: { limit },
    })
  },
}
