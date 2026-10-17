import {
  childIds,
  parseSource,
  serializeSource,
  validateInstance,
  type ComponentInstance,
  type ComponentNode,
} from '@lingui/renderer'
import { cloneJson } from '../shared/clone'
import { updateInstanceDocument } from '../component-studio/document-editor'

export interface DraftChange {
  key: string
  area: 'node' | 'document' | 'theme'
  nodeId?: string
  path: string[]
  label: string
  before: unknown
  current: unknown
  after: unknown
  conflict: boolean
}
export interface DraftMerge {
  base: ComponentInstance
  incoming: ComponentInstance
  changes: DraftChange[]
  fingerprint: string
}
export interface DraftSelection {
  fingerprint: string
  keys: string[]
}

/** Object ordering is irrelevant to a design change; array order remains meaningful. */
export function designValue(value: unknown): string {
  if (value === undefined) return '未设置'
  if (Array.isArray(value)) return `[${value.map(designValue).join(',')}]`
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${designValue(item)}`)
      .join(',')}}`
  return JSON.stringify(value)
}
const equal = (a: unknown, b: unknown) => designValue(a) === designValue(b)
function read(value: unknown, path: string[]): unknown {
  for (const key of path)
    value = value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined
  return value
}
function write(value: object, path: string[], next: unknown) {
  let object = value as Record<string, unknown>
  for (const key of path.slice(0, -1)) {
    if (!object[key] || typeof object[key] !== 'object') object[key] = {}
    object = object[key] as Record<string, unknown>
  }
  const key = path.at(-1)!
  if (next === undefined) delete object[key]
  else object[key] = cloneJson(next)
}
export function buildDraftMerge(
  ancestor: ComponentInstance,
  base: ComponentInstance,
  incoming: ComponentInstance,
  includesTheme: boolean,
): DraftMerge {
  const changes: DraftChange[] = []
  function add(
    area: DraftChange['area'],
    path: string[],
    label: string,
    before: unknown,
    current: unknown,
    after: unknown,
    nodeId?: string,
  ) {
    if (equal(before, after) || equal(current, after)) return
    changes.push({
      key: JSON.stringify([area, nodeId, ...path]),
      area,
      path,
      nodeId,
      label,
      before,
      current,
      after,
      conflict: !equal(before, current),
    })
  }
  const oldNodes = new Map(parseSource(ancestor.document.source).map((node) => [node.id, node]))
  const currentNodes = new Map(parseSource(base.document.source).map((node) => [node.id, node]))
  const nextNodes = new Map(parseSource(incoming.document.source).map((node) => [node.id, node]))
  for (const id of new Set([...oldNodes.keys(), ...nextNodes.keys()])) {
    const old = oldNodes.get(id),
      current = currentNodes.get(id),
      next = nextNodes.get(id)
    if (
      !old ||
      !next ||
      old.component !== next.component ||
      !current ||
      current.component !== old.component
    ) {
      add(
        'node',
        [],
        `${!old ? '新增' : !next ? '删除' : '替换'}组件 · ${id}`,
        old,
        current,
        next,
        id,
      )
    } else
      for (const key of new Set([...Object.keys(old), ...Object.keys(next)])) {
        if (key === 'id' || key === 'component') continue
        add(
          'node',
          [key],
          `${id} · ${key}`,
          read(old, [key]),
          read(current, [key]),
          read(next, [key]),
          id,
        )
      }
  }
  for (const key of ['title', 'parameters', 'integrations'] as const)
    add(
      'document',
      [key],
      { title: '作品名称', parameters: '参数定义', integrations: '接口与回调' }[key],
      ancestor.document[key],
      base.document[key],
      incoming.document[key],
    )
  for (const key of new Set([
    ...Object.keys(ancestor.document.state),
    ...Object.keys(incoming.document.state),
  ]))
    add(
      'document',
      ['state', key],
      `初始状态 · ${key}`,
      ancestor.document.state[key],
      base.document.state[key],
      incoming.document.state[key],
    )
  if (includesTheme)
    for (const key of new Set([...Object.keys(ancestor.theme), ...Object.keys(incoming.theme)])) {
      const paths =
        key === 'colors'
          ? Object.keys(incoming.theme.colors).map((color) => ['colors', color])
          : [[key]]
      for (const path of paths)
        add(
          'theme',
          path,
          `主题 · ${path.join('.')}`,
          read(ancestor.theme, path),
          read(base.theme, path),
          read(incoming.theme, path),
        )
    }
  return { base, incoming, changes, fingerprint: designValue({ ancestor, base, incoming }) }
}
export function defaultDraftSelection(merge: DraftMerge): DraftSelection {
  return {
    fingerprint: merge.fingerprint,
    keys: merge.changes.filter((change) => !change.conflict).map((change) => change.key),
  }
}
export function applyDraftSelection(
  merge: DraftMerge,
  selection: DraftSelection,
): ComponentInstance {
  if (selection.fingerprint !== merge.fingerprint)
    throw new Error('项目或草稿在审核期间发生了变化，请重新选择草稿并审核。')
  const keys = new Set(selection.keys)
  if ([...keys].some((key) => !merge.changes.some((change) => change.key === key)))
    throw new Error('审核选项已失效，请重新审核。')
  const document = cloneJson(merge.base.document),
    theme = cloneJson(merge.base.theme)
  const nodes = new Map(parseSource(document.source).map((node) => [node.id, node]))
  for (const change of merge.changes.filter((change) => keys.has(change.key))) {
    if (change.area === 'document') write(document, change.path, change.after)
    else if (change.area === 'theme') write(theme, change.path, change.after)
    else if (!change.path.length) {
      if (change.after === undefined) nodes.delete(change.nodeId!)
      else nodes.set(change.nodeId!, cloneJson(change.after) as ComponentNode)
    } else write(nodes.get(change.nodeId!)!, change.path, change.after)
  }
  const seen = new Set<string>(),
    visiting = new Set<string>()
  function visit(id: string) {
    if (visiting.has(id)) throw new Error('所选修改产生循环引用，请一并选择关联的结构改动。')
    if (seen.has(id)) return
    const node = nodes.get(id)
    if (!node) throw new Error(`缺少关联组件 ${id}，请一并选择新增组件与父容器的引用改动。`)
    visiting.add(id)
    seen.add(id)
    childIds(node).forEach(visit)
    visiting.delete(id)
  }
  visit('root')
  if (seen.size !== nodes.size)
    throw new Error('部分组件未连接到根容器，请一并选择关联的新增、删除或容器引用改动。')
  document.source = serializeSource([...nodes.values()])
  return validateInstance({ ...updateInstanceDocument(merge.base, document), theme })
}
