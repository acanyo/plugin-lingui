<script setup lang="ts">
import { computed, ref } from 'vue'
import { useElementSize, useIntersectionObserver } from '@vueuse/core'
import type { ComponentInstance } from '@lingui/renderer'
import LinguiRenderer from '../shared/LinguiRenderer.vue'
const props = defineProps<{ instance: ComponentInstance }>()
const host = ref<HTMLElement>()
const visible = ref(false)
const { width } = useElementSize(host)
const scale = computed(() => Math.min(1, width.value / 640))
useIntersectionObserver(
  host,
  ([entry]) => {
    if (entry?.isIntersecting) visible.value = true
  },
  { rootMargin: '160px' },
)
const paper = computed(() => ({
  background: props.instance.theme.colors.background,
  borderColor: props.instance.theme.colors.border,
  borderRadius: `${Math.min(20, props.instance.theme.radius)}px`,
}))
</script>
<template>
  <div ref="host" class="lu-market-thumbnail" :style="paper" inert aria-hidden="true">
    <div
      v-if="visible && width"
      class="lu-market-thumbnail-content"
      :style="{ transform: `scale(${scale})` }"
    >
      <LinguiRenderer :instance="instance" :auto-start="false" />
    </div>
    <div v-else class="lu-market-thumbnail-placeholder"><span /><span /><span /></div>
    <div
      class="lu-market-thumbnail-fade"
      :style="{ '--lu-thumbnail-bg': instance.theme.colors.background }"
    />
  </div>
</template>
