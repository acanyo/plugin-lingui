<script setup lang="ts">
import { computed } from 'vue'
import { parseSource, type ComponentInstance } from '@lingui/renderer'
const emit = defineEmits<{ select: [id: string]; cancel: [] }>()
const props = defineProps<{ instance: ComponentInstance }>()
const options = computed(() =>
  parseSource(props.instance.document.source).map((node) => ({
    value: node.id,
    label: `${node.id} · ${node.component}`,
  })),
)
</script>
<template>
  <section class="lu-selection-bar" aria-label="选取局部修改组件">
    <p>点击预览中的组件，或从列表选择。选取期间暂停交互。</p>
    <FormKit
      type="select"
      :options="[{ value: '', label: '按 ID 选择组件…' }, ...options]"
      model-value=""
      label="选择组件"
      :delay="0"
      @update:model-value="$event && emit('select', String($event))"
    />
    <button type="button" class="lu-text-button" @click="emit('cancel')">退出选取</button>
  </section>
</template>
