import { CustomSelect, EmptyState, Panel, ProviderSelect, ProviderTag, Spinner, StatusBadge, formatManagedStatus, formatMaybe, formatTimestamp, toneFromStatus } from '../../ui/shared'
import type { AccountHealthReport } from '../../types'

export function AccountHealthPanel({
  title,
  description,
  provider,
  providers,
  allLabel,
  loading,
  filteredHealth,
  pagedHealth,
  page,
  totalPages,
  pageSize,
  onProviderChange,
  onPrevPage,
  onNextPage,
  onPageSizeChange,
  t,
}: {
  title: string
  description: string
  provider: string
  providers: string[]
  allLabel: string
  loading: boolean
  filteredHealth: AccountHealthReport[]
  pagedHealth: AccountHealthReport[]
  page: number
  totalPages: number
  pageSize: number
  onProviderChange: (value: string) => void
  onPrevPage: () => void
  onNextPage: () => void
  onPageSizeChange: (value: number) => void
  t: (key: string, values?: Record<string, string | number>) => string
}) {
  return (
    <Panel
      title={title}
      description={description}
      actions={
        <ProviderSelect
          value={provider}
          onChange={onProviderChange}
          providers={providers}
          includeAll
          allLabel={allLabel}
          className="panel-filter-select"
          ariaLabel={t('table.provider')}
        />
      }
    >
      {loading ? (
        <Spinner />
      ) : filteredHealth.length === 0 ? (
        <EmptyState title={t('overview.no_accounts')} body={t('overview.no_accounts_desc')} />
      ) : (
        <>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('table.provider')}</th>
                  <th>{t('table.name')}</th>
                  <th>{t('table.status')}</th>
                  <th>{t('table.enabled')}</th>
                  <th>{t('table.weight')}</th>
                  <th>{t('table.failures')}</th>
                  <th>{t('table.last_used')}</th>
                  <th>{t('table.last_error')}</th>
                </tr>
              </thead>
              <tbody>
                {pagedHealth.map((account) => (
                  <tr key={account.id}>
                    <td><ProviderTag provider={account.provider} /></td>
                    <td>
                      <div className="cell-stack">
                        <strong>{account.name}</strong>
                        <span>{account.id}</span>
                      </div>
                    </td>
                    <td>
                      <StatusBadge tone={toneFromStatus(account.status)}>{formatManagedStatus(account.status, t)}</StatusBadge>
                    </td>
                    <td>
                      <StatusBadge tone={account.enabled ? 'success' : 'danger'}>
                        {account.enabled ? t('common.yes') : t('common.no')}
                      </StatusBadge>
                    </td>
                    <td>{account.weight}</td>
                    <td>{account.consecutive_failures}</td>
                    <td>{account.last_used_at ? formatTimestamp(account.last_used_at) : '—'}</td>
                    <td>{formatMaybe(account.last_error)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pagination-bar">
            <span className="pagination-info">
              {t('pagination.page_info').replace('{page}', String(page + 1)).replace('{total}', String(totalPages))}
            </span>
            <div className="pagination-controls">
              <button type="button" className="ghost-button" disabled={page <= 0} onClick={onPrevPage}>
                {t('pagination.prev')}
              </button>
              <button type="button" className="ghost-button" disabled={page >= totalPages - 1} onClick={onNextPage}>
                {t('pagination.next')}
              </button>
              <CustomSelect
                value={String(pageSize)}
                onChange={(value) => onPageSizeChange(Number(value))}
                className="pagination-size-select"
                options={[
                  { value: '5', label: '5' },
                  { value: '10', label: '10' },
                  { value: '20', label: '20' },
                ]}
                ariaLabel={t('common.limit')}
              />
            </div>
          </div>
        </>
      )}
    </Panel>
  )
}
