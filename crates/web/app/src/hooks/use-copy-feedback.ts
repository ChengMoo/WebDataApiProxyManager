import { useCallback, useState } from 'react'

export function useCopyFeedback(timeout = 2000) {
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const copy = useCallback(
    async (text: string, id: string) => {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), timeout)
    },
    [timeout],
  )

  return { copiedId, copy }
}
