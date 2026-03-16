export function formatMaybe(value: string | number | null | undefined) {
  if (value == null || value === '') {
    return '—'
  }
  return String(value)
}

export function formatTimestamp(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function formatManagedStatus(
  status: string,
  t: (key: string) => string,
) {
  switch (status) {
    case 'active':
      return t('table.status_active')
    case 'cooldown':
      return t('table.status_cooldown')
    case 'disabled':
      return t('table.status_disabled')
    default:
      return status
  }
}

export function toneFromStatus(
  status: string | null | undefined,
): 'neutral' | 'success' | 'warning' | 'danger' {
  if (!status) {
    return 'neutral'
  }
  if (status === 'active' || status === 'completed' || status === 'settled') {
    return 'success'
  }
  if (status === 'cooldown' || status === 'pending' || status === 'running') {
    return 'warning'
  }
  if (status === 'disabled' || status === 'failed' || status === 'cancelled') {
    return 'danger'
  }
  return 'neutral'
}
