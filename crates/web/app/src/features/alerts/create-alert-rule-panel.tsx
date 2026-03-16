import { CustomSelect, ErrorBanner, Panel } from '../../ui/shared'

export function CreateAlertRulePanel({
  name,
  kind,
  threshold,
  webhookUrl,
  createPending,
  createError,
  onNameChange,
  onKindChange,
  onThresholdChange,
  onWebhookUrlChange,
  onCreate,
  t,
}: {
  name: string
  kind: string
  threshold: string
  webhookUrl: string
  createPending: boolean
  createError?: string
  onNameChange: (value: string) => void
  onKindChange: (value: string) => void
  onThresholdChange: (value: string) => void
  onWebhookUrlChange: (value: string) => void
  onCreate: () => void
  t: (key: string, values?: Record<string, string | number>) => string
}) {
  return (
    <Panel title={t('alerts.create')} description={t('alerts.create_desc')}>
      <div className="stack-form">
        <div className="inline-form">
          <label className="field alerts-field-flex">
            <span>{t('table.name')}</span>
            <input
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder={t('alerts.name_placeholder')}
            />
          </label>
          <label className="field alerts-field-flex">
            <span>{t('table.kind')}</span>
            <CustomSelect
              value={kind}
              onChange={onKindChange}
              options={[
                { value: 'account_disabled', label: t('alerts.kind_account_disabled') },
                { value: 'high_error_rate', label: t('alerts.kind_high_error_rate') },
                { value: 'stale_async_job', label: t('alerts.kind_stale_async_job') },
              ]}
            />
          </label>
          <label className="field short alerts-threshold-field">
            <span>{t('table.threshold')}</span>
            <input
              value={threshold}
              onChange={(event) => onThresholdChange(event.target.value)}
              inputMode="numeric"
            />
          </label>
        </div>
        <label className="field">
          <span>{t('table.webhook_url')}</span>
          <input
            value={webhookUrl}
            onChange={(event) => onWebhookUrlChange(event.target.value)}
            placeholder="https://hooks.example.com/..."
          />
        </label>
        {createError ? <ErrorBanner message={createError} /> : null}
        <button
          type="button"
          className="primary-button"
          disabled={createPending || !name.trim() || !webhookUrl.trim()}
          onClick={onCreate}
        >
          {createPending ? t('common.creating') : t('common.add_rule')}
        </button>
      </div>
    </Panel>
  )
}
