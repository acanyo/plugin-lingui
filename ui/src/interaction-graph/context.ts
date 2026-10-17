import type { InjectionKey, ComputedRef } from 'vue'
import type { DebugReport } from '../component-studio/debug-records'
export const graphReportsKey: InjectionKey<ComputedRef<DebugReport[]>> = Symbol(
  'interaction-graph-reports',
)
