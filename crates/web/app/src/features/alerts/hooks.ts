import { useMutation, type QueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { adminApi } from '../../api'

export function useAlertsStateAndMutations({
  token,
  queryClient,
}: {
  token: string
  queryClient: QueryClient
}) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState('account_disabled')
  const [threshold, setThreshold] = useState('1')
  const [webhookUrl, setWebhookUrl] = useState('')

  const resetCreateForm = () => {
    setName('')
    setWebhookUrl('')
    setThreshold('1')
  }

  const createMutation = useMutation({
    mutationFn: async () =>
      adminApi.createAlertRule(token, {
        name,
        kind,
        threshold_value: Number(threshold),
        webhook_url: webhookUrl,
      }),
    onSuccess: async () => {
      resetCreateForm()
      await queryClient.invalidateQueries({ queryKey: ['alert-rules'] })
    },
  })

  const toggleMutation = useMutation({
    mutationFn: async (payload: { ruleId: string; enabled: boolean }) =>
      adminApi.updateAlertRule(token, payload.ruleId, { enabled: payload.enabled }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['alert-rules'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (ruleId: string) => adminApi.deleteAlertRule(token, ruleId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['alert-rules'] })
    },
  })

  return {
    name,
    kind,
    threshold,
    webhookUrl,
    createMutation,
    toggleMutation,
    deleteMutation,
    setName,
    setKind,
    setThreshold,
    setWebhookUrl,
    onCreate: () => void createMutation.mutateAsync(),
    onToggleEnabled: (ruleId: string, enabled: boolean) =>
      void toggleMutation.mutateAsync({ ruleId, enabled }),
    onDelete: (ruleId: string) => void deleteMutation.mutateAsync(ruleId),
  }
}
