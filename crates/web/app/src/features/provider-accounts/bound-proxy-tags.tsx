import { useQuery } from '@tanstack/react-query'
import { adminApi } from '../../api'
import type { EgressProxySummary } from '../../types'

export function BoundProxyTags({ token, accountId }: { token: string; accountId: string }) {
  const query = useQuery({
    queryKey: ['bound-proxies', accountId],
    queryFn: () => adminApi.listBoundEgressProxies(token, accountId),
  })

  if (query.isLoading) {
    return <span className="bound-proxy-loading">...</span>
  }

  if (query.error || !query.data?.length) {
    return null
  }

  return (
    <div className="bound-proxy-tags">
      {query.data.map((proxy: EgressProxySummary) => (
        <span key={proxy.id} className="tag">{proxy.name}</span>
      ))}
    </div>
  )
}
