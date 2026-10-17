<script setup lang="ts">
import { ref } from 'vue'
import type { ComponentNode } from '@lingui/renderer'
const props = defineProps<{ node: ComponentNode }>()
const emit = defineEmits<{ update: [node: ComponentNode] }>()
const error = ref('')
function patch(key: string, value: unknown) {
  error.value = ''
  emit('update', { ...props.node, [key]: value })
}
function point(index: number, key: 'label' | 'x' | 'y', value: string) {
  if (
    key !== 'label' &&
    (!value.trim() || !Number.isFinite(Number(value)) || Math.abs(Number(value)) > 1e12)
  ) {
    error.value = '请输入有效数值，绝对值不能超过 1 万亿。'
    return
  }
  if (key === 'label' && !value.trim()) {
    error.value = '记录名称不能为空。'
    return
  }
  patch(
    'points',
    props.node.points!.map((point, i) =>
      i === index ? { ...point, [key]: key === 'label' ? value : Number(value) } : point,
    ),
  )
}
</script>
<template>
  <section
    v-if="node.component === 'LingUI.ScatterChart'"
    class="lu-table-editor"
    aria-label="散点数据编辑"
  >
    <label v-for="key in ['xLabel', 'yLabel'] as const" :key="key" class="lu-field"
      ><span>{{ key === 'xLabel' ? '横轴说明' : '纵轴说明' }}</span
      ><input
        maxlength="120"
        :value="node[key]"
        @change="patch(key, ($event.target as HTMLInputElement).value)"
    /></label>
    <div v-for="(item, index) in node.points" :key="index" class="lu-table-editor-row">
      <label class="lu-field"
        ><span>记录 {{ index + 1 }}</span
        ><input
          maxlength="120"
          :value="item.label"
          @change="point(index, 'label', ($event.target as HTMLInputElement).value)"
      /></label>
      <label v-for="key in ['x', 'y'] as const" :key="key" class="lu-field"
        ><span>{{ key.toUpperCase() }} 值</span
        ><input
          type="number"
          min="-1000000000000"
          max="1000000000000"
          :value="item[key]"
          @change="point(index, key, ($event.target as HTMLInputElement).value)"
      /></label>
      <button
        type="button"
        class="lu-text-button danger"
        :disabled="node.points!.length <= 1"
        @click="
          patch(
            'points',
            node.points!.filter((_, i) => i !== index),
          )
        "
      >
        移除记录
      </button>
    </div>
    <button
      type="button"
      class="lu-button"
      :disabled="node.points!.length >= 24"
      @click="patch('points', [...node.points!, { label: '新记录', x: 0, y: 0 }])"
    >
      添加记录
    </button>
    <p v-if="error" role="alert" class="lu-error">{{ error }}</p>
  </section>
</template>
