import type { AlertRuleRecord } from '../../types'
import { EmptyState, Panel, StatusBadge, formatTimestamp } from '../../ui/shared'
import { formatAlertKind } from './utils'

export function AlertRulesPanel({
  rules,
  togglePending,
  deletePending,
  onToggleEnabled,
  onDelete,
  t,
}: {
  rules: AlertRuleRecord[]
  togglePending: boolean
  deletePending: boolean
  onToggleEnabled: (ruleId: string, enabled: boolean) => void
  onDelete: (ruleId: string) => void
  t: (key: string, values?: Record<string, string | number>) => string
}) {
  return (
    <Panel
      title={t('alerts.rules')}
      description={t('alerts.rules_count', { count: rules.length })}
    >
      {rules.length === 0 ? (
        <EmptyState title={t('alerts.no_rules')} body={t('alerts.no_rules_desc')} />
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('table.name')}</th>
                <th>{t('table.kind')}</th>
                <th>{t('table.threshold')}</th>
                <th>{t('table.status')}</th>
                <th>{t('table.last_triggered')}</th>
                <th>{t('table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id}>
                  <td>
                    <div className="cell-stack">
                      <strong>{rule.name}</strong>
                      <span>{rule.id}</span>
                    </div>
                  </td>
                  <td>
                    <span className="tag">{formatAlertKind(rule.kind, t)}</span>
                  </td>
                  <td>{rule.threshold_value}</td>
                  <td>
                    <StatusBadge tone={rule.enabled ? 'success' : 'neutral'}>
                      {rule.enabled ? t('table.status_enabled') : t('table.status_disabled')}
                    </StatusBadge>
                  </td>
                  <td>{rule.last_triggered_at ? formatTimestamp(rule.last_triggered_at) : '—'}</td>
                  <td>
                    <div className="inline-action">
                      <button
                        type="button"
                        className="ghost-button"
                        disabled={togglePending}
                        onClick={() => onToggleEnabled(rule.id, !rule.enabled)}
                      >
                        {rule.enabled ? t('common.disable') : t('common.enable')}
                      </button>
                      <button
                        type="button"
                        className="danger-button"
                        disabled={deletePending}
                        onClick={() => onDelete(rule.id)}
                      >
                        {t('common.delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}
