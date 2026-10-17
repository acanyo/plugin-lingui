<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import type { ComponentInstance } from '@lingui/renderer'
import LinguiRenderer from '../shared/LinguiRenderer.vue'
import type { ApiScenario } from '../integrations/scenarios/model'
import { recordingIssues, type InteractionRecording } from './model'
import { createReplay } from './replay'
const props = defineProps<{
  recording: InteractionRecording
  current?: ComponentInstance
  rules?: Record<string, ApiScenario>
}>()
const mode = ref<'snapshot' | 'current'>('snapshot'),
  playing = ref(false),
  executing = ref(false),
  cursor = ref(-1),
  error = ref('')
const view = shallowRef<ComponentInstance>(),
  preview = ref<InstanceType<typeof LinguiRenderer>>()
const issues = computed(() =>
  recordingIssues(
    props.recording,
    mode.value === 'current' && props.current ? props.current : props.recording.snapshot,
  ),
)
const isolated = { inheritRegistered: false, requests: { allow: () => false } }
let replay: ReturnType<typeof createReplay> | undefined,
  epoch = 0
function reset() {
  epoch++
  playing.value = false
  executing.value = false
  cursor.value = -1
  error.value = ''
  replay?.destroy()
  replay = createReplay(
    mode.value === 'current' && props.current ? props.current : props.recording.snapshot,
    props.rules,
  )
  view.value = replay.view()
}
function stop() {
  epoch++
  playing.value = false
  executing.value = false
  replay?.destroy()
  replay = undefined
}
async function step() {
  if (executing.value || cursor.value >= props.recording.steps.length - 1) return false
  if (!replay) reset()
  const token = epoch,
    engine = replay!,
    index = cursor.value + 1,
    item = props.recording.steps[index]!
  executing.value = true
  error.value = ''
  try {
    await engine.step(item)
    if (token !== epoch) return false
    cursor.value = index
    view.value = engine.view()
    await nextTick()
    preview.value?.locateNode(item.nodeId)
    return true
  } catch (cause) {
    if (token === epoch) {
      error.value = cause instanceof Error ? cause.message : '回放失败'
      view.value = engine.view()
      await nextTick()
      preview.value?.locateNode(item.nodeId)
      playing.value = false
    }
    return false
  } finally {
    if (token === epoch) executing.value = false
  }
}
async function play() {
  if (playing.value || executing.value) return
  if (!replay || cursor.value === props.recording.steps.length - 1) reset()
  playing.value = true
  const token = epoch
  while (playing.value && token === epoch && cursor.value < props.recording.steps.length - 1) {
    if (!(await step())) break
    await new Promise((resolve) => setTimeout(resolve, 350))
  }
  if (token === epoch) playing.value = false
}
watch([() => props.recording, mode], reset, { immediate: true })
onBeforeUnmount(stop)
</script>
<template>
  <section class="lu-replay" aria-label="隔离回放">
    <label class="lu-field"
      ><span>回放来源</span
      ><select v-model="mode" :disabled="executing || playing">
        <option value="snapshot">录制时的原快照</option>
        <option v-if="current" value="current">检查当前作品</option>
      </select></label
    >
    <p class="lu-muted">
      独立状态 · 接口仅用示例/模拟场景 · JS
      回调返回模拟参数。暂停在当前步骤完成后生效；停止会立即取消执行。
    </p>
    <p v-if="issues.length" class="lu-error">
      {{ issues[0]?.message }}（{{ issues.length }} 个不可回放步骤）
    </p>
    <div class="lu-recording-actions">
      <button
        type="button"
        class="lu-button"
        :disabled="playing || executing || !!issues.length"
        @click="play"
      >
        {{ cursor === recording.steps.length - 1 ? '重新播放' : '播放 / 继续' }}
      </button>
      <button type="button" class="lu-button" :disabled="!playing" @click="playing = false">
        暂停
      </button>
      <button
        type="button"
        class="lu-button"
        :disabled="playing || executing || !!issues.length || cursor >= recording.steps.length - 1"
        @click="step"
      >
        单步
      </button>
      <button type="button" class="lu-button" @click="stop">停止</button>
      <button type="button" class="lu-button" @click="reset">重置</button>
    </div>
    <p role="status">
      已完成 {{ cursor + 1 }} / {{ recording.steps.length }} 步{{
        executing ? ' · 正在执行下一步' : ''
      }}
    </p>
    <p v-if="error" role="alert" class="lu-error">
      第 {{ cursor + 2 }} 步：{{ error }}。可单步重试，或更改测试场景后重置。
    </p>
    <ol class="lu-recording-steps">
      <li
        v-for="(item, index) in recording.steps"
        :key="item.id"
        :class="{ current: index === cursor || (!!error && index === cursor + 1) }"
      >
        <span>{{ index + 1 }} · {{ item.nodeId }} · {{ item.event }}</span
        ><small v-if="!item.supported">不支持回放</small
        ><button type="button" class="lu-text-button" @click="preview?.locateNode(item.nodeId)">
          定位
        </button>
      </li>
    </ol>
    <div class="lu-replay-preview" inert>
      <LinguiRenderer
        :auto-start="false"
        v-if="view"
        ref="preview"
        :instance="view"
        :interactions="isolated"
      />
    </div>
  </section>
</template>
