import type { AdminAuditLogRecord } from '../types'
import { buildSearchParams, request } from './core'

export const auditLogsApi = {
  listAuditLogs(
    token: string,
    params?: { since?: string; until?: string; resource_type?: string; limit?: number },
  ) {
    return request<AdminAuditLogRecord[]>(`/audit-logs${buildSearchParams(params ?? {})}`, { token })
  },
}
