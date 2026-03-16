import { alertsApi } from './api/alerts'
import { asyncJobsApi } from './api/async-jobs'
import { auditLogsApi } from './api/audit-logs'
import { authApi } from './api/auth'
import { egressProxiesApi } from './api/egress-proxies'
import { platformApiKeysApi } from './api/platform-api-keys'
import { providerAccountsApi } from './api/provider-accounts'
import { reportsApi } from './api/reports'
import { requestLogsApi } from './api/request-logs'

export const adminApi = {
  ...authApi,
  ...platformApiKeysApi,
  ...providerAccountsApi,
  ...egressProxiesApi,
  ...requestLogsApi,
  ...asyncJobsApi,
  ...auditLogsApi,
  ...alertsApi,
  ...reportsApi,
}
