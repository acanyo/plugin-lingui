<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import {
  defaultScenario,
  scenarioLabels,
  validateScenario,
  type ApiScenario,
  type ApiTarget,
  type ScenarioMode,
} from './model'
const props = defineProps<{
  targets: ApiTarget[]
  rules: Record<string, ApiScenario>
  active: number
}>()
const emit = defineEmits<{ apply: [key: string, value: ApiScenario]; reset: [] }>()
const selected = ref(''),
  mode = ref<ScenarioMode>('real'),
  success = ref('{}'),
  empty = ref('{}'),
  status = ref(503),
  message = ref(''),
  delayMs = ref(2000),
  feedback = ref(''),
  error = ref('')
const target = computed(() => props.targets.find((item) => item.key === selected.value))
const current = computed(() =>
  target.value ? (props.rules[target.value.key] ?? defaultScenario(target.value)) : undefined,
)
watch(
  () => props.targets.map((item) => item.key).join('\n'),
  () => {
    if (!props.targets.some((item) => item.key === selected.value))
      selected.value = props.targets[0]?.key ?? ''
  },
  { immediate: true },
)
watch(
  current,
  (value) => {
    if (!value) return
    mode.value = value.mode
    success.value = JSON.stringify(value.success, null, 2)
    empty.value = JSON.stringify(value.empty, null, 2)
    status.value = value.status
    message.value = value.message
    delayMs.value = value.delayMs
    feedback.value = error.value = ''
  },
  { immediate: true },
)
watch([mode, success, empty, status, message, delayMs], () => {
  feedback.value = ''
  error.value = ''
})
async function apply() {
  if (!target.value) return
  try {
    const value = validateScenario({
      mode: mode.value,
      success: JSON.parse(success.value),
      empty: JSON.parse(empty.value),
      status: Number(status.value),
      message: message.value,
      delayMs: Number(delayMs.value),
    })
    emit('apply', target.value.key, value)
    await nextTick()
    error.value = ''
    feedback.value =
      mode.value === 'real'
        ? '已恢复原始接口。'
        : `已应用「${scenarioLabels[mode.value]}」，可在预览中触发请求。`
  } catch (cause) {
    feedback.value = ''
    error.value =
      cause instanceof SyntaxError
        ? '响应需要有效的 JSON，请检查引号和逗号。'
        : cause instanceof Error
          ? cause.message
          : '场景配置无效'
  }
}
</script>
<template>
  <details class="lu-api-scenarios">
    <summary>
      <strong>API 测试场景</strong
      ><span>{{ active ? `${active} 个接口正在模拟` : '使用原始接口' }}</span>
    </summary>
    <p class="lu-muted">
      场景仅用于当前预览；同一方法、域名和路径的请求共用场景，查询参数可以不同。模拟数据不会写入作品。
    </p>
    <p v-if="!targets.length" class="lu-muted">
      添加 API 配置或请求动作后，即可测试成功、空数据、失败和慢响应。
    </p>
    <form v-else class="lu-scenario-form" @submit.prevent="apply">
      <label class="lu-field"
        ><span>测试接口</span
        ><select v-model="selected" aria-label="测试接口">
          <option v-for="item in targets" :key="item.key" :value="item.key">
            {{ item.label }} · {{ item.method }}
          </option>
        </select></label
      >
      <code v-if="target" class="lu-scenario-url">{{ target.method }} {{ target.url }}</code>
      <label class="lu-field"
        ><span>响应场景</span
        ><select v-model="mode" aria-label="响应场景">
          <option v-for="(label, value) in scenarioLabels" :key="value" :value="value">
            {{ label }}
          </option>
        </select></label
      >
      <p v-if="mode === 'real'" class="lu-muted">
        恢复该接口原有行为；作品里的内置演示地址仍使用演示数据。
      </p>
      <template v-else>
        <label v-if="mode === 'success' || mode === 'slow'" class="lu-field"
          ><span>成功响应（JSON）</span
          ><textarea
            v-model="success"
            aria-label="成功响应 JSON"
            class="lu-code"
            rows="6"
            spellcheck="false"
          />
        </label>
        <label v-if="mode === 'empty'" class="lu-field"
          ><span>空数据响应（JSON）</span
          ><textarea
            v-model="empty"
            aria-label="空数据响应 JSON"
            class="lu-code"
            rows="6"
            spellcheck="false"
          />
        </label>
        <template v-if="mode === 'failure'">
          <label class="lu-field"
            ><span>HTTP 状态码</span
            ><input
              v-model.number="status"
              aria-label="模拟 HTTP 状态码"
              type="number"
              min="400"
              max="599"
              required
          /></label>
          <label class="lu-field"
            ><span>错误说明</span
            ><input v-model="message" aria-label="模拟错误说明" maxlength="500"
          /></label>
        </template>
        <label v-if="mode === 'slow'" class="lu-field"
          ><span>延迟（毫秒）</span
          ><input
            v-model.number="delayMs"
            aria-label="模拟延迟毫秒"
            type="number"
            min="0"
            max="60000"
            required
          /><small>超过动作配置的超时时间会触发超时错误，可检查 loading 和重试。</small></label
        >
      </template>
      <p v-if="error" class="lu-error" role="alert">{{ error }}</p>
      <p v-if="feedback" class="lu-muted" role="status">{{ feedback }}</p>
      <div class="lu-lab-actions">
        <button type="submit" class="lu-button">应用场景并重置预览</button
        ><button v-if="active" type="button" class="lu-text-button" @click="emit('reset')">
          全部恢复原始接口
        </button>
      </div>
    </form>
  </details>
</template>
