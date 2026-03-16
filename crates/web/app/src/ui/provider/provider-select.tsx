import { CustomSelect } from '../overlays/custom-select'
import { PROVIDER_IDS, getProviderLabel } from '../../lib/provider'

export function ProviderSelect({
  value,
  onChange,
  providers = PROVIDER_IDS,
  includeAll = false,
  allLabel = 'ALL',
  disabled = false,
  className,
  ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  providers?: readonly string[]
  includeAll?: boolean
  allLabel?: string
  disabled?: boolean
  className?: string
  ariaLabel?: string
}) {
  return (
    <CustomSelect
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={className}
      ariaLabel={ariaLabel}
      options={[
        ...(includeAll ? [{ value: '', label: allLabel }] : []),
        ...providers.map((provider) => ({
          value: provider,
          label: getProviderLabel(provider),
        })),
      ]}
    />
  )
}
