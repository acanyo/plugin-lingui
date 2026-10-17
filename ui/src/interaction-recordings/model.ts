import {
  eventNames,
  parseSource,
  serializeSource,
  supportedEvents,
  validateInstance,
  createRuntime,
  type ComponentNode,
  type ComponentInstance,
  type ComponentEventName,
  type EventReport,
  type JsonValue,
} from '@lingui/renderer'
import { sanitizeDiagnostic } from '../component-studio/debug-records'
import { cloneJson } from '../shared/clone'

export const recordingSchema = 'lingui.interaction-recording/1' as const
export interface RecordingStep {
  id: string
  nodeId: string
  component: string
  event: ComponentEventName
  data: JsonValue
  supported: boolean
}
export interface InteractionRecording {
  schemaVersion: typeof recordingSchema
  id: string
  name: string
  createdAt: string
  snapshot: ComponentInstance
  steps: RecordingStep[]
}
export interface RecordingIssue {
  stepId: string
  message: string
}
export function privateRecordingInput(node: ComponentNode | undefined): boolean {
  return (
    !!node &&
    (node.component === 'LingUI.PasswordInput' ||
      node.variant === 'obscured' ||
      /password|secret|token|authorization|credential|apikey/i.test(
        JSON.stringify([node.id, node.label, node.value]),
      ))
  )
}
function recordingSnapshot(instance: ComponentInstance): ComponentInstance {
  const raw = cloneJson(instance),
    nodes = parseSource(raw.document.source)
  const state = createRuntime(raw.document.state)
  for (const node of nodes.filter(privateRecordingInput)) {
    if (node.value && typeof node.value === 'object') {
      if (!('path' in node.value)) throw new Error('密码输入使用动态计算，无法安全保存录制快照')
      state.set(node.value, '')
      for (const parameter of raw.document.parameters.filter(
        (item) => item.path === (node.value as { path: string }).path,
      )) {
        const value = parameter.type === 'string' ? '' : parameter.type === 'number' ? 0 : false
        parameter.default = value
        raw.parameters[parameter.key] = value
      }
    } else if (node.value !== undefined) node.value = ''
  }
  raw.document.state = state.state
  raw.document.source = serializeSource(nodes.map((node) => sanitizeDiagnostic(node)))
  const snapshot = validateInstance(sanitizeDiagnostic(raw))
  delete snapshot.templateId
  delete snapshot.templateVersion
  return snapshot
}
const inputComponents = new Set([
  'TextField',
  'Slider',
  'CheckBox',
  'ChoicePicker',
  'LingUI.NumberInput',
  'LingUI.SearchInput',
  'LingUI.Textarea',
  'LingUI.Select',
  'LingUI.RadioGroup',
  'LingUI.Switch',
  'LingUI.Rating',
  'LingUI.Segmented',
  'LingUI.ColorPicker',
  'LingUI.DatePicker',
  'LingUI.TimePicker',
])
export function canReplay(step: Pick<RecordingStep, 'component' | 'event'>) {
  return (
    step.event === 'mount' ||
    (step.component === 'Button' && step.event === 'click') ||
    (inputComponents.has(step.component) &&
      ['input', 'change', 'select', 'clear', 'enter', 'search'].includes(step.event))
  )
}
/** Only event inputs are retained. Request responses, diffs and diagnostics never enter recordings. */
export function stepFromReport(report: EventReport): RecordingStep | undefined {
  if (report.scope && report.scope !== 'event') return
  if (!['start', 'success'].includes(report.phase)) return
  const supported = canReplay(report)
  return {
    id: `step-${crypto.randomUUID()}`,
    nodeId: report.nodeId,
    component: report.component,
    event: report.event,
    supported,
    data: supported ? JSON.parse(JSON.stringify(sanitizeDiagnostic(report.data ?? null))) : null,
  }
}
export function createRecording(
  instance: ComponentInstance,
  name = '未命名演示',
  steps: RecordingStep[] = [],
): InteractionRecording {
  // Redact credentials already present in document defaults as well as typed event inputs.
  const snapshot = recordingSnapshot(instance)
  return {
    schemaVersion: recordingSchema,
    id: `recording-${crypto.randomUUID()}`,
    name: name.trim().slice(0, 120) || '未命名演示',
    createdAt: new Date().toISOString(),
    snapshot,
    steps: steps.slice(0, 100),
  }
}
export function validateRecording(value: unknown): InteractionRecording {
  if (!value || typeof value !== 'object') throw new Error('交互录制格式无效')
  const source = value as InteractionRecording
  if (
    source.schemaVersion !== recordingSchema ||
    !/^recording-[\w-]+$/.test(source.id) ||
    typeof source.name !== 'string' ||
    !source.name.trim() ||
    source.name.length > 120 ||
    !Array.isArray(source.steps) ||
    source.steps.length > 100 ||
    Number.isNaN(Date.parse(source.createdAt))
  )
    throw new Error('交互录制格式无效')
  const snapshot = recordingSnapshot(validateInstance(source.snapshot))
  const ids = new Set<string>()
  const steps = source.steps.map((step) => {
    if (
      !step ||
      typeof step.id !== 'string' ||
      ids.has(step.id) ||
      typeof step.nodeId !== 'string' ||
      typeof step.component !== 'string' ||
      !eventNames.includes(step.event) ||
      typeof step.supported !== 'boolean'
    )
      throw new Error('交互录制步骤无效')
    ids.add(step.id)
    const safe = stepFromReport({ ...step, phase: 'start' })!
    return { ...safe, id: step.id, supported: safe.supported && step.supported }
  })
  if (JSON.stringify(steps).length > 65536) throw new Error('录制输入超过 64 KiB')
  return {
    schemaVersion: recordingSchema,
    id: source.id,
    name: source.name,
    createdAt: source.createdAt,
    snapshot,
    steps,
  }
}
export function recordingIssues(
  recording: InteractionRecording,
  instance: ComponentInstance,
): RecordingIssue[] {
  const nodes = new Map(parseSource(instance.document.source).map((node) => [node.id, node]))
  return recording.steps.flatMap((step) => {
    const node = nodes.get(step.nodeId)
    const message = !node
      ? `组件 ${step.nodeId} 已不存在`
      : node.component !== step.component
        ? `组件 ${step.nodeId} 的类型已改变`
        : privateRecordingInput(node)
          ? '密码或凭据输入不支持回放'
          : !supportedEvents(node.component).includes(step.event)
            ? `组件 ${step.nodeId} 已不支持 ${step.event}`
            : step.event === 'mount' && !node.events?.mount
              ? `组件 ${step.nodeId} 的自动执行事件已移除`
              : !step.supported || !canReplay(step)
                ? '此操作暂不能准确回放；密码、文件及宿主操作不会记录输入'
                : ''
    return message ? [{ stepId: step.id, message }] : []
  })
}
