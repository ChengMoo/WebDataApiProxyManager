import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { adminApi } from '../../api'
import { useSession } from '../../app'
import { useLocale } from '../../i18n'
import type { ProviderAsyncJobState } from '../../types'
import {
  CustomSelect,
  EmptyState,
  ErrorBanner,
  Panel,
  Spinner,
  StatusBadge,
  formatTimestamp,
  toneFromStatus,
} from '../../ui/shared'

function formatJobState(state: string, t: ReturnType<typeof useLocale>['t']) {
  switch (state) {
    case 'pending':
      return t('table.status_pending')
    case 'running':
      return t('table.status_running')
    case 'completed':
      return t('table.status_completed')
    case 'failed':
      return t('table.status_failed')
    case 'cancelled':
      return t('table.status_cancelled')
    default:
      return state
  }
}

export function AsyncJobsPage() {
  const { token } = useSession()
  const { t } = useLocale()
  const queryClient = useQueryClient()
  const [stateFilter, setStateFilter] = useState<ProviderAsyncJobState | ''>('')
  const [limit, setLimit] = useState('80')

  const jobsQuery = useQuery({
    queryKey: ['async-jobs', token, stateFilter, limit],
    queryFn: () =>
      adminApi.listAsyncJobs(token, {
        provider: 'firecrawl',
        state: stateFilter || undefined,
        limit: Number(limit || '80'),
      }),
  })

  const reconcileMutation = useMutation({
    mutationFn: async () => adminApi.reconcileFirecrawl(token, Number(limit || '80')),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['async-jobs'] }),
        queryClient.invalidateQueries({ queryKey: ['request-logs'] }),
      ])
    },
  })

  if (jobsQuery.isLoading) return <Spinner />
  if (jobsQuery.error) return <ErrorBanner message={jobsQuery.error.message} />

  return (
    <div className="page-grid">
      <Panel
        title={t('async.title')}
        description={t('async.desc')}
        actions={
          <div className="inline-action">
            <label className="inline-field compact">
              <span>{t('table.state')}</span>
              <CustomSelect
                value={stateFilter}
                onChange={(value) => setStateFilter(value as ProviderAsyncJobState | '')}
                options={[
                  { value: '', label: t('common.all') },
                  { value: 'pending', label: t('table.status_pending') },
                  { value: 'running', label: t('table.status_running') },
                  { value: 'completed', label: t('table.status_completed') },
                  { value: 'failed', label: t('table.status_failed') },
                  { value: 'cancelled', label: t('table.status_cancelled') },
                ]}
              />
            </label>
            <label className="inline-field compact">
              <span>{t('common.limit')}</span>
              <input value={limit} onChange={(event) => setLimit(event.target.value)} />
            </label>
            <button
              type="button"
              className="primary-button"
              disabled={reconcileMutation.isPending}
              onClick={() => void reconcileMutation.mutateAsync()}
            >
              {reconcileMutation.isPending
                ? t('async.reconciling')
                : t('async.reconcile')}
            </button>
          </div>
        }
      >
        {(jobsQuery.data ?? []).length === 0 ? (
          <EmptyState title={t('async.no_jobs')} body={t('async.no_jobs_desc')} />
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('table.state')}</th>
                  <th>{t('table.route')}</th>
                  <th>{t('table.upstream_job')}</th>
                  <th>{t('table.account')}</th>
                  <th>{t('table.proxy')}</th>
                  <th>{t('table.polls')}</th>
                  <th>{t('table.next_poll')}</th>
                </tr>
              </thead>
              <tbody>
                {(jobsQuery.data ?? []).map((job) => (
                  <tr key={job.id}>
                    <td>
                      <StatusBadge tone={toneFromStatus(job.state)}>
                        {formatJobState(job.state, t)}
                      </StatusBadge>
                    </td>
                    <td className="mono-cell">{job.route}</td>
                    <td className="mono-cell">{job.upstream_job_id}</td>
                    <td>{job.provider_account_id ?? '—'}</td>
                    <td>{job.egress_proxy_id ?? t('common.direct')}</td>
                    <td>{job.poll_attempts}</td>
                    <td>{job.next_poll_at ? formatTimestamp(job.next_poll_at) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {reconcileMutation.data ? (
          <div className="footnote">
            <strong>{t('async.reconcile_result')}</strong>
            <span>
              {t('async.reconcile_stats', {
                scanned: reconcileMutation.data.scanned,
                progressed: reconcileMutation.data.progressed,
                settled: reconcileMutation.data.settled,
                failed: reconcileMutation.data.failed,
              })}
            </span>
          </div>
        ) : null}
      </Panel>
    </div>
  )
}
