const adminApiBaseUrl =
  import.meta.env.VITE_ADMIN_API_BASE_URL?.trim() || '/admin'

type ApiRequestOptions = {
  method?: string
  token?: string
  body?: unknown
}

export async function request<T>(
  path: string,
  { method = 'GET', token, body }: ApiRequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {}
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(`${adminApiBaseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (response.status === 204) {
    return undefined as T
  }

  const text = await response.text()
  const data = parseResponseBody(text) as Record<string, unknown> | string | null

  if (!response.ok) {
    const message =
      typeof data === 'string'
        ? data
        : data && typeof data.message === 'string'
          ? data.message
          : text || `Request failed with status ${response.status}`
    throw new Error(message)
  }

  return data as T
}

export function buildSearchParams(
  params: Record<string, string | number | null | undefined>,
) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== '') {
      search.set(key, String(value))
    }
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}

function parseResponseBody(text: string) {
  if (!text) {
    return null
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}
