import { CheckIcon, CopyIcon, Drawer, ErrorBanner } from '../../ui/shared'
import { formatQuota } from './utils'

export function CreateKeyDrawer({
  open,
  onClose,
  createdKey,
  newName,
  newQuota,
  copied,
  creating,
  createError,
  onNewNameChange,
  onNewQuotaChange,
  onCreate,
  onCopyCreated,
  t,
}: {
  open: boolean
  onClose: () => void
  createdKey: { id: string; name: string; key: string; quota: number } | null
  newName: string
  newQuota: string
  copied: boolean
  creating: boolean
  createError?: string
  onNewNameChange: (value: string) => void
  onNewQuotaChange: (value: string) => void
  onCreate: () => void
  onCopyCreated: () => void
  t: (key: string, values?: Record<string, string | number>) => string
}) {
  return (
    <Drawer open={open} onClose={onClose} title={t('api_keys.create')}>
      {createdKey ? (
        <>
          <div className="key-created-panel">
            <div className="key-created-header">
              <div>
                <h3>{t('api_keys.key_created')}</h3>
                <p>{t('api_keys.key_created_desc')}</p>
              </div>
            </div>
            <div className="key-created-meta">
              <strong>{createdKey.name}</strong>
              <span className="tag">{formatQuota(createdKey.quota, t)}</span>
            </div>
            <div className="key-created-value">
              <code>{createdKey.key}</code>
              <button
                type="button"
                className={`copy-btn${copied ? ' is-copied' : ''}`}
                onClick={onCopyCreated}
              >
                {copied ? (
                  <>
                    <CheckIcon /> {t('common.copied')}
                  </>
                ) : (
                  <>
                    <CopyIcon /> {t('common.copy')}
                  </>
                )}
              </button>
            </div>
          </div>
          <button type="button" className="ghost-button stack-form-spaced" onClick={onClose}>
            {t('api_keys.dismiss')}
          </button>
        </>
      ) : (
        <>
          <p className="panel-copy">{t('api_keys.create_desc')}</p>
          <div className="stack-form stack-form-spaced">
            <label className="field">
              <span>{t('table.name')}</span>
              <input value={newName} onChange={(event) => onNewNameChange(event.target.value)} placeholder="e.g. Production Gateway" />
            </label>
            <label className="field">
              <span>{t('api_keys.quota_label')}</span>
              <input value={newQuota} onChange={(event) => onNewQuotaChange(event.target.value)} inputMode="numeric" placeholder="0" />
            </label>
            {createError ? <ErrorBanner message={createError} /> : null}
            <button
              type="button"
              className="primary-button"
              disabled={creating || !newName.trim()}
              onClick={onCreate}
            >
              {creating ? t('common.creating') : t('api_keys.create_btn')}
            </button>
          </div>
        </>
      )}
    </Drawer>
  )
}
