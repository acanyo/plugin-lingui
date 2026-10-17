<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, shallowRef } from 'vue'
import { VButton } from '@halo-dev/components'
import { builtInThemes, type ThemeTokens } from '@lingui/renderer'
import StudioModal from '../shared/StudioModal.vue'
import StudioSearch from '../shared/StudioSearch.vue'
import LinguiIcon from '../shared/LinguiIcon.vue'
import LinguiRenderer from '../shared/LinguiRenderer.vue'
import ThemeThumbnail from '../theme-studio/ThemeThumbnail.vue'
import { useRepository, errorMessage } from '../services/repository'
import { themeSubmission } from './theme-submission'
import type { SubmissionDraft } from './submission'

const props = defineProps<{ author?: string }>()
const emit = defineEmits<{ close: []; selected: [draft: SubmissionDraft]; themes: [] }>()
const repository = useRepository()
const themes = shallowRef<ThemeTokens[]>([])
const selectedId = ref(''),
  query = ref(''),
  loading = ref(true),
  error = ref('')
let request = 0
const filtered = computed(() =>
  themes.value.filter((theme) =>
    theme.name.toLocaleLowerCase().includes(query.value.trim().toLocaleLowerCase()),
  ),
)
const selected = computed(() => themes.value.find((theme) => theme.id === selectedId.value))
const draft = computed(() =>
  selected.value ? themeSubmission(selected.value, props.author) : undefined,
)
async function load() {
  const current = ++request
  loading.value = true
  error.value = ''
  try {
    const result = await repository.listThemes()
    if (current !== request) return
    themes.value = result.filter(
      (theme) => !builtInThemes.some((builtin) => builtin.id === theme.id),
    )
    if (!themes.value.some((theme) => theme.id === selectedId.value)) selectedId.value = ''
  } catch (cause) {
    if (current === request) error.value = errorMessage(cause)
  } finally {
    if (current === request) loading.value = false
  }
}
onMounted(load)
onBeforeUnmount(() => ++request)
</script>
<template>
  <StudioModal title="从我的主题选择" :width="1000" @close="emit('close')">
    <section class="lingui-studio lu-project-picker lu-theme-submission-picker">
      <p class="lu-muted">选择你已保存的主题。配色、排版和自定义字体会作为快照提交审核。</p>
      <div class="lu-project-picker-toolbar">
        <StudioSearch v-model="query" label="搜索投稿主题" placeholder="搜索主题名称…" />
        <button type="button" class="lu-text-button" :disabled="loading" @click="load">
          刷新主题
        </button>
      </div>
      <p v-if="loading" class="lu-muted" role="status">正在读取我的主题…</p>
      <div v-else-if="error" class="lu-error" role="alert">
        {{ error }} <button type="button" class="lu-text-button" @click="load">重新加载</button>
      </div>
      <div v-else-if="!themes.length" class="lu-draft-empty">
        <LinguiIcon name="palette" />
        <h2>还没有保存的主题</h2>
        <p>在主题工作室调整样式，保存为我的主题后再来投稿。</p>
        <button type="button" class="lu-button" @click="emit('themes')">前往主题工作室</button>
      </div>
      <div v-else class="lu-project-picker-layout">
        <div class="lu-project-picker-list" aria-label="可投稿主题">
          <p v-if="!filtered.length" class="lu-muted">没有匹配的主题。</p>
          <button
            v-for="theme in filtered"
            :key="theme.id"
            type="button"
            :class="['lu-project-picker-item', { selected: selectedId === theme.id }]"
            :aria-pressed="selectedId === theme.id"
            @click="selectedId = theme.id"
          >
            <ThemeThumbnail :theme="theme" />
            <span
              ><strong>{{ theme.name }}</strong
              ><small
                >{{ theme.mode === 'dark' ? '深色' : theme.mode === 'auto' ? '跟随系统' : '浅色' }}
                ·
                {{
                  theme.customFont?.name ||
                  (theme.font === 'serif'
                    ? '衬线 / 宋体'
                    : theme.font === 'mono'
                      ? '等宽'
                      : '系统无衬线')
                }}</small
              ></span
            >
            <LinguiIcon v-if="selectedId === theme.id" name="check" />
          </button>
        </div>
        <div class="lu-project-picker-preview">
          <template v-if="draft"
            ><h3>{{ selected?.name }}</h3>
            <LinguiRenderer :instance="draft.instance"
          /></template>
          <p v-else class="lu-muted">选择一个主题，试用它的输入、按钮和反馈样式。</p>
        </div>
      </div>
    </section>
    <template #footer>
      <VButton class="lu-button" @click="emit('close')">取消</VButton>
      <VButton
        class="lu-button primary"
        type="secondary"
        :disabled="!draft || loading || !!error"
        @click="draft && emit('selected', draft)"
        >下一步：填写主题说明</VButton
      >
    </template>
  </StudioModal>
</template>
