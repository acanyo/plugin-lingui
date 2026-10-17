<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, useId, watch } from 'vue'
import { pureTheme, type ComponentInstance } from '@lingui/renderer'
import { templateInstance, type TemplateRecord } from '../component-library/types'
import { projectEditorUrl } from '../component-library/project-links'
import { useRepository, errorMessage } from '../services/repository'
import { useStudioAccess } from '../services/studio-access'
import type { MarketplaceWork } from '../marketplace/catalog'
import CommunityCatalog from '../marketplace/CommunityCatalog.vue'
import LinguiRenderer from '../shared/LinguiRenderer.vue'
import LinguiIcon from '../shared/LinguiIcon.vue'
import StudioSearch from '../shared/StudioSearch.vue'
import { downloadedProject, marketProject } from './market-download'
import '../shared/studio.css'
import './article-picker.css'

const props = defineProps<{ insert: (instance: ComponentInstance) => Promise<void> }>()
const emit = defineEmits<{ busy: [value: boolean] }>()
const repository = useRepository()
const access = useStudioAccess()
const panelId = `article-projects-${useId()}`
const tab = ref<'projects' | 'market'>('projects')
const projects = shallowRef<TemplateRecord[]>([])
const selectedId = ref('')
const search = ref('')
const category = ref('')
const loading = ref(false)
const downloading = ref(false)
const inserting = ref(false)
const error = ref('')
const notice = ref('')
const tabs = [
  { id: 'projects', label: '我的项目', icon: 'grid' },
  { id: 'market', label: '应用市场', icon: 'layers' },
] as const
const busy = computed(() => downloading.value || inserting.value)
const canDownload = computed(() => access.allows('components:manage'))
const categories = computed(() => [...new Set(projects.value.map((project) => project.category))])
const filtered = computed(() => {
  const query = search.value.trim().toLocaleLowerCase()
  return projects.value.filter(
    (project) =>
      (!category.value || project.category === category.value) &&
      `${project.name} ${project.description} ${project.category}`
        .toLocaleLowerCase()
        .includes(query),
  )
})
const selected = computed(() => filtered.value.find((project) => project.id === selectedId.value))
const preview = computed(() =>
  selected.value ? templateInstance(selected.value, pureTheme) : undefined,
)
watch(filtered, (values) => {
  if (!values.some((project) => project.id === selectedId.value))
    selectedId.value = values[0]?.id ?? ''
})
watch(busy, (value) => emit('busy', value))
let mounted = true
onUnmounted(() => {
  mounted = false
})
async function refresh() {
  if (loading.value || busy.value) return
  loading.value = true
  error.value = ''
  try {
    const result = await repository.listTemplates()
    if (mounted) projects.value = result
  } catch (cause) {
    if (mounted) error.value = errorMessage(cause)
  } finally {
    loading.value = false
  }
}
onMounted(refresh)
async function download(work: MarketplaceWork) {
  if (loading.value || busy.value || !canDownload.value) return
  downloading.value = true
  error.value = ''
  notice.value = ''
  try {
    const current = await repository.listTemplates()
    if (!mounted) return
    const existing = downloadedProject(work, current)
    const saved = existing ?? (await repository.saveTemplate(marketProject(work)))
    if (!mounted) return
    projects.value = [saved, ...current.filter((project) => project.id !== saved.id)]
    search.value = ''
    category.value = ''
    selectedId.value = saved.id
    tab.value = 'projects'
    notice.value = existing
      ? '已选中下载过的项目，可以预览、编辑或插入文章。'
      : '已下载到我的项目，确认预览后即可插入文章。'
    await nextTick()
    document.getElementById(`${panelId}-projects`)?.focus()
  } catch (cause) {
    if (mounted) error.value = errorMessage(cause)
  } finally {
    downloading.value = false
  }
}
async function insertSelected() {
  const id = selected.value?.id
  if (!id || loading.value || busy.value) return
  inserting.value = true
  error.value = ''
  notice.value = ''
  try {
    const current = await repository.listTemplates()
    if (!mounted) return
    const latest = current.find((project) => project.id === id)
    const previous = selected.value
    projects.value = current
    if (!latest) throw new Error('该项目已被删除，请选择其他项目')
    if (JSON.stringify(latest) !== JSON.stringify(previous)) {
      notice.value = '项目已在其他窗口更新，预览已刷新，请确认后再次插入。'
      return
    }
    await props.insert(templateInstance(latest, pureTheme))
  } catch (cause) {
    if (mounted) error.value = errorMessage(cause)
  } finally {
    inserting.value = false
  }
}
function selectTab(value: 'projects' | 'market') {
  if (busy.value) return
  tab.value = value
  error.value = ''
  notice.value = ''
}
function clearFilters() {
  search.value = ''
  category.value = ''
}
function selectProject(id: string) {
  selectedId.value = id
  notice.value = ''
}
function keydown(event: KeyboardEvent) {
  if (busy.value || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const value =
    event.key === 'Home'
      ? 'projects'
      : event.key === 'End'
        ? 'market'
        : tab.value === 'projects'
          ? 'market'
          : 'projects'
  selectTab(value)
  document.getElementById(`${panelId}-${value}`)?.focus()
}
</script>
<template>
  <section class="lingui-studio lu-article-picker" aria-label="选择文章组件" :aria-busy="busy">
    <div class="lu-article-picker-heading">
      <div class="lu-market-kind-tabs" role="tablist" aria-label="组件来源">
        <button
          v-for="item in tabs"
          :id="`${panelId}-${item.id}`"
          :key="item.id"
          type="button"
          role="tab"
          :aria-selected="tab === item.id"
          :aria-controls="panelId"
          :tabindex="tab === item.id ? 0 : -1"
          :disabled="busy"
          @click="selectTab(item.id)"
          @keydown="keydown"
        >
          <LinguiIcon :name="item.icon" />{{ item.label }}
          <span v-if="item.id === 'projects' && !loading" class="lu-market-count">{{
            projects.length
          }}</span>
        </button>
      </div>
      <a class="lu-text-button" :href="projectEditorUrl()" target="_blank" rel="noopener noreferrer"
        >前往工作台创作 <LinguiIcon name="arrow"
      /></a>
    </div>
    <p v-if="notice" class="lu-article-picker-notice" role="status">{{ notice }}</p>
    <p v-if="error" class="lu-error" role="alert">{{ error }}</p>
    <div :id="panelId" role="tabpanel" :aria-labelledby="`${panelId}-${tab}`">
      <template v-if="tab === 'projects'">
        <div class="lu-project-picker-toolbar">
          <StudioSearch
            v-model="search"
            class="lu-project-search"
            label="搜索我的项目"
            placeholder="搜索项目名称、分类…"
            :disabled="busy"
          />
          <label class="lu-article-category"
            >分类
            <select v-model="category" aria-label="筛选项目分类" :disabled="busy">
              <option value="">全部分类</option>
              <option v-for="value in categories" :key="value" :value="value">{{ value }}</option>
            </select>
          </label>
          <button type="button" class="lu-button" :disabled="loading || busy" @click="refresh">
            刷新项目
          </button>
        </div>
        <p v-if="loading" class="lu-community-loading" role="status">正在读取我的项目…</p>
        <div v-else-if="!filtered.length" class="lu-market-empty">
          <LinguiIcon name="layers" />
          <h3>{{ projects.length ? '没有找到匹配的项目' : '还没有项目' }}</h3>
          <p class="lu-muted">
            {{
              projects.length
                ? '试试其他关键词或分类。'
                : '从应用市场下载组件，或前往工作台创建自己的作品。'
            }}
          </p>
          <button v-if="projects.length" type="button" class="lu-button" @click="clearFilters">
            清空筛选
          </button>
          <button v-else type="button" class="lu-button primary" @click="selectTab('market')">
            浏览应用市场
          </button>
        </div>
        <div v-else class="lu-project-picker-layout">
          <div class="lu-project-picker-list" aria-label="可插入的项目">
            <button
              v-for="project in filtered"
              :key="project.id"
              type="button"
              class="lu-project-picker-item"
              :class="{ selected: selectedId === project.id }"
              :aria-pressed="selectedId === project.id"
              :disabled="busy"
              @click="selectProject(project.id)"
            >
              <span
                ><strong>{{ project.name }}</strong
                ><span>{{ project.description || '交互组件' }}</span
                ><small
                  >{{ project.category }} · v{{ project.revisions.at(-1)?.version }}</small
                ></span
              >
              <LinguiIcon v-if="selectedId === project.id" name="check" />
            </button>
          </div>
          <div v-if="selected && preview" class="lu-article-project-detail">
            <div class="lu-article-preview-heading">
              <div>
                <h3>{{ selected.name }}</h3>
                <p class="lu-muted">交互预览</p>
              </div>
              <a
                class="lu-button"
                :href="projectEditorUrl(selected.id)"
                target="_blank"
                rel="noopener noreferrer"
                >编辑项目 <LinguiIcon name="edit"
              /></a>
            </div>
            <div class="lu-project-picker-preview">
              <LinguiRenderer
                :key="`${selected.id}-${selected.revisions.at(-1)?.version}`"
                :instance="preview"
              />
            </div>
          </div>
        </div>
        <div class="lu-article-picker-footer">
          <p class="lu-muted">
            插入时开启公开嵌入。文章按 ID 引用项目最新保存版本，删除项目或关闭嵌入后将无法展示。
          </p>
          <button
            type="button"
            class="lu-button primary"
            :disabled="!selected || loading || busy"
            @click="insertSelected"
          >
            {{ inserting ? '正在插入…' : '插入文章' }} <LinguiIcon name="arrow" />
          </button>
        </div>
      </template>
      <template v-else>
        <p class="lu-muted lu-article-market-hint">
          先预览，再下载到「我的项目」，确认后插入文章。
        </p>
        <p v-if="!canDownload" class="lu-article-picker-notice">
          下载需要「管理组件模板」权限，请联系管理员开通；已有项目仍可插入文章。
        </p>
        <p v-if="downloading" role="status" class="lu-article-picker-notice">
          正在保存到我的项目，请稍候…
        </p>
        <CommunityCatalog
          download
          :action-disabled="loading || busy || !canDownload"
          @download="download"
        />
      </template>
    </div>
  </section>
</template>
