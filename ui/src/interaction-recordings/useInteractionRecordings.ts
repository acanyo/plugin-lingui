import { onBeforeUnmount, ref, shallowRef } from 'vue'
import { parseSource, type ComponentInstance, type EventReport } from '@lingui/renderer'
import { cloneJson } from '../shared/clone'
import {
  createRecording,
  stepFromReport,
  privateRecordingInput,
  type InteractionRecording,
} from './model'

export function useInteractionRecordings(options: {
  instance: () => ComponentInstance | undefined
  initial?: InteractionRecording[]
  reset?: () => void
  changed: (records: InteractionRecording[]) => void
}) {
  const records = shallowRef(cloneJson(options.initial ?? [])),
    recording = ref(false),
    count = ref(0),
    error = ref('')
  let pending: InteractionRecording | undefined
  const seen = new Set<string>()
  function start(name: string) {
    try {
      const instance = options.instance()
      if (!instance) return
      pending = createRecording(instance, name)
      seen.clear()
      count.value = 0
      error.value = ''
      options.reset?.()
      recording.value = true
    } catch {
      error.value = '作品快照包含无法脱敏的配置，请移除敏感默认值后再录制'
    }
  }
  function observe(report: EventReport) {
    if (!recording.value || !pending) return
    const key = report.runId
    if (key && seen.has(key)) return
    const step = stepFromReport(report)
    if (!step) return
    if (key) seen.add(key)
    const node = parseSource(pending.snapshot.document.source).find(
      (node) => node.id === step.nodeId,
    )
    if (privateRecordingInput(node)) {
      step.supported = false
      step.data = null
    }
    pending.steps.push(step)
    count.value = pending.steps.length
    if (count.value >= 100) stop()
  }
  function stop() {
    recording.value = false
    if (pending?.steps.length) {
      records.value = [pending, ...records.value].slice(0, 12)
      options.changed(records.value)
    }
    pending = undefined
  }
  function remove(id: string) {
    records.value = records.value.filter((item) => item.id !== id)
    options.changed(records.value)
  }
  function rename(id: string, name: string) {
    if (!name.trim()) return
    records.value = records.value.map((item) =>
      item.id === id ? { ...item, name: name.trim().slice(0, 120) } : item,
    )
    options.changed(records.value)
  }
  onBeforeUnmount(stop)
  return { records, recording, count, error, start, stop, observe, remove, rename }
}
