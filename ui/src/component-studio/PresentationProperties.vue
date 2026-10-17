<script setup lang="ts">
import type { ComponentNode } from '@lingui/renderer'
const props = defineProps<{ node: ComponentNode }>()
const emit = defineEmits<{ update: [node: ComponentNode] }>()
function patch(key: string, value: unknown) {
  emit('update', { ...props.node, [key]: value })
}
</script>
<template>
  <label v-if="['LingUI.Avatar', 'LingUI.Spinner'].includes(node.component)" class="lu-field"
    ><span>尺寸</span
    ><select
      :value="node.size ?? 'medium'"
      @change="patch('size', ($event.target as HTMLSelectElement).value)"
    >
      <option value="small">小</option>
      <option value="medium">中</option>
      <option value="large">大</option>
    </select></label
  >
  <template v-if="node.component === 'LingUI.Skeleton'">
    <label class="lu-field"
      ><span>占位样式</span
      ><select
        :value="node.variant ?? 'text'"
        @change="patch('variant', ($event.target as HTMLSelectElement).value)"
      >
        <option value="text">文字</option>
        <option value="avatar">头像与文字</option>
        <option value="card">卡片</option>
      </select></label
    >
    <label class="lu-field"
      ><span>占位行数</span
      ><input
        type="number"
        min="1"
        max="8"
        :value="node.lines ?? 3"
        @change="
          patch(
            'lines',
            Math.max(
              1,
              Math.min(8, Math.round(Number(($event.target as HTMLInputElement).value) || 3)),
            ),
          )
        "
    /></label>
  </template>
  <label v-if="node.component === 'LingUI.EmptyState'" class="lu-field"
    ><span>提示图标</span
    ><select
      :value="node.name ?? 'layers'"
      @change="patch('name', ($event.target as HTMLSelectElement).value)"
    >
      <option
        v-for="icon in ['layers', 'book', 'list', 'help', 'info', 'sparkles']"
        :key="icon"
        :value="icon"
      >
        {{ icon }}
      </option>
    </select></label
  >
</template>
