<script setup lang="ts">
import { computed } from 'vue'
import { accentForeground, contrastRatio, type ThemeTokens } from '@lingui/renderer'
const props = defineProps<{ theme: ThemeTokens }>()
const checks = computed(() => {
  const c = props.theme.colors
  const worst = (color: string) =>
    Math.min(contrastRatio(color, c.background), contrastRatio(color, c.surface))
  return [
    { label: '正文文字', ratio: worst(c.text), minimum: 4.5 },
    { label: '辅助文字', ratio: worst(c.muted), minimum: 4.5 },
    {
      label: '主按钮文字',
      ratio: contrastRatio(accentForeground(c.accent), c.accent),
      minimum: 4.5,
    },
    { label: '强调色与表面', ratio: worst(c.accent), minimum: 3 },
  ]
})
</script>
<template>
  <section class="lu-theme-contrast" aria-label="主题对比度">
    <div class="lu-theme-section-heading">
      <h2>可读性检查</h2>
      <span>文字 4.5:1 · 控件 3:1</span>
    </div>
    <div class="lu-theme-contrast-grid">
      <div
        v-for="check in checks"
        :key="check.label"
        class="lu-theme-contrast-item"
        :class="{ warning: check.ratio < check.minimum }"
      >
        <span>{{ check.label }}</span
        ><strong>{{ check.ratio.toFixed(2) }}<small>:1</small></strong
        ><span>{{ check.ratio >= check.minimum ? '对比清晰' : '建议调整配色' }}</span>
      </div>
    </div>
    <p class="lu-muted">正文与辅助文字检查页面、次级表面中的较低值；提示不会更改你的配色。</p>
  </section>
</template>
