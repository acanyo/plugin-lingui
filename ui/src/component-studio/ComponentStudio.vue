<script setup lang="ts">
import { reparentNode } from './reparent-editor'
import { cloneJson } from '../shared/clone'

import LinguiRenderer from '../shared/LinguiRenderer.vue'
import LinguiIcon from '../shared/LinguiIcon.vue'
import { computed, nextTick, ref, watch, provide } from 'vue'
import type { BindingImpact } from '../integrations/contracts/impact'
import {
  componentNames,
  resolveDocument,
  type ComponentInstance,
  type ComponentNode,
  type LinguiDocument,
  type ThemeTokens,
} from '@lingui/renderer'
import { integrationKey } from '../integrations/context'
import StructureTree from './StructureTree.vue'
import NodeProperties from './NodeProperties.vue'
import ActionEditor from './ActionEditor.vue'
import { graphReportsKey } from '../interaction-graph/context'
import EventDebugger from './EventDebugger.vue'
import { useEventDebug, type EventDebugController } from './useEventDebug'
import ParameterEditor from './ParameterEditor.vue'
import InstanceParameters from './InstanceParameters.vue'
import {
  addNode,
  moveNode,
  removeNode,
  replaceSurface,
  updateInstanceDocument,
  updateNode,
  updateText,
} from './document-editor'
import { nodeLabels } from './catalog-labels'
import { useStudioAccess } from '../services/studio-access'
const access = useStudioAccess()
const localEventDebug = useEventDebug()
const props = defineProps<{
  instance: ComponentInstance
  themes: ThemeTokens[]
  dirty?: boolean
  savedVersion?: number
  compact?: boolean
  eventDebug?: EventDebugController
  bindingFocus?: BindingImpact
}>()
provide(
  integrationKey,
  computed(() => props.instance.document.integrations ?? { apis: [], callbacks: [] }),
)
const eventDebug = computed(() => props.eventDebug ?? localEventDebug)
provide(
  graphReportsKey,
  computed(() => eventDebug.value.reports.value),
)
const emit = defineEmits<{
  update: [instance: ComponentInstance]
  save: []
  export: []
  ai: []
  import: []
  back: []
  submission: []
  insert: [instance: ComponentInstance]
}>()
const resetPreview = ref(0)
const selected = ref(
    props.compact
      ? (Object.values(resolveDocument(props.instance.document).nodes).find(
          (item) => item.component === 'Text',
        )?.id ?? 'root')
      : 'root',
  ),
  panel = ref<'properties' | 'actions' | 'parameters' | 'state' | 'data'>('properties'),
  viewport = ref('desktop'),
  error = ref(''),
  addType = ref(componentNames[3]!),
  newParent = ref(''),
  stateText = ref(''),
  dataText = ref('')
const surface = computed(() => resolveDocument(props.instance.document)),
  node = computed(() => surface.value.nodes[selected.value] ?? surface.value.nodes.root!)
