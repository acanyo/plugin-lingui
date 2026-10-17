import { onBeforeUnmount, ref, shallowRef } from 'vue'
import { createMcpClient, mcpError, type McpClient, type McpServer, type McpTool } from './client'

export function useMcpManager(client: McpClient = createMcpClient()) {
  const state = ref<'idle' | 'connecting' | 'ready' | 'error'>('idle')
  const error = ref('')
  const server = shallowRef<McpServer>()
  const tools = shallowRef<McpTool[]>([])
  const skill = ref('')
  const checkedAt = ref('')
  const elapsed = ref(0)
  let controller: AbortController | undefined

  async function connect() {
    if (state.value === 'connecting') return
    controller?.abort()
    controller = new AbortController()
    const signal = controller.signal
    state.value = 'connecting'
    error.value = ''
    server.value = undefined
    tools.value = []
    skill.value = ''
    const started = performance.now()
    try {
      const info = await client.initialize(signal)
      const inspection = await client.inspect(info.protocolVersion, signal)
      if (signal.aborted) return
      server.value = info
      tools.value = inspection.tools
      skill.value = inspection.skill
      elapsed.value = Math.round(performance.now() - started)
      checkedAt.value = new Date().toLocaleTimeString('zh-CN', { hour12: false })
      state.value = 'ready'
    } catch (cause) {
      if (signal.aborted) return
      error.value = mcpError(cause)
      state.value = 'error'
    }
  }
  onBeforeUnmount(() => controller?.abort())
  return { state, error, server, tools, skill, checkedAt, elapsed, connect }
}
