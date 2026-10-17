<script setup lang="ts">
import { ref } from 'vue'
import type { ComponentInstance, LinguiDocument, ThemeTokens } from '@lingui/renderer'
import { useRepository } from '../services/repository'
import { useStudioAccess } from '../services/studio-access'
import LinguiRenderer from '../shared/LinguiRenderer.vue'
import GenerationProgress from '../ai-adapter/progress/GenerationProgress.vue'
import { useDesignCandidates } from './useDesignCandidates'
import { combineCandidateTheme, type CandidateSet } from './model'
import './candidates.css'
const props = defineProps<{
  instance?: ComponentInstance
  initial?: CandidateSet
  blocked?: boolean
}>()
const emit = defineEmits<{
  changed: [value: CandidateSet]
  busy: [value: boolean]
  adopt: [document: LinguiDocument, source?: ComponentInstance, theme?: ThemeTokens]
}>()
const repository = useRepository(),
  access = useStudioAccess()
const api = useDesignCandidates({
  generate: repository.generate.bind(repository),
  current: () => props.instance,
  initial: props.initial,
  changed: (value) => emit('changed', value),
  busy: (value) => emit('busy', value),
})
const { set, busy } = api,
  prompt = ref(props.initial?.prompt ?? ''),
  mobile = ref(0),
  error = ref('')
const safe = { inheritRegistered: false, requests: { allow: () => false } }
function combine() {
  const a = set.value?.candidates[0]?.instance,
    b = set.value?.candidates[1]?.instance
  if (a && b) {
    try {
      api.addCombined(combineCandidateTheme(a, b))
      error.value = ''
    } catch (cause) {
      error.value = String(cause)
    }
  }
}
</script>
<template>
  <details class="lu-candidate-panel">
    <summary>
      多方案设计{{
        set ? ` · ${set.candidates.filter((c) => c.status === 'done').length} 个可用方案` : ''
      }}
    </summary>
    <p class="lu-muted">
      默认顺序生成两案，每案最多两轮修复。采用前保留当前作品；生成期间可取消某案，成功方案和其他候选留在创作历史中。
    </p>
    <textarea
      v-model="prompt"
      aria-label="多方案共同需求"
      placeholder="输入同一个创作需求，比较两种布局"
      maxlength="3400"
      rows="3"
      :disabled="busy"
    />
    <button
      type="button"
      class="lu-button"
      :disabled="
        busy ||
        blocked ||
        !prompt.trim() ||
        repository.mode !== 'halo' ||
        !access.allows('ai:generate')
      "
      @click="api.start(prompt)"
    >
      生成两种方案{{ set ? '（替换本组候选）' : '' }}
    </button>
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
          @click="api.cancel(row.id)"
        >
          取消此案
        </button>
        <button
          v-if="['error', 'stopped'].includes(row.status)"
          type="button"
          class="lu-button"
          :disabled="busy || blocked"
          @click="api.retry(row.id)"
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
        @click="api.third"
      >
        再生成第三案</button
      ><button
        type="button"
        class="lu-button"
        :disabled="busy || blocked || !set.candidates[0]?.instance || !set.candidates[1]?.instance"
        @click="combine"
      >
        以方案一布局、方案二配色创建候选
      </button>
    </div>
    <p v-if="error" class="lu-error" role="alert">{{ error }}</p>
  </details>
</template>
