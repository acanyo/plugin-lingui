<script setup lang="ts">
import { childIds, type ComponentNode } from '@lingui/renderer'
import { nodeLabels } from './catalog-labels'
defineProps<{
  id: string
  nodes: Record<string, ComponentNode>
  selected: string
  depth?: number
}>()
const emit = defineEmits<{ select: [id: string] }>()
</script>
<template>
  <div v-if="nodes[id]" class="lu-tree">
    <button
      type="button"
      :class="['lu-tree-item', { active: selected === id }]"
      :style="{ paddingLeft: `${12 + Math.min(depth ?? 0, 5) * 13}px` }"
      :aria-label="`选择组件 ${id}（${nodeLabels[nodes[id]!.component]}）`"
      :aria-pressed="selected === id"
      :title="`${id} · ${nodeLabels[nodes[id]!.component]}`"
      @click="emit('select', id)"
    >
      <span class="lu-tree-kind" aria-hidden="true">{{
        childIds(nodes[id]!).length ? '▾' : '·'
      }}</span
      ><span class="lu-tree-label"
        ><code class="lu-tree-id">{{ id }}</code
        ><small class="lu-tree-type"
          >{{ nodeLabels[nodes[id]!.component] }}{{ id === 'root' ? ' · 根节点' : '' }}</small
        ></span
      ></button
    ><StructureTree
      v-for="child in childIds(nodes[id]!)"
      :id="child"
      :key="child"
      :nodes="nodes"
      :selected="selected"
      :depth="(depth ?? 0) + 1"
      @select="emit('select', $event)"
    />
  </div>
</template>
