import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { adminApi } from '../../api'
import { useSession } from '../../app'
import { useLocale } from '../../i18n'
import {
  CustomSelect,
  EmptyState,
  ErrorBanner,
  Panel,
  Spinner,
  formatTimestamp,
} from '../../ui/shared'

function AuditLogDiffDisclosure({
  label,
  value,
}: {
  label: string
  value: unknown
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className={open ? 'audit-diff-card is-open' : 'audit-diff-card'}>
      <button type="button" className="audit-diff-toggle" onClick={() => setOpen((current) => !current)}>
        <span>{label}</span>
        <svg
          className={open ? 'audit-diff-caret is-open' : 'audit-diff-caret'}
          viewBox="0 0 20 20"
          width="14"
          height="14"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" />
        </svg>
      </button>
      {open ? <pre className="audit-diff-content">{JSON.stringify(value, null, 2)}</pre> : null}
    </div>
  )
}

export function AuditLogsPage() {
  const { token } = useSession()
  const { t } = useLocale()
  const [resourceType, setResourceType] = useState('')
  const [limit, setLimit] = useState('100')

  const logsQuery = useQuery({
    queryKey: ['audit-logs', token, resourceType, limit],
    queryFn: () =>
      adminApi.listAuditLogs(token, {
        resource_type: resourceType || undefined,
        limit: Number(limit || '100'),
      }),
  })

  if (logsQuery.isLoading) return <Spinner />
  if (logsQuery.error) return <ErrorBanner message={logsQuery.error.message} />

  return (
    <Panel
      title={t('audit.title')}
      description={t('audit.desc')}
      actions={
        <div className="inline-action">
          <label className="inline-field compact">
            <span>{t('common.resource')}</span>
            <CustomSelect
              value={resourceType}
              onChange={setResourceType}
              options={[
                { value: '', label: t('common.all') },
                { value: 'provider_account', label: 'provider_account' },
                { value: 'egress_proxy', label: 'egress_proxy' },
                { value: 'platform_api_key', label: 'platform_api_key' },
                { value: 'alert_rule', label: 'alert_rule' },
              ]}
            />
          </label>
          <label className="inline-field compact">
            <span>{t('common.limit')}</span>
            <input value={limit} onChange={(event) => setLimit(event.target.value)} />
          </label>
        </div>
      }
    >
      {(logsQuery.data ?? []).length === 0 ? (
        <EmptyState title={t('audit.no_logs')} body={t('audit.no_logs_desc')} />
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('table.time')}</th>
                <th>{t('table.admin')}</th>
                <th>{t('table.action')}</th>
                <th>{t('table.resource')}</th>
                <th>{t('table.resource_id')}</th>
                <th>{t('table.changes')}</th>
              </tr>
            </thead>
            <tbody>
              {(logsQuery.data ?? []).map((log) => (
                <tr key={log.id}>
                  <td>{formatTimestamp(log.created_at)}</td>
                  <td className="mono-cell">{log.admin_identity}</td>
                  <td>
                    <span className="tag">{log.action}</span>
                  </td>
                  <td>{log.resource_type}</td>
                  <td className="mono-cell">{log.resource_id ?? '—'}</td>
                  <td>
                    {log.new_value ? (
                      <AuditLogDiffDisclosure label={t('audit.view_diff')} value={log.new_value} />
                    ) : (
                      '—'
                    )}
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
