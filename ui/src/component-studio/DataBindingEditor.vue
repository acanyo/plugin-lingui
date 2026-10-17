<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'
import {
  bindingCapabilities,
  validateDataBindings,
  resolveCollectionNode,
  type ComponentNode,
  type State,
  type LinguiDocument,
} from '@lingui/renderer'
import { bindingDiagnostics } from '../data-binding/diagnostics'
import { fields } from '../data-binding/fields'
import { dataSamples, sampleState, sampleValue } from '../data-binding/samples'
import { responseSamplesKey } from '../data-binding/context'
import FieldPicker from '../data-binding/FieldPicker.vue'
import MappingFields from '../data-binding/MappingFields.vue'
const props = defineProps<{ node: ComponentNode; state: State; document?: LinguiDocument }>()
const observations = inject(
  responseSamplesKey,
  computed(() => ({})),
)
const samples = computed(() =>
  props.document
    ? dataSamples(props.document, observations.value)
    : [{ label: '初始状态', path: '/', value: props.state }],
)
function record(key: string) {
  try {
    const value = sampleValue(samples.value, draft.value[key]?.path || '/')
    return Array.isArray(value) ? value[0] : undefined
  } catch {
    return undefined
  }
}
const emit = defineEmits<{ update: [node: ComponentNode] }>()
const keys = computed(() => bindingCapabilities[props.node.component] ?? [])
const draft = ref<Record<string, { path: string; map: string }>>({})
const loading = ref(''),
  failure = ref(''),
  empty = ref(''),
  error = ref('')
watch(
  () => props.node,
  (node) => {
    draft.value = Object.fromEntries(
      keys.value.map((key) => {
        const binding = node.bindings?.[key as keyof typeof node.bindings]
        return [
          key,
          {
            path: binding?.path ?? '',
            map: binding?.map ? JSON.stringify(binding.map, null, 2) : '',
          },
        ]
      }),
    )
    loading.value = node.dataState?.loading?.path ?? ''
    failure.value = node.dataState?.error?.path ?? ''
    empty.value = node.dataState?.emptyText ?? ''
    error.value = ''
  },
  { immediate: true },
)
function draftNode(): ComponentNode {
  const bindings = Object.fromEntries(
    Object.entries(draft.value)
      .filter(([, value]) => value.path.trim())
      .map(([key, value]) => [
        key,
        { path: value.path.trim(), ...(value.map.trim() ? { map: JSON.parse(value.map) } : {}) },
      ]),
  )
  const node: ComponentNode = {
    ...props.node,
    bindings,
    dataState: {
      ...(loading.value.trim() ? { loading: { path: loading.value.trim() } } : {}),
      ...(failure.value.trim() ? { error: { path: failure.value.trim() } } : {}),
      ...(empty.value ? { emptyText: empty.value } : {}),
    },
  }
  if (!Object.keys(bindings).length) delete node.bindings
  if (!Object.keys(node.dataState ?? {}).length) delete node.dataState
  validateDataBindings(node)
  return node
}
const preview = computed(() => {
  try {
    const node = draftNode()
    const diagnostics = bindingDiagnostics(node, samples.value)
    const problem = diagnostics.find((issue) => issue.level === 'error')
    if (problem) throw new Error(problem.message)
    const result = resolveCollectionNode(node, sampleState(samples.value, node))
    return {
      valid: true,
      warnings: diagnostics
        .filter((issue) => issue.level === 'warning')
        .map((issue) => issue.message),
      text: JSON.stringify(
        Object.fromEntries(keys.value.map((key) => [key, result.node[key as keyof ComponentNode]])),
        null,
        2,
      ),
    }
  } catch (cause) {
    return { valid: false, text: cause instanceof Error ? cause.message : '数据尚未就绪' }
  }
})
function save() {
  try {
    const node = draftNode()
    if (!preview.value.valid) throw new Error(preview.value.text)
    emit('update', node)
    error.value = ''
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '绑定配置无效'
  }
}
</script>
<template>
  <details
    v-if="keys.length"
    class="lu-advanced lu-data-bindings"
    :open="!!node.bindings || !!node.dataState"
  >
    <summary>动态数据绑定</summary>
    <p class="lu-muted">将接口结果写入状态，组件会自动更新。保留静态内容作为未绑定时的配置。</p>
    <div v-for="key in keys" :key="key" class="lu-binding-section">
      <label class="lu-field"
        ><span>{{ key }} 数据路径</span></label
      >
      <FieldPicker
        v-model="draft[key]!.path"
        :samples="samples"
        :label="`${key} 数据路径`"
        arrays-only
      />
      <details class="lu-advanced">
        <summary>查看数据字段树</summary>
        <div v-for="sample in samples" :key="sample.label + sample.path" class="lu-data-tree">
          <strong>{{ sample.label }}</strong>
          <div
            v-for="field in fields(sample.value, sample.path)"
            :key="field.path"
            :style="{ paddingInlineStart: `${field.depth * 12}px` }"
          >
            <code>{{ field.path }}</code
            ><small>{{ field.type }}</small>
          </div>
        </div>
      </details>
      <MappingFields :node="node" :property="key" v-model="draft[key]!.map" :record="record(key)" />
      <details class="lu-advanced">
        <summary>高级字段映射 JSON</summary>
        <label class="lu-field"
          ><span>字段映射（选填 JSON）</span
          ><textarea
            v-model="draft[key]!.map"
            class="lu-code"
            rows="4"
            placeholder='{"label":"/name","value":"/count"}'
          />
        </label>
      </details>
    </div>
    <label class="lu-field"
      ><span>加载状态路径</span><input v-model="loading" placeholder="/loading"
    /></label>
    <label class="lu-field"
      ><span>错误状态路径</span><input v-model="failure" placeholder="/error"
    /></label>
    <label class="lu-field"
      ><span>空数据提示</span><input v-model="empty" placeholder="暂无数据" maxlength="300"
    /></label>
    <p v-if="error" class="lu-error" role="alert">{{ error }}</p>
    <button type="button" class="lu-button" @click="save">应用数据绑定</button>
    <details class="lu-advanced">
      <summary>当前数据预览</summary>
      <p v-if="!preview.valid" class="lu-error" role="status">{{ preview.text }}</p>
      <template v-else
        ><p v-for="warning in preview.warnings" :key="warning" class="lu-muted">{{ warning }}</p>
        <pre class="lu-code">{{ preview.text }}</pre>
      </template>
    </details>
  </details>
</template>
