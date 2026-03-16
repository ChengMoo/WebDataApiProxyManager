import { useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '../../api'
import { useSession } from '../../app'
import { useLocale } from '../../i18n'
import { ErrorBanner, Spinner } from '../../ui/shared'
import { AlertEventsPanel } from './alert-events-panel'
import { AlertRulesPanel } from './alert-rules-panel'
import { CreateAlertRulePanel } from './create-alert-rule-panel'
import { useAlertsStateAndMutations } from './hooks'

export function AlertsPage() {
  const { token } = useSession()
  const { t } = useLocale()
  const queryClient = useQueryClient()
  const state = useAlertsStateAndMutations({ token, queryClient })

  const rulesQuery = useQuery({
    queryKey: ['alert-rules', token],
    queryFn: () => adminApi.listAlertRules(token),
  })

  const eventsQuery = useQuery({
    queryKey: ['alert-events', token],
    queryFn: () => adminApi.listAlertEvents(token, { limit: 50 }),
  })
  if (rulesQuery.isLoading) return <Spinner />
  if (rulesQuery.error) return <ErrorBanner message={rulesQuery.error.message} />

  return (
    <div className="page-grid">
      <CreateAlertRulePanel
        name={state.name}
        kind={state.kind}
        threshold={state.threshold}
        webhookUrl={state.webhookUrl}
        createPending={state.createMutation.isPending}
        createError={state.createMutation.error?.message}
        onNameChange={state.setName}
        onKindChange={state.setKind}
        onThresholdChange={state.setThreshold}
        onWebhookUrlChange={state.setWebhookUrl}
        onCreate={state.onCreate}
        t={t}
      />

      <AlertRulesPanel
        rules={rulesQuery.data ?? []}
        togglePending={state.toggleMutation.isPending}
        deletePending={state.deleteMutation.isPending}
        onToggleEnabled={state.onToggleEnabled}
        onDelete={state.onDelete}
        t={t}
      />

      <AlertEventsPanel loading={eventsQuery.isLoading} events={eventsQuery.data ?? []} t={t} />
    </div>
  )
}
