<script setup lang="ts">
import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import type { ComponentInstance } from '@lingui/renderer'
import { useRepository } from '../services/repository'
import { useStudioAccess } from '../services/studio-access'
import { downloadJson } from '../shared/download'
import { runInteractionCheck, checkFingerprint } from './run'
import { checkSummary, repairInstruction } from './repair'
import { scenarioLabels, type ApiScenario } from '../integrations/scenarios/model'
import type { InteractionCheck, CheckedDesign, InteractionCase } from './types'
const checkScenarioLabels: Record<InteractionCase['scenario'], string> = {
  ...scenarioLabels,
  initial: '初始状态',
  local: '本地交互',
  missing: '缺少字段',
  partial: '部分字段为空',
  null: 'null 响应',
  recovery: '失败后重试',
}
const props = defineProps<{
  instance: ComponentInstance
  rules: Record<string, ApiScenario>
  automaticCheck?: CheckedDesign
  blocked: boolean
}>()
const emit = defineEmits<{ repair: [instruction: string] }>()
const repository = useRepository(),
  access = useStudioAccess()
const report = shallowRef<InteractionCheck>(),
  running = ref(false),
  reportFingerprint = ref(''),
  error = ref(''),
  failuresOnly = ref(false)
let controller: AbortController | undefined
const fingerprint = computed(
  () => `${checkFingerprint(props.instance)}\n${JSON.stringify(props.rules)}`,
)
const stale = computed(() => !!report.value && reportFingerprint.value !== fingerprint.value)
watch(fingerprint, () => {
  controller?.abort()
})
watch(
  [fingerprint, () => props.automaticCheck],
  () => {
    if (props.automaticCheck && `${props.automaticCheck.fingerprint}\n{}` === fingerprint.value) {
      report.value = props.automaticCheck.report
      reportFingerprint.value = fingerprint.value
    }
  },
  { immediate: true },
)
onScopeDispose(() => controller?.abort())
const repairReason = computed(() =>
  props.blocked
    ? '请先等待 AI 完成或处理当前修改冲突。'
    : stale.value
      ? '作品或模拟响应已变化，请重新自检。'
      : repository.mode !== 'halo'
        ? '需要在 Halo 工作台中使用 AI 修复；可复制诊断交给外部 AI。'
        : !access.allows('ai:generate')
          ? '需要 AI 生成权限。'
          : !report.value?.cases.some((row) => row.status === 'failed')
            ? '当前没有自检失败项。'
            : '',
)
const rows = computed(
  () =>
    report.value?.cases.filter(
      (row) => !failuresOnly.value || row.status !== 'passed' || row.issues.length,
    ) ?? [],
)
const resultLabel = computed(() => {
  if (running.value) return '正在检查'
  if (stale.value) return '需要重新检查'
  if (!report.value) return '尚未检查'
  const failed = report.value.cases.filter((row) => row.status === 'failed').length
  const skipped = report.value.cases.filter((row) => row.status === 'skipped').length
  return failed
    ? `${failed} 项失败`
    : skipped
      ? `${skipped} 项未验证`
      : `${report.value.cases.length} 项通过`
})
async function run() {
  if (running.value || props.blocked) return
  const own = new AbortController()
  controller = own
  running.value = true
  error.value = ''
  const source = fingerprint.value
  try {
    const result = await runInteractionCheck(props.instance, {
      signal: own.signal,
      rules: props.rules,
    })
    if (!own.signal.aborted && source === fingerprint.value) {
      report.value = result
      reportFingerprint.value = source
    }
  } catch (cause) {
    if (!own.signal.aborted) error.value = cause instanceof Error ? cause.message : '自检失败'
  } finally {
    if (controller === own) {
      running.value = false
      controller = undefined
    }
  }
}
function repair() {
  if (!report.value || running.value || repairReason.value) return
  emit('repair', repairInstruction(report.value))
}
async function copy() {
  if (!report.value) return
  try {
    await navigator.clipboard.writeText(repairInstruction(report.value))
    error.value = '诊断已复制。'
  } catch {
    error.value = '复制失败，可导出检查报告后交给外部 AI。'
  }
}
</script>
<template>
  <details class="lu-interaction-check">
    <summary>
      <strong>交互自检</strong><span>{{ resultLabel }}</span>
    </summary>
    <p class="lu-muted">
      用独立状态运行输入、选择与事件动作，检查成功、空数据、缺少字段、null
      与失败重试。不发送真实请求；视觉效果、完整业务流程和宿主 JS 回调请在预览或目标页面验证。
    </p>
    <div class="lu-lab-actions">
      <button
        type="button"
        class="lu-button"
        :disabled="running || blocked"
        :title="blocked ? '请先完成 AI 创作或处理修改冲突' : undefined"
        @click="run"
      >
        {{ running ? '检查中…' : report ? '重新自检' : '运行交互自检' }}
      </button>
      <button v-if="running" type="button" class="lu-text-button" @click="controller?.abort()">
        停止检查
      </button>
      <button
        v-if="report"
        type="button"
        class="lu-button"
        :disabled="!!repairReason || running"
        :title="repairReason || undefined"
        @click="repair"
      >
        交给 AI 修复
      </button>
    </div>
    <p v-if="error" class="lu-muted" role="status">{{ error }}</p>
    <template v-if="report">
      <p class="lu-check-summary" role="status">
        {{
          stale ? '结果已过期。作品或模拟响应有更新，请重新自检后再修复。' : checkSummary(report)
        }}
      </p>
      <p
        v-if="repairReason && report.cases.some((row) => row.status === 'failed')"
        class="lu-muted"
      >
        {{ repairReason }}
      </p>
      <div class="lu-lab-actions">
        <label class="lu-checkbox"
          ><input v-model="failuresOnly" type="checkbox" />只看问题与未验证项</label
        ><button type="button" class="lu-text-button" @click="copy">复制修复诊断</button
        ><button
          type="button"
          class="lu-text-button"
          @click="downloadJson('lingui-interaction-check', report)"
        >
          导出报告
        </button>
      </div>
      <ul class="lu-check-cases">
        <li v-for="row in rows" :key="row.id" :class="`is-${row.status}`">
          <details>
            <summary>
              <span class="lu-check-status">{{
                row.status === 'passed' ? '通过' : row.status === 'failed' ? '失败' : '未验证'
              }}</span
              ><code>{{ row.nodeId }}</code
              ><span
                >{{ row.label
                }}{{
                  row.scenario === 'initial' || row.scenario === 'local'
                    ? ''
                    : ` · ${checkScenarioLabels[row.scenario]}`
                }}</span
              >
            </summary>
            <p v-if="row.event">事件：{{ row.event }}</p>
            <p
              v-for="(issue, index) in row.issues"
              :key="index"
              :class="issue.level === 'error' ? 'lu-error' : 'lu-muted'"
            >
              <code>{{ issue.nodeId }}</code> · {{ issue.message }}
            </p>
            <p v-if="row.changedPaths.length" class="lu-muted">
              状态写入：{{ row.changedPaths.join('、') }}
            </p>
            <p v-if="row.input !== undefined" class="lu-muted">
              输入：{{ JSON.stringify(row.input) }}
            </p>
          </details>
        </li>
      </ul>
    </template>
  </details>
</template>
