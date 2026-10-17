import {
  eventActions,
  parseSource,
  readPath,
  resolveDocument,
  writePath,
  type ComponentNode,
  type JsonValue,
  type LinguiDocument,
  type State,
} from '@lingui/renderer'
export interface DataSample {
  label: string
  path: string
  value: JsonValue
  origin?: 'initial' | 'example' | 'test'
}
/** Response examples are suggestions only. They never become initial state or saved test data. */
export function dataSamples(
  document: LinguiDocument,
  observed: Record<string, JsonValue> = {},
): DataSample[] {
  const samples: DataSample[] = [
    { label: '初始状态', path: '/', value: resolveDocument(document).state, origin: 'initial' },
  ]
  for (const node of parseSource(document.source))
    for (const binding of Object.values(node.events ?? {})) {
      for (const action of eventActions({ ...node, events: { click: binding } })) {
        if (action.type !== 'api') continue
        const api = document.integrations?.apis.find((item) => item.name === action.name)
        if (!api || (observed[api.name] === undefined && api.responseExample === undefined))
          continue
        if (action.resultPath)
          samples.push({
            label: `${api.label} · ${observed[api.name] !== undefined ? '本次测试结果' : '返回示例'}`,
            path: action.resultPath,
            value: observed[api.name] !== undefined ? observed[api.name]! : api.responseExample!,
            origin: observed[api.name] !== undefined ? 'test' : 'example',
          })
      }
      const last = binding.actions.at(-1)
      if (binding.resultPath && last?.type === 'api') {
        const api = document.integrations?.apis.find((item) => item.name === last.name)
        if (api && (observed[api.name] !== undefined || api.responseExample !== undefined))
          samples.push({
            label: `${api.label} · ${observed[api.name] !== undefined ? '本次测试结果' : '返回示例'}`,
            path: binding.resultPath,
            value: observed[api.name] !== undefined ? observed[api.name]! : api.responseExample!,
            origin: observed[api.name] !== undefined ? 'test' : 'example',
          })
      }
    }
  return samples
    .filter(
      (sample, index) =>
        samples.findIndex((other) => other.label === sample.label && other.path === sample.path) ===
        index,
    )
    .sort((a, b) => (a.origin === 'initial' ? 1 : 0) - (b.origin === 'initial' ? 1 : 0))
}
export function sampleValue(samples: DataSample[], path: string): JsonValue | undefined {
  // A test/declared response owns its destination. Do not hide missing fields with old state.
  for (const sample of samples) {
    const relative =
      sample.path === '/'
        ? path
        : path === sample.path
          ? '/'
          : path.startsWith(`${sample.path}/`)
            ? path.slice(sample.path.length)
            : ''
    if (relative) return readPath(sample.value, relative)
  }
  return undefined
}

export function sampleState(samples: DataSample[], node: ComponentNode): State {
  // Only substitute arrays in a throwaway validation state. Examples never reach the document.
  const result: State = {}
  for (const binding of Object.values(node.bindings ?? {})) {
    const value = sampleValue(samples, binding.path)
    if (value !== undefined) writePath(result, binding.path, value)
  }
  return result
}
