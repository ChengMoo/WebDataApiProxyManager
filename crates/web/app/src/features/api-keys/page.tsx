import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { adminApi } from '../../api'
import { useSession } from '../../app'
import { useLocale } from '../../i18n'
import { ErrorBanner, Spinner, useCopyFeedback } from '../../ui/shared'
import type { PlatformApiKeyRecord } from '../../types'
import { CreateKeyDrawer } from './create-key-drawer'
import { ApiKeysPanel } from './keys-table'

export function ApiKeysPage() {
  const { token } = useSession()
  const { t } = useLocale()
  const queryClient = useQueryClient()
  const { copiedId, copy } = useCopyFeedback()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newQuota, setNewQuota] = useState('')
  const [createdKey, setCreatedKey] = useState<{ id: string; name: string; key: string; quota: number } | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editQuota, setEditQuota] = useState('')
  const [copyingId, setCopyingId] = useState<string | null>(null)

  const keysQuery = useQuery({
    queryKey: ['platform-api-keys', token],
    queryFn: () => adminApi.listPlatformApiKeys(token),
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      const quota = newQuota.trim() ? Number(newQuota) : undefined
      return adminApi.createPlatformApiKey(token, { name: newName.trim(), quota })
    },
    onSuccess: async (data) => {
      setCreatedKey(data)
      setNewName('')
      setNewQuota('')
      await queryClient.invalidateQueries({ queryKey: ['platform-api-keys'] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (keyId: string) => {
      const payload: { name?: string; quota?: number } = {}
      if (editName.trim()) payload.name = editName.trim()
      if (editQuota.trim()) payload.quota = Number(editQuota)
      return adminApi.updatePlatformApiKey(token, keyId, payload)
    },
    onSuccess: async () => {
      setEditingId(null)
      setEditName('')
      setEditQuota('')
      await queryClient.invalidateQueries({ queryKey: ['platform-api-keys'] })
    },
  })

  const revokeMutation = useMutation({
    mutationFn: async (keyId: string) => adminApi.revokePlatformApiKey(token, keyId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['platform-api-keys'] })
    },
  })

  const copyKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      setCopyingId(keyId)
      const { key } = await adminApi.revealPlatformApiKey(token, keyId)
      await copy(key, keyId)
    },
    onSettled: () => {
      setCopyingId(null)
    },
  })

  if (keysQuery.isLoading) return <Spinner />
  if (keysQuery.error) return <ErrorBanner message={keysQuery.error.message} />

  const closeDrawer = () => {
    setDrawerOpen(false)
    setCreatedKey(null)
  }

  return (
    <div className="page-grid">
      <section className="hero-strip">
        <div>
          <span className="eyebrow">{t('api_keys.eyebrow')}</span>
          <h2>{t('api_keys.title')}</h2>
        </div>
        <div className="hero-actions">
          <button type="button" className="primary-button" onClick={() => { setCreatedKey(null); setDrawerOpen(true) }}>
            + {t('api_keys.create_btn')}
          </button>
        </div>
      </section>

      <CreateKeyDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        createdKey={createdKey}
        newName={newName}
        newQuota={newQuota}
        copied={copiedId === 'created'}
        creating={createMutation.isPending}
        createError={createMutation.error?.message}
        onNewNameChange={setNewName}
        onNewQuotaChange={setNewQuota}
        onCreate={() => void createMutation.mutateAsync()}
        onCopyCreated={() => {
          if (createdKey) {
            void copy(createdKey.key, 'created')
          }
        }}
        t={t}
      />

      <ApiKeysPanel
        title={t('api_keys.pool')}
        description={t('api_keys.count', { count: keysQuery.data?.length ?? 0 })}
        keys={keysQuery.data ?? []}
        editingId={editingId}
        editName={editName}
        editQuota={editQuota}
        copiedId={copiedId}
        copyingId={copyingId}
        updatePending={updateMutation.isPending}
        revokePending={revokeMutation.isPending}
        copyError={copyKeyMutation.error?.message}
        updateError={updateMutation.error?.message}
        revokeError={revokeMutation.error?.message}
        onEditNameChange={setEditName}
        onEditQuotaChange={setEditQuota}
        onCopyKey={(keyId) => void copyKeyMutation.mutateAsync(keyId)}
        onSaveEdit={(keyId) => void updateMutation.mutateAsync(keyId)}
        onCancelEdit={() => {
          setEditingId(null)
          setEditName('')
          setEditQuota('')
        }}
        onStartEdit={(key: PlatformApiKeyRecord) => {
          setEditingId(key.id)
          setEditName(key.name)
          setEditQuota(String(key.quota))
        }}
        onRevoke={(keyId) => void revokeMutation.mutateAsync(keyId)}
        t={t}
      />
    </div>
  )
}
