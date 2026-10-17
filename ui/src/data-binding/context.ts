import type { ComputedRef, InjectionKey } from 'vue'
import type { JsonValue } from '@lingui/renderer'
/** Only lives in the open creation workspace; never persisted in projects or history. */
export const responseSamplesKey: InjectionKey<ComputedRef<Record<string, JsonValue>>> =
  Symbol('LingUI response samples')
