<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from 'vue'
import { fontUrl, type FontFamilyDefinition } from '@lingui/renderer'
import LinguiIcon from '../shared/LinguiIcon.vue'
import FontSpecimen from './FontSpecimen.vue'
import { fetchFontCss, importFontCss, MAX_CSS_BYTES } from './css-import'
import type { ManagedFont } from './types'
const props = defineProps<{ saving: boolean }>()
const emit = defineEmits<{ save: [font: ManagedFont]; close: [] }>()
const mode = ref<'link' | 'file'>('link'),
  url = ref(''),
  base = ref(''),
  css = ref(''),
  error = ref(''),
  busy = ref(false)
const candidates = ref<FontFamilyDefinition[]>([]),
  selected = ref(0),
  displayName = ref(''),
  sourceUrl = ref('')
const chosen = computed(() => candidates.value[selected.value])
watch(chosen, (font) => {
  displayName.value = font?.name ?? ''
})
let controller: AbortController | undefined
let requestId = 0
function clear() {
  requestId++
  controller?.abort()
  candidates.value = []
  error.value = ''
  busy.value = false
}
watch(mode, clear)
watch([url, base, css], () => {
  if (!busy.value) candidates.value = []
})
onScopeDispose(clear)
async function analyze() {
  if (busy.value || props.saving) return
  const id = ++requestId
  controller = new AbortController()
  const timeout = setTimeout(() => controller?.abort(), 15000)
  error.value = ''
  busy.value = true
  candidates.value = []
  try {
    let text = css.value,
      address = base.value.trim() || undefined
    if (mode.value === 'link') {
      const result = await fetchFontCss(url.value, controller.signal)
      text = result.text
      address = result.sourceUrl
    }
    const result = importFontCss(text, address)
    if (id !== requestId) return
    sourceUrl.value = address ?? ''
    selected.value = 0
    candidates.value = result
  } catch (cause) {
    if (id !== requestId) return
    error.value =
      cause instanceof Error && cause.name === 'AbortError'
        ? '读取字体 CSS 超时，请稍后重试。'
        : cause instanceof TypeError
          ? '无法读取字体 CSS，请检查链接是否公开、可访问，并允许浏览器跨域读取。也可以下载 CSS 文件后导入。'
          : cause instanceof Error
            ? cause.message
            : '无法识别字体 CSS'
  } finally {
    clearTimeout(timeout)
    if (id === requestId) busy.value = false
  }
}
async function upload(event: Event) {
  const input = event.target as HTMLInputElement,
    file = input.files?.[0]
  input.value = ''
  clear()
  if (!file) return
  if (file.size > MAX_CSS_BYTES) {
    error.value = '字体 CSS 不能超过 1 MiB'
    return
  }
  try {
    css.value = await file.text()
  } catch {
    error.value = '无法读取文件，请重新选择'
  }
}
function save() {
  if (!chosen.value || busy.value || props.saving || !displayName.value.trim()) return
  emit('save', {
    definition: { ...chosen.value, name: displayName.value.trim() },
    ...(sourceUrl.value ? { sourceUrl: fontUrl(sourceUrl.value) } : {}),
  })
}
</script>
<template>
  <section class="lu-font-import" aria-label="添加字体">
    <header>
      <div>
        <h2>添加字体</h2>
        <p class="lu-muted">导入字体 CSS，保留字重和字符分包。</p>
      </div>
      <button
        class="lu-icon-button"
        type="button"
        aria-label="关闭添加字体"
        :disabled="saving"
        @click="emit('close')"
      >
        <LinguiIcon name="close" />
      </button>
    </header>
    <div class="lu-segment" role="group" aria-label="字体导入方式">
      <button
        type="button"
        :class="{ active: mode === 'link' }"
        :aria-pressed="mode === 'link'"
        :disabled="saving"
        @click="mode = 'link'"
      >
        CSS 链接</button
      ><button
        type="button"
        :class="{ active: mode === 'file' }"
        :aria-pressed="mode === 'file'"
        :disabled="saving"
        @click="mode = 'file'"
      >
        CSS 文件
      </button>
    </div>
    <form @submit.prevent="analyze">
      <label v-if="mode === 'link'" class="lu-field"
        ><span>字体 CSS 链接</span
        ><input
          v-model="url"
          type="url"
          maxlength="2048"
          placeholder="https://你的字体站点/font.css"
          :disabled="busy || saving"
          required
      /></label>
      <template v-else>
        <label class="lu-field"
          ><span>选择 CSS 文件</span
          ><input type="file" accept=".css,text/css" :disabled="busy || saving" @change="upload"
        /></label>
        <label class="lu-field"
          ><span>CSS 原始地址</span
          ><input
            v-model="base"
            type="url"
            maxlength="2048"
            placeholder="例如 https://你的站点/fonts/font.css"
            :disabled="busy || saving"
          /><small class="lu-muted"
            >有相对路径时必填。字体文件需要已上传到可访问的站点。</small
          ></label
        >
        <label class="lu-field"
          ><span>字体 CSS 内容</span
          ><textarea
            v-model="css"
            rows="5"
            class="lu-code"
            placeholder="也可以直接粘贴 @font-face…"
            :disabled="busy || saving"
          />
        </label>
      </template>
      <button
        class="lu-button"
        type="submit"
        :disabled="busy || saving || !(mode === 'link' ? url.trim() : css.trim())"
      >
        <LinguiIcon name="search" />{{ busy ? '正在识别…' : '识别字体' }}
      </button>
    </form>
    <p v-if="error" class="lu-error" role="alert">{{ error }}</p>
    <div v-if="chosen" class="lu-font-import-result">
      <label v-if="candidates.length > 1" class="lu-field"
        ><span>选择字体家族</span
        ><select v-model.number="selected">
          <option v-for="(font, index) in candidates" :key="font.id" :value="index">
            {{ font.name }}
          </option>
        </select></label
      >
      <p class="lu-muted">
        识别到 {{ chosen.faces.length }} 个分包 ·
        {{ [...new Set(chosen.faces.map((face) => face.weight))].join(' / ') }} 字重
      </p>
      <FontSpecimen :font="chosen" />
      <form @submit.prevent="save">
        <label class="lu-field"
          ><span>字体名称</span
          ><input v-model="displayName" maxlength="120" :disabled="saving" required /></label
        ><button class="lu-button primary" type="submit" :disabled="saving || !displayName.trim()">
          {{ saving ? '正在保存…' : '加入字体库' }}
        </button>
      </form>
    </div>
    <p class="lu-font-import-note lu-muted">
      仅提取 @font-face，支持 WOFF2 / WOFF、字重区间、斜体和 unicode-range。其他 CSS
      不会应用；分包按需加载。字体源站需允许跨域，HTTPS 网站也需要 HTTPS 字体链接。
    </p>
  </section>
</template>
