<script setup lang="ts">
import { ref, watch } from 'vue'
import type { LinguiDocument, Parameter } from '@lingui/renderer'
const props = defineProps<{ document: LinguiDocument }>()
const emit = defineEmits<{ update: [document: LinguiDocument] }>()
const items = ref<Parameter[]>([])
watch(
  () => props.document.parameters,
  (value) => {
    items.value = JSON.parse(JSON.stringify(value))
  },
  { immediate: true, deep: true },
)
function apply() {
  emit('update', { ...props.document, parameters: items.value })
}
function add() {
  items.value.push({
    key: `parameter${items.value.length + 1}`,
    label: '新参数',
    path: '/value',
    type: 'string',
    default: '',
  })
  apply()
}
function setType(item: Parameter, type: Parameter['type']) {
  item.type = type
  item.default = type === 'boolean' ? false : type === 'number' ? 0 : ''
  apply()
}
function setDefault(item: Parameter, event: Event) {
  const input = event.target as HTMLInputElement
  item.default =
    item.type === 'boolean'
      ? input.checked
      : item.type === 'number'
        ? Number(input.value)
        : input.value
  apply()
}
function remove(index: number) {
  items.value.splice(index, 1)
  apply()
}
</script>
<template>
  <div class="lu-parameters">
    <h3>组件参数</h3>
    <p class="lu-muted">插入文章时可填写这些参数，每篇文章单独保存。</p>
    <div v-for="(item, index) in items" :key="index" class="lu-parameter">
      <label class="lu-field"
        ><span>参数名称</span><input v-model="item.label" @change="apply" /></label
      ><label class="lu-field"><span>标识</span><input v-model="item.key" @change="apply" /></label
      ><label class="lu-field"
        ><span>状态路径</span><input v-model="item.path" @change="apply" /></label
      ><label class="lu-field"
        ><span>类型</span
        ><select
          :value="item.type"
          @change="setType(item, ($event.target as HTMLSelectElement).value as Parameter['type'])"
        >
          <option value="string">文字</option>
          <option value="number">数字</option>
          <option value="boolean">开关</option>
        </select></label
      ><label class="lu-field"
        ><span>默认值</span
        ><input
          v-if="item.type === 'boolean'"
          type="checkbox"
          :checked="Boolean(item.default)"
          @change="setDefault(item, $event)" /><input
          v-else
          :type="item.type === 'number' ? 'number' : 'text'"
          :value="item.default as string | number"
          @change="setDefault(item, $event)" /></label
      ><button type="button" class="lu-text-button danger" @click="remove(index)">删除参数</button>
    </div>
    <button type="button" class="lu-button" @click="add">＋ 添加参数</button>
  </div>
</template>
