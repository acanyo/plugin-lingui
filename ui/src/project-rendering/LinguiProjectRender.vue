<script setup lang="ts">
import { computed, toRef } from 'vue'
import { VButton } from '@halo-dev/components'
import type { InteractionHost } from '@lingui/renderer'
import { useComponentReference } from '../component-embed/useComponentReference'
import LinguiRenderer from '../shared/LinguiRenderer.vue'

const props = withDefaults(
  defineProps<{
    projectId: string
    preview?: boolean
    fallback?: string
  }>(),
  { preview: false, fallback: '此作品暂时无法展示' },
)
const { instance, loading, error, refresh } = useComponentReference(toRef(props, 'projectId'))
const interactions = computed<InteractionHost>(() =>
  props.preview
    ? { autoStart: false, inheritRegistered: false, requests: { allow: () => false } }
    : { inheritRegistered: false },
)
defineExpose({ refresh })
</script>

<template>
  <div class="lingui-project-render" :aria-busy="loading">
    <p v-if="!projectId" role="status">请选择灵构 UI 作品</p>
    <p v-else-if="loading" role="status">正在加载灵构 UI 作品…</p>
    <LinguiRenderer
      v-else-if="instance"
      :key="projectId"
      :instance="instance"
      :interactions="interactions"
      :auto-start="!preview"
    />
    <div v-else role="alert">
      <slot name="fallback" :error="error" :refresh="refresh">
        <p>{{ fallback }}：{{ error }}</p>
        <VButton size="xs" @click="refresh">重新加载</VButton>
      </slot>
    </div>
  </div>
</template>

<style scoped>
.lingui-project-render {
  min-width: 0;
  width: 100%;
}
</style>
