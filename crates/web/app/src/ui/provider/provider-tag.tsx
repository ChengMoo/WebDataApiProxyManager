import { getProviderLabel, providerTagClassName } from '../../lib/provider'

export function ProviderTag({ provider }: { provider: string }) {
  return <span className={providerTagClassName(provider)}>{getProviderLabel(provider)}</span>
}
