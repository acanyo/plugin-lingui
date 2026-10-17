<script setup lang="ts">
import { computed } from 'vue'
import { workInstance, type MarketplaceWork } from './catalog'
import MarketThumbnail from './MarketThumbnail.vue'
import LinguiIcon from '../shared/LinguiIcon.vue'
const props = defineProps<{
  example: MarketplaceWork
  actionLabel?: string
  actionDisabled?: boolean
}>()
defineEmits<{ preview: []; use: [] }>()
const canRemix = computed(
  () =>
    props.example.kind === 'theme' ||
    props.example.source !== 'community' ||
    ['MIT', 'Apache-2.0', 'GPL-3.0'].includes(props.example.license),
)
const instance = computed(() => workInstance(props.example))
</script>
<template>
  <article class="lu-builtin-card" :aria-label="example.title">
    <div class="lu-builtin-cover">
      <MarketThumbnail :instance="instance" />
      <span class="lu-market-cover-kind"
        ><LinguiIcon :name="example.kind === 'theme' ? 'palette' : example.icon" />{{
          example.kind === 'theme' ? '主题' : '交互组件'
        }}</span
      >
      <button
        type="button"
        class="lu-builtin-preview-button"
        :aria-label="`预览${example.title}`"
        @click="$emit('preview')"
      >
        <span
          ><LinguiIcon name="expand" />{{
            example.kind === 'theme' ? '试用主题' : '交互预览'
          }}</span
        >
      </button>
    </div>
    <div class="lu-builtin-copy">
      <div class="lu-builtin-title">
        <LinguiIcon :name="example.icon" />
        <h3>
          <button type="button" :aria-label="`查看${example.title}详情`" @click="$emit('preview')">
            {{ example.title }}
          </button>
        </h3>
        <span class="lu-builtin-source">{{
          example.source === 'community' ? '社区' : '内置'
        }}</span>
      </div>
      <p>{{ example.description }}</p>
      <div class="lu-market-card-author">
        <span>{{ example.publisher }}</span
        ><span v-if="example.version">v{{ example.version }}</span>
      </div>
      <div class="lu-builtin-actions">
        <span class="lu-builtin-category">{{ example.category }}</span>
        <button
          type="button"
          class="lu-button"
          :aria-label="`${actionLabel ?? '使用'}${example.title}`"
          :disabled="actionDisabled || !canRemix"
          :title="canRemix ? undefined : '此作品未明确允许改编，请先向原作者取得可用许可证'"
          @click="$emit('use')"
        >
          {{ actionLabel ?? (example.kind === 'theme' ? '加入主题' : '使用') }}
          <LinguiIcon name="arrow" />
        </button>
      </div>
    </div>
  </article>
</template>
