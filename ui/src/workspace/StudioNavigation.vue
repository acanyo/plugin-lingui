<script setup lang="ts">
import LinguiIcon from '../shared/LinguiIcon.vue'
import LinguiBrandIcon from '../shared/LinguiBrandIcon.vue'
export type StudioSection =
  'components' | 'projects' | 'market' | 'drafts' | 'catalog' | 'themes' | 'fonts' | 'mcp'
defineProps<{
  section: StudioSection
  mode: 'local' | 'halo'
  embedding?: boolean
  hasActive?: boolean
}>()
defineEmits<{ navigate: [section: StudioSection]; close: [] }>()
</script>
<template>
  <header class="lu-app-header">
    <div class="lu-brand">
      <span class="lu-brand-symbol"><LinguiBrandIcon badge /></span
      ><strong>灵构<span>UI</span></strong>
    </div>
    <nav class="lu-app-nav" aria-label="工作室导航">
      <button
        type="button"
        :class="{
          active: ['components', 'projects', 'catalog', 'themes', 'fonts'].includes(section),
        }"
        :aria-current="
          ['components', 'projects', 'catalog', 'themes', 'fonts'].includes(section)
            ? 'page'
            : undefined
        "
        @click="$emit('navigate', 'components')"
      >
        开发工作台
        <span v-if="hasActive" class="lu-nav-dot" aria-hidden="true" title="有正在编辑的项目" />
      </button>
      <button
        type="button"
        :class="{ active: section === 'market' }"
        :aria-current="section === 'market' ? 'page' : undefined"
        @click="$emit('navigate', 'market')"
      >
        组件市场
      </button>
      <button
        type="button"
        :class="{ active: section === 'drafts' }"
        :aria-current="section === 'drafts' ? 'page' : undefined"
        @click="$emit('navigate', 'drafts')"
      >
        投稿草稿
      </button>
      <button
        type="button"
        :class="{ active: section === 'mcp' }"
        :aria-current="section === 'mcp' ? 'page' : undefined"
        @click="$emit('navigate', 'mcp')"
      >
        MCP 管理
      </button>
    </nav>
    <div class="lu-app-context">
      <a
        class="lu-support-link"
        href="https://docs.xhhao.com/"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="查看文档（新窗口打开）"
        ><LinguiIcon name="book" /><span>查看文档</span></a
      >
      <a
        class="lu-support-link"
        href="https://qm.qq.com/q/YqlBX8d2Ei"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="QQ 讨论：Halo插件主题交流群（新窗口打开）"
        ><LinguiIcon name="message" /><span>QQ 讨论</span></a
      >
      <button
        v-if="embedding"
        type="button"
        class="lu-icon-button"
        aria-label="关闭工作室"
        @click="$emit('close')"
      >
        <LinguiIcon name="close" />
      </button>
    </div>
  </header>
</template>
