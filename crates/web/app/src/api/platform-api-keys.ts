import type { PlatformApiKeyRecord } from '../types'
import { request } from './core'

export const platformApiKeysApi = {
  listPlatformApiKeys(token: string) {
    return request<PlatformApiKeyRecord[]>('/settings/platform-api-keys', { token })
  },
  createPlatformApiKey(token: string, payload: { name: string; quota?: number }) {
    return request<{ id: string; name: string; key: string; key_prefix: string; quota: number }>('/settings/platform-api-keys', {
      method: 'POST',
      token,
      body: payload,
    })
  },
  updatePlatformApiKey(token: string, keyId: string, payload: { name?: string; quota?: number }) {
    return request<PlatformApiKeyRecord>(`/settings/platform-api-keys/${keyId}`, {
      method: 'PATCH',
      token,
      body: payload,
    })
  },
  revealPlatformApiKey(token: string, keyId: string) {
    return request<{ key: string }>(`/settings/platform-api-keys/${keyId}/secret`, {
      token,
    })
  },
  revokePlatformApiKey(token: string, keyId: string) {
    return request<void>(`/settings/platform-api-keys/${keyId}/revoke`, {
      method: 'POST',
      token,
    })
  },
}
