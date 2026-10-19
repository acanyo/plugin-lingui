import { computed, onScopeDispose, ref, watch, type Ref } from 'vue'
import type { ProjectOption } from '../api/project-selection'
import type { ProjectSelectionClient } from './client'

export interface ProjectSelectionOptions {
  modelValue: Readonly<Ref<string | undefined>>
  category: Readonly<Ref<string | undefined>>
  publicOnly: Readonly<Ref<boolean>>
  pageSize: Readonly<Ref<number>>
}

export function useProjectOptions(
  client: ProjectSelectionClient,
  options: ProjectSelectionOptions,
) {
  const page = ref(1)
  const keyword = ref('')
  const size = computed(() => Math.min(100, Math.max(1, Math.trunc(options.pageSize.value) || 20)))
  const items = ref<ProjectOption[]>([])
  const total = ref(0)
  const loading = ref(false)
  const error = ref('')
  const selected = ref<ProjectOption>()
  const selectedLoading = ref(false)
  const selectedError = ref('')
  const unavailable = ref(false)
  let listController: AbortController | undefined
  let selectedController: AbortController | undefined

  async function load() {
    listController?.abort()
    const controller = new AbortController()
    listController = controller
    loading.value = true
    error.value = ''
    // Results from the previous query must not remain selectable during a new request.
    items.value = []
    total.value = 0
    try {
      const result = await client.list(
        {
          page: page.value,
          size: size.value,
          keyword: keyword.value.trim() || undefined,
          category: options.category.value || undefined,
          publicOnly: options.publicOnly.value,
        },
        controller.signal,
      )
      if (controller.signal.aborted) return
      items.value = (result.items ?? []).filter(
        (item) => !!item.id && (!options.publicOnly.value || item.embedEnabled === true),
      )
      total.value = result.total ?? 0
    } catch {
      if (!controller.signal.aborted) error.value = '无法加载灵构 UI 作品，请稍后重试。'
    } finally {
      if (!controller.signal.aborted) loading.value = false
    }
  }

  async function loadSelected() {
    selectedController?.abort()
    selected.value = undefined
    selectedError.value = ''
    unavailable.value = false
    selectedLoading.value = false
    const name = options.modelValue.value
    if (!name) return
    const controller = new AbortController()
    selectedController = controller
    selectedLoading.value = true
    try {
      const result = await client.get(name, options.publicOnly.value, controller.signal)
      if (controller.signal.aborted) return
      if (result.id !== name || (options.publicOnly.value && result.embedEnabled !== true)) {
        unavailable.value = true
        return
      }
      selected.value = result
    } catch (cause) {
      if (controller.signal.aborted) return
      const status = (cause as { response?: { status?: number } })?.response?.status
      if (status === 404) unavailable.value = true
      else selectedError.value = '无法读取所选作品，请重试。'
    } finally {
      if (!controller.signal.aborted) selectedLoading.value = false
    }
  }

  watch([keyword, options.category, options.publicOnly, size], () => (page.value = 1), {
    flush: 'sync',
  })
  watch([page, keyword, options.category, options.publicOnly, size], load, { immediate: true })
  watch([options.modelValue, options.publicOnly], loadSelected, { immediate: true })
  onScopeDispose(() => {
    listController?.abort()
    selectedController?.abort()
  })

  return {
    page,
    keyword,
    size,
    items,
    total,
    loading,
    error,
    selected,
    selectedLoading,
    selectedError,
    unavailable,
    reload: load,
    reloadSelected: loadSelected,
  }
}
