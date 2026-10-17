import { computed, shallowRef } from 'vue'
import type { ComponentInstance } from '@lingui/renderer'
import { cloneJson } from '../shared/clone'
import {
  allRevisions,
  validateRevisionHistory,
  type RevisionHistory,
  type WorkRevision,
} from './types'
const budget = 1800000
export function useWorkRevisions(
  current: () => ComponentInstance | undefined,
  apply: (instance: ComponentInstance | undefined) => void,
) {
  const history = shallowRef<RevisionHistory>()
  function entry(instance: ComponentInstance | undefined, label: string): WorkRevision {
    return {
      id: crypto.randomUUID(),
      label: label.slice(0, 160),
      createdAt: new Date().toISOString(),
      ...(instance ? { instance: cloneJson(instance) } : {}),
    }
  }
  function reset(value?: RevisionHistory) {
    history.value = value ? validateRevisionHistory(value) : undefined
  }
  function commit(instance: ComponentInstance | undefined, label: string) {
    const previous = current()
    if (JSON.stringify(instance) === JSON.stringify(previous)) return
    const stored = history.value
    const archived = [
      ...(stored?.archived ?? []),
      ...(stored ? stored.entries.slice(stored.cursor + 1) : []),
    ]
    let entries = stored
      ? stored.entries.slice(0, stored.cursor + 1)
      : [entry(previous, '开始创作')]
    // External saves can update template metadata without creating an edit revision.
    entries = [
      ...entries.slice(0, -1),
      { ...entries.at(-1)!, ...(previous ? { instance: cloneJson(previous) } : {}) },
    ]
    entries.push(entry(instance, label))
    entries = entries.slice(-30)
    archived.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    while (
      entries.length + archived.length > 30 ||
      JSON.stringify([entries, archived]).length > budget
    ) {
      if (
        archived.length &&
        (entries.length <= 2 || archived[0]!.createdAt <= entries[0]!.createdAt)
      )
        archived.shift()
      else if (entries.length > 2) entries.shift()
      else break
    }
    history.value = {
      entries,
      cursor: entries.length - 1,
      ...(archived.length ? { archived } : {}),
    }
    apply(instance)
  }
  function move(delta: number) {
    const value = history.value
    if (!value || value.cursor + delta < 0 || value.cursor + delta >= value.entries.length) return
    const cursor = value.cursor + delta
    history.value = { ...value, cursor }
    apply(value.entries[cursor]!.instance ? cloneJson(value.entries[cursor]!.instance) : undefined)
  }
  function restore(id: string) {
    const value = allRevisions(history.value).find((revision) => revision.id === id)
    if (value)
      commit(value.instance ? cloneJson(value.instance) : undefined, `恢复：${value.label}`)
  }
  return {
    history,
    reset,
    commit,
    restore,
    undo: () => move(-1),
    redo: () => move(1),
    canUndo: computed(() => (history.value?.cursor ?? 0) > 0),
    canRedo: computed(
      () => !!history.value && history.value.cursor < history.value.entries.length - 1,
    ),
  }
}
