import { CustomSelect } from '../../ui/shared'
import type { EgressProxySummary } from '../../types'
import type { AccountBulkAction } from './utils'

export function AccountsBulkBar({
  selectedCount,
  bulkProxyId,
  bulkPending,
  proxies,
  onBulkProxyChange,
  onRunBulkAction,
  t,
}: {
  selectedCount: number
  bulkProxyId: string
  bulkPending: boolean
  proxies: EgressProxySummary[]
  onBulkProxyChange: (value: string) => void
  onRunBulkAction: (action: AccountBulkAction) => void
  t: (key: string, values?: Record<string, string | number>) => string
}) {
  return (
    <div className="accounts-bulk-bar">
      <div className="accounts-bulk-row">
        <span className="accounts-selected-count">
          {t('accounts.selected_count', { count: selectedCount })}
        </span>
        <button
          type="button"
          className="ghost-button"
          disabled={bulkPending}
          onClick={() => onRunBulkAction('enable')}
        >
          {t('accounts.bulk_enable')}
        </button>
        <button
          type="button"
          className="ghost-button"
          disabled={bulkPending}
          onClick={() => onRunBulkAction('disable')}
        >
          {t('accounts.bulk_disable')}
        </button>
        <button
          type="button"
          className="danger-button"
          disabled={bulkPending}
          onClick={() => onRunBulkAction('delete')}
        >
          {t('accounts.bulk_delete')}
        </button>
      </div>
      <div className="account-bind-controls compound-control">
        <CustomSelect
          className="accounts-bulk-select"
          value={bulkProxyId}
          onChange={onBulkProxyChange}
          ariaLabel={t('table.proxy_binding')}
          options={[
            { value: '', label: t('common.select_proxy') },
            ...proxies.map((proxy) => ({
              value: proxy.id,
              label: proxy.name,
            })),
          ]}
        />
        <button
          type="button"
          className="ghost-button"
          disabled={bulkPending || !bulkProxyId}
          onClick={() => onRunBulkAction('bind')}
        >
          {t('accounts.bulk_bind')}
        </button>
      </div>
    </div>
  )
}
