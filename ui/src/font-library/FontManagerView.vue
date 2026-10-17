<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { type FontFamilyDefinition } from '@lingui/renderer'
import LinguiIcon from '../shared/LinguiIcon.vue'
import StudioSearch from '../shared/StudioSearch.vue'
import { useStudioAccess } from '../services/studio-access'
import { downloadFontCss } from './css-export'
import { useFontLibrary } from './useFontLibrary'
import FontImportPanel from './FontImportPanel.vue'
import FontSpecimen from './FontSpecimen.vue'
import type { ManagedFont } from './types'
withDefaults(defineProps<{ selection?: boolean; compact?: boolean }>(), {
  selection: false,
  compact: false,
})
const emit = defineEmits<{
  select: [font: FontFamilyDefinition]
  changed: []
  busy: [value: boolean]
}>()
const library = useFontLibrary(),
  access = useStudioAccess()
watch(library.busy, (value) => emit('busy', value), { flush: 'sync' })
const adding = ref(false),
  query = ref(''),
  sample = ref('灵感成形，文字有自己的声音。 Design 0123')
const visible = computed(() =>
  library.fonts.value.filter((font) =>
    font.definition.name.toLowerCase().includes(query.value.toLowerCase().trim()),
  ),
)
async function save(font: ManagedFont) {
  if (!access.allows('themes:manage')) return
  if (await library.save(font)) {
    adding.value = false
    query.value = ''
    emit('changed')
  }
}
const renaming = ref(''),
  renameValue = ref('')
function startRename(font: ManagedFont) {
  renaming.value = font.definition.id
  renameValue.value = font.definition.name
}
async function rename(font: ManagedFont) {
  if (!access.allows('themes:manage') || !renameValue.value.trim()) return
  if (
    await library.save({
      ...font,
      definition: { ...font.definition, name: renameValue.value.trim() },
    })
  ) {
    renaming.value = ''
    emit('changed')
  }
}
</script>
<template>
  <section :class="['lu-font-manager', { 'is-compact': compact }]" aria-label="字体管理">
    <header class="lu-page-title">
      <div>
        <h1 v-if="!compact">字体管理</h1>
        <h2 v-else>我的字体</h2>
        <p class="lu-muted">管理字体家族和分包，在主题中自由使用。</p>
      </div>
      <button
        v-if="access.allows('themes:manage')"
        class="lu-button primary"
        type="button"
        :disabled="library.loading.value || library.busy.value"
        @click="adding = true"
      >
        <LinguiIcon name="plus" />添加字体
      </button>
    </header>
    <FontImportPanel
      v-if="adding"
      :saving="library.busy.value || library.loading.value"
      @save="save"
      @close="adding = false"
    />
    <p v-if="library.error.value" class="lu-error" role="alert">
      {{ library.error.value }}
      <button type="button" class="lu-text-button" @click="library.refresh">重新加载</button>
    </p>
    <div v-if="library.fonts.value.length" class="lu-font-tools">
      <StudioSearch v-model="query" label="搜索字体" placeholder="搜索字体名称…" /><label
        class="lu-field"
        ><span>试用文字</span><input v-model="sample" maxlength="200"
      /></label>
    </div>
    <p v-if="library.loading.value" class="lu-muted" role="status">正在加载字体库…</p>
    <div v-else-if="!library.fonts.value.length && !adding" class="lu-font-empty">
      <LinguiIcon name="book" />
      <h2>让文字也有你的风格</h2>
      <p>添加一份字体 CSS，即可在主题中使用。中文分包无需逐个上传。</p>
      <button
        v-if="access.allows('themes:manage')"
        type="button"
        class="lu-button"
        @click="adding = true"
      >
        添加第一套字体
      </button>
    </div>
    <p v-else-if="!visible.length && library.fonts.value.length" class="lu-muted">
      没有匹配的字体，试试其他名称。
    </p>
    <div class="lu-font-grid">
      <article v-for="font in visible" :key="font.definition.id" class="lu-font-card">
        <header>
          <h2>{{ font.definition.name }}</h2>
          <span>{{
            font.definition.faces.some((face) => face.unicodeRange) ? '字符分包' : '完整字形'
          }}</span>
        </header>
        <FontSpecimen :font="font.definition" :text="sample" />
        <p class="lu-font-meta">
          {{ font.definition.faces.length }} 个分包 · 字重
          {{ [...new Set(font.definition.faces.map((face) => face.weight))].join(' / ') }}
        </p>
        <details class="lu-font-details">
          <summary>字体来源与分包</summary>
          <p v-if="font.sourceUrl">{{ font.sourceUrl }}</p>
          <ul>
            <li v-for="(face, index) in font.definition.faces" :key="index">
              <span
                >{{ face.weight }} · {{ face.style === 'italic' ? '斜体' : '常规' }} ·
                {{ face.unicodeRange || '全部字符' }}</span
              ><a :href="face.url" target="_blank" rel="noopener noreferrer">{{ face.url }}</a>
            </li>
          </ul>
        </details>
        <form
          v-if="renaming === font.definition.id"
          class="lu-font-rename"
          @submit.prevent="rename(font)"
        >
          <label class="lu-field"
            ><span>新字体名称</span><input v-model="renameValue" maxlength="120" required
          /></label>
          <div class="lu-toolbar-actions">
            <button
              class="lu-button"
              type="submit"
              :disabled="library.busy.value || !renameValue.trim()"
            >
              保存名称</button
            ><button class="lu-text-button" type="button" @click="renaming = ''">取消</button>
          </div>
        </form>
        <footer v-else>
          <button
            v-if="selection"
            type="button"
            class="lu-button primary"
            @click="emit('select', font.definition)"
          >
            使用此字体</button
          ><button type="button" class="lu-text-button" @click="downloadFontCss(font.definition)">
            导出 CSS</button
          ><button
            v-if="access.allows('themes:manage')"
            type="button"
            class="lu-text-button"
            @click="startRename(font)"
          >
            重命名</button
          ><button
            v-if="access.allows('themes:manage')"
            type="button"
            class="lu-text-button danger"
            :disabled="library.busy.value"
            @click="library.remove(font)"
          >
            移除
          </button>
        </footer>
      </article>
    </div>
    <p class="lu-font-footnote lu-muted">
      这里只保存字体配置，不复制字体文件。移除库中的字体后，已有作品保留配置快照；字体文件仍需源站可访问。
    </p>
  </section>
</template>
