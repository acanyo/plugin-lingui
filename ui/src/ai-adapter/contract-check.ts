import { bindingDiagnostics } from '../data-binding/diagnostics'
import {
  eventActions,
  parseSource,
  resolveCollectionNode,
  type LinguiDocument,
} from '@lingui/renderer'
import { dataSamples, sampleState } from '../data-binding/samples'

export interface ContractIssue {
  nodeId: string
  message: string
  level: 'error' | 'warning'
}
export function checkContracts(document: LinguiDocument): ContractIssue[] {
  const issues: ContractIssue[] = []
  const samples = dataSamples(document)
  for (const node of parseSource(document.source)) {
    for (const action of eventActions(node)) {
      if (action.type === 'request')
        issues.push({
          nodeId: node.id,
          level: 'warning',
          message: `直接请求 ${action.method ?? 'GET'} ${action.url}，请在目标环境确认地址、权限与返回结构。`,
        })
      if (
        action.type === 'api' &&
        !document.integrations?.apis.some((api) => api.name === action.name)
      )
        issues.push({
          nodeId: node.id,
          level: 'error',
          message: `接口 ${action.name} 未配置，请使用已有接口标识。`,
        })
      if (
        action.type === 'callback' &&
        !['lingui.log', 'lingui.notify'].includes(action.name) &&
        !document.integrations?.callbacks.some((callback) => callback.name === action.name)
      )
        issues.push({ nodeId: node.id, level: 'error', message: `回调 ${action.name} 未声明。` })
    }
    if (!node.bindings) continue
    issues.push(
      ...bindingDiagnostics(node, samples).map((issue) => ({ ...issue, nodeId: node.id })),
    )
    try {
      resolveCollectionNode(node, sampleState(samples, node))
    } catch (cause) {
      issues.push({
        nodeId: node.id,
        level: 'error',
        message: cause instanceof Error ? cause.message : '字段映射无效',
      })
    }
  }
  return issues.filter(
    (item, index) =>
      issues.findIndex(
        (other) => other.nodeId === item.nodeId && other.message === item.message,
      ) === index,
  )
}
export class GenerationContractError extends Error {
  constructor(readonly issues: ContractIssue[]) {
    super(
      `生成结果未通过校验：\n${issues.map((issue) => `${issue.nodeId}：${issue.message}`).join('\n')}`,
    )
  }
}
export function assertGenerationContracts(document: LinguiDocument) {
  const errors = checkContracts(document).filter((issue) => issue.level === 'error')
  if (errors.length) throw new GenerationContractError(errors)
}
