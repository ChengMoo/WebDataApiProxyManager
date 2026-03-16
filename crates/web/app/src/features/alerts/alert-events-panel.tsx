import type { AlertEventRecord } from '../../types'
import { EmptyState, Panel, Spinner, StatusBadge, formatTimestamp } from '../../ui/shared'
import { formatAlertKind, formatDeliveryStatus } from './utils'

export function AlertEventsPanel({
  loading,
  events,
  t,
}: {
  loading: boolean
  events: AlertEventRecord[]
  t: (key: string, values?: Record<string, string | number>) => string
}) {
  return (
    <Panel title={t('alerts.events')} description={t('alerts.events_desc')}>
      {loading ? (
        <Spinner />
      ) : events.length === 0 ? (
        <EmptyState title={t('alerts.no_events')} body={t('alerts.no_events_desc')} />
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('table.time')}</th>
                <th>{t('table.kind')}</th>
                <th>{t('table.message')}</th>
                <th>{t('table.rule')}</th>
                <th>{t('alerts.delivery')}</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => {
                const deliveryStatus = (event.metadata as Record<string, unknown>)
                  ?.delivery_status as string | undefined
                return (
                  <tr key={event.id}>
                    <td>{formatTimestamp(event.created_at)}</td>
                    <td>
                      <span className="tag">{formatAlertKind(event.kind, t)}</span>
                    </td>
                    <td>{event.message}</td>
                    <td className="mono-cell">{event.alert_rule_id ?? '—'}</td>
                    <td>
                      {deliveryStatus ? (
                        <StatusBadge
                          tone={deliveryStatus === 'sent' ? 'success' : 'danger'}
                        >
                          {formatDeliveryStatus(deliveryStatus, t)}
                        </StatusBadge>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}
