<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import {
  builtInThemes,
  validateTheme,
  type ThemeTokens,
  type FontFamilyDefinition,
} from '@lingui/renderer'
import { cloneJson } from '../shared/clone'
import { downloadJson } from '../shared/download'
import { useStudioAccess } from '../services/studio-access'
import LinguiIcon from '../shared/LinguiIcon.vue'
import ThemeThumbnail from './ThemeThumbnail.vue'
import ThemeControls from './ThemeControls.vue'
import ThemePreview from './ThemePreview.vue'
import ThemeAiComposer from './ai/ThemeAiComposer.vue'
import { parseGeneratedTheme } from './ai/theme-result'
import { useFontLibrary } from '../font-library/useFontLibrary'
import FontManagerView from '../font-library/FontManagerView.vue'
import StudioModal from '../shared/StudioModal.vue'
const props = defineProps<{ themes: ThemeTokens[]; initialTheme?: ThemeTokens }>()
const emit = defineEmits<{
  save: [theme: ThemeTokens]
  delete: [theme: ThemeTokens]
  submission: [theme: ThemeTokens]
}>()
const access = useStudioAccess()
const fontLibrary = useFontLibrary()
const showFonts = ref(false)
const fontManaging = ref(false)
const importingAi = ref(false)
watch(showFonts, (value) => {
  if (!value) void fontLibrary.refresh()
})
const current = ref<ThemeTokens>(cloneJson(builtInThemes[0]!)),
  baseline = ref(cloneJson(current.value)),
  selectedId = ref('pure'),
  filter = ref('all'),
  error = ref(''),
  json = ref(''),
  colorsValid = ref(true),
  controlRevision = ref(0)
