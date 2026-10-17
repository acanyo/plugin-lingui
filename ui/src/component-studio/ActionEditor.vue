<script setup lang="ts">
import type { ComponentNode, LinguiDocument } from '@lingui/renderer'
import EventEditor from './EventEditor.vue'
import LegacyActionEditor from './LegacyActionEditor.vue'
defineProps<{ node: ComponentNode; document: LinguiDocument }>()
const emit = defineEmits<{ update: [node: ComponentNode] }>()
</script>
<template>
  <EventEditor :node="node" :document="document" @update="emit('update', $event)" />
  <details
    v-if="node.action && ['Button', 'LingUI.IconButton'].includes(node.component)"
    class="lu-event-extra"
  >
    <summary>已有本地点击动作</summary>
    <LegacyActionEditor :node="node" @update="emit('update', $event)" />
  </details>
</template>
