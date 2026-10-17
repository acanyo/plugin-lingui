<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import LinguiIcon from '../../shared/LinguiIcon.vue'
import { durationLabel, type GenerationTrace } from './types'

const props = defineProps<{ trace: GenerationTrace; pending: boolean }>()
const expanded = ref(false)
const timeline = ref<HTMLOListElement>()
const elapsed = ref(props.trace.elapsedMs)
let timer: ReturnType<typeof setInterval> | undefined
watch(
  () => [props.trace.elapsedMs, props.pending] as const,
  ([ms, pending]) => {
    clearInterval(timer)
    elapsed.value = ms
    if (pending) {
      const now = Date.now()
      timer = setInterval(() => {
        elapsed.value = ms + Date.now() - now
      }, 1000)
    }
  },
  { immediate: true },
)
onBeforeUnmount(() => clearInterval(timer))
const current = computed(() =>
  [...props.trace.activities].reverse().find((item) => item.state === 'running'),
)
const latest = computed(() => props.trace.activities.at(-1))
const label = computed(() =>
  props.pending
    ? (current.value?.label ?? latest.value?.label ?? '正在连接 AI 基座')
    : props.trace.outcome === 'done'
      ? '生成完成'
      : props.trace.outcome === 'stopped'
        ? '已停止生成'
        : '生成未完成',
)
const visible = computed(() =>
  expanded.value ? props.trace.activities : props.trace.activities.slice(-3),
)
watch(
  [() => props.trace, expanded],
  async () => {
    const list = timeline.value
    const follow =
      props.pending && (!list || list.scrollHeight - list.scrollTop - list.clientHeight < 48)
    await nextTick()
    if (follow && timeline.value) timeline.value.scrollTop = timeline.value.scrollHeight
  },
  { deep: true },
)
</script>
<template>
  <div class="lu-generation-progress" :class="{ 'is-pending': pending }" aria-label="AI 执行进度">
    <div class="lu-generation-heading">
      <span class="lu-generation-indicator" :class="{ 'is-running': pending }"
        ><LinguiIcon :name="pending ? 'sparkles' : trace.outcome === 'done' ? 'check' : 'info'"
      /></span>
      <strong role="status">{{ label }}</strong>
      <span class="lu-generation-elapsed" aria-live="off">{{ durationLabel(elapsed) }}</span>
    </div>
    <button
      type="button"
      class="lu-generation-toggle"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    >
      <LinguiIcon name="chevronDown" /><span>{{
        expanded ? '收起执行过程' : `查看执行过程 · ${trace.activities.length} 个步骤`
      }}</span>
    </button>
    <ol
      v-if="expanded || pending"
      ref="timeline"
      class="lu-generation-timeline"
      aria-label="执行步骤"
    >
      <li v-if="!expanded && trace.activities.length > 3" class="lu-generation-earlier">
        此前还有 {{ trace.activities.length - 3 }} 个步骤
      </li>
      <li v-for="activity in visible" :key="activity.id" :class="`is-${activity.state}`">
        <span class="lu-generation-step-icon"
          ><LinguiIcon
            :name="
              activity.state === 'done'
                ? 'check'
                : activity.state === 'warning' || activity.state === 'error'
                  ? 'warning'
                  : 'clock'
            "
        /></span>
        <span>{{ activity.label }}</span
        ><time aria-live="off" title="此步骤耗时">{{
          durationLabel(Math.max(0, (activity.endedMs ?? elapsed) - activity.startedMs))
        }}</time>
      </li>
    </ol>
    <p v-if="pending && current?.id.includes('model-')" class="lu-generation-wait">
      正在等待模型返回，工具执行后会继续更新进度。
    </p>
  </div>
</template>
