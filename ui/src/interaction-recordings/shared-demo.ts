import { assertSafeJson, type ComponentInstance, type JsonValue } from '@lingui/renderer'
import { recordingIssues, canReplay, type InteractionRecording, type RecordingStep } from './model'
import { sanitizeDiagnostic } from '../component-studio/debug-records'
export interface SharedDemo {
  schemaVersion: 'lingui.demo/1'
  name: string
  steps: RecordingStep[]
}
export function validateSharedDemos(value: unknown, instance: ComponentInstance): SharedDemo[] {
  if (!Array.isArray(value) || value.length > 3) throw new Error('最多分享 3 条演示')
  return value.map((raw) => {
    if (
      !raw ||
      typeof raw !== 'object' ||
      raw.schemaVersion !== 'lingui.demo/1' ||
      typeof raw.name !== 'string' ||
      !raw.name.trim() ||
      raw.name.length > 120 ||
      !Array.isArray(raw.steps) ||
      !raw.steps.length ||
      raw.steps.length > 40 ||
      Object.keys(raw).some((key) => !['schemaVersion', 'name', 'steps'].includes(key))
    )
      throw new Error('公开演示格式无效')
    const ids = new Set<string>()
    const steps: RecordingStep[] = raw.steps.map((item: RecordingStep) => {
      if (
        !item ||
        !canReplay(item) ||
        !item.supported ||
        typeof item.id !== 'string' ||
        typeof item.nodeId !== 'string' ||
        ids.has(item.id)
      )
        throw new Error('公开演示包含不可回放的步骤')
      ids.add(item.id)
      const input = item.data
      assertSafeJson(input)
      if (
        input !== null &&
        (typeof input !== 'object' ||
          Array.isArray(input) ||
          Object.keys(input).some((key) => !['value', 'text', 'key'].includes(key)))
      )
        throw new Error('公开演示只能包含输入值、文本与按键')
      if (
        JSON.stringify(sanitizeDiagnostic(input)) !== JSON.stringify(input) ||
        /lgu_mcp_|Bearer\s|-----BEGIN|\[已隐藏/i.test(JSON.stringify(input))
      )
        throw new Error('演示包含敏感或已脱敏输入，请使用演示数据重新整理')
      return {
        id: item.id,
        nodeId: item.nodeId,
        component: item.component,
        event: item.event,
        supported: true,
        data: JSON.parse(JSON.stringify(input ?? null)) as JsonValue,
      }
    })
    if (JSON.stringify(steps).length > 16000) throw new Error('公开演示输入过长')
    const demo: SharedDemo = { schemaVersion: 'lingui.demo/1', name: raw.name, steps }
    const recording: InteractionRecording = {
      schemaVersion: 'lingui.interaction-recording/1',
      id: 'recording-shared',
      name: demo.name,
      createdAt: new Date().toISOString(),
      snapshot: instance,
      steps,
    }
    if (recordingIssues(recording, instance).length) throw new Error('演示步骤与当前投稿快照不匹配')
    return demo
  })
}
export function shareRecording(
  recording: InteractionRecording,
  instance: ComponentInstance,
): SharedDemo {
  return validateSharedDemos(
    [
      {
        schemaVersion: 'lingui.demo/1',
        name: recording.name,
        steps: recording.steps.map((step) => ({
          ...step,
          data:
            step.data && typeof step.data === 'object' && !Array.isArray(step.data)
              ? Object.fromEntries(
                  Object.entries(step.data).filter(([key]) =>
                    ['value', 'text', 'key'].includes(key),
                  ),
                )
              : step.data,
        })),
      },
    ],
    instance,
  )[0]!
}
export function sharedRecording(
  demo: SharedDemo,
  instance: ComponentInstance,
): InteractionRecording {
  return {
    schemaVersion: 'lingui.interaction-recording/1',
    id: 'recording-shared',
    createdAt: new Date().toISOString(),
    name: demo.name,
    snapshot: instance,
    steps: demo.steps,
  }
}
