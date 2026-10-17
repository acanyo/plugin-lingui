<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  autoDarkColors,
  autoLightColors,
  createInstance,
  examples,
  tokenStyle,
  type ThemeTokens,
} from '@lingui/renderer'
import LinguiRenderer from '../shared/LinguiRenderer.vue'
import LinguiIcon from '../shared/LinguiIcon.vue'
import ThemeContrast from './ThemeContrast.vue'
import { themeControlsDocument } from './preview-document'
const props = defineProps<{ theme: ThemeTokens }>()
const scenario = ref('controls'),
  device = ref('desktop'),
  autoMode = ref<'light' | 'dark'>('light'),
  revision = ref(0)
const specimen = themeControlsDocument()
const resolved = computed(() =>
  props.theme.mode === 'auto'
    ? {
        ...props.theme,
        mode: autoMode.value,
        colors:
          autoMode.value === 'dark'
            ? autoDarkColors(props.theme.colors)
            : autoLightColors(props.theme.colors),
      }
    : props.theme,
)
const preview = computed(() =>
  createInstance(
    scenario.value === 'controls'
      ? specimen
      : examples.find((example) => example.id === scenario.value)!.create(),
    resolved.value,
  ),
)
</script>
<template>
  <div class="lu-theme-preview">
    <div class="lu-theme-preview-header">
      <div>
        <h2>实时预览</h2>
        <p class="lu-muted">修改样式，马上试用。</p>
      </div>
      <div class="lu-theme-device" role="group" aria-label="主题预览尺寸">
        <button
          v-for="item in [
            { id: 'desktop', name: '桌面', icon: 'desktop' },
            { id: 'mobile', name: '手机', icon: 'phone' },
          ]"
          :key="item.id"
          type="button"
          :aria-label="`${item.name}主题预览`"
          :aria-pressed="device === item.id"
          @click="device = item.id"
        >
          <LinguiIcon :name="item.icon" />
        </button>
      </div>
    </div>
    <div class="lu-theme-preview-toolbar">
      <select v-model="scenario" aria-label="主题预览场景">
        <option value="controls">基础控件 · 输入与反馈</option>
        <option v-for="example in examples" :key="example.id" :value="example.id">
          {{ example.title }}
        </option>
      </select>
      <div
        v-if="theme.mode === 'auto'"
        class="lu-theme-auto-modes"
        role="group"
        aria-label="自动主题预览效果"
      >
        <button
          v-for="mode in [
            { id: 'light' as const, name: '浅色效果' },
            { id: 'dark' as const, name: '深色效果' },
          ]"
          :key="mode.id"
          type="button"
          :aria-pressed="autoMode === mode.id"
          @click="autoMode = mode.id"
        >
          {{ mode.name }}
        </button>
      </div>
      <button type="button" class="lu-text-button" @click="revision++">
        <LinguiIcon name="refresh" />重置交互
      </button>
    </div>
    <div class="lu-theme-preview-stage" :class="{ mobile: device === 'mobile' }">
      <div class="lu-theme-preview-frame" :style="tokenStyle(resolved)">
        <LinguiRenderer :key="revision" :instance="preview" />
      </div>
    </div>
    <ThemeContrast :theme="resolved" />
    <p class="lu-canvas-hint">主题修改不会影响文章中已保存的组件。</p>
  </div>
</template>
