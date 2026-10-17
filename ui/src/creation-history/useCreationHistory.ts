import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch, type Ref } from 'vue'
import {
  creationHistoryRepository,
  HistoryConflictError,
  type CreationHistoryRepository,
} from './repository'
import {
  hasCreation,
  resumeSnapshot,
  validateSnapshot,
  type CreationOrigin,
  type CreationRecord,
  type CreationSnapshot,
} from './types'

interface Session {
  record: CreationRecord
  fingerprint: string
}
/** Owns autosave/restore; the workspace owns rendering and project saves independently. */
export function useCreationHistory(
  scope: Ref<string | undefined>,
  snapshot: () => CreationSnapshot,
  restore: (snapshot: CreationSnapshot) => void,
  options: { autoResume: boolean; origin: CreationOrigin; repository?: CreationHistoryRepository },
) {
  const repository = options.repository ?? creationHistoryRepository
  const entries = shallowRef<CreationRecord[]>([])
  const error = ref('')
  const notice = ref('')
  const loading = ref(true)
  const saving = ref(false)
  const activeId = ref('')
  let current: Session | undefined
  let queue: Promise<void> = Promise.resolve()
  let epoch = 0
  let disposed = false
  let invalidSnapshot = false
  const pointerKey = (value: string) => `lingui-creation-current:${value}`
  function pointer(value: string, id: string) {
    if (!options.autoResume) return
    try {
      sessionStorage.setItem(pointerKey(value), id)
    } catch {
      /* Autosave remains available through the history list. */
    }
  }
  function start(origin: CreationOrigin = options.origin) {
    if (!scope.value) return
    const now = new Date().toISOString()
    current = {
      record: {
        id: crypto.randomUUID(),
        scope: scope.value,
        origin,
        revision: 0,
        createdAt: now,
        updatedAt: now,
        messages: [],
        instruction: '',
        dirty: false,
        editing: false,
      },
      fingerprint: '',
    }
    activeId.value = current.record.id
    pointer(scope.value, activeId.value)
    notice.value = ''
  }
  function replaceEntry(saved: CreationRecord) {
    entries.value = [saved, ...entries.value.filter((entry) => entry.id !== saved.id)].sort(
      (a, b) => b.updatedAt.localeCompare(a.updatedAt),
    )
  }
  async function flush(): Promise<void> {
    if (loading.value) throw new Error('创作历史尚未载入，请稍后重试')
    if (!scope.value || !current) throw new Error('无法确认当前账号，创作历史暂未保存')
    let value: CreationSnapshot
    try {
      value = validateSnapshot(snapshot())
      invalidSnapshot = false
    } catch (cause) {
      invalidSnapshot = true
      error.value = cause instanceof Error ? cause.message : '历史数据无效，请导出当前作品后重试'
      throw cause
    }
    const target = current
    const generation = epoch
    const fingerprint = JSON.stringify(value)
    const run = queue
      .catch(() => undefined)
      .then(async () => {
        if (
          (!hasCreation(value) && target.record.revision === 0) ||
          target.fingerprint === fingerprint ||
          disposed ||
          generation !== epoch
        )
          return
        saving.value = true
        try {
          let saved: CreationRecord
          try {
            saved = await repository.save({ ...target.record, ...value })
          } catch (cause) {
            if (!(cause instanceof HistoryConflictError)) throw cause
            // Preserve both windows' work rather than silently replacing a newer snapshot.
            const now = new Date().toISOString()
            saved = await repository.save({
              ...target.record,
              ...value,
              id: crypto.randomUUID(),
              revision: 0,
              createdAt: now,
              updatedAt: now,
            })
            if (generation === epoch) {
              notice.value = '另一窗口更新了这段历史，当前内容已另存为一段新历史。'
              entries.value = await repository.list(target.record.scope)
            }
          }
          target.record = saved
          target.fingerprint = fingerprint
          if (generation === epoch && !disposed) {
            replaceEntry(saved)
            if (!invalidSnapshot) error.value = ''
            if (current === target) {
              activeId.value = saved.id
              pointer(saved.scope, saved.id)
            }
          }
        } catch (cause) {
          if (generation === epoch && !disposed)
            error.value = cause instanceof Error ? cause.message : '历史保存失败，请重试'
          throw cause
        } finally {
          if (generation === epoch) saving.value = false
        }
      })
    queue = run
    return run
  }
  async function refresh() {
    if (!scope.value) return
    const generation = epoch
    try {
      const list = await repository.list(scope.value)
      if (generation === epoch && !disposed) entries.value = list
    } catch (cause) {
      if (generation === epoch)
        error.value = cause instanceof Error ? cause.message : '历史载入失败'
    }
  }
  async function activate(record: CreationRecord) {
    const generation = epoch
    await flush()
    if (record.scope !== scope.value) throw new Error('不能打开其他账号的历史')
    const fresh = (await repository.list(record.scope)).find((item) => item.id === record.id)
    if (generation !== epoch || disposed) throw new Error('账号已变化，请重新打开创作历史')
    if (!fresh) throw new Error('这段历史已被删除，请刷新列表')
    const value = resumeSnapshot(fresh)
    current = { record: fresh, fingerprint: '' }
    activeId.value = fresh.id
    pointer(fresh.scope, fresh.id)
    restore(value)
    await nextTick()
    await flush()
  }
  async function remove(record: CreationRecord) {
    await queue.catch(() => undefined)
    if (record.scope !== scope.value) throw new Error('不能删除其他账号的历史')
    const fresh = entries.value.find((item) => item.id === record.id) ?? record
    await repository.remove(fresh)
    entries.value = entries.value.filter((entry) => entry.id !== record.id)
  }
  watch(
    scope,
    async (value, previous) => {
      const generation = ++epoch
      loading.value = true
      entries.value = []
      current = undefined
      activeId.value = ''
      error.value = ''
      if (previous && previous !== value)
        restore({ messages: [], instruction: '', dirty: false, editing: false })
      if (!value) {
        error.value = '无法确认当前账号，创作历史暂未保存。请重新登录后重试。'
        loading.value = false
        return
      }
      try {
        const list = await repository.list(value)
        if (disposed || generation !== epoch) return
        entries.value = list
        let id: string | null = null
        if (options.autoResume) {
          try {
            id = sessionStorage.getItem(pointerKey(value))
          } catch {
            /* History can still be opened manually. */
          }
        }
        const selected = list.find((entry) => entry.id === id)
        if (selected) {
          current = { record: selected, fingerprint: '' }
          activeId.value = selected.id
          restore(resumeSnapshot(selected))
          await nextTick()
        } else start()
      } catch (cause) {
        if (generation !== epoch) return
        error.value = cause instanceof Error ? cause.message : '历史载入失败'
        start()
      } finally {
        if (generation === epoch && !disposed) {
          loading.value = false
          void flush().catch(() => undefined)
        }
      }
    },
    { immediate: true },
  )
  watch(
    snapshot,
    () => {
      if (!loading.value && scope.value) void flush().catch(() => undefined)
    },
    { deep: true },
  )
  function pagehide() {
    if (!loading.value) void flush().catch(() => undefined)
  }
  window.addEventListener('pagehide', pagehide)
  onBeforeUnmount(() => {
    window.removeEventListener('pagehide', pagehide)
    // Queued writes contain immutable snapshots and may finish after the view unmounts.
    void queue
      .finally(() => {
        disposed = true
      })
      .catch(() => undefined)
  })
  const status = computed(() =>
    loading.value
      ? '正在载入创作历史…'
      : error.value
        ? '历史未保存'
        : saving.value
          ? '正在保留历史…'
          : '历史自动保留在此浏览器',
  )
  return {
    entries,
    error,
    notice,
    loading,
    saving,
    activeId,
    status,
    start,
    flush,
    refresh,
    activate,
    remove,
  }
}
