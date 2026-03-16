import { request } from './core'

export const authApi = {
  authStatus() {
    return request<{ initialized: boolean }>('/auth/status')
  },
  authSetup(password: string) {
    return request<{ token: string }>('/auth/setup', {
      method: 'POST',
      body: { password },
    })
  },
  authLogin(password: string) {
    return request<{ token: string }>('/auth/login', {
      method: 'POST',
      body: { password },
    })
  },
}
