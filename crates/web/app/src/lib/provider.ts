import type { ProviderId } from '../types'

export const THEME_CHART_COLORS = ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc']
export const CHART_TEXT_COLOR = '#1C1B22'
export const CHART_TEXT_SECONDARY = '#4A4A55'
export const CHART_TEXT_TERTIARY = '#6B6B76'
export const CHART_GRID_COLOR = 'rgba(28, 27, 34, 0.1)'
export const PROVIDER_IDS: ProviderId[] = ['exa', 'tavily', 'firecrawl', 'jina']

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  exa: 'Exa',
  tavily: 'Tavily',
  firecrawl: 'Firecrawl',
  jina: 'Jina',
}

export const PROVIDER_THEME_COLORS: Record<ProviderId, string> = {
  exa: '#6200EA',
  tavily: '#00A67E',
  firecrawl: '#F59E0B',
  jina: '#F50057',
}

export function providerTagClassName(provider: string) {
  return `tag provider-tag provider-${provider}`
}

export function getProviderLabel(provider: string) {
  return PROVIDER_LABELS[provider as ProviderId] ?? provider
}
