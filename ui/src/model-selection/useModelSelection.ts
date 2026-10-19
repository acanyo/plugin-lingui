import { computed, onScopeDispose, ref, watch, type Ref } from 'vue'
import type { GenerationSettings } from '../api/generated'

export const modelPreferenceKey = (scope: string) =>
  `lingui:generation-model:${encodeURIComponent(scope)}`

/** One controller belongs to one mounted workbench; persistence is isolated by Halo account. */
export function useModelSelection(options: {
  scope: Readonly<Ref<string | undefined>>
  enabled: Readonly<Ref<boolean>>
  loadDefault: () => Promise<GenerationSettings>
  storage?: Pick<Storage, 'getItem' | 'setItem'>
}) {
  const modelName = ref<string>()
  const loading = ref(false)
  const error = ref('')
  const persistenceError = ref('')
  const activeGenerations = ref(0)
  let epoch = 0
  let disposed = false
  let pending: Promise<void> = Promise.resolve()
  function storage() {
    return options.storage ?? localStorage
  }
  function persist(scope: string, name: string) {
    try {
      storage().setItem(modelPreferenceKey(scope), JSON.stringify(name))
      persistenceError.value = ''
    } catch {
      persistenceError.value = '模型已切换，但此浏览器无法保存偏好，刷新后需重新选择。'
    }
  }
  async function initialize(scope: string, generation: number) {
    try {
      const stored = storage().getItem(modelPreferenceKey(scope))
      if (stored !== null) {
        const value: unknown = JSON.parse(stored)
        if (typeof value === 'string' && value.length <= 160) {
          modelName.value = value.trim()
          loading.value = false
          return
        }
      }
    } catch {
      // A blocked store or invalid value must not prevent selecting a model for this session.
    }
    try {
      const settings = await options.loadDefault()
      if (disposed || generation !== epoch) return
      modelName.value = settings.modelName.trim()
      persist(scope, modelName.value)
    } catch {
      if (disposed || generation !== epoch) return
      // Leaving this undefined preserves the server's legacy setting until the user chooses.
      error.value = '未能载入原模型设置。可重试载入，或直接选择生成模型；未选择时沿用原设置。'
    } finally {
      if (!disposed && generation === epoch) loading.value = false
    }
  }
  function reset() {
    const generation = ++epoch
    modelName.value = undefined
    error.value = ''
    persistenceError.value = ''
    loading.value = false
    const scope = options.scope.value
    if (!options.enabled.value || !scope) {
      pending = Promise.resolve()
      return
    }
    loading.value = true
    pending = initialize(scope, generation)
  }
  watch([options.scope, options.enabled], reset, { immediate: true, flush: 'sync' })
  onScopeDispose(() => {
    disposed = true
    epoch++
  })
  const awaitingIdentity = computed(() => options.enabled.value && !options.scope.value)
  const ready = computed(() => !loading.value && !awaitingIdentity.value)
  function select(value: unknown) {
    const scope = options.scope.value
    if (!options.enabled.value || !scope || loading.value || activeGenerations.value) return
    modelName.value = typeof value === 'string' ? value.trim() : ''
    error.value = ''
    persist(scope, modelName.value)
  }
  async function forGeneration() {
    const generation = epoch
    await pending
    if (disposed || generation !== epoch) throw new Error('账号已变化，请重新生成。')
    if (!options.enabled.value) throw new Error('需要 AI 生成权限。')
    if (!options.scope.value) throw new Error('正在确认当前账号，请稍后重试。')
    return modelName.value
  }
  function acquire() {
    activeGenerations.value++
    let released = false
    return () => {
      if (released) return
      released = true
      activeGenerations.value--
    }
  }
  return {
    modelName,
    loading,
    awaitingIdentity,
    ready,
    error,
    persistenceError,
    generating: computed(() => activeGenerations.value > 0),
    acquire,
    select,
    retry: () => {
      if (!activeGenerations.value) reset()
    },
    forGeneration,
  }
}

export type ModelSelection = ReturnType<typeof useModelSelection>
