import type { ReactNode } from 'react'
import { ActionDropdown, CheckIcon, CopyIcon, EmptyState, ErrorBanner, Panel, StatusBadge, formatTimestamp } from '../../ui/shared'
import type { PlatformApiKeyRecord } from '../../types'
import { formatQuota } from './utils'

export function ApiKeysPanel({
  title,
  description,
  actions,
  keys,
  editingId,
  editName,
  editQuota,
  copiedId,
  copyingId,
  updatePending,
  revokePending,
  copyError,
  updateError,
  revokeError,
  onEditNameChange,
  onEditQuotaChange,
  onCopyKey,
  onSaveEdit,
  onCancelEdit,
  onStartEdit,
  onRevoke,
  t,
}: {
  title: string
  description: string
  actions?: ReactNode
  keys: PlatformApiKeyRecord[]
  editingId: string | null
  editName: string
  editQuota: string
  copiedId: string | null
  copyingId: string | null
  updatePending: boolean
  revokePending: boolean
  copyError?: string
  updateError?: string
  revokeError?: string
  onEditNameChange: (value: string) => void
  onEditQuotaChange: (value: string) => void
  onCopyKey: (keyId: string) => void
  onSaveEdit: (keyId: string) => void
  onCancelEdit: () => void
  onStartEdit: (key: PlatformApiKeyRecord) => void
  onRevoke: (keyId: string) => void
  t: (key: string, values?: Record<string, string | number>) => string
}) {
  return (
    <Panel title={title} description={description} actions={actions}>
      {keys.length === 0 ? (
        <EmptyState title={t('api_keys.no_keys')} body={t('api_keys.no_keys_desc')} />
      ) : (
        <div className="table-scroll">
          <table className="data-table api-keys-table">
            <thead>
              <tr>
                <th>{t('table.name')}</th>
                <th>{t('table.key_prefix')}</th>
                <th>{t('table.quota')}</th>
                <th>{t('table.requests_count')}</th>
                <th>{t('table.created')}</th>
                <th>{t('table.status')}</th>
                <th>{t('table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key.id}>
                  <td>
                    {editingId === key.id ? (
                      <input className="api-key-name-input" value={editName} onChange={(event) => onEditNameChange(event.target.value)} placeholder={key.name} />
                    ) : (
                      <div className="cell-stack">
                        <strong>{key.name}</strong>
                        <span>{key.id}</span>
                      </div>
                    )}
                  </td>
                  <td>
                    <div className="key-cell api-key-secret-cell">
                      <code className="key-mono">
                        {key.key_prefix}...
                      </code>
                      <button
                        type="button"
                        className={`copy-btn copy-btn-compact${copiedId === key.id ? ' is-copied' : ''}`}
                        disabled={copyingId === key.id}
                        onClick={() => onCopyKey(key.id)}
                      >
                        {copiedId === key.id ? <CheckIcon /> : <CopyIcon />}
                        {copiedId === key.id
                          ? t('common.copied')
                          : copyingId === key.id
                            ? t('common.copying')
                            : t('common.copy')}
                      </button>
                    </div>
                  </td>
                  <td>
                    {editingId === key.id ? (
                      <input className="api-key-quota-input" value={editQuota} onChange={(event) => onEditQuotaChange(event.target.value)} inputMode="numeric" placeholder={String(key.quota)} />
                    ) : (
                      formatQuota(key.quota, t)
                    )}
                  </td>
                  <td>{key.request_count}</td>
                  <td>{formatTimestamp(key.created_at)}</td>
                  <td>
                    <StatusBadge tone={key.revoked_at ? 'danger' : 'success'}>
                      {key.revoked_at ? t('table.status_revoked') : t('table.status_active')}
                    </StatusBadge>
                  </td>
                  <td>
                    <div className="inline-action api-key-actions">
                      {editingId === key.id ? (
                        <>
                          <button
                            type="button"
                            className="primary-button"
                            disabled={updatePending}
                            onClick={() => onSaveEdit(key.id)}
                          >
                            {updatePending ? t('common.saving') : t('common.save')}
                          </button>
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={onCancelEdit}
                          >
                            {t('common.cancel')}
                          </button>
                        </>
                      ) : !key.revoked_at ? (
                        <ActionDropdown
                          primaryLabel={t('common.edit')}
                          onPrimaryClick={() => onStartEdit(key)}
                          items={[
                            {
                              label: revokePending ? t('common.revoking') : t('common.revoke'),
                              danger: true,
                              disabled: revokePending,
                              onClick: () => onRevoke(key.id),
                            },
                          ]}
                        />
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {copyError ? <ErrorBanner message={copyError} /> : null}
      {updateError ? <ErrorBanner message={updateError} /> : null}
      {revokeError ? <ErrorBanner message={revokeError} /> : null}
    </Panel>
  )
}
