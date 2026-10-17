import { validateInstance, type ComponentInstance } from '@lingui/renderer'
export interface WorkRevision {
  id: string
  label: string
  createdAt: string
  instance?: ComponentInstance
}
export interface RevisionHistory {
  entries: WorkRevision[]
  cursor: number
  archived?: WorkRevision[]
}
export function allRevisions(value?: RevisionHistory): WorkRevision[] {
  return value
    ? [...value.entries, ...(value.archived ?? [])].sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt),
      )
    : []
}
export function validateRevisionHistory(value: RevisionHistory): RevisionHistory {
  if (
    !Array.isArray(value.entries) ||
    (value.archived !== undefined && !Array.isArray(value.archived)) ||
    allRevisions(value).length > 30 ||
    !Number.isInteger(value.cursor) ||
    value.cursor < 0 ||
    value.cursor >= value.entries.length
  )
    throw new Error('作品版本记录无效')
  const ids = new Set<string>()
  const validate = (entry: WorkRevision): WorkRevision => {
    if (
      typeof entry.id !== 'string' ||
      ids.has(entry.id) ||
      typeof entry.label !== 'string' ||
      entry.label.length > 160 ||
      !Number.isFinite(Date.parse(entry.createdAt))
    )
      throw new Error('作品版本信息无效')
    ids.add(entry.id)
    return {
      id: entry.id,
      label: entry.label,
      createdAt: entry.createdAt,
      ...(entry.instance ? { instance: validateInstance(entry.instance) } : {}),
    }
  }
  return {
    cursor: value.cursor,
    entries: value.entries.map(validate),
    ...(value.archived?.length ? { archived: value.archived.map(validate) } : {}),
  }
}
