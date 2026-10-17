import { onBeforeUnmount, ref, shallowRef, watch, type Ref } from 'vue'
import { loadComponentReference, type ComponentInstance } from '@lingui/renderer'

export function useComponentReference(name: Readonly<Ref<string>>) {
  const instance = shallowRef<ComponentInstance>()
  const loading = ref(false)
  const error = ref('')
  const revision = ref(0)
  const stop = watch(
    [name, revision],
    ([id], _, onCleanup) => {
      const controller = new AbortController()
      let active = true
      const timeout = setTimeout(() => controller.abort(), 15000)
      onCleanup(() => {
        active = false
        clearTimeout(timeout)
        controller.abort()
      })
      instance.value = undefined
      loading.value = true
      error.value = ''
      void loadComponentReference(id, controller.signal)
        .then(
          (value) => {
            if (active) instance.value = value
          },
          (cause) => {
            if (active)
              error.value = controller.signal.aborted
                ? '组件加载超时，请重试'
                : cause instanceof Error
                  ? cause.message
                  : '组件加载失败'
          },
        )
        .finally(() => {
          clearTimeout(timeout)
          if (active) loading.value = false
        })
    },
    { immediate: true },
  )
  onBeforeUnmount(stop)
  return {
    instance,
    loading,
    error,
    refresh: () => {
      revision.value++
    },
  }
}
