import { computed, shallowRef } from 'vue'
import {
  createDemoRequests,
  type EventReport,
  type InteractionHost,
  type JsonValue,
} from '@lingui/renderer'
import { sanitizeDebugReport, type DebugReport } from './debug-records'
import { createScenarioRequests } from '../integrations/scenarios/transport'
import type { ApiScenario } from '../integrations/scenarios/model'
export function useEventDebug(
  rules: () => Record<string, ApiScenario> = () => ({}),
  observe: (report: EventReport) => void = () => {},
) {
  const reports = shallowRef<DebugReport[]>([])
  let serial = 0
  const demoRequests = shallowRef(createDemoRequests({ allowReal: () => true }))
  const record = (report: EventReport) => {
    reports.value = [
      ...reports.value,
      {
        ...sanitizeDebugReport(report),
        id: ++serial,
        time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
      },
    ].slice(-300)
  }
  const interactions = computed<InteractionHost>(() => {
    const base = demoRequests.value
    const requests = createScenarioRequests(base, rules())
    const report = (value: EventReport) => {
      if (base === demoRequests.value) {
        try {
          observe(value)
        } finally {
          record(value)
        }
      }
    }
    return {
      trace: true,
      inheritRegistered: false,
      requests,
      callbacks: {
        'lingui.log': (args) => args,
        'lingui.notify': (args, context) => {
          const { nodeId, component, event, data, runId } = context
          report({
            nodeId,
            component,
            event,
            data,
            ...(runId ? { runId } : {}),
            phase: 'emit',
            name: 'lingui.notify',
            result: args as JsonValue,
          })
          return args
        },
      },
      onEvent: report,
    }
  })
  return {
    reports,
    interactions,
    resetDemo: () => {
      demoRequests.value = createDemoRequests({ allowReal: () => true })
    },
    clear: () => {
      reports.value = []
    },
  }
}
export type EventDebugController = ReturnType<typeof useEventDebug>
