import type { EgressProxySummary } from '../types'
import { request } from './core'

export const egressProxiesApi = {
  listEgressProxies(token: string) {
    return request<EgressProxySummary[]>('/egress-proxies', { token })
  },
  createEgressProxy(
    token: string,
    payload: {
      name: string
      proxy_url: string
      region?: string
      enabled?: boolean
    },
  ) {
    return request<EgressProxySummary>('/egress-proxies', {
      method: 'POST',
      token,
      body: payload,
    })
  },
  updateEgressProxy(
    token: string,
    proxyId: string,
    payload: { name?: string; proxy_url?: string; region?: string; clear_region?: boolean; enabled?: boolean },
  ) {
    return request<EgressProxySummary>(`/egress-proxies/${proxyId}`, {
      method: 'PATCH',
      token,
      body: payload,
    })
  },
}
