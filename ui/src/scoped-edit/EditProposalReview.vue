<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import type { ComponentInstance } from '@lingui/renderer'
import StudioModal from '../shared/StudioModal.vue'
import LinguiRenderer from '../shared/LinguiRenderer.vue'
import DraftChangeReview from '../revisions/DraftChangeReview.vue'
import { defaultDraftSelection, type DraftSelection } from '../revisions/design-changes'
import { runInteractionCheck, checkFingerprint } from '../interaction-check/run'
import { newCheckFailures } from '../interaction-check/regressions'
import type { CheckedDesign } from '../interaction-check/types'
import { cloneJson } from '../shared/clone'
import type { EditProposal } from './model'
import { scopedMerge, applyScopedSelection } from './merge'

const props = defineProps<{
  proposal: EditProposal
  current?: ComponentInstance
  blocked?: boolean
}>()
const emit = defineEmits<{
  close: []
  discard: []
  adopt: [result: ComponentInstance, source: ComponentInstance, check: CheckedDesign]
}>()
const selection = shallowRef<DraftSelection>({ fingerprint: '', keys: [] })
const error = ref(''),
  checking = ref(false)
const controller = new AbortController()
onBeforeUnmount(() => controller.abort())
const comparison = computed(() => {
  try {
    if (!props.current) throw new Error('当前作品已关闭，请返回创作重新选取。')
    return { merge: scopedMerge(props.proposal, props.current), problem: '' }
  } catch (cause) {
    return {
      problem: cause instanceof Error ? cause.message : '无法比较局部修改',
      merge: undefined,
    }
  }
})
watch(
  () => comparison.value.merge?.fingerprint,
  () => {
    const merge = comparison.value.merge
    selection.value = merge ? defaultDraftSelection(merge) : { fingerprint: '', keys: [] }
    error.value = ''
  },
  { immediate: true },
)
const preview = computed(() => {
  try {
    const merge = comparison.value.merge
    return merge
      ? { instance: applyScopedSelection(props.proposal, merge, selection.value), problem: '' }
      : undefined
  } catch (cause) {
    return { instance: undefined, problem: cause instanceof Error ? cause.message : '合并结果无效' }
  }
})
const interactions = { inheritRegistered: false, requests: { allow: () => false } }
const beforeView = ref<InstanceType<typeof LinguiRenderer>>()
const afterView = ref<InstanceType<typeof LinguiRenderer>>()
function locate(id: string) {
  beforeView.value?.locateNode(id)
  afterView.value?.locateNode(id)
}
async function adopt() {
  const merge = comparison.value.merge
  if (
    !merge ||
    !preview.value?.instance ||
    !selection.value.keys.length ||
    props.blocked ||
    checking.value
  )
    return
  const fingerprint = merge.fingerprint
  const result = cloneJson(preview.value.instance),
    source = cloneJson(merge.base)
  checking.value = true
  error.value = ''
  try {
    const baseline = await runInteractionCheck(source, { signal: controller.signal, maxCases: 80 })
    const report = await runInteractionCheck(result, { signal: controller.signal, maxCases: 80 })
    if (controller.signal.aborted) return
    if (comparison.value.merge?.fingerprint !== fingerprint || props.blocked)
      throw new Error('检查期间作品发生变化，请重新确认差异。')
    if (newCheckFailures(report, baseline).length)
      throw new Error(
        `合并后未通过交互检查，当前作品已保留。${report.issues.map((issue) => `${issue.nodeId}：${issue.message}`).join('；')}`,
      )
    emit('adopt', result, source, { report, fingerprint: checkFingerprint(result) })
  } catch (cause) {
    if (!controller.signal.aborted)
      error.value = cause instanceof Error ? cause.message : '无法采用局部修改'
  } finally {
    checking.value = false
  }
}
</script>
<template>
  <StudioModal title="比较局部修改" :width="1120" @close="emit('close')">
    <section class="lingui-studio lu-scoped-review">
      <p class="lu-muted">
        目标 {{ proposal.target.nodeId }} ·
        {{
          proposal.target.scope === 'subtree' ? '包含子组件' : '仅此组件'
        }}。采用后可撤销，项目需主动保存。这里的预览不会调用业务接口或宿主回调。
      </p>
      <p v-if="comparison.problem" role="alert" class="lu-scoped-warning">
        {{ comparison.problem }}
      </p>
      <template v-if="comparison.merge">
        <p
          v-if="comparison.merge.changes.some((change) => change.conflict)"
          class="lu-scoped-warning"
          role="status"
        >
          生成后有手动修改。同一属性的冲突默认保留当前值，请逐项确认。
        </p>
        <DraftChangeReview
          :merge="comparison.merge"
          :selection="selection"
          :disabled="checking || blocked"
          appearance-only
          @update="selection = $event"
          @locate="locate"
        />
        <p v-if="preview?.problem" role="alert" class="lu-scoped-warning">{{ preview.problem }}</p>
        <div class="lu-revision-previews">
          <div>
            <h4>当前作品</h4>
            <LinguiRenderer
              :auto-start="false"
              v-if="current"
              ref="beforeView"
              :instance="current"
              :interactions="interactions"
              :selected-node="proposal.target.nodeId"
            />
          </div>
          <div>
            <h4>采用勾选项后</h4>
            <LinguiRenderer
              :auto-start="false"
              v-if="preview?.instance"
              ref="afterView"
              :instance="preview.instance"
              :interactions="interactions"
              :selected-node="proposal.target.nodeId"
            />
          </div>
        </div>
      </template>
      <p v-if="error" role="alert" class="lu-scoped-warning">{{ error }}</p>
    </section>
    <template #footer>
      <button
        type="button"
        class="lu-button"
        :disabled="checking || blocked"
        @click="emit('discard')"
      >
        放弃这次修改
      </button>
      <button type="button" class="lu-button" @click="emit('close')">稍后处理</button>
      <button
        type="button"
        class="lu-button primary"
        :disabled="checking || blocked || !preview?.instance || !selection.keys.length"
        @click="adopt"
      >
        {{ checking ? '检查合并结果…' : `采用 ${selection.keys.length} 项修改` }}
      </button>
    </template>
  </StudioModal>
</template>
