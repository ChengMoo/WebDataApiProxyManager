import type { ReactNode } from 'react'
import { CustomSelect, DatePicker, Panel, ProviderSelect } from '../../ui/shared'

export function RequestLogsFiltersPanel({
  title,
  description,
  provider,
  statusRange,
  since,
  until,
  advancedOpen,
  latencyMin,
  latencyMax,
  apiKeyName,
  limit,
  onProviderChange,
  onStatusRangeChange,
  onSinceChange,
  onUntilChange,
  onToggleAdvanced,
  onLatencyMinChange,
  onLatencyMaxChange,
  onApiKeyNameChange,
  onLimitChange,
  onApply,
  children,
  t,
}: {
  title: string
  description: string
  provider: string
  statusRange: string
  since: string
  until: string
  advancedOpen: boolean
  latencyMin: string
  latencyMax: string
  apiKeyName: string
  limit: string
  onProviderChange: (value: string) => void
  onStatusRangeChange: (value: string) => void
  onSinceChange: (value: string) => void
  onUntilChange: (value: string) => void
  onToggleAdvanced: () => void
  onLatencyMinChange: (value: string) => void
  onLatencyMaxChange: (value: string) => void
  onApiKeyNameChange: (value: string) => void
  onLimitChange: (value: string) => void
  onApply: () => void
  children: ReactNode
  t: (key: string, values?: Record<string, string | number>) => string
}) {
  return (
    <Panel title={title} description={description}>
      <div className="filter-bar">
        <label className="inline-field compact">
          <span>{t('table.provider')}</span>
          <ProviderSelect value={provider} onChange={onProviderChange} includeAll allLabel={t('requests.filter_all')} />
        </label>
        <label className="inline-field compact">
          <span>{t('table.status')}</span>
          <CustomSelect
            value={statusRange}
            onChange={onStatusRangeChange}
            options={[
              { value: '', label: t('requests.filter_all') },
              { value: '2xx', label: t('requests.status_2xx') },
              { value: '4xx', label: t('requests.status_4xx') },
              { value: '5xx', label: t('requests.status_5xx') },
            ]}
          />
        </label>
        <label className="inline-field compact">
          <span>{t('requests.since')}</span>
          <DatePicker value={since} onChange={onSinceChange} ariaLabel={t('requests.since')} />
        </label>
        <label className="inline-field compact">
          <span>{t('requests.until')}</span>
          <DatePicker value={until} onChange={onUntilChange} ariaLabel={t('requests.until')} />
        </label>
        <button type="button" className="primary-button" onClick={onApply}>
          {t('requests.filter_apply')}
        </button>
        <button
          type="button"
          className="advanced-filter-toggle"
          onClick={onToggleAdvanced}
        >
          {t('requests.advanced_filter')} {advancedOpen ? '▲' : '▼'}
        </button>
      </div>

      {advancedOpen ? (
        <div className="advanced-filter-section is-visible">
          <label className="inline-field compact">
            <span>{t('requests.latency_range')}</span>
            <div className="range-input">
              <input value={latencyMin} onChange={(event) => onLatencyMinChange(event.target.value)} inputMode="numeric" placeholder={t('requests.latency_min_placeholder')} />
              <span className="range-separator">—</span>
              <input value={latencyMax} onChange={(event) => onLatencyMaxChange(event.target.value)} inputMode="numeric" placeholder={t('requests.latency_max_placeholder')} />
            </div>
          </label>
          <label className="inline-field compact">
            <span>{t('requests.api_key_name')}</span>
            <input value={apiKeyName} onChange={(event) => onApiKeyNameChange(event.target.value)} />
          </label>
          <label className="inline-field compact">
            <span>{t('common.limit')}</span>
            <input className="request-limit-input" value={limit} onChange={(event) => onLimitChange(event.target.value)} inputMode="numeric" />
          </label>
        </div>
      ) : null}

      {children}
    </Panel>
  )
}
