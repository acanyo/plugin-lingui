import { computed, shallowRef, watch } from 'vue'
import type { LinguiDocument } from '@lingui/renderer'
import { apiTargets, validateScenario, type ApiScenario } from './model'
export function useApiScenarios(current: () => LinguiDocument | undefined) {
  const rules = shallowRef<Record<string, ApiScenario>>({})
  const targets = computed(() => apiTargets(current()))
  watch(targets, (list) => {
    const keys = new Set(list.map((target) => target.key))
    rules.value = Object.fromEntries(Object.entries(rules.value).filter(([key]) => keys.has(key)))
  })
  return {
    targets,
    rules,
    active: computed(
      () => Object.values(rules.value).filter((rule) => rule.mode !== 'real').length,
    ),
    apply(key: string, value: ApiScenario) {
      if (!targets.value.some((target) => target.key === key))
        throw new Error('接口已变化，请重新选择')
      rules.value = { ...rules.value, [key]: validateScenario(value) }
    },
    reset: () => {
      rules.value = {}
    },
  }
}
