import { accountsMessages } from './accounts'
import { coreMessages } from './core'
import { operationsMessages } from './operations'
import { overviewMessages } from './overview'
import { settingsMessages } from './settings'
import { tableMessages } from './table'

export const messages: Record<string, { en: string; zh: string }> = {
  ...coreMessages,
  ...overviewMessages,
  ...tableMessages,
  ...accountsMessages,
  ...operationsMessages,
  ...settingsMessages,
}
