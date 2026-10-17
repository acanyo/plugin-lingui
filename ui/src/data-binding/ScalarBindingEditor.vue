<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'
import type { ComponentNode, LinguiDocument } from '@lingui/renderer'
import { dynamicPaths, replaceDynamicPaths, type DynamicPath } from './dynamic-paths'
import { dataSamples } from './samples'
import { responseSamplesKey } from './context'
import FieldPicker from './FieldPicker.vue'
const props = defineProps<{ node: ComponentNode; document: LinguiDocument }>()
const emit = defineEmits<{ update: [node: ComponentNode] }>()
const observations = inject(
  responseSamplesKey,
  computed(() => ({})),
)
const samples = computed(() => dataSamples(props.document, observations.value))
const paths = ref<DynamicPath[]>([])
const error = ref('')
watch(
  () => props.node,
  (node) => {
    paths.value = dynamicPaths(node)
    error.value = ''
  },
  { immediate: true },
)
function save() {
  try {
    emit('update', replaceDynamicPaths(props.node, paths.value))
    error.value = ''
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '绑定路径无效'
  }
}
</script>
<template>
  <details v-if="paths.length" class="lu-advanced lu-scalar-bindings">
    <summary>属性数据绑定</summary>
    <p class="lu-muted">选择接口字段或填写状态路径。仅修改数据来源，保留原有计算与空值处理。</p>
    <div
      v-for="(item, index) in paths"
      :key="item.property + item.trail.join('.')"
      class="lu-binding-section"
    >
      <p>
        <code>{{ item.property }}</code
        ><small v-if="item.trail.length" class="lu-muted"> · {{ item.trail.join('.') }}</small>
      </p>
      <FieldPicker
        v-model="item.path"
        :samples="samples"
        :label="`${item.property} 绑定路径${paths.slice(0, index).some((prior) => prior.property === item.property) ? ` ${index + 1}` : ''}`"
      />
    </div>
    <p v-if="error" class="lu-error" role="alert">{{ error }}</p>
    <button type="button" class="lu-button" @click="save">应用属性绑定</button>
  </details>
</template>