const availableNames = computed(() => componentNames)
const inspector = ref<HTMLElement>()
watch(
  () => props.bindingFocus,
  async (target) => {
    if (!target || !surface.value.nodes[target.nodeId]) return
    selected.value = target.nodeId
    panel.value = 'properties'
    await nextTick()
    const selector = target.property.startsWith('bindings.')
      ? '.lu-data-bindings'
      : '.lu-scalar-bindings'
    const section = inspector.value?.querySelector<HTMLDetailsElement>(selector)
    if (section) section.open = true
    const input =
      [...(section?.querySelectorAll<HTMLInputElement>('input') ?? [])].find(
        (input) => input.value === target.path,
      ) ?? section?.querySelector<HTMLInputElement>('input')
    input?.focus({ preventScroll: true })
    section?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
  },
)
watch(surface, (value) => {
  if (!value.nodes[selected.value]) selected.value = 'root'
  stateText.value = JSON.stringify(value.state, null, 2)
  dataText.value = JSON.stringify(props.instance.document, null, 2)
})
function apply(document: LinguiDocument) {
  try {
    emit('update', updateInstanceDocument(props.instance, document))
    error.value = ''
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '组件配置无效'
  }
}
function patch(value: ComponentNode) {
  try {
    apply(updateNode(props.instance.document, value))
  } catch (cause) {
    error.value = String(cause)
  }
}
function add() {
  try {
    const result = addNode(props.instance.document, selected.value, addType.value)
    apply(result.document)
    selected.value = result.id
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '添加失败'
  }
}
function remove() {
  try {
    apply(removeNode(props.instance.document, selected.value))
    selected.value = 'root'
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '删除失败'
  }
}
function switchPanel(value: typeof panel.value) {
  panel.value = value
  stateText.value = JSON.stringify(surface.value.state, null, 2)
  dataText.value = JSON.stringify(props.instance.document, null, 2)
}
function applyJson(text: string, stateOnly: boolean) {
  try {
    const value = JSON.parse(text)
    apply(
      stateOnly
        ? replaceSurface(props.instance.document, Object.values(surface.value.nodes), value)
        : value,
    )
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'JSON 格式无效'
  }
}
function themeChanged(id: string) {
  const theme = props.themes.find((item) => item.id === id)
  if (theme) emit('update', { ...props.instance, theme: cloneJson(theme) })
}
const parents = computed(() =>
  Object.values(surface.value.nodes).filter((item) =>
    [
      'Row',
      'Column',
      'List',
      'LingUI.Section',
      'LingUI.Grid',
      'LingUI.Toolbar',
      'LingUI.Box',
      'LingUI.ButtonGroup',
      'LingUI.Carousel',
      'LingUI.Diagram',
      'LingUI.DiagramNode',
      'LingUI.Timeline',
      'LingUI.Steps',
    ].includes(item.component),
  ),
)
function reparent() {
  try {
    const current = surface.value.nodes[selected.value]!,
      parent = surface.value.nodes[newParent.value]
    if (!parent || current.id === 'root') return
    apply(reparentNode(props.instance.document, current.id, parent.id))
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '移动失败'
  }
}
</script>
<template>
  <div :class="['lu-workbench', { 'lu-workbench-compact': compact }]">
    <div v-if="!compact" class="lu-workbench-toolbar">
      <div class="lu-title-group">
        <button
          type="button"
          class="lu-icon-button"
          aria-label="返回项目列表"
          @click="emit('back')"
        >
          <LinguiIcon name="chevronLeft" /></button
        ><input
          :value="instance.document.title"
          class="lu-title-input"
          aria-label="组件名称"
          maxlength="120"
          @change="
            apply({ ...instance.document, title: ($event.target as HTMLInputElement).value })
          "
        /><span class="lu-save-state" role="status">{{
          dirty ? '未保存' : savedVersion ? `已保存 · v${savedVersion}` : '文章实例'
        }}</span>
      </div>
      <div class="lu-toolbar-actions">
        <button type="button" class="lu-button" @click="emit('ai')">AI 修改</button
        ><button type="button" class="lu-button" @click="emit('export')">导出</button
        ><button
          v-if="access.allows('components:manage')"
          type="button"
          class="lu-button primary"
          @click="emit('save')"
        >
          {{ savedVersion ? '保存新版本' : '保存项目' }}</button
        ><button type="button" class="lu-button" @click="emit('submission')">准备投稿</button
        ><slot name="insert" />
      </div>
    </div>
    <p v-if="error" class="lu-error lu-workbench-error" role="alert">{{ error }}</p>
    <div class="lu-workbench-grid">
      <aside class="lu-structure-panel">
        <div class="lu-panel-heading">
          <h3>组件结构</h3>
        </div>
        <StructureTree
          id="root"
          :nodes="surface.nodes"
          :selected="selected"
          @select="selected = $event"
        />
        <div class="lu-add-node">
          <label class="lu-field"
            ><span>添加到所选容器</span
            ><select v-model="addType" aria-label="要添加的组件类型">
              <option v-for="name in availableNames" :key="name" :value="name">
                {{ nodeLabels[name] }}
              </option>
            </select></label
          ><button type="button" class="lu-button full" @click="add">＋ 添加组件</button>
        </div>
        <div class="lu-node-operations">
          <button
            type="button"
            class="lu-text-button"
            :disabled="selected === 'root'"
            @click="apply(moveNode(instance.document, selected, -1))"
          >
            ↑ 上移</button
          ><button
            type="button"
            class="lu-text-button"
            :disabled="selected === 'root'"
            @click="apply(moveNode(instance.document, selected, 1))"
          >
            ↓ 下移</button
          ><button
            type="button"
            class="lu-text-button danger"
            :disabled="selected === 'root'"
            @click="remove"
          >
            删除
          </button>
        </div>
      </aside>
      <main v-if="!compact" class="lu-canvas">
        <div class="lu-canvas-toolbar">
          <span class="lu-inline-icon"><span class="lu-status-dot" /> 实时预览</span>
          <div class="lu-segment">
            <button
              type="button"
              :class="{ active: viewport === 'desktop' }"
              @click="viewport = 'desktop'"
            >
              桌面</button
            ><button
              type="button"
              :class="{ active: viewport === 'mobile' }"
              @click="viewport = 'mobile'"
            >
              手机
            </button>
          </div>
          <select
            :value="instance.theme.id"
            aria-label="预览主题"
            @change="themeChanged(($event.target as HTMLSelectElement).value)"
          >
            <option v-for="theme in themes" :key="theme.id" :value="theme.id">
              {{ theme.name }}
            </option>
          </select>
        </div>
        <div :class="['lu-preview-frame', { 'lu-preview-mobile': viewport === 'mobile' }]">
          <LinguiRenderer
            :key="resetPreview"
            :instance="instance"
            :interactions="eventDebug.interactions.value"
          />
        </div>
        <p class="lu-canvas-hint">
          预览中的交互不会改变组件的初始状态。
          <button type="button" class="lu-text-button" @click="resetPreview++">重置预览</button>
        </p>
      </main>
      <aside ref="inspector" class="lu-inspector">
        <div class="lu-inspector-node">
          <span>{{ nodeLabels[node.component] }}</span
          ><code>{{ node.id }}</code>
        </div>
        <div class="lu-inspector-tabs">
          <button
            v-for="(label, key) in {
              properties: '属性',
              actions: '交互',
              parameters: '参数',
              state: '状态',
              data: '数据',
            }"
            :key="key"
            type="button"
            :class="{ active: panel === key }"
            @click="switchPanel(key)"
          >
            {{ label }}
          </button>
        </div>
        <div class="lu-inspector-content">
          <template v-if="panel === 'properties'"
            ><NodeProperties
              :node="node"
              :document="instance.document"
              :state="surface.state"
              @update="patch"
              @document="apply"
              @text="
                (property, value) => apply(updateText(instance.document, node.id, property, value))
              "
            /><label v-if="selected !== 'root'" class="lu-field"
              ><span>移动到布局容器</span
              ><select v-model="newParent">
                <option value="">选择容器</option>
                <option v-for="parent in parents" :key="parent.id" :value="parent.id">
                  {{ nodeLabels[parent.component] }} · {{ parent.id }}
                </option>
              </select></label
            ><button
              v-if="selected !== 'root'"
              type="button"
              class="lu-button"
              :disabled="!newParent"
              @click="reparent"
            >
              移动节点
            </button></template
          >
          <div v-else-if="panel === 'actions'">
            <ActionEditor
              :node="node"
              :document="instance.document"
              @update="patch"
            /><EventDebugger :reports="eventDebug.reports.value" @clear="eventDebug.clear" />
          </div>
          <template v-else-if="panel === 'parameters'"
            ><InstanceParameters :instance="instance" @update="emit('update', $event)" />
            <details class="lu-advanced">
              <summary>参数定义与默认值</summary>
              <ParameterEditor :document="instance.document" @update="apply" /></details></template
          ><template v-else
            ><h3>{{ panel === 'state' ? '初始状态' : '完整组件数据' }}</h3>
            <p class="lu-muted">
              {{
                panel === 'state'
                  ? '每个读者从这些状态开始，交互状态不会上传。'
                  : '结构、参数与动作都保留为可编辑数据。'
              }}
            </p>
            <textarea
              v-if="panel === 'state'"
              v-model="stateText"
              class="lu-code"
              rows="20"
              spellcheck="false"
              aria-label="初始状态 JSON"
            /><textarea
              v-else
              v-model="dataText"
              class="lu-code"
              rows="24"
              spellcheck="false"
              aria-label="组件文档 JSON"
            /><button
              type="button"
              class="lu-button"
              @click="applyJson(panel === 'state' ? stateText : dataText, panel === 'state')"
            >
              校验并应用
            </button></template
          >
        </div>
      </aside>
    </div>
    <footer v-if="!compact" class="lu-workbench-status">
      <span class="lu-inline-icon"
        ><span class="lu-status-dot" />
        {{ error ? '修改未应用，请检查错误提示' : '当前文档已通过校验' }}</span
      ><span
        >{{ Object.keys(surface.nodes).length }} 个节点 ·
        {{ instance.document.parameters.length }} 个参数 ·
        {{ viewport === 'mobile' ? '手机预览' : '桌面预览' }}</span
      >
    </footer>
  </div>
</template>
