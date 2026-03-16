export function formatAlertKind(
  kind: string,
  t: (key: string, values?: Record<string, string | number>) => string,
) {
  switch (kind) {
    case 'account_disabled':
      return t('alerts.kind_account_disabled')
    case 'high_error_rate':
      return t('alerts.kind_high_error_rate')
    case 'stale_async_job':
      return t('alerts.kind_stale_async_job')
    default:
      return kind
  }
}

export function formatDeliveryStatus(
  status: string,
  t: (key: string, values?: Record<string, string | number>) => string,
) {
  switch (status) {
    case 'sent':
      return t('alerts.delivery_sent')
    case 'failed':
      return t('alerts.delivery_failed')
    default:
      return status
  }
}
