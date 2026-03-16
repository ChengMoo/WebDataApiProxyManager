export type ChartView = 'bar' | 'pie'

export type RequestStatsSummary = {
  totalRequests: number
  weightedLatency: number | null
}

export type DonutBreakdownItem = {
  provider: string
  label: string
  requests: number
  percent: number
  color: string
}
