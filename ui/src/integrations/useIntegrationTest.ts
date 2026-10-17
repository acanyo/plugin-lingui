import { computed, onScopeDispose, ref, watch } from 'vue'
import {
  createDemoRequests,
  createEventRuntime,
  createRuntime,
  validateIntegrations,
  type ApiDefinition,
  type JsonValue,
} from '@lingui/renderer'

/** A result belongs to one request configuration, including its parameter example. */
export function useIntegrationTest(options: {
  requestKey: () => string
  configuration: () => ApiDefinition
  onSample: (name: string, value: JsonValue) => void
}) {
  const testing = ref(false),
    result = ref(''),
    error = ref('')
  const canAdopt = computed(() => !testing.value && result.value !== '')
  const requests = createDemoRequests({ allowReal: () => true })
  let active: ReturnType<typeof createEventRuntime> | undefined
  let generation = 0

  function clear() {
    generation++
    active?.destroy()
    active = undefined
    testing.value = false
    result.value = ''
    error.value = ''
  }
  watch(options.requestKey, clear, { flush: 'sync' })
  onScopeDispose(clear)

  async function test() {
    if (testing.value) return
    clear()
    const current = generation
    testing.value = true
    let events: ReturnType<typeof createEventRuntime> | undefined
    try {
      const api = options.configuration()
      validateIntegrations({ apis: [api], callbacks: [] })
      events = createEventRuntime(
        createRuntime({}),
        {
          inheritRegistered: false,
          apis: { [api.name]: api },
          requests,
          onEvent(report) {
            if (current !== generation) return
            if (report.phase === 'success' && report.result !== undefined) {
              result.value = JSON.stringify(report.result, null, 2)
              options.onSample(api.name, report.result)
            }
            if (report.phase === 'error') error.value = report.error ?? '请求失败'
          },
        },
        (cause) => {
          if (current === generation)
            error.value = cause instanceof Error ? cause.message : '请求失败'
        },
      )
      active = events
      await events.fire(
        {
          id: 'api-test',
          component: 'Button',
          child: 'label',
          events: {
            click: {
              actions: [
                {
                  type: 'api',
                  name: api.name,
                  args: api.inputExample === undefined ? {} : api.inputExample,
                },
              ],
            },
          },
        },
        'click',
        null,
      )
    } catch (cause) {
      if (current === generation) error.value = cause instanceof Error ? cause.message : '测试失败'
    } finally {
      events?.destroy()
      if (current === generation) {
        active = undefined
        testing.value = false
      }
    }
  }
  return { testing, result, error, canAdopt, test, clear }
}
