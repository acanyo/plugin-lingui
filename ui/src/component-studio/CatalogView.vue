<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { builtInThemes, componentNames, type ComponentName } from '@lingui/renderer'
import catalog from '../../../packages/renderer/schemas/catalog.json'
import { componentGroups, nodeDescriptions, nodeLabels } from './catalog-labels'
import { createCatalogPreview } from './catalog-preview'
import StudioSearch from '../shared/StudioSearch.vue'
import LinguiRenderer from '../shared/LinguiRenderer.vue'
import LinguiIcon from '../shared/LinguiIcon.vue'
const search = ref('')
const selected = ref<ComponentName>('Text')
const reset = ref(0)
const themeId = ref('pure')
const viewport = ref<'desktop' | 'mobile'>('desktop')
const groups = computed(() =>
  componentGroups
    .map((group) => ({
      ...group,
      names: group.names.filter((name) =>
        `${nodeLabels[name]} ${name} ${nodeDescriptions[name]}`
          .toLocaleLowerCase()
          .includes(search.value.trim().toLocaleLowerCase()),
      ),
    }))
    .filter((group) => group.names.length),
)
const count = computed(() => groups.value.reduce((total, group) => total + group.names.length, 0))
watch(groups, (groups) => {
  if (groups.length && !groups.some((group) => group.names.includes(selected.value)))
    selected.value = groups[0]!.names[0]!
})
const example = computed(() => createCatalogPreview(selected.value))
const preview = computed(() => ({
  ...example.value,
  theme: builtInThemes.find((theme) => theme.id === themeId.value)!,
}))
</script>
<template>
  <section class="lu-library">
    <div class="lu-page-title">
      <div>
        <span class="lu-eyebrow">创作资源</span>
        <h1>基础组件</h1>
        <p class="lu-muted">选择基础组件，组合内容、样式和交互。</p>
      </div>
      <span class="lu-tag">{{ componentNames.length }} 种组件</span>
    </div>
    <div class="lu-catalog-layout">
      <aside class="lu-catalog-sidebar" aria-label="基础组件列表">
        <StudioSearch v-model="search" label="搜索基础组件" placeholder="搜索名称或用途…" />
        <p class="lu-catalog-count lu-muted" role="status">{{ count }} 种可用组件</p>
        <div class="lu-catalog-list">
          <section v-for="group in groups" :key="group.title">
            <h2 class="lu-catalog-group-title">{{ group.title }}</h2>
            <button
              v-for="name in group.names"
              :key="name"
              type="button"
              :class="['lu-catalog-item', { active: selected === name }]"
              :aria-pressed="selected === name"
              @click="selected = name"
            >
              <span>{{ nodeLabels[name] }}</span
              ><code>{{ name.replace('LingUI.', '') }}</code>
            </button>
          </section>
          <div v-if="!count" class="lu-catalog-empty">
            <p>没有找到匹配的组件</p>
            <button type="button" class="lu-text-button" @click="search = ''">清空搜索</button>
          </div>
        </div>
      </aside>
      <div v-if="count" class="lu-catalog-details">
        <header class="lu-catalog-detail-heading">
          <div>
            <h2>{{ nodeLabels[selected] }}</h2>
            <code>{{ selected }}</code>
          </div>
          <button type="button" class="lu-button" @click="reset++">
            <LinguiIcon name="reset" />重置预览
          </button>
        </header>
        <p class="lu-catalog-description">{{ nodeDescriptions[selected] }}</p>
        <div class="lu-catalog-preview-controls">
          <div class="lu-segment" role="group" aria-label="组件预览尺寸">
            <button
              type="button"
              :class="{ active: viewport === 'desktop' }"
              :aria-pressed="viewport === 'desktop'"
              @click="viewport = 'desktop'"
            >
              <LinguiIcon name="desktop" />桌面
            </button>
            <button
              type="button"
              :class="{ active: viewport === 'mobile' }"
              :aria-pressed="viewport === 'mobile'"
              @click="viewport = 'mobile'"
            >
              <LinguiIcon name="phone" />手机
            </button>
          </div>
          <select v-model="themeId" aria-label="组件预览主题">
            <option v-for="theme in builtInThemes" :key="theme.id" :value="theme.id">
              {{ theme.name }}
            </option>
          </select>
        </div>
        <div class="lu-catalog-preview" aria-label="基础组件交互预览">
          <div
            :class="['lu-catalog-preview-paper', { 'is-mobile': viewport === 'mobile' }]"
            :style="{
              background: preview.theme.colors.background,
              borderRadius: `${preview.theme.radius}px`,
            }"
          >
            <LinguiRenderer :key="`${selected}-${reset}`" :instance="preview" />
          </div>
        </div>
        <p class="lu-muted lu-catalog-tip">
          在工作台打开“手动编辑”，即可添加组件并调整内容、样式和交互。
        </p>
        <details :key="selected" class="lu-advanced">
          <summary>查看属性定义</summary>
          <pre class="lu-code">{{ JSON.stringify(catalog.components[selected], null, 2) }}</pre>
        </details>
      </div>
    </div>
  </section>
</template>
