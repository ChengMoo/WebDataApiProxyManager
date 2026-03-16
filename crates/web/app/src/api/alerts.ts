import type { AlertEventRecord, AlertRuleRecord } from '../types'
import { buildSearchParams, request } from './core'

export const alertsApi = {
  listAlertRules(token: string) {
    return request<AlertRuleRecord[]>('/alert-rules', { token })
  },
  createAlertRule(
    token: string,
    payload: { name: string; kind: string; threshold_value: number; webhook_url: string; enabled?: boolean },
  ) {
    return request<AlertRuleRecord>('/alert-rules', { method: 'POST', token, body: payload })
  },
  updateAlertRule(
    token: string,
    ruleId: string,
    payload: { name?: string; kind?: string; threshold_value?: number; webhook_url?: string; enabled?: boolean },
  ) {
    return request<AlertRuleRecord>(`/alert-rules/${ruleId}`, { method: 'PATCH', token, body: payload })
  },
  deleteAlertRule(token: string, ruleId: string) {
    return request<void>(`/alert-rules/${ruleId}`, { method: 'DELETE', token })
  },
  listAlertEvents(
    token: string,
    params?: { since?: string; until?: string; kind?: string; limit?: number },
  ) {
    return request<AlertEventRecord[]>(`/alert-events${buildSearchParams(params ?? {})}`, { token })
  },
}
