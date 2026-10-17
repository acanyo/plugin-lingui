<script setup lang="ts">
import ProjectCard from './ProjectCard.vue'
import ProjectPreviewDialog from './ProjectPreviewDialog.vue'
import EmbedCodeDialog from '../component-embed/EmbedCodeDialog.vue'
import { templateInstance } from './types'
import { pureTheme, type ComponentInstance } from '@lingui/renderer'
import LinguiIcon from '../shared/LinguiIcon.vue'
import StudioSearch from '../shared/StudioSearch.vue'
import { computed, ref, shallowRef, watch } from 'vue'
import type { TemplateRecord } from './types'
import { useStudioAccess } from '../services/studio-access'
const access = useStudioAccess()
const embed = shallowRef<ComponentInstance>()
const props = defineProps<{ templates: TemplateRecord[]; loading: boolean }>()
const emit = defineEmits<{
  open: [template: TemplateRecord, revision?: number]
  submission: [template: TemplateRecord]
  market: []
  catalog: []
  themes: []
  duplicate: [template: TemplateRecord]
  delete: [template: TemplateRecord]
  export: [template: TemplateRecord]
  rename: [template: TemplateRecord]
  import: []
  ai: []
  create: []
}>()
const search = ref(''),
  category = ref('全部'),
  selected = ref<string>(),
  previewHistory = ref(false),
  sort = ref<'updated' | 'name'>('updated'),
  limit = ref(12)
const categories = computed(() => [
  '全部',
  ...new Set(props.templates.map((template) => template.category)),
])
const filtered = computed(() =>
  [...props.templates]
    .sort((a, b) =>
      sort.value === 'name'
        ? a.name.localeCompare(b.name, 'zh-CN')
        : b.revisions.at(-1)!.createdAt.localeCompare(a.revisions.at(-1)!.createdAt),
    )
    .filter(
      (template) =>
        (category.value === '全部' || category.value === template.category) &&
        `${template.name} ${template.description} ${template.category}`
          .toLocaleLowerCase()
          .includes(search.value.trim().toLocaleLowerCase()),
    ),
)
const preview = computed(() => props.templates.find((template) => template.id === selected.value))
watch([search, category, sort], () => {
  limit.value = 12
})
watch(categories, (items) => {
  if (!items.includes(category.value)) category.value = '全部'
  if (!props.templates.length) search.value = ''
})
function openPreview(template: TemplateRecord, history = false) {
  selected.value = template.id
  previewHistory.value = history
}
function editPreview(version: number) {
  if (preview.value) emit('open', preview.value, version)
  selected.value = undefined
}
function clearFilters() {
  search.value = ''
  category.value = '全部'
}
function categoryCount(item: string) {
  return item === '全部'
    ? props.templates.length
    : props.templates.filter((template) => template.category === item).length
}
</script>
<template>
  <section class="lu-library">
    <div class="lu-page-title">
      <div>
        <span class="lu-eyebrow">工作空间</span>
        <h1>我的项目</h1>
        <p class="lu-muted">打开已保存的作品，继续对话和创作。</p>
      </div>
      <div class="lu-toolbar-actions">
        <button type="button" class="lu-button primary" @click="emit('ai')">开始 AI 创作</button>
        <button type="button" class="lu-button" @click="emit('create')">新建空白组件</button
        ><button type="button" class="lu-button" @click="emit('import')">导入 JSON</button>
      </div>
    </div>
    <section class="lu-projects" aria-label="项目">
      <div class="lu-projects-heading">
        <div class="lu-projects-title">
          <h2>项目</h2>
          <span class="lu-project-count">{{ templates.length }}</span>
        </div>
        <div v-if="templates.length" class="lu-projects-controls">
          <StudioSearch
            v-model="search"
            class="lu-project-search"
            label="搜索项目"
            placeholder="搜索项目…"
          />
          <label class="lu-project-sort"
            ><LinguiIcon name="sort" /><select v-model="sort" aria-label="项目排序">
              <option value="updated">最近更新</option>
              <option value="name">名称排序</option>
            </select></label
          >
        </div>
      </div>
      <div v-if="templates.length" class="lu-project-filters" aria-label="项目分类">
        <button
          v-for="item in categories"
          :key="item"
          type="button"
          :class="{ active: category === item }"
          :aria-pressed="category === item"
          @click="category = item"
        >
          {{ item }}<span aria-hidden="true">{{ categoryCount(item) }}</span>
        </button>
      </div>
      <div v-if="loading" class="lu-project-loading" role="status">正在读取项目预览…</div>
      <div v-else-if="filtered.length" class="lu-project-grid">
        <ProjectCard
          v-for="template in filtered.slice(0, limit)"
          :key="template.id"
          :template="template"
          :can-manage="access.allows('components:manage')"
          @open="emit('open', template)"
          @submission="emit('submission', template)"
          @preview="openPreview(template)"
          @history="openPreview(template, true)"
          @rename="emit('rename', template)"
          @duplicate="emit('duplicate', template)"
          @embed="embed = templateInstance(template, pureTheme)"
          @export="emit('export', template)"
          @delete="emit('delete', template)"
        />
      </div>
      <div v-else class="lu-project-empty">
        <LinguiIcon :name="search || category !== '全部' ? 'search' : 'layers'" />
        <h3>
          {{ search || category !== '全部' ? '没有找到匹配的项目' : '还没有项目' }}
        </h3>
        <p>
          {{
            search || category !== '全部'
              ? '试试其他名称，或清除当前筛选条件。'
              : '这里只显示你保存的项目。也可以在组件市场中预览作品，带回工作台继续创作。'
          }}
        </p>
        <button
          v-if="search || category !== '全部'"
          type="button"
          class="lu-button"
          @click="clearFilters"
        >
          清除筛选</button
        ><button v-else type="button" class="lu-button" @click="emit('market')">
          浏览组件市场 <LinguiIcon name="arrow" />
        </button>
      </div>
      <div v-if="filtered.length > limit" class="lu-project-load-more">
        <span class="lu-muted">已显示 {{ limit }} / {{ filtered.length }} 个项目</span
        ><button type="button" class="lu-button" @click="limit += 12">显示更多项目</button>
      </div>
    </section>
    <ProjectPreviewDialog
      v-if="preview"
      :key="preview.id"
      :template="preview"
      :history="previewHistory"
      @close="selected = undefined"
      @edit="editPreview"
    />
    <EmbedCodeDialog v-if="embed" :instance="embed" @close="embed = undefined" />
  </section>
</template>
