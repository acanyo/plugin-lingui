<script setup lang="ts">
import type { ComponentNode } from '@lingui/renderer'
const props = defineProps<{ node: ComponentNode }>()
const emit = defineEmits<{ update: [node: ComponentNode] }>()
function patch(key: string, value: unknown) {
  emit('update', { ...props.node, [key]: value })
}
function column(index: number, value: string) {
  patch(
    'columns',
    props.node.columns!.map((item, i) => (i === index ? value : item)),
  )
}
function cell(rowIndex: number, index: number, value: string) {
  patch(
    'rows',
    props.node.rows!.map((row, i) =>
      i !== rowIndex
        ? row
        : index === -1
          ? { ...row, label: value }
          : { ...row, cells: row.cells.map((cell, j) => (j === index ? value : cell)) },
    ),
  )
}
function addColumn() {
  emit('update', {
    ...props.node,
    columns: [...props.node.columns!, '新方案'],
    rows: props.node.rows!.map((row) => ({ ...row, cells: [...row.cells, '内容'] })),
  })
}
function removeColumn(index: number) {
  emit('update', {
    ...props.node,
    columns: props.node.columns!.filter((_, i) => i !== index),
    rows: props.node.rows!.map((row) => ({
      ...row,
      cells: row.cells.filter((_, i) => i !== index - 1),
    })),
  })
}
</script>
<template>
  <label v-if="node.component === 'LingUI.Badge'" class="lu-field"
    ><span>语义颜色</span>
    <select
      :value="typeof node.tone === 'string' ? node.tone : 'info'"
      :disabled="typeof node.tone === 'object'"
      @change="patch('tone', ($event.target as HTMLSelectElement).value)"
    >
      <option value="info">默认</option>
      <option value="success">成功</option>
      <option value="warning">提示</option>
      <option value="danger">错误</option>
    </select>
  </label>
  <template v-if="node.component === 'LingUI.Quote'">
    <label v-if="node.label === undefined" class="lu-field"
      ><span>署名</span
      ><input type="text" @change="patch('label', ($event.target as HTMLInputElement).value)"
    /></label>
    <label v-if="node.description === undefined" class="lu-field"
      ><span>出处说明</span
      ><input type="text" @change="patch('description', ($event.target as HTMLInputElement).value)"
    /></label>
  </template>
  <label v-if="node.component === 'LingUI.Metric'" class="lu-field"
    ><span>指标数值</span>
    <input
      :value="typeof node.value === 'object' ? '根据参数自动计算' : node.value"
      :disabled="typeof node.value === 'object'"
      type="text"
      @change="patch('value', ($event.target as HTMLInputElement).value)"
    />
  </label>
  <section
    v-if="node.component === 'LingUI.Table'"
    class="lu-table-editor"
    aria-label="表格内容编辑"
  >
    <h3>表头</h3>
    <div v-for="(title, index) in node.columns" :key="index" class="lu-table-editor-line">
      <input
        :value="title"
        :aria-label="`第 ${index + 1} 列名称`"
        @change="column(index, ($event.target as HTMLInputElement).value)"
      />
      <button
        v-if="index > 0"
        type="button"
        class="lu-icon-button"
        :aria-label="`移除第 ${index + 1} 列`"
        :disabled="node.columns!.length <= 2"
        @click="removeColumn(index)"
      >
        ×
      </button>
    </div>
    <button
      type="button"
      class="lu-button"
      :disabled="node.columns!.length >= 6"
      @click="addColumn"
    >
      添加方案列
    </button>
    <div v-for="(row, rowIndex) in node.rows" :key="rowIndex" class="lu-table-editor-row">
      <div class="lu-panel-heading">
        <h3>第 {{ rowIndex + 1 }} 行</h3>
        <button
          type="button"
          class="lu-text-button danger"
          :disabled="node.rows!.length <= 1"
          @click="
            patch(
              'rows',
              node.rows!.filter((_, i) => i !== rowIndex),
            )
          "
        >
          移除此行
        </button>
      </div>
      <label class="lu-field"
        ><span>{{ node.columns![0] }}</span
        ><input
          :value="row.label"
          @change="cell(rowIndex, -1, ($event.target as HTMLInputElement).value)"
      /></label>
      <label v-for="(value, index) in row.cells" :key="index" class="lu-field"
        ><span>{{ node.columns![index + 1] }}</span
        ><input
          :value="value"
          @change="cell(rowIndex, index, ($event.target as HTMLInputElement).value)"
      /></label>
    </div>
    <button
      type="button"
      class="lu-button"
      :disabled="node.rows!.length >= 30"
      @click="
        patch('rows', [
          ...node.rows!,
          { label: '新维度', cells: node.columns!.slice(1).map(() => '内容') },
        ])
      "
    >
      添加对比行
    </button>
  </section>
</template>
