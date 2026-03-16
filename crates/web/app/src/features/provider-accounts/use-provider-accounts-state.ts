import { useMemo, useState } from 'react'
import type { ProviderAccountSummary, ProviderId } from '../../types'
import { detectProviderFromApiKey, parseBatchApiKeys } from './utils'
import type { AccountSortMode, ProviderFilter } from './utils'

export function useProviderAccountsState(accounts: ProviderAccountSummary[] | undefined) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [provider, setProvider] = useState<ProviderId>('exa')
  const [name, setName] = useState('')
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [batchApiKeysInput, setBatchApiKeysInput] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [bindSelections, setBindSelections] = useState<Record<string, string>>({})
  const [providerFilter, setProviderFilter] = useState<ProviderFilter>('all')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkProxyId, setBulkProxyId] = useState('')
  const [sortMode, setSortMode] = useState<AccountSortMode>('default')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editBaseUrl, setEditBaseUrl] = useState('')
  const detectedProvider = detectProviderFromApiKey(apiKeyInput)
  const providerAutoDetected = detectedProvider !== null
  const batchApiKeys = parseBatchApiKeys(batchApiKeysInput)
  const detectedBatchCount = batchApiKeys.filter((value) =>
    detectProviderFromApiKey(value),
  ).length
  const unknownBatchCount = batchApiKeys.length - detectedBatchCount

  const visibleAccounts = useMemo(() => {
    const filtered = (accounts ?? []).filter(
      (account) => providerFilter === 'all' || account.provider === providerFilter,
    )
    if (sortMode === 'failures_desc') {
      return [...filtered].sort((left, right) => {
        if (right.consecutive_failures !== left.consecutive_failures) {
          return right.consecutive_failures - left.consecutive_failures
        }
        return left.name.localeCompare(right.name)
      })
    }
    return filtered
  }, [accounts, providerFilter, sortMode])

  const allVisibleSelected =
    visibleAccounts.length > 0 &&
    visibleAccounts.every((account) => selectedIds.includes(account.id))

  const resetCreateForm = () => {
    setName('')
    setApiKeyInput('')
    setBatchApiKeysInput('')
    setBaseUrl('')
    setDrawerOpen(false)
  }

  const resetEditForm = () => {
    setEditingId(null)
    setEditName('')
    setEditBaseUrl('')
  }

  const toggleSelection = (accountId: string, checked: boolean) => {
    setSelectedIds((current) =>
      checked ? [...current, accountId] : current.filter((id) => id !== accountId),
    )
  }

  const toggleSelectAllVisible = (checked: boolean) => {
    setSelectedIds((current) => {
      const visibleIds = visibleAccounts.map((account) => account.id)
      if (checked) {
        return Array.from(new Set([...current, ...visibleIds]))
      }
      return current.filter((id) => !visibleIds.includes(id))
    })
  }

  const handleApiKeyChange = (nextApiKey: string) => {
    const nextDetectedProvider = detectProviderFromApiKey(nextApiKey)
    setApiKeyInput(nextApiKey)
    if (nextDetectedProvider) {
      setProvider(nextDetectedProvider)
    }
  }

  const handleProviderFilterChange = (value: ProviderFilter) => {
    setProviderFilter(value)
    setSelectedIds([])
  }

  const handleBindSelectionChange = (accountId: string, value: string) => {
    setBindSelections((current) => ({
      ...current,
      [accountId]: value,
    }))
  }

  const handleStartEdit = (account: ProviderAccountSummary) => {
    setEditingId(account.id)
    setEditName(account.name)
    setEditBaseUrl(account.base_url ?? '')
  }

  return {
    drawerOpen,
    provider,
    name,
    apiKeyInput,
    batchApiKeysInput,
    baseUrl,
    bindSelections,
    providerFilter,
    selectedIds,
    bulkProxyId,
    sortMode,
    editingId,
    editName,
    editBaseUrl,
    providerAutoDetected,
    detectedProvider,
    batchApiKeys,
    detectedBatchCount,
    unknownBatchCount,
    visibleAccounts,
    allVisibleSelected,
    setDrawerOpen,
    setProvider,
    setName,
    setBatchApiKeysInput,
    setBaseUrl,
    setSelectedIds,
    setBulkProxyId,
    setSortMode,
    setEditName,
    setEditBaseUrl,
    resetCreateForm,
    resetEditForm,
    toggleSelection,
    toggleSelectAllVisible,
    handleApiKeyChange,
    handleProviderFilterChange,
    handleBindSelectionChange,
    handleStartEdit,
  }
}
