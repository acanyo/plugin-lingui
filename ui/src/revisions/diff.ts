import { parseSource, type ComponentInstance } from '@lingui/renderer'
export function revisionDiff(before?: ComponentInstance, after?: ComponentInstance): string[] {
  const changes: string[] = []
  const oldNodes = new Map(
    before ? parseSource(before.document.source).map((node) => [node.id, node]) : [],
  )
  const nextNodes = new Map(
    after ? parseSource(after.document.source).map((node) => [node.id, node]) : [],
  )
  if (before?.document.title !== after?.document.title)
    changes.push(`名称：${before?.document.title ?? '空白'} → ${after?.document.title ?? '空白'}`)
  for (const [id, node] of nextNodes) {
    const old = oldNodes.get(id)
    if (!old) changes.push(`新增 ${node.component} · ${id}`)
    else if (JSON.stringify(old) !== JSON.stringify(node)) {
      const keys = [...new Set([...Object.keys(old), ...Object.keys(node)])].filter(
        (key) =>
          JSON.stringify(old[key as keyof typeof old]) !==
          JSON.stringify(node[key as keyof typeof node]),
      )
      changes.push(`修改 ${id}：${keys.join('、')}`)
    }
  }
  for (const id of oldNodes.keys()) if (!nextNodes.has(id)) changes.push(`移除 ${id}`)
  for (const key of ['state', 'parameters', 'integrations'] as const)
    if (JSON.stringify(before?.document[key]) !== JSON.stringify(after?.document[key]))
      changes.push(
        `更新${{ state: '初始状态', parameters: '参数定义', integrations: '接口与回调' }[key]}`,
      )
  if (JSON.stringify(before?.theme) !== JSON.stringify(after?.theme)) changes.push('更新主题样式')
  if (JSON.stringify(before?.parameters) !== JSON.stringify(after?.parameters))
    changes.push('更新参数值')
  return changes
}
