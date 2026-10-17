<script setup lang="ts">
import { computed } from 'vue'
import type { ComponentInstance } from '@lingui/renderer'
import { targetInfo, type EditTarget } from './model'
const props = defineProps<{ instance: ComponentInstance; target: EditTarget; disabled?: boolean }>()
const emit = defineEmits<{ update: [value: EditTarget]; clear: []; reselect: [] }>()
const info = computed(() => {
  try {
    return targetInfo(props.instance.document, props.target)
  } catch {
    return undefined
  }
})
</script>
<template>
  <section class="lu-edit-target" aria-label="AI 局部修改目标">
    <header>
      <strong>局部修改 · {{ target.nodeId }}</strong
      ><small>{{ info?.node.component }}</small>
    </header>
    <nav v-if="info" aria-label="所选组件路径">
      <button
        v-for="id in info.path"
        :key="id"
        type="button"
        class="lu-text-button"
        :disabled="disabled"
        :aria-current="id === target.nodeId ? 'true' : undefined"
        @click="emit('update', { nodeId: id, scope: target.scope })"
      >
        {{ id }}
      </button>
    </nav>
    <div class="lu-edit-scope" role="group" aria-label="局部修改范围">
      <button
        v-for="scope in ['node', 'subtree'] as const"
        :key="scope"
        type="button"
        :disabled="disabled"
        :aria-pressed="target.scope === scope"
        @click="emit('update', { ...target, scope })"
      >
        {{ scope === 'node' ? '仅此组件' : '包含子组件' }}
      </button>
    </div>
    <p>仅调整静态文字、外观和布局。按钮文字在子组件时，请选“包含子组件”。</p>
    <div class="lu-edit-target-actions">
      <button type="button" class="lu-text-button" :disabled="disabled" @click="emit('reselect')">
        重新选取
      </button>
      <button type="button" class="lu-text-button" :disabled="disabled" @click="emit('clear')">
        改为整件作品
      </button>
    </div>
  </section>
</template>
