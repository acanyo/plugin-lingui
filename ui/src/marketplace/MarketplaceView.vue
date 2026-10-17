<script setup lang="ts">
import type { WorkSource } from '../remix/provenance'
import type { ComponentInstance, ThemeTokens } from '@lingui/renderer'
import CommunityCatalog from './CommunityCatalog.vue'
import LinguiIcon from '../shared/LinguiIcon.vue'
withDefaults(defineProps<{ remoteEnabled?: boolean }>(), { remoteEnabled: true })
const emit = defineEmits<{
  use: [work: ComponentInstance, sources?: WorkSource[]]
  theme: [theme: ThemeTokens]
  drafts: []
}>()
</script>
<template>
  <div class="lu-market">
    <div class="lu-page-title">
      <div>
        <span class="lu-eyebrow">组件资源</span>
        <h1>组件市场</h1>
        <p class="lu-muted">发现交互组件和主题，先试用，再带回工作台。</p>
      </div>
      <button type="button" class="lu-button" @click="emit('drafts')">
        <LinguiIcon name="arrowUp" /> 投稿草稿
      </button>
    </div>
    <CommunityCatalog
      v-if="remoteEnabled"
      @use="(instance, sources) => emit('use', instance, sources)"
      @theme="emit('theme', $event)"
      @drafts="emit('drafts')"
    />
    <div v-else class="lu-market-empty">
      <LinguiIcon name="layers" />
      <h3>在 Halo 工作台中浏览组件市场</h3>
      <p class="lu-muted">市场展示已审核并上架的作品。独立工作室中可以继续创作和管理投稿草稿。</p>
      <button type="button" class="lu-button" @click="emit('drafts')">管理投稿草稿</button>
    </div>
  </div>
</template>
