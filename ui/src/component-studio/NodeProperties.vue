<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  readPath,
  type ComponentNode,
  type Dynamic,
  type LinguiDocument,
  type State,
} from '@lingui/renderer'
import DataBindingEditor from './DataBindingEditor.vue'
import ControlProperties from './ControlProperties.vue'
import MenuProperties from './MenuProperties.vue'
import DynamicInputProperties from './DynamicInputProperties.vue'
import ContentProperties from './ContentProperties.vue'
import DesignProperties from './DesignProperties.vue'
import MotionProperties from './MotionProperties.vue'
import MediaProperties from './MediaProperties.vue'
import InputProperties from './InputProperties.vue'
import TabsProperties from './TabsProperties.vue'
import ChoiceProperties from './ChoiceProperties.vue'
import NavigationProperties from './NavigationProperties.vue'
import PresentationProperties from './PresentationProperties.vue'
import FormValueProperties from './FormValueProperties.vue'
import AdvancedInputProperties from './AdvancedInputProperties.vue'
import AccordionProperties from './AccordionProperties.vue'
import AnalyticsProperties from './AnalyticsProperties.vue'
import RangeProperties from './RangeProperties.vue'
import ResourceProperties from './ResourceProperties.vue'
import CarouselProperties from './CarouselProperties.vue'
import WorkspaceProperties from './WorkspaceProperties.vue'
import TreeProperties from './TreeProperties.vue'
import KanbanProperties from './KanbanProperties.vue'
import ScatterProperties from './ScatterProperties.vue'
import PrimitiveProperties from './PrimitiveProperties.vue'
import ScalarBindingEditor from '../data-binding/ScalarBindingEditor.vue'
const props = defineProps<{ node: ComponentNode; document: LinguiDocument; state: State }>()
const emit = defineEmits<{
  update: [node: ComponentNode]
  text: [property: 'text' | 'title' | 'description' | 'label' | 'url', value: string]
  document: [document: LinguiDocument]
}>()
const advanced = ref(''),
  error = ref('')