const editRevision = ref(0)
const importPanel = ref<HTMLDetailsElement>()
const importText = ref<HTMLTextAreaElement>()
watch([current, colorsValid, selectedId], () => editRevision.value++, { deep: true, flush: 'sync' })
const builtin = computed(() => builtInThemes.some((theme) => theme.id === selectedId.value))
const changed = computed(() => JSON.stringify(current.value) !== JSON.stringify(baseline.value))
const visibleThemes = computed(() =>
  props.themes.filter(
    (theme) =>
      filter.value === 'all' ||
      (filter.value === 'custom'
        ? !builtInThemes.some((item) => item.id === theme.id)
        : theme.mode === filter.value),
  ),
)
const safeTheme = computed(() => {
  try {
    return validateTheme(current.value)
  } catch {
    return undefined
  }
})
const previewTheme = ref(cloneJson(current.value))
watch(
  safeTheme,
  (theme) => {
    if (theme) previewTheme.value = theme
  },
  { immediate: true },
)
const canSave = computed(() => colorsValid.value && Boolean(safeTheme.value))
function select(theme: ThemeTokens) {
  importingAi.value = false
  current.value = cloneJson(theme)
  baseline.value = cloneJson(theme)
  selectedId.value = theme.id
  error.value = ''
  colorsValid.value = true
  controlRevision.value++
}
watch(
  () => props.initialTheme,
  (theme) => {
    if (theme) select(theme)
  },
  { immediate: true },
)
function reset() {
  const saved = props.themes.some((theme) => theme.id === baseline.value.id)
  select(baseline.value)
  if (!saved) selectedId.value = ''
}
function save(copy = false) {
  if (!canSave.value) return
  try {
    const theme = validateTheme(current.value)
    if (copy || builtin.value || !selectedId.value) theme.id = `theme-${crypto.randomUUID()}`
    if (copy) theme.name = `${theme.name.slice(0, 117)} 副本`
    emit('save', theme)
    // Only an updated repository list marks the draft as saved.
    current.value = cloneJson(theme)
    selectedId.value = theme.id
    error.value = ''
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '主题无效'
  }
}
watch(
  () => props.themes,
  (themes, previous) => {
    const saved = themes.find((theme) => theme.id === selectedId.value)
    if (saved && JSON.stringify(saved) === JSON.stringify(current.value))
      baseline.value = cloneJson(saved)
    else if (!saved && previous.some((theme) => theme.id === selectedId.value))
      select(builtInThemes[0]!)
  },
)
function importJson() {
  try {
    const theme = parseGeneratedTheme(json.value)
    if (importingAi.value && current.value.customFont)
      theme.customFont = cloneJson(current.value.customFont)
    theme.id = `theme-${crypto.randomUUID()}`
    select(theme)
    selectedId.value = ''
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'JSON 格式无效'
  }
}
function applyAiTheme(theme: ThemeTokens) {
  current.value = { ...validateTheme(theme), id: `theme-${crypto.randomUUID()}` }
  selectedId.value = ''
  error.value = ''
  colorsValid.value = true
  controlRevision.value++
}
function selectFont(font: FontFamilyDefinition) {
  current.value.customFont = cloneJson(font)
  showFonts.value = false
}
async function openImport() {
  importingAi.value = true
  if (importPanel.value) importPanel.value.open = true
  await nextTick()
  importText.value?.focus()
  importText.value?.scrollIntoView?.({ block: 'center', behavior: 'auto' })
}
async function upload(event: Event) {
  const input = event.target as HTMLInputElement,
    file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (file.size > 262144) {
    error.value = '主题文件不能超过 256 KiB'
    return
  }
  try {
    json.value = await file.text()
    importJson()
  } catch {
    error.value = '无法读取主题文件，请重新选择'
  }
}
</script>
<template>
  <section class="lu-theme-studio">
    <div class="lu-page-title">
      <div>
        <div class="lu-theme-title-line">
          <h1>主题工作室</h1>
          <span v-if="changed || !selectedId || !colorsValid" class="lu-theme-draft">未保存</span>
        </div>
        <p class="lu-muted">从一套配色开始，打磨属于你的组件风格。</p>
      </div>
      <div class="lu-toolbar-actions">
        <button
          v-if="
            !builtin &&
            selectedId &&
            canSave &&
            !changed &&
            props.themes.some((theme) => theme.id === selectedId)
          "
          type="button"
          class="lu-button"
          @click="safeTheme && emit('submission', safeTheme)"
        >
          <LinguiIcon name="arrowUp" />投稿主题
        </button>
        <button
          type="button"
          class="lu-button"
          :disabled="!canSave"
          @click="downloadJson(current.name, current)"
        >
          <LinguiIcon name="download" />导出主题
        </button>
        <button
          v-if="access.allows('themes:manage')"
          type="button"
          class="lu-button"
          :disabled="!canSave"
          @click="save(true)"
        >
          复制主题
        </button>
        <button
          v-if="access.allows('themes:manage')"
          type="button"
          class="lu-button primary"
          :disabled="!canSave"
          @click="save()"
        >
          {{ builtin || !selectedId ? '保存为我的主题' : '保存主题' }}
        </button>
      </div>
    </div>
    <div class="lu-theme-section-heading">
      <h2>选择起点</h2>
      <div class="lu-theme-filters" role="group" aria-label="筛选主题">
        <button
          v-for="item in [
            { id: 'all', label: '全部' },
            { id: 'light', label: '浅色' },
            { id: 'dark', label: '深色' },
            { id: 'custom', label: '我的主题' },
          ]"
          :key="item.id"
          type="button"
          :aria-pressed="filter === item.id"
          @click="filter = item.id"
        >
          {{ item.label }}
        </button>
      </div>
    </div>
    <div class="lu-theme-swatches" aria-label="可选主题">
      <button
        v-for="theme in visibleThemes"
        :key="theme.id"
        type="button"
        :class="['lu-theme-swatch', { active: selectedId === theme.id }]"
        :aria-label="theme.name"
        :aria-pressed="selectedId === theme.id"
        @click="select(theme)"
      >
        <ThemeThumbnail :theme="theme" /><span class="lu-theme-name" :title="theme.name">{{
          theme.name.split(' · ')[0]
        }}</span
        ><small>{{ theme.name.split(' · ')[1] || '自定义主题' }}</small
        ><LinguiIcon v-if="selectedId === theme.id" class="lu-theme-selected" name="check" />
      </button>
    </div>
    <p v-if="!visibleThemes.length" class="lu-theme-empty">
      还没有自定义主题。调整下方样式，保存第一套主题。
    </p>
    <div class="lu-theme-layout">
      <aside class="lu-theme-controls">
        <div class="lu-theme-controls-heading">
          <strong>{{ current.name.split(' · ')[0] }}</strong
          ><button
            type="button"
            class="lu-text-button"
            :disabled="!changed && colorsValid"
            @click="reset"
          >
            <LinguiIcon name="refresh" />还原修改
          </button>
        </div>
        <ThemeControls
          :key="controlRevision"
          v-model="current"
          :fonts="fontLibrary.fonts.value.map((item) => item.definition)"
          @validity="colorsValid = $event"
          @fonts="showFonts = true"
        />
        <p v-if="fontLibrary.error.value" class="lu-error" role="alert">
          {{ fontLibrary.error.value
          }}<button type="button" class="lu-text-button" @click="fontLibrary.refresh">
            重新加载字体库
          </button>
        </p>
        <details ref="importPanel" class="lu-advanced">
          <summary>导入主题</summary>
          <p class="lu-muted">
            导入灵构主题 JSON，校验后预览。<span v-if="importingAi && current.customFont"
              >保留当前字体「{{ current.customFont.name }}」。</span
            >
          </p>
          <input
            type="file"
            accept=".json,application/json"
            aria-label="导入主题文件"
            @change="upload"
          /><textarea
            ref="importText"
            v-model="json"
            class="lu-code"
            rows="7"
            aria-label="主题 JSON"
            placeholder="粘贴主题 JSON…"
          /><button type="button" class="lu-button" :disabled="!json.trim()" @click="importJson">
            校验并预览
          </button>
        </details>
        <button
          v-if="
            !builtin &&
            selectedId &&
            access.allows('themes:manage') &&
            themes.some((theme) => theme.id === selectedId)
          "
          type="button"
          class="lu-text-button danger"
          @click="emit('delete', current)"
        >
          删除此主题
        </button>
        <p v-if="error" class="lu-error" role="alert">{{ error }}</p>
      </aside>
      <div class="lu-theme-preview-column">
        <ThemeAiComposer
          :theme="previewTheme"
          :revision="editRevision"
          :blocked="!canSave"
          @generated="applyAiTheme"
          @import="openImport"
        />
        <p v-if="!safeTheme" class="lu-error" role="alert">
          主题配置无效，预览暂时保留上一次有效样式。请检查名称和参数范围。
        </p>
        <ThemePreview :theme="previewTheme" />
      </div>
    </div>
    <StudioModal
      v-if="showFonts"
      title="字体管理"
      :width="1040"
      :close-disabled="fontManaging"
      @close="showFonts = false"
      ><div class="lingui-studio lu-dialog-body">
        <FontManagerView
          compact
          selection
          @select="selectFont"
          @busy="fontManaging = $event"
        /></div
    ></StudioModal>
  </section>
</template>
