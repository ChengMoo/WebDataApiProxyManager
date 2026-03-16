import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { adminApi } from '../../api'
import { useSession } from '../../app'
import { useLocale } from '../../i18n'
import {
  MetricCard,
  ErrorBanner,
  Spinner,
  PROVIDER_THEME_COLORS,
  getProviderLabel,
} from '../../ui/shared'
import { AccountHealthPanel } from './account-health-panel'
import { buildPieChartOption, buildRequestChartOption } from './chart-options'
import { RequestStatsPanel } from './request-stats-panel'
import type { ChartView, RequestStatsSummary } from './types'

export function DashboardPage() {
  const { token } = useSession()
  const { t } = useLocale()

  const logsQuery = useQuery({
    queryKey: ['request-logs', token, 40],
    queryFn: () => adminApi.listRequestLogs(token, { limit: 40 }),
  })
  const requestsReport = useQuery({
    queryKey: ['report-requests', token],
    queryFn: () => adminApi.reportRequestsByProvider(token),
  })
  const healthReport = useQuery({
    queryKey: ['report-health', token],
    queryFn: () => adminApi.reportAccountHealth(token),
  })
  const proxiesQuery = useQuery({
    queryKey: ['egress-proxies', token],
    queryFn: () => adminApi.listEgressProxies(token),
  })

  const [chartView, setChartView] = useState<ChartView>('pie')
  const [healthProvider, setHealthProvider] = useState('')
  const [healthPage, setHealthPage] = useState(0)
  const [healthPageSize, setHealthPageSize] = useState(5)

  const requestStatsSummary = useMemo<RequestStatsSummary>(() => {
    const reports = requestsReport.data ?? []
    const totalRequests = reports.reduce((sum, report) => sum + report.total_requests, 0)
    const weightedLatency =
      totalRequests > 0
        ? Math.round(reports.reduce((sum, report) => sum + (report.avg_latency_ms ?? 0) * report.total_requests, 0) / totalRequests)
        : null
    return { totalRequests, weightedLatency }
  }, [requestsReport.data])

  const donutBreakdown = useMemo(() => {
    const reports = [...(requestsReport.data ?? [])].sort((a, b) => b.total_requests - a.total_requests)
    return reports.map((report, index) => {
      const total = requestStatsSummary.totalRequests || 1
      const percent = Math.round((report.total_requests / total) * 100)
      return {
        provider: report.provider,
        label: getProviderLabel(report.provider),
        requests: report.total_requests,
        percent,
        color: PROVIDER_THEME_COLORS[report.provider as keyof typeof PROVIDER_THEME_COLORS] ?? ['#F05633', '#1C1B22', '#FFB800', '#73C0DE'][index % 4],
      }
    })
  }, [requestsReport.data, requestStatsSummary.totalRequests])

  const requestChartOption = useMemo(
    () => buildRequestChartOption({ reports: requestsReport.data ?? [], t }),
    [requestsReport.data, t],
  )

  const pieChartOption = useMemo(
    () =>
      buildPieChartOption({
        donutBreakdown,
        totalRequests: requestStatsSummary.totalRequests,
        t,
      }),
    [donutBreakdown, requestStatsSummary.totalRequests, t],
  )

  const healthProviders = useMemo(() => {
    const providers = new Set((healthReport.data ?? []).map((account) => account.provider))
    return Array.from(providers).sort()
  }, [healthReport.data])

  const filteredHealth = useMemo(() => {
    const data = healthReport.data ?? []
    return healthProvider ? data.filter((account) => account.provider === healthProvider) : data
  }, [healthReport.data, healthProvider])

  const healthTotalPages = Math.max(1, Math.ceil(filteredHealth.length / healthPageSize))
  const safeHealthPage = Math.min(healthPage, healthTotalPages - 1)
  const pagedHealth = filteredHealth.slice(safeHealthPage * healthPageSize, (safeHealthPage + 1) * healthPageSize)

  const anyLoading = logsQuery.isLoading || healthReport.isLoading
  if (anyLoading) return <Spinner />

  const anyError = logsQuery.error
  if (anyError) return <ErrorBanner message={anyError.message} />

  const recentFailures =
    logsQuery.data?.filter((item) => item.failure_kind != null || (item.status_code ?? 0) >= 400).length ?? 0
  const activeAccounts =
    healthReport.data?.filter((account) => account.status === 'active' && account.enabled).length ?? 0
  const totalAccounts = healthReport.data?.length ?? 0
  const totalProxies = proxiesQuery.data?.length ?? 0

  return (
    <div className="page-grid">
      <section className="hero-strip">
        <div>
          <span className="eyebrow">{t('overview.eyebrow')}</span>
          <h2>{t('overview.title')}</h2>
        </div>
      </section>

      <div className="metrics-grid">
        <MetricCard
          label={t('overview.recent_requests')}
          value={String(logsQuery.data?.length ?? 0)}
          hint={`${recentFailures} ${t('overview.failed_hint')}`}
        />
        <MetricCard
          label={t('overview.active_accounts')}
          value={String(activeAccounts)}
          hint={t('overview.active_accounts_hint', { count: totalAccounts })}
        />
        <MetricCard
          label={t('overview.egress_proxies')}
          value={String(totalProxies)}
          hint={t('overview.egress_proxies_hint')}
        />
        <MetricCard
          label={t('overview.avg_latency')}
          value={requestStatsSummary.weightedLatency != null ? `${requestStatsSummary.weightedLatency} ms` : '—'}
          hint={t('overview.avg_latency_hint')}
        />
      </div>

      <RequestStatsPanel
        title={t('overview.requests_by_provider')}
        description={t('overview.requests_by_provider_desc')}
        chartView={chartView}
        onChartViewChange={setChartView}
        loading={requestsReport.isLoading}
        reports={requestsReport.data ?? []}
        requestChartOption={requestChartOption}
        pieChartOption={pieChartOption}
        donutBreakdown={donutBreakdown}
        summary={requestStatsSummary}
        t={t}
      />

      <AccountHealthPanel
        title={t('overview.account_health')}
        description={t('overview.account_health_desc')}
        provider={healthProvider}
        providers={healthProviders}
        allLabel={t('overview.all_providers')}
        loading={healthReport.isLoading}
        filteredHealth={filteredHealth}
        pagedHealth={pagedHealth}
        page={safeHealthPage}
        totalPages={healthTotalPages}
        pageSize={healthPageSize}
        onProviderChange={(value) => {
          setHealthProvider(value)
          setHealthPage(0)
        }}
        onPrevPage={() => setHealthPage((page) => page - 1)}
        onNextPage={() => setHealthPage((page) => page + 1)}
        onPageSizeChange={(value) => {
          setHealthPageSize(value)
          setHealthPage(0)
        }}
        t={t}
      />
    </div>
  )
}
