import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { EmbedStatus } from '../api/generated'
import { errorMessage } from '../services/repository'
import type { EmbedClient } from './client'

export function useEmbedReference(name: string | undefined, client: EmbedClient | undefined) {
  const status = ref<EmbedStatus>()
  const busy = ref(false)
  const error = ref('')
  const controller = new AbortController()
  onBeforeUnmount(() => controller.abort())
  async function run(operation: 'status' | 'enable' | 'disable') {
    if (!name || !client || busy.value) return false
    busy.value = true
    error.value = ''
    try {
      const value = await client[operation](name, controller.signal)
      if (controller.signal.aborted) return false
      status.value = value
      return true
    } catch (cause) {
      if (!controller.signal.aborted) error.value = errorMessage(cause)
      return false
    } finally {
      if (!controller.signal.aborted) busy.value = false
    }
  }
  onMounted(() => {
    void run('status')
  })
  return {
    status,
    busy,
    error,
    refresh: () => run('status'),
    enable: () => run('enable'),
    disable: () => run('disable'),
  }
}
