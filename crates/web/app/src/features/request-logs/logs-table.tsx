import { EmptyState, ProviderTag, formatTimestamp } from '../../ui/shared'
import type { RequestLogRecord } from '../../types'
import { compactTail } from './utils'

export function RequestLogsTable({
  logs,
  copiedId,
  onCopy,
  t,
}: {
  logs: RequestLogRecord[]
  copiedId: string | null
  onCopy: (value: string, id: string) => void
  t: (key: string, values?: Record<string, string | number>) => string
}) {
  if (logs.length === 0) {
    return <EmptyState title={t('requests.no_logs')} body={t('requests.no_logs_desc')} />
  }

  return (
    <div className="table-scroll">
      <table className="data-table request-logs-table">
        <thead>
          <tr>
            <th>{t('table.time')}</th>
            <th>{t('table.route')}</th>
            <th>{t('table.provider')}</th>
            <th>{t('table.account')}</th>
            <th>{t('table.proxy')}</th>
            <th>{t('table.api_key')}</th>
            <th>{t('table.status')}</th>
            <th>{t('table.latency')}</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td>{formatTimestamp(log.created_at)}</td>
              <td className="mono-cell"><span className="request-log-route" title={log.route}>{log.route}</span></td>
              <td className="request-log-center-cell"><ProviderTag provider={log.provider} /></td>
              <td>
                {log.provider_account_id ? (
                  <button
                    type="button"
                    className={`request-log-copy-chip${copiedId === `account:${log.id}` ? ' is-copied' : ''}`}
                    title={log.provider_account_id}
                    aria-label={`${t('common.copy')}: ${log.provider_account_id}`}
                    onClick={() => onCopy(log.provider_account_id!, `account:${log.id}`)}
                  >
                    {copiedId === `account:${log.id}` ? t('common.copied') : compactTail(log.provider_account_id)}
                  </button>
                ) : (
                  '—'
                )}
              </td>
              <td className="request-log-center-cell">
                {log.egress_proxy_id ? (
                  <button
                    type="button"
                    className={`request-log-copy-chip${copiedId === `proxy:${log.id}` ? ' is-copied' : ''}`}
                    title={log.egress_proxy_id}
                    aria-label={`${t('common.copy')}: ${log.egress_proxy_id}`}
                    onClick={() => onCopy(log.egress_proxy_id!, `proxy:${log.id}`)}
                  >
                    {copiedId === `proxy:${log.id}` ? t('common.copied') : compactTail(log.egress_proxy_id)}
                  </button>
                ) : (
                  <span className="request-log-inline-text">{t('common.direct')}</span>
                )}
              </td>
              <td>
                {log.platform_api_key_id ? (
                  <button
                    type="button"
                    className={`request-log-copy-chip${copiedId === `key:${log.id}` ? ' is-copied' : ''}`}
                    title={log.platform_api_key_id}
                    aria-label={`${t('common.copy')}: ${log.platform_api_key_id}`}
                    onClick={() => onCopy(log.platform_api_key_id!, `key:${log.id}`)}
                  >
                    {copiedId === `key:${log.id}` ? t('common.copied') : compactTail(log.platform_api_key_id)}
                  </button>
                ) : (
                  '—'
                )}
              </td>
              <td className="request-log-center-cell" title={log.failure_message ?? undefined}>
                <span className="request-log-status">
                  {log.status_code ?? log.failure_kind ?? '—'}
                </span>
              </td>
              <td className="request-log-center-cell">
                <span className="request-log-inline-text">{log.latency_ms != null ? `${log.latency_ms} ms` : '—'}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
