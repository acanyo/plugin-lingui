<script setup lang="ts">
import { computed } from 'vue'
import { readPath, type ComponentNode, type LinguiDocument, type State } from '@lingui/renderer'
import { updateBoundValue } from './value-editor'
const props = defineProps<{ node: ComponentNode; document: LinguiDocument; state: State }>()
const emit = defineEmits<{ document: [document: LinguiDocument] }>()
const value = computed(() =>
  typeof props.node.value === 'object' && 'path' in props.node.value
    ? readPath(props.state, props.node.value.path)
    : undefined,
)
function set(value: string | number | boolean) {
  emit('document', updateBoundValue(props.document, props.node, value))
}
</script>
<template>
  <label v-if="node.component === 'LingUI.Switch'" class="lu-check"
    ><input
      type="checkbox"
      :checked="value === true"
      @change="set(($event.target as HTMLInputElement).checked)"
    />默认开启</label
  >
  <label
    v-if="
      ['LingUI.Select', 'LingUI.SegmentedControl', 'LingUI.CardChoice', 'LingUI.Combobox'].includes(
        node.component,
      )
    "
    class="lu-field"
    ><span>初始选项</span
    ><select
      :value="typeof value === 'string' ? value : ''"
      @change="set(($event.target as HTMLSelectElement).value)"
    >
      <option value="">未选择</option>
      <option v-for="option in node.options" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </select></label
  >
  <label v-if="['LingUI.Cascader', 'LingUI.TreeSelect'].includes(node.component)" class="lu-field"
    ><span>初始节点</span
    ><select
      :value="typeof value === 'string' ? value : ''"
      @change="set(($event.target as HTMLSelectElement).value)"
    >
      <option value="">未选择</option>
      <option
        v-for="item in node.treeItems!.filter(
          (item) =>
            node.component !== 'LingUI.Cascader' ||
            !node.treeItems!.some((child) => child.parent === item.id),
        )"
        :key="item.id"
        :value="item.id"
      >
        {{ item.label }}
      </option>
    </select></label
  >
  <label v-if="node.component === 'LingUI.Rating'" class="lu-field"
    ><span>初始评分（0 表示未评分）</span
    ><input
      type="number"
      min="0"
      :max="node.max ?? 5"
      :value="typeof value === 'number' ? value : 0"
      @change="
        set(
          Math.max(
            0,
            Math.min(
              Number(node.max ?? 5),
              Math.round(Number(($event.target as HTMLInputElement).value) || 0),
            ),
          ),
        )
      "
  /></label>
</template>
