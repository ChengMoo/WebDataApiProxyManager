import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { adminApi } from './api'
import { LocaleProvider } from './i18n'
import { router } from './router'

const storageKey = 'wdapm.sessionToken'

type AuthPhase = 'loading' | 'setup' | 'login' | 'authenticated'

type SessionContextValue = {
  token: string
  authPhase: AuthPhase
  setToken: (nextValue: string) => void
  logout: () => void
  refreshAuthPhase: () => void
}

const SessionContext = createContext<SessionContextValue | null>(null)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 15_000,
      refetchOnWindowFocus: false,
    },
  },
})

function SessionProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState(() => {
    if (typeof window === 'undefined') {
      return ''
    }
    return window.localStorage.getItem(storageKey) ?? ''
  })
  const [authPhase, setAuthPhase] = useState<AuthPhase>('loading')

  const checkAuthStatus = useCallback(async () => {
    try {
      const { initialized } = await adminApi.authStatus()
      if (!initialized) {
        setAuthPhase('setup')
        return
      }
      if (token) {
        try {
          await adminApi.listPlatformApiKeys(token)
          setAuthPhase('authenticated')
        } catch {
          window.localStorage.removeItem(storageKey)
          setTokenState('')
          setAuthPhase('login')
        }
      } else {
        setAuthPhase('login')
      }
    } catch {
      setAuthPhase('login')
    }
  }, [token])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void checkAuthStatus()
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [checkAuthStatus])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    if (token) {
      window.localStorage.setItem(storageKey, token)
      return
    }
    window.localStorage.removeItem(storageKey)
  }, [token])

  const value: SessionContextValue = {
    token,
    authPhase,
    setToken(nextValue) {
      startTransition(() => {
        setTokenState(nextValue.trim())
        setAuthPhase('authenticated')
      })
    },
    logout() {
      startTransition(() => {
        setTokenState('')
        setAuthPhase('login')
        queryClient.clear()
      })
    },
    refreshAuthPhase() {
      checkAuthStatus()
    },
  }

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const value = useContext(SessionContext)
  if (!value) {
    throw new Error('Session context is unavailable')
  }
  return value
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LocaleProvider>
        <SessionProvider>
          <RouterProvider router={router} />
        </SessionProvider>
      </LocaleProvider>
    </QueryClientProvider>
  )
}
