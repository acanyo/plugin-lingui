import type { InjectionKey, ComputedRef } from 'vue'
import type { IntegrationDefinitions } from '@lingui/renderer'
export const integrationKey: InjectionKey<ComputedRef<IntegrationDefinitions>> =
  Symbol('LingUI integrations')
