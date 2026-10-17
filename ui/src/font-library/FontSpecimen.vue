<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from 'vue'
import { fontFamilyName, registerFont, type FontFamilyDefinition } from '@lingui/renderer'
const props = withDefaults(
  defineProps<{ font: FontFamilyDefinition; text?: string; weight?: string }>(),
  { text: '灵感成形，文字有自己的声音。 Design 0123', weight: '400' },
)
const status = ref(''),
  family = computed(() => fontFamilyName(props.font))
const specimenStyle = computed(() => ({
  fontFamily: `"${family.value}", sans-serif`,
  fontWeight: props.weight,
}))
let release = () => undefined as void
let revision = 0
watch(
  () => props.font,
  (font) => {
    release()
    try {
      release = registerFont(font, document)
    } catch {
      status.value = '字体配置暂不受浏览器支持，显示备用字体。'
    }
  },
  { immediate: true, deep: true },
)
watch(
  [family, () => props.text, () => props.weight],
  async () => {
    const current = ++revision
    if (!document.fonts || !props.text.trim()) {
      status.value = ''
      return
    }
    status.value = '加载字样所需分包…'
    try {
      const faces = await document.fonts.load(`${props.weight} 20px "${family.value}"`, props.text)
      if (current === revision) status.value = faces.length ? '字样已加载' : '这些字符使用备用字体'
    } catch {
      if (current === revision)
        status.value = '字体加载失败，已显示备用字体。请检查链接、跨域和字体文件。'
    }
  },
  { immediate: true },
)
onScopeDispose(() => {
  revision++
  release()
})
</script>
<template>
  <div class="lu-font-specimen">
    <p :style="specimenStyle">{{ text || '输入文字试用字体' }}</p>
    <small v-if="status" role="status">{{ status }}</small>
  </div>
</template>
