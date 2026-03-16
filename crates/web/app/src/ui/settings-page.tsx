import { Suspense, lazy, useState } from 'react'
import { useLocale } from '../i18n'
import { Spinner } from './shared'

type SettingsTab = 'alerts' | 'audit'

const AlertsPanel = lazy(async () => ({
  default: (await import('../features/alerts/page')).AlertsPage,
}))

const AuditLogsPanel = lazy(async () => ({
  default: (await import('../features/audit-logs/page')).AuditLogsPage,
}))

export function SettingsPage() {
  const { t } = useLocale()
  const [tab, setTab] = useState<SettingsTab>('alerts')

  return (
    <div className="page-grid">
      <section className="hero-strip">
        <div>
          <span className="eyebrow">{t('settings.eyebrow')}</span>
          <h2>{t('settings.title')}</h2>
        </div>
      </section>

      <div className="tab-bar">
        <button
          type="button"
          className={tab === 'alerts' ? 'active' : ''}
          onClick={() => setTab('alerts')}
        >
          {t('settings.tab_alerts')}
        </button>
        <button
          type="button"
          className={tab === 'audit' ? 'active' : ''}
          onClick={() => setTab('audit')}
        >
          {t('settings.tab_audit')}
        </button>
      </div>

      <Suspense fallback={<Spinner />}>
        {tab === 'alerts' ? <AlertsPanel /> : <AuditLogsPanel />}
      </Suspense>
    </div>
  )
}
