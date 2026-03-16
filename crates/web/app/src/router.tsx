import {
  Link,
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  useRouterState,
} from '@tanstack/react-router'
import { Suspense, lazy, useState } from 'react'
import { useSession } from './app'
import { useLocale } from './i18n'
import { AppHeader } from './ui/app-header'
import { AuthPage } from './ui/auth-page'
import { Spinner } from './ui/shared'

const DashboardPage = lazy(async () => ({
  default: (await import('./features/dashboard/page')).DashboardPage,
}))

const ProviderAccountsPage = lazy(async () => ({
  default: (await import('./features/provider-accounts/page')).ProviderAccountsPage,
}))

const EgressProxiesPage = lazy(async () => ({
  default: (await import('./features/egress-proxies/page')).EgressProxiesPage,
}))

const RequestLogsPage = lazy(async () => ({
  default: (await import('./features/request-logs/page')).RequestLogsPage,
}))

const AsyncJobsPage = lazy(async () => ({
  default: (await import('./features/async-jobs/page')).AsyncJobsPage,
}))

const ApiKeysPage = lazy(async () => ({
  default: (await import('./features/api-keys/page')).ApiKeysPage,
}))

const SettingsPage = lazy(async () => ({
  default: (await import('./ui/settings-page')).SettingsPage,
}))

const NAV_ICONS: Record<string, string> = {
  '/': 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1',
  '/requests': 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  '/async-jobs': 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  '/accounts': 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  '/proxies': 'M5 12h14M12 5l7 7-7 7',
  '/api-keys': 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z',
  '/settings': 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
}

const mainNavKeys = [
  { to: '/', labelKey: 'nav.overview' },
  { to: '/requests', labelKey: 'nav.requests' },
  { to: '/async-jobs', labelKey: 'nav.async_jobs' },
] as const

const opsNavKeys = [
  { to: '/accounts', labelKey: 'nav.accounts' },
  { to: '/proxies', labelKey: 'nav.proxies' },
  { to: '/api-keys', labelKey: 'nav.api_keys' },
  { to: '/settings', labelKey: 'nav.settings' },
] as const

function NavIcon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  )
}

function AppLayout() {
  const { authPhase } = useSession()
  const { t } = useLocale()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const [navOpen, setNavOpen] = useState(false)

  if (authPhase === 'loading') {
    return (
      <div className="auth-page">
        <div className="spinner" />
      </div>
    )
  }

  if (authPhase === 'setup' || authPhase === 'login') {
    return <AuthPage />
  }

  const isActive = (to: string) =>
    to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`)

  return (
    <div className="app-shell">
      <aside className={`app-sidebar${navOpen ? ' is-open' : ''}`}>
        <div className="sidebar-scroll">
          <div className="brand-block">
            <span className="brand-kicker">WDAPM</span>
            <h1>Proxy Console</h1>
            <p>Web Data API Proxy Manager</p>
          </div>
          <nav className="sidebar-nav">
            {mainNavKeys.map((item) => (
              <Link
                key={item.to}
                className={`nav-link${isActive(item.to) ? ' is-active' : ''}`}
                to={item.to}
                onClick={() => setNavOpen(false)}
              >
                <NavIcon path={NAV_ICONS[item.to] ?? ''} />
                {t(item.labelKey)}
              </Link>
            ))}
            <div className="nav-section-label">{t('nav.operations')}</div>
            {opsNavKeys.map((item) => (
              <Link
                key={item.to}
                className={`nav-link${isActive(item.to) ? ' is-active' : ''}`}
                to={item.to}
                onClick={() => setNavOpen(false)}
              >
                <NavIcon path={NAV_ICONS[item.to] ?? ''} />
                {t(item.labelKey)}
              </Link>
            ))}
          </nav>
        </div>
        <div className="sidebar-footer-container">
          <div className="sidebar-footer">
            <span className="version-tag">v0.1.0</span>
          </div>
          <div className="footer-bar">
            <div className="pixel-art mascot-fox" aria-hidden="true">
              <span className="mascot-fox-glyph">🦊</span>
            </div>
            <div className="step step-1"></div>
            <div className="step step-2"></div>
            <div className="step step-3"></div>
            <div className="step step-4"></div>
          </div>
        </div>
      </aside>
      <main className="app-main">
        <AppHeader navOpen={navOpen} onToggleNav={() => setNavOpen((value) => !value)} />
        <div className="page-frame">
          <Suspense fallback={<Spinner />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
    </div>
  )
}

const rootRoute = createRootRoute({
  component: AppLayout,
})

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: DashboardPage,
})

const accountsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'accounts',
  component: ProviderAccountsPage,
})

const proxiesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'proxies',
  component: EgressProxiesPage,
})

const requestsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'requests',
  component: RequestLogsPage,
})

const asyncJobsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'async-jobs',
  component: AsyncJobsPage,
})

const apiKeysRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'api-keys',
  component: ApiKeysPage,
})

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'settings',
  component: SettingsPage,
})

const routeTree = rootRoute.addChildren([
  dashboardRoute,
  accountsRoute,
  proxiesRoute,
  requestsRoute,
  asyncJobsRoute,
  apiKeysRoute,
  settingsRoute,
])

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
