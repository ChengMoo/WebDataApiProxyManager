import type { EgressProxySummary } from '../../types'
import {
  StatusBadge,
  formatManagedStatus,
  formatMaybe,
  toneFromStatus,
} from '../../ui/shared'

export function EgressProxyRow({
  proxy,
  editingId,
  editName,
  editProxyUrl,
  editRegion,
  updatePending,
  togglePending,
  onEditNameChange,
  onEditProxyUrlChange,
  onEditRegionChange,
  onSaveEdit,
  onCancelEdit,
  onStartEdit,
  onToggleEnabled,
  t,
}: {
  proxy: EgressProxySummary
  editingId: string | null
  editName: string
  editProxyUrl: string
  editRegion: string
  updatePending: boolean
  togglePending: boolean
  onEditNameChange: (value: string) => void
  onEditProxyUrlChange: (value: string) => void
  onEditRegionChange: (value: string) => void
  onSaveEdit: (proxyId: string) => void
  onCancelEdit: () => void
  onStartEdit: (proxy: EgressProxySummary) => void
  onToggleEnabled: (proxyId: string, enabled: boolean) => void
  t: (key: string, values?: Record<string, string | number>) => string
}) {
  const isEditing = editingId === proxy.id

  return (
    <tr>
      <td>
        {isEditing ? (
          <input
            value={editName}
            onChange={(event) => onEditNameChange(event.target.value)}
            placeholder={proxy.name}
          />
        ) : (
          <div className="cell-stack">
            <strong>{proxy.name}</strong>
            <span>{proxy.id}</span>
          </div>
        )}
      </td>
      <td>
        <span className="tag">{proxy.kind}</span>
      </td>
      <td>
        <StatusBadge tone={toneFromStatus(proxy.status)}>
          {formatManagedStatus(proxy.status, t)}
        </StatusBadge>
      </td>
      <td>
        {isEditing ? (
          <input
            value={editRegion}
            onChange={(event) => onEditRegionChange(event.target.value)}
            placeholder="e.g. us-west"
            className="proxy-region-input"
          />
        ) : (
          formatMaybe(proxy.region)
        )}
      </td>
      <td>{proxy.consecutive_failures}</td>
      <td className="mono-cell">
        {isEditing ? (
          <input
            value={editProxyUrl}
            onChange={(event) => onEditProxyUrlChange(event.target.value)}
            placeholder={proxy.proxy_url}
          />
        ) : (
          proxy.proxy_url
        )}
      </td>
      <td>
        <div className="inline-action">
          {isEditing ? (
            <>
              <button
                type="button"
                className="primary-button"
                disabled={updatePending}
                onClick={() => onSaveEdit(proxy.id)}
              >
                {updatePending ? t('common.saving') : t('common.save')}
              </button>
              <button type="button" className="ghost-button" onClick={onCancelEdit}>
                {t('common.cancel')}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="ghost-button"
                onClick={() => onStartEdit(proxy)}
              >
                {t('common.edit')}
              </button>
              <button
                type="button"
                className={proxy.enabled ? 'danger-button' : 'ghost-button'}
                disabled={togglePending}
                onClick={() => onToggleEnabled(proxy.id, !proxy.enabled)}
              >
                {proxy.enabled ? t('common.disable') : t('common.enable')}
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  )
}
