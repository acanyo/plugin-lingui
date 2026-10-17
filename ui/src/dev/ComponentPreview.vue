<script setup lang="ts">
import { computed, ref } from 'vue'
import { builtInThemes, createInstance, examples, createDemoRequests } from '@lingui/renderer'
import LinguiRenderer from '../shared/LinguiRenderer.vue'
import './preview.css'
const props = defineProps<{ exampleId: string }>()
const scenario = ref(props.exampleId)
const themeId = ref('pure')
const mobile = ref(false)
const interactions = {
  inheritRegistered: false,
  requests: createDemoRequests({ allowReal: () => true }),
}
const instance = computed(() =>
  createInstance(
    examples.find((example) => example.id === scenario.value)!.create(),
    builtInThemes.find((theme) => theme.id === themeId.value)!,
  ),
)
</script>
<template>
  <main class="lu-component-preview">
    <nav class="lu-preview-controls" aria-label="组件预览设置">
      <a href="/">返回工作室</a>
      <select v-model="scenario" aria-label="预览组件">
        <option v-for="example in examples" :key="example.id" :value="example.id">
          {{ example.title }}
        </option>
      </select>
      <select v-model="themeId" aria-label="预览主题">
        <option v-for="theme in builtInThemes" :key="theme.id" :value="theme.id">
          {{ theme.name }}
        </option>
      </select>
      <button type="button" :aria-pressed="mobile" @click="mobile = !mobile">
        {{ mobile ? '桌面宽度' : '手机宽度' }}
      </button>
    </nav>
    <div :class="['lu-preview-article', { 'lu-preview-article-mobile': mobile }]">
      <LinguiRenderer :instance="instance" :interactions="interactions" />
    </div>
  </main>
</template>