watch(
  () => props.node,
  (node) => {
    advanced.value = JSON.stringify(node, null, 2)
    error.value = ''
  },
  { immediate: true, deep: true },
)
function label(value: Dynamic | undefined) {
  return value && typeof value === 'object'
    ? 'path' in value
      ? String(readPath(props.state, value.path) ?? '')
      : '计算表达式（在数据中编辑）'
    : String(value ?? '')
}
function patch(key: string, value: unknown) {
  emit('update', { ...props.node, [key]: value })
}
function changeIcon(name: string) {
  const next = { ...props.node }
  if (name) next.name = name
  else delete next.name
  emit('update', next)
}
const textual = computed(() =>
  (['text', 'title', 'description', 'label'] as const).filter(
    (key) => props.node[key] !== undefined,
  ),
)
function apply() {
  try {
    const node = JSON.parse(advanced.value)
    if (node.id !== props.node.id || node.component !== props.node.component)
      throw new Error('节点标识和类型不能在属性中修改')
    emit('update', node)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'JSON 格式无效'
  }
}
</script>
<template>
  <section class="lu-properties">
    <DataBindingEditor
      :node="node"
      :state="state"
      :document="document"
      @update="emit('update', $event)"
    />
    <ScalarBindingEditor :node="node" :document="document" @update="emit('update', $event)" />
    <label v-for="key in textual" :key="key" class="lu-field"
      ><span>{{
        {
          text: '内容',
          title: '标题',
          description: '说明',
          label: node.component === 'LingUI.Quote' ? '署名' : '名称',
        }[key]
      }}</span
      ><textarea
        :value="label(node[key])"
        rows="3"
        :disabled="
          typeof node[key] === 'object' && node[key] !== null && 'call' in (node[key] as object)
        "
        @change="emit('text', key, ($event.target as HTMLTextAreaElement).value)"
      />
    </label>
    <label v-if="node.component === 'Text'" class="lu-field"
      ><span>文字层级</span
      ><select
        :value="node.variant ?? 'body'"
        @change="patch('variant', ($event.target as HTMLSelectElement).value)"
      >
        <option value="h1">大标题</option>
        <option value="h2">标题</option>
        <option value="h3">小标题</option>
        <option value="body">正文</option>
        <option value="caption">辅助文字</option>
      </select></label
    >
    <label
      v-if="
        node.component === 'Icon' ||
        node.component === 'LingUI.IconButton' ||
        node.component === 'LingUI.DiagramNode'
      "
      class="lu-field"
      ><span>图标</span
      ><select
        :value="node.name ?? ''"
        @change="changeIcon(($event.target as HTMLSelectElement).value)"
      >
        <option v-if="node.component === 'LingUI.DiagramNode'" value="">无图标</option>
        <option
          v-for="name in [
            'warning',
            'info',
            'check',
            'code',
            'layers',
            'book',
            'sparkles',
            'arrow',
            'clock',
            'help',
            'cube',
            'database',
            'heap',
            'list',
            'cpu',
          ]"
          :key="name"
          :value="name"
        >
          {{ name }}
        </option>
      </select></label
    >
    <label v-if="node.component === 'LingUI.Diagram'" class="lu-field"
      ><span>布局方向</span
      ><select
        :value="node.orientation ?? 'vertical'"
        @change="patch('orientation', ($event.target as HTMLSelectElement).value)"
      >
        <option value="vertical">纵向</option>
        <option value="horizontal">横向</option>
      </select></label
    >
    <label v-if="node.component === 'LingUI.DiagramNode'" class="lu-check"
      ><input
        type="checkbox"
        :checked="node.accent"
        @change="patch('accent', ($event.target as HTMLInputElement).checked)"
      />使用强调色</label
    >
    <template v-if="node.component === 'LingUI.DiagramNode'">
      <label class="lu-field"
        ><span>节点布局</span
        ><select
          :value="node.variant ?? 'tree'"
          @change="patch('variant', ($event.target as HTMLSelectElement).value)"
        >
          <option value="tree">树状节点</option>
          <option value="stage">居中阶段</option>
          <option value="group">分组区域</option>
          <option value="item">内容节点</option>
        </select></label
      >
      <label class="lu-field"
        ><span>语义颜色</span
        ><select
          :value="typeof node.tone === 'string' ? node.tone : 'info'"
          @change="patch('tone', ($event.target as HTMLSelectElement).value)"
        >
          <option value="info">默认</option>
          <option value="success">成功</option>
          <option value="warning">提示</option>
          <option value="danger">错误</option>
        </select></label
      >
    </template>
    <label
      v-if="node.component === 'Button' || node.component === 'LingUI.IconButton'"
      class="lu-field"
      ><span>按钮样式</span
      ><select
        :value="node.variant ?? 'secondary'"
        @change="patch('variant', ($event.target as HTMLSelectElement).value)"
      >
        <option value="primary">主要</option>
        <option value="secondary">次要</option>
        <option value="text">文字</option>
      </select></label
    >
    <ContentProperties :node="node" @update="emit('update', $event)" />
    <MediaProperties
      :node="node"
      :state="state"
      @update="emit('update', $event)"
      @text="(property, value) => emit('text', property, value)"
    />
    <ControlProperties :node="node" @update="emit('update', $event)" />
    <MenuProperties :node="node" @update="emit('update', $event)" />
    <DynamicInputProperties
      :node="node"
      :document="document"
      :state="state"
      @update="emit('update', $event)"
      @document="emit('document', $event)"
    />
    <InputProperties :node="node" @update="emit('update', $event)" />
    <FormValueProperties
      :node="node"
      :document="document"
      :state="state"
      @document="emit('document', $event)"
    />
    <AdvancedInputProperties
      :node="node"
      :document="document"
      :state="state"
      @update="emit('update', $event)"
      @document="emit('document', $event)"
    />
    <AccordionProperties
      :node="node"
      :document="document"
      :state="state"
      @update="emit('update', $event)"
      @document="emit('document', $event)"
    />
    <AnalyticsProperties
      :node="node"
      :document="document"
      :state="state"
      @update="emit('update', $event)"
      @document="emit('document', $event)"
    />
    <RangeProperties
      :node="node"
      :document="document"
      :state="state"
      @update="emit('update', $event)"
      @document="emit('document', $event)"
    />
    <ResourceProperties :node="node" @update="emit('update', $event)" />
    <CarouselProperties
      :node="node"
      :document="document"
      :state="state"
      @document="emit('document', $event)"
    />
    <ChoiceProperties :node="node" @update="emit('update', $event)" />
    <WorkspaceProperties
      :node="node"
      :document="document"
      :state="state"
      @update="emit('update', $event)"
      @document="emit('document', $event)"
    />
    <TreeProperties
      :node="node"
      :document="document"
      :state="state"
      @document="emit('document', $event)"
    />
    <KanbanProperties :node="node" :document="document" @document="emit('document', $event)" />
    <ScatterProperties :node="node" @update="emit('update', $event)" />
    <PrimitiveProperties :node="node" @update="emit('update', $event)" />
    <PresentationProperties :node="node" @update="emit('update', $event)" />
    <NavigationProperties
      :node="node"
      :state="state"
      @update="emit('update', $event)"
      @text="(property, value) => emit('text', property, value)"
    />
    <TabsProperties
      :node="node"
      :document="document"
      :state="state"
      @document="emit('document', $event)"
    />
    <DesignProperties :node="node" @update="emit('update', $event)" />
    <MotionProperties :node="node" @update="emit('update', $event)" />
    <details class="lu-advanced">
      <summary>节点配置</summary>
      <p class="lu-muted">调整绑定、选项或计算表达式。保存前会校验所有字段。</p>
      <textarea
        v-model="advanced"
        class="lu-code"
        rows="14"
        spellcheck="false"
        aria-label="节点 JSON"
      /><button type="button" class="lu-button" @click="apply">应用配置</button>
      <p v-if="error" class="lu-error" role="alert">{{ error }}</p>
    </details>
  </section>
</template>
