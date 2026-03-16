import type * as echarts from 'echarts'
import { EChart, EmptyState, Panel, ProviderTag, Spinner } from '../../ui/shared'
import type { ProviderRequestReport } from '../../types'
import type { ChartView, DonutBreakdownItem, RequestStatsSummary } from './types'

export function RequestStatsPanel({
  title,
  description,
  chartView,
  onChartViewChange,
  loading,
  reports,
  requestChartOption,
  pieChartOption,
  donutBreakdown,
  summary,
  t,
}: {
  title: string
  description: string
  chartView: ChartView
  onChartViewChange: (view: ChartView) => void
  loading: boolean
  reports: ProviderRequestReport[]
  requestChartOption: echarts.EChartsCoreOption
  pieChartOption: echarts.EChartsCoreOption
  donutBreakdown: DonutBreakdownItem[]
  summary: RequestStatsSummary
  t: (key: string, values?: Record<string, string | number>) => string
}) {
  return (
    <Panel title={title} description={description}>
      {loading ? (
        <Spinner />
      ) : reports.length === 0 ? (
        <EmptyState title={t('overview.no_data')} body={t('overview.no_request_stats')} />
      ) : (
        <>
          <div className="tab-bar">
            <button type="button" className={chartView === 'bar' ? 'active' : ''} onClick={() => onChartViewChange('bar')}>
              {t('overview.chart_bar')}
            </button>
            <button type="button" className={chartView === 'pie' ? 'active' : ''} onClick={() => onChartViewChange('pie')}>
              {t('overview.chart_pie')}
            </button>
          </div>
          {chartView === 'bar' ? (
            <>
              <EChart option={requestChartOption} className="chart chart-bar-brutal" />
              <div className="chart-legend chart-legend-brutal">
                <div className="chart-legend-item">
                  <span className="chart-legend-swatch chart-legend-swatch-success" />
                  <span>{t('table.success')}</span>
                </div>
                <div className="chart-legend-item">
                  <span className="chart-legend-swatch chart-legend-swatch-danger" />
                  <span>{t('table.errors')}</span>
                </div>
              </div>
            </>
          ) : (
            <div className="donut-layout">
              <div className="donut-side">
                <div className="donut-legend">
                  {donutBreakdown.map((item) => (
                    <div key={item.provider} className="donut-legend-item">
                      <span className="donut-swatch" style={{ background: item.color }} />
                      <div className="donut-legend-copy">
                        <strong>{item.label}</strong>
                        <span>{item.requests} · {item.percent}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="donut-chart-shell">
                <EChart option={pieChartOption} className="chart chart-donut chart-donut-focus" />
              </div>
              <div className="donut-side donut-insight">
                {donutBreakdown[0] ? (
                  <>
                    <span className="donut-insight-kicker">TOP SHARE</span>
                    <strong>{donutBreakdown[0].label}</strong>
                    <p>
                      {t('overview.donut_share_detail', {
                        count: donutBreakdown[0].requests,
                        percent: donutBreakdown[0].percent,
                      })}
                    </p>
                    <div className="donut-insight-metric">
                      <span>{t('overview.avg_latency')}</span>
                      <strong>{summary.weightedLatency != null ? `${summary.weightedLatency} ms` : '—'}</strong>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          )}
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('table.provider')}</th>
                  <th>{t('table.total')}</th>
                  <th>{t('table.success')}</th>
                  <th>{t('table.errors')}</th>
                  <th>{t('table.avg_latency')}</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.provider}>
                    <td><ProviderTag provider={report.provider} /></td>
                    <td>{report.total_requests}</td>
                    <td>{report.success_count}</td>
                    <td>{report.error_count}</td>
                    <td>{report.avg_latency_ms != null ? `${report.avg_latency_ms.toFixed(0)} ms` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Panel>
  )
}
