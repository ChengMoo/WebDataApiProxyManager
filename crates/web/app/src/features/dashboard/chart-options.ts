import {
  CHART_GRID_COLOR,
  CHART_TEXT_COLOR,
  CHART_TEXT_SECONDARY,
} from '../../lib/provider'
import { getProviderLabel } from '../../lib/provider'
import type { ProviderRequestReport } from '../../types'
import type { DonutBreakdownItem } from './types'

export function buildRequestChartOption({
  reports,
  t,
}: {
  reports: ProviderRequestReport[]
  t: (key: string, values?: Record<string, string | number>) => string
}) {
  return {
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: '#FFFFFF',
      borderColor: CHART_TEXT_COLOR,
      borderWidth: 3,
      textStyle: {
        color: CHART_TEXT_COLOR,
        fontSize: 12,
        fontWeight: 700,
        fontFamily: 'Space Mono, monospace',
      },
      axisPointer: {
        type: 'shadow' as const,
        shadowStyle: {
          color: 'rgba(28, 27, 34, 0.06)',
        },
      },
      extraCssText: 'box-shadow: 4px 4px 0 #1C1B22; border-radius: 4px; padding: 10px 12px;',
      formatter: (params: Array<{ axisValueLabel: string; marker: string; seriesName: string; value: number }>) => {
        const rows = params
          .map((param) => `${param.marker} ${param.seriesName}: ${param.value}`)
          .join('<br/>')
        return `<strong>${params[0]?.axisValueLabel ?? ''}</strong><br/>${rows}`
      },
    },
    legend: { show: false },
    grid: { top: 16, left: 20, right: 12, bottom: 12, containLabel: true },
    xAxis: {
      type: 'category' as const,
      data: reports.map((report) => getProviderLabel(report.provider)),
      axisLine: { lineStyle: { color: CHART_TEXT_COLOR } },
      axisTick: { show: false },
      axisLabel: {
        color: CHART_TEXT_SECONDARY,
        fontFamily: 'Space Mono, monospace',
        fontWeight: 700,
      },
    },
    yAxis: {
      type: 'value' as const,
      minInterval: 1,
      splitLine: { lineStyle: { color: CHART_GRID_COLOR } },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: CHART_TEXT_SECONDARY,
        fontFamily: 'Space Mono, monospace',
        formatter: (value: number) => String(Math.round(value)),
      },
    },
    series: [
      {
        name: t('table.success'),
        type: 'bar',
        stack: 'total',
        barWidth: 56,
        data: reports.map((report) => ({
          value: report.success_count,
          itemStyle: {
            color: '#00A67E',
            borderColor: CHART_TEXT_COLOR,
            borderWidth: 3,
            borderRadius: report.error_count > 0 ? [0, 0, 6, 6] : [6, 6, 6, 6],
          },
        })),
      },
      {
        name: t('table.errors'),
        type: 'bar',
        stack: 'total',
        barWidth: 56,
        data: reports.map((report) => ({
          value: report.error_count,
          itemStyle: {
            color: '#F50057',
            borderColor: CHART_TEXT_COLOR,
            borderWidth: 3,
            borderRadius: report.success_count > 0 ? [6, 6, 0, 0] : [6, 6, 6, 6],
          },
        })),
      },
    ],
  }
}

export function buildPieChartOption({
  donutBreakdown,
  totalRequests,
  t,
}: {
  donutBreakdown: DonutBreakdownItem[]
  totalRequests: number
  t: (key: string, values?: Record<string, string | number>) => string
}) {
  return {
    title: [
      {
        text: String(totalRequests),
        left: 'center',
        top: '40%',
        textAlign: 'center' as const,
        textStyle: {
          color: CHART_TEXT_COLOR,
          fontSize: 40,
          fontWeight: 800,
          fontFamily: 'Space Mono, monospace',
        },
      },
      {
        text: t('overview.total_label').toUpperCase(),
        left: 'center',
        top: '55%',
        textAlign: 'center' as const,
        textStyle: {
          color: CHART_TEXT_SECONDARY,
          fontSize: 12,
          fontWeight: 700,
          fontFamily: 'Space Mono, monospace',
          letterSpacing: 1.5,
        },
      },
    ],
    tooltip: { trigger: 'item' as const, formatter: '{b}: {c} ({d}%)' },
    series: [
      {
        type: 'pie',
        radius: ['56%', '78%'],
        center: ['50%', '52%'],
        padAngle: 3,
        minAngle: 6,
        data: donutBreakdown.map((item) => ({
          name: item.label,
          value: item.requests,
          itemStyle: { color: item.color },
        })),
        itemStyle: {
          borderColor: CHART_TEXT_COLOR,
          borderWidth: 3,
          borderRadius: 6,
        },
        label: {
          show: true,
          formatter: (params: { name: string; value: number; percent: number }) =>
            `${params.name} - ${params.value} (${Math.round(params.percent)}%)`,
          color: CHART_TEXT_COLOR,
          fontSize: 12,
          fontWeight: 700,
          fontFamily: 'Space Mono, monospace',
        },
        labelLine: {
          length: 16,
          length2: 14,
          lineStyle: {
            color: CHART_TEXT_SECONDARY,
            width: 2,
          },
        },
        emphasis: {
          scale: true,
          scaleSize: 4,
          itemStyle: {
            shadowBlur: 0,
            shadowColor: 'transparent',
          },
        },
      },
    ],
  }
}
