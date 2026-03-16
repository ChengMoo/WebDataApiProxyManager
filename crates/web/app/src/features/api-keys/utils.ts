export function formatQuota(
  quota: number,
  t: (key: string, values?: Record<string, string | number>) => string,
) {
  return quota === 0 ? t('common.unlimited') : String(quota)
}
