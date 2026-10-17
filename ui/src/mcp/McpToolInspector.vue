<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { VButton } from '@halo-dev/components'
import { mcpError, type McpClient, type McpTool } from './client'
import LinguiIcon from '../shared/LinguiIcon.vue'

const props = defineProps<{ tools: McpTool[]; version: string; client: McpClient }>()
const selected = ref('')
const args = ref('')
const result = ref('')
const error = ref('')
const busy = ref(false)
let controller: AbortController | undefined
const tool = computed(() => props.tools.find((entry) => entry.name === selected.value))
const examples: Record<string, object> = {
  search_components: { query: '按钮', limit: 5 },
  get_component_schemas: { names: ['Text', 'Button'] },
  get_current_work: { workName: '请替换为项目资源名称' },
  get_guidance: { topic: 'interactions' },
  validate_design: {
    design: {
      schemaVersion: 'lingui.document/2',
      title: '问候',
      parameters: [],
      source: 'root = Text({"id":"root","text":"你好"}, [])',
      state: {},
    },
  },
}
watch(
  () => props.tools,
  (tools) => {
    selected.value = tools[0]?.name ?? ''
  },
  { immediate: true },
)
watch(
  selected,
  (name) => {
    controller?.abort()
    busy.value = false
    result.value = ''
    error.value = ''
    args.value = JSON.stringify(examples[name] ?? {}, null, 2)
  },
  { immediate: true },
)
async function run() {
  if (busy.value || !tool.value) return
  error.value = ''
  result.value = ''
  let input: Record<string, unknown>
  try {
    if (args.value.length > 262144) throw new Error('参数不能超过 256 KiB')
    input = JSON.parse(args.value)
    if (!input || Array.isArray(input) || typeof input !== 'object')
      throw new Error('参数必须是 JSON 对象')
  } catch (cause) {
    error.value =
      cause instanceof SyntaxError ? 'JSON 格式不正确，请检查引号和逗号。' : mcpError(cause)
    return
  }
  busy.value = true
  controller = new AbortController()
  const signal = controller.signal
  try {
    const response = await props.client.call(selected.value, input, props.version, signal)
    if (signal.aborted) return
    result.value =
      response.structuredContent !== undefined
        ? JSON.stringify(response.structuredContent, null, 2)
        : response.content
            .filter((item) => item.type === 'text')
            .map((item) => item.text)
            .join('\n')
    if (response.isError) error.value = '工具未完成请求，请根据返回结果调整参数。'
  } catch (cause) {
    if (!signal.aborted) error.value = mcpError(cause)
  } finally {
    if (!signal.aborted) busy.value = false
  }
}
onBeforeUnmount(() => controller?.abort())
</script>
<template>
  <section class="lu-mcp-tools" aria-labelledby="mcp-tools-title">
    <div class="lu-mcp-section-heading">
      <div>
        <h2 id="mcp-tools-title">
          可用工具 <span>{{ tools.length }}</span>
        </h2>
        <p class="lu-muted">来自服务实时返回的工具清单，可直接检查参数和试运行。</p>
      </div>
      <span class="lu-mcp-readonly"><LinguiIcon name="check" />只读工具</span>
    </div>
    <div class="lu-mcp-tool-layout">
      <div class="lu-mcp-tool-list" aria-label="选择 MCP 工具">
        <button
          v-for="entry in tools"
          :key="entry.name"
          type="button"
          :aria-pressed="selected === entry.name"
          :class="{ active: selected === entry.name }"
          @click="selected = entry.name"
        >
          <strong>{{ entry.name }}</strong
          ><span>{{ entry.description }}</span
          ><LinguiIcon name="arrow" />
        </button>
      </div>
      <div v-if="tool" class="lu-mcp-tool-detail">
        <h3>{{ tool.name }}</h3>
        <p class="lu-muted">{{ tool.description }}</p>
        <details class="lu-mcp-schema">
          <summary>查看参数 Schema</summary>
          <pre tabindex="0">{{ JSON.stringify(tool.inputSchema, null, 2) }}</pre>
        </details>
        <form @submit.prevent="run">
          <label class="lu-field"
            ><span>调用参数 · JSON</span
            ><textarea
              v-model="args"
              aria-label="MCP 工具调用参数"
              class="lu-code"
              rows="7"
              spellcheck="false"
              :disabled="busy"
            />
          </label>
          <p v-if="selected === 'get_current_work'" class="lu-mcp-hint">
            workName 是已保存项目的资源名称。外部 MCP 无法读取浏览器中尚未保存的编辑。
          </p>
          <div class="lu-mcp-run-actions">
            <VButton class="lu-button" :loading="busy" :disabled="busy" @click="run">{{
              busy ? '正在执行…' : '试运行工具'
            }}</VButton
            ><span class="lu-muted">不会保存项目或执行作品中的接口</span>
          </div>
        </form>
        <p v-if="error" class="lu-error" role="alert">{{ error }}</p>
        <div v-if="result" class="lu-mcp-result">
          <h3>返回结果</h3>
          <pre tabindex="0" aria-label="MCP 工具返回结果">{{ result }}</pre>
        </div>
      </div>
    </div>
  </section>
</template>
