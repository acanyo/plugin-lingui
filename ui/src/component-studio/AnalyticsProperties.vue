<script setup lang="ts">
import { computed, ref } from 'vue'
import { readPath, type ComponentNode, type LinguiDocument, type State } from '@lingui/renderer'
import { updateBoundValue } from './value-editor'
const props = defineProps<{ node: ComponentNode; document: LinguiDocument; state: State }>()
const emit = defineEmits<{ update: [node: ComponentNode]; document: [document: LinguiDocument] }>()
const error = ref('')
const value = computed(() =>
  props.node.value && typeof props.node.value === 'object' && 'path' in props.node.value
    ? readPath(props.state, props.node.value.path)
    : props.node.value,
)
function patch(key: string, value: unknown) {
  error.value = ''
  emit('update', { ...props.node, [key]: value })
}
function numeric(key: 'min' | 'max' | 'value', text: string) {
  const next = Number(text)
  if (!text.trim() || !Number.isFinite(next) || Math.abs(next) > 1e12) {
    error.value = '请输入有效数值，绝对值不能超过 1 万亿。'
    return
  }
  if (
    props.node.component === 'LingUI.Gauge' &&
    ((key === 'min' && next >= Number(props.node.max)) ||
      (key === 'max' && next <= Number(props.node.min)))
  ) {
    error.value = '最大值必须大于最小值。'
    return
  }
  if (
    props.node.component === 'LingUI.RadarChart' &&
    (next <= 0 || props.node.data?.some((item) => item.value > next))
  ) {
    error.value = '刻度上限必须为正数，且不能小于已有数值。'
    return
  }
  if (props.node.component === 'LingUI.ProgressRing' && key === 'max' && next <= 0) {
    error.value = '进度上限必须为正数。'
    return
  }
  if (
    key === 'value' &&
    props.node.value &&
    typeof props.node.value === 'object' &&
    'path' in props.node.value
  ) {
    error.value = ''
    emit('document', updateBoundValue(props.document, props.node, next))
  } else patch(key, next)
}
function datum(index: number, key: 'label' | 'value', text: string) {
  if (
    key === 'value' &&
    (!text.trim() ||
      !Number.isFinite(Number(text)) ||
      Number(text) < 0 ||
      Number(text) > Number(props.node.max))
  ) {
    error.value = '数值必须在 0 到刻度上限之间。'
    return
  }
  patch(
    'data',
    props.node.data!.map((item, i) =>
      i === index ? { ...item, [key]: key === 'value' ? Number(text) : text } : item,
    ),
  )
}
function heatCell(row: number, column: number, text: string) {
  const next = Number(text)
  if (!text.trim() || !Number.isFinite(next) || next < 0 || next > 1e12) {
    error.value = '热力值必须在 0 到 1 万亿之间。'
    return
  }
  patch(
    'matrix',
    props.node.matrix!.map((item, i) =>
      i === row
        ? { ...item, cells: item.cells.map((cell, j) => (j === column ? next : cell)) }
        : item,
    ),
  )
}
function column(remove = -1) {
  const columns = [...props.node.columns!],
    matrix = props.node.matrix!.map((row) => ({ ...row, cells: [...row.cells] }))
  if (remove >= 0) {
    columns.splice(remove, 1)
    matrix.forEach((row) => row.cells.splice(remove, 1))
  } else {
    columns.push(`列 ${columns.length + 1}`)
    matrix.forEach((row) => row.cells.push(0))
  }
  emit('update', { ...props.node, columns, matrix })
}
</script>
<template>
  <section
    v-if="
      ['LingUI.Gauge', 'LingUI.RadarChart', 'LingUI.Heatmap', 'LingUI.ProgressRing'].includes(
        node.component,
      )
    "
    class="lu-table-editor"
    aria-label="分析图表编辑"
  >
    <label
      v-if="node.component !== 'LingUI.RadarChart' && node.component !== 'LingUI.ProgressRing'"
      class="lu-field"
      ><span>数值单位</span
      ><input
        :value="node.unit ?? ''"
        maxlength="40"
        @change="patch('unit', ($event.target as HTMLInputElement).value)"
    /></label>
    <template v-if="node.component === 'LingUI.Gauge' || node.component === 'LingUI.ProgressRing'">
      <label
        v-for="key in (node.component === 'LingUI.ProgressRing'
          ? ['max', 'value']
          : ['min', 'max', 'value']) as ('min' | 'max' | 'value')[]"
        :key="key"
        class="lu-field"
        ><span>{{ { min: '刻度最小值', max: '刻度最大值', value: '初始数值' }[key] }}</span
        ><input
          type="number"
          :value="key === 'value' ? value : node[key]"
          @change="numeric(key, ($event.target as HTMLInputElement).value)"
      /></label>
    </template>
    <template v-if="node.component === 'LingUI.RadarChart'">
      <label class="lu-field"
        ><span>统一刻度上限</span
        ><input
          type="number"
          :value="node.max"
          @change="numeric('max', ($event.target as HTMLInputElement).value)"
      /></label>
      <div v-for="(item, index) in node.data" :key="index" class="lu-table-editor-row">
        <label class="lu-field"
          ><span>维度 {{ index + 1 }} 名称</span
          ><input
            :value="item.label"
            @change="datum(index, 'label', ($event.target as HTMLInputElement).value)"
        /></label>
        <label class="lu-field"
          ><span>维度 {{ index + 1 }} 数值</span
          ><input
            type="number"
            min="0"
            :max="node.max"
            :value="item.value"
            @change="datum(index, 'value', ($event.target as HTMLInputElement).value)"
        /></label>
        <button
          type="button"
          class="lu-text-button danger"
          :disabled="node.data!.length <= 3"
          @click="
            patch(
              'data',
              node.data!.filter((_, i) => i !== index),
            )
          "
        >
          移除此维度
        </button>
      </div>
      <button
        type="button"
        class="lu-button"
        :disabled="node.data!.length >= 8"
        @click="patch('data', [...node.data!, { label: '新维度', value: 0 }])"
      >
        添加维度
      </button>
    </template>
    <template v-if="node.component === 'LingUI.Heatmap'">
      <div v-for="(name, index) in node.columns" :key="index" class="lu-table-editor-row">
        <label class="lu-field"
          ><span>列 {{ index + 1 }} 名称</span
          ><input
            :value="name"
            @change="
              patch(
                'columns',
                node.columns!.map((item, i) =>
                  i === index ? ($event.target as HTMLInputElement).value : item,
                ),
              )
            "
        /></label>
        <button
          type="button"
          class="lu-text-button danger"
          :disabled="node.columns!.length <= 1"
          @click="column(index)"
        >
          移除此列
        </button>
      </div>
      <button
        type="button"
        class="lu-button"
        :disabled="node.columns!.length >= 14"
        @click="column()"
      >
        添加列
      </button>
      <div v-for="(row, index) in node.matrix" :key="index" class="lu-table-editor-row">
        <label class="lu-field"
          ><span>行 {{ index + 1 }} 名称</span
          ><input
            :value="row.label"
            @change="
              patch(
                'matrix',
                node.matrix!.map((item, i) =>
                  i === index
                    ? { ...item, label: ($event.target as HTMLInputElement).value }
                    : item,
                ),
              )
            "
        /></label>
        <label v-for="(cell, j) in row.cells" :key="j" class="lu-field"
          ><span>{{ node.columns![j] }} 数值</span
          ><input
            type="number"
            min="0"
            max="1000000000000"
            :value="cell"
            @change="heatCell(index, j, ($event.target as HTMLInputElement).value)"
        /></label>
        <button
          type="button"
          class="lu-text-button danger"
          :disabled="node.matrix!.length <= 1"
          @click="
            patch(
              'matrix',
              node.matrix!.filter((_, i) => i !== index),
            )
          "
        >
          移除此行
        </button>
      </div>
      <button
        type="button"
        class="lu-button"
        :disabled="node.matrix!.length >= 12"
        @click="
          patch('matrix', [...node.matrix!, { label: '新行', cells: node.columns!.map(() => 0) }])
        "
      >
        添加行
      </button>
    </template>
    <p v-if="error" class="lu-error" role="alert">{{ error }}</p>
  </section>
</template>
