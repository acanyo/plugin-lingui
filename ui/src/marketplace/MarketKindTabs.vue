<script setup lang="ts">
import LinguiIcon from '../shared/LinguiIcon.vue'

export type MarketKind = 'component' | 'theme'
const props = defineProps<{
  modelValue: MarketKind
  counts: Record<MarketKind, number | undefined>
  panelId: string
}>()
const emit = defineEmits<{ 'update:modelValue': [kind: MarketKind] }>()
const tabs = [
  { kind: 'component', label: '组件', icon: 'layers' },
  { kind: 'theme', label: '主题', icon: 'palette' },
] as const
function keydown(event: KeyboardEvent) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const kind =
    event.key === 'Home'
      ? 'component'
      : event.key === 'End'
        ? 'theme'
        : props.modelValue === 'component'
          ? 'theme'
          : 'component'
  const group = (event.currentTarget as HTMLElement).parentElement
  emit('update:modelValue', kind)
  group?.querySelector<HTMLButtonElement>(`[data-kind="${kind}"]`)?.focus()
}
</script>
<template>
  <div class="lu-market-kind-tabs" role="tablist" aria-label="市场作品类型">
    <button
      v-for="tab in tabs"
      :id="`${panelId}-${tab.kind}`"
      :key="tab.kind"
      type="button"
      role="tab"
      :data-kind="tab.kind"
      :aria-selected="modelValue === tab.kind"
      :aria-controls="panelId"
      :tabindex="modelValue === tab.kind ? 0 : -1"
      @click="emit('update:modelValue', tab.kind)"
      @keydown="keydown"
    >
      <LinguiIcon :name="tab.icon" /><span>{{ tab.label }}</span>
      <span v-if="counts[tab.kind] !== undefined" class="lu-market-count">{{
        counts[tab.kind]
      }}</span>
    </button>
  </div>
</template>
