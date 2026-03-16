import type { ProviderId } from '../../types'

export type ProviderFilter = ProviderId | 'all'
export type AccountSortMode = 'default' | 'failures_desc'
export type AccountBulkAction = 'enable' | 'disable' | 'delete' | 'bind'

export function parseBatchApiKeys(value: string): string[] {
  const deduped = new Set<string>()
  for (const line of value.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed) {
      deduped.add(trimmed)
    }
  }
  return Array.from(deduped)
}

export function detectProviderFromApiKey(value: string): ProviderId | null {
  const normalized = value.trim().toLowerCase()
  if (!normalized) {
    return null
  }

  if (normalized.startsWith('tvly-')) {
    return 'tavily'
  }
  if (normalized.startsWith('fc-')) {
    return 'firecrawl'
  }
  if (normalized.startsWith('jina_') || normalized.startsWith('jina-')) {
    return 'jina'
  }
  if (normalized.startsWith('exa_') || normalized.startsWith('exa-')) {
    return 'exa'
  }

  return null
}

function sanitizeApiKeyToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)
}

export function createAccountName(
  provider: ProviderId,
  apiKey: string,
  index: number,
  usedNames: Set<string>,
): string {
  const token = sanitizeApiKeyToken(apiKey) || `k${index + 1}`
  const maxBaseLength = 20
  const base = `${provider}-${token}`.slice(0, maxBaseLength)
  let candidate = base
  let suffix = 2
  while (usedNames.has(candidate)) {
    const suffixText = `-${suffix}`
    const prefix = base.slice(0, Math.max(1, maxBaseLength - suffixText.length))
    candidate = `${prefix}${suffixText}`
    suffix += 1
  }
  usedNames.add(candidate)
  return candidate
}
