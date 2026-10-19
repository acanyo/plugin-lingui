<script setup lang="ts">
import { ref, watch } from 'vue'
import type { ComponentInstance, LinguiDocument, ThemeTokens } from '@lingui/renderer'
import LinguiRenderer from '../shared/LinguiRenderer.vue'
import GenerationProgress from '../ai-adapter/progress/GenerationProgress.vue'
import type { CandidateSet } from './model'
import './candidates.css'
const props = defineProps<{
  set: CandidateSet
  busy: boolean
  blocked?: boolean
}>()
const emit = defineEmits<{
  retry: [id: string]
  cancel: [id: string]
  third: []
  combine: []
  adopt: [document: LinguiDocument, source?: ComponentInstance, theme?: ThemeTokens]
}>()
const mobile = ref(0)
const open = ref(true)
watch(
  () => props.set.id,
  () => {
    open.value = true
    mobile.value = 0
  },
)
const safe = { inheritRegistered: false, requests: { allow: () => false } }
</script>
<template>
  <details
    class="lu-candidate-panel"
    :open="open"
    @toggle="open = ($event.target as HTMLDetailsElement).open"
  >
    <summary>
      多方案设计{{
        set ? ` · ${set.candidates.filter((c) => c.status === 'done').length} 个可用方案` : ''
      }}
    </summary>
    <p class="lu-candidate-prompt lu-muted">{{ set.prompt }}</p>
    <nav v-if="set" class="lu-candidate-tabs" aria-label="切换候选">
      <button
        v-for="(row, index) in set.candidates"
        :key="row.id"
        type="button"
        :aria-pressed="mobile === index"
        @click="mobile = index"
      >
        方案 {{ index + 1 }}
      </button>
    </nav>
    <div v-if="set" class="lu-candidate-grid">
      <article
        v-for="(row, index) in set.candidates"
        :key="row.id"
        :class="{ 'is-mobile-active': mobile === index }"
      >
        <h4>
          方案 {{ index + 1 }} ·
          {{
            row.status === 'done'
              ? '检查完成'
              : row.status === 'running'
                ? '生成中'
                : row.status === 'queued'
                  ? '等待前一案'
                  : '未完成'
          }}
        </h4>
        <p class="lu-muted">{{ row.direction }}</p>
        <GenerationProgress
          v-if="row.trace"
          :trace="row.trace"
          :pending="row.status === 'running'"
        />
        <p v-if="row.error" class="lu-error" role="status">{{ row.error }}</p>
        <div v-if="row.instance" class="lu-candidate-preview">
          <LinguiRenderer :auto-start="false" :instance="row.instance" :interactions="safe" />
        </div>
        <p v-if="row.check" class="lu-muted">
          自检 {{ row.check.cases.length }} 项 · {{ row.check.issues.length }} 条提示
        </p>
        <button
          v-if="['queued', 'running'].includes(row.status)"
          type="button"
          class="lu-button"
          @click="emit('cancel', row.id)"
        >
          取消此案
        </button>
        <button
          v-if="['error', 'stopped'].includes(row.status)"
          type="button"
          class="lu-button"
          :disabled="busy || blocked"
          @click="emit('retry', row.id)"
        >
          单独重试
        </button>
        <button
          v-if="row.status === 'done' && row.instance"
          type="button"
          class="lu-button primary"
          :disabled="busy || blocked"
          @click="emit('adopt', row.instance.document, set.source, row.instance.theme)"
        >
          采用此案（可撤销）
        </button>
      </article>
    </div>
    <div v-if="set" class="lu-recording-actions">
      <button
        type="button"
        class="lu-button"
        :disabled="busy || blocked || set.candidates.length >= 3"
        @click="emit('third')"
      >
        再生成第三案</button
      ><button
        type="button"
        class="lu-button"
        :disabled="busy || blocked || !set.candidates[0]?.instance || !set.candidates[1]?.instance"
        @click="emit('combine')"
      >
        以方案一布局、方案二配色创建候选
      </button>
    </div>
  </details>
</template>
