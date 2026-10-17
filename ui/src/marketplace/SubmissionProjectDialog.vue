<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, onBeforeUnmount } from 'vue'
import { VButton } from '@halo-dev/components'
import VModal from '../shared/StudioModal.vue'
import { pureTheme } from '@lingui/renderer'
import { templateInstance, type TemplateRecord } from '../component-library/types'
import { useRepository, errorMessage } from '../services/repository'
import LinguiRenderer from '../shared/LinguiRenderer.vue'
import LinguiIcon from '../shared/LinguiIcon.vue'
import StudioSearch from '../shared/StudioSearch.vue'
import { projectSubmission } from './project-submission'
import type { SubmissionDraft } from './submission'

const props = defineProps<{ author?: string }>()
const emit = defineEmits<{ close: []; selected: [draft: SubmissionDraft]; workspace: [] }>()
const repository = useRepository()
const projects = shallowRef<TemplateRecord[]>([])
const selectedId = ref(''),
  search = ref(''),
  loading = ref(true),
  error = ref('')
let request = 0
const filtered = computed(() =>
  projects.value.filter((project) =>
    `${project.name} ${project.description} ${project.category}`
      .toLocaleLowerCase()
      .includes(search.value.trim().toLocaleLowerCase()),
  ),
)
const selected = computed(() => projects.value.find((project) => project.id === selectedId.value))
const instance = computed(() =>
  selected.value ? templateInstance(selected.value, pureTheme) : undefined,
)
async function load() {
  const current = ++request
  loading.value = true
  error.value = ''
  try {
    const result = await repository.listTemplates()
    if (current !== request) return
    projects.value = result.sort((a, b) =>
      b.revisions.at(-1)!.createdAt.localeCompare(a.revisions.at(-1)!.createdAt),
    )
    if (!projects.value.some((project) => project.id === selectedId.value)) selectedId.value = ''
  } catch (cause) {
    if (current === request) error.value = errorMessage(cause)
  } finally {
    if (current === request) loading.value = false
  }
}
function choose() {
  if (!selected.value || loading.value || error.value) return
  emit('selected', projectSubmission(selected.value, props.author))
}
onMounted(load)
onBeforeUnmount(() => {
  ++request
})
</script>
<template>
  <VModal title="从我的项目选择作品" :width="1000" @close="emit('close')">
    <section class="lingui-studio lu-project-picker">
      <p class="lu-muted">选择已保存的项目，填写作品说明后投稿。项目后续修改不会影响提交的快照。</p>
      <div class="lu-project-picker-toolbar">
        <StudioSearch
          v-model="search"
          class="lu-project-search"
          label="搜索投稿项目"
          placeholder="搜索项目、分类…"
        />
        <button type="button" class="lu-text-button" :disabled="loading" @click="load">
          刷新项目
        </button>
      </div>
      <p v-if="loading" class="lu-muted" role="status">正在读取我的项目…</p>
      <div v-else-if="error" role="alert" class="lu-error">
        {{ error }} <button type="button" class="lu-text-button" @click="load">重新加载</button>
      </div>
      <div v-else-if="!projects.length" class="lu-draft-empty">
        <LinguiIcon name="layers" />
        <h2>还没有保存的项目</h2>
        <p>在开发工作台完成创作并保存，再来选择作品投稿。</p>
        <button type="button" class="lu-button" @click="emit('workspace')">前往开发工作台</button>
      </div>
      <div v-else class="lu-project-picker-layout">
        <div class="lu-project-picker-list" aria-label="可投稿项目">
          <p v-if="!filtered.length" class="lu-muted">没有匹配的项目。</p>
          <button
            v-for="project in filtered"
            :key="project.id"
            type="button"
            :class="['lu-project-picker-item', { selected: selectedId === project.id }]"
            :aria-pressed="selectedId === project.id"
            @click="selectedId = project.id"
          >
            <span
              ><strong>{{ project.name }}</strong
              ><small
                >{{ project.category }} · 已保存 v{{ project.revisions.at(-1)!.version }}</small
              ><span>{{ project.description || '暂无项目简介' }}</span></span
            >
            <LinguiIcon v-if="selectedId === project.id" name="check" />
          </button>
        </div>
        <div class="lu-project-picker-preview">
          <template v-if="instance"
            ><h3>{{ selected?.name }}</h3>
            <LinguiRenderer :instance="instance"
          /></template>
          <p v-else class="lu-muted">选择一个项目，查看完整交互预览。</p>
        </div>
      </div>
    </section>
    <template #footer
      ><VButton class="lu-button" @click="emit('close')">取消</VButton
      ><VButton
        class="lu-button primary"
        type="secondary"
        :disabled="!selected || loading || !!error"
        @click="choose"
        >下一步：填写作品说明</VButton
      ></template
    >
  </VModal>
</template>
