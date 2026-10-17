import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { errorMessage } from '../../services/repository'
import {
  createMcpHistoryClient,
  type McpHistoryClient,
  type DraftInfo,
  type ActivityInfo,
} from './client'

/** Metadata polling never reads draft bodies or changes the active work. */
export function useMcpInbox(
  enabled: () => boolean,
  client: McpHistoryClient = createMcpHistoryClient(),
) {
  const drafts = shallowRef<DraftInfo[]>([])
  const activities = shallowRef<ActivityInfo[]>([])
  const open = ref(false)
  const busy = ref(false)
  const error = ref('')
  let disposed = false
  let timer: ReturnType<typeof setTimeout> | undefined
  async function refresh() {
    if (!enabled() || disposed || busy.value) return
    busy.value = true
    try {
      const values = await Promise.all([
        client.drafts(),
        open.value ? client.activities() : Promise.resolve(undefined),
      ])
      if (disposed) return
      drafts.value = values[0]
      if (values[1]) activities.value = values[1]
      error.value = ''
    } catch (cause) {
      if (!disposed) error.value = errorMessage(cause)
    } finally {
      if (!disposed) busy.value = false
    }
  }
  async function poll() {
    if (document.visibilityState !== 'hidden') await refresh()
    if (!disposed) timer = setTimeout(poll, 8000)
  }
  onMounted(() => {
    if (enabled()) void poll()
  })
  onBeforeUnmount(() => {
    disposed = true
    if (timer) clearTimeout(timer)
  })
  async function show() {
    open.value = true
    await refresh()
  }
  return {
    client,
    drafts,
    activities,
    open,
    busy,
    error,
    refresh,
    show,
    pending: computed(() => drafts.value.filter((draft) => !draft.loadedAt).length),
  }
}
