<script setup lang="ts">
import InteractionGraph from '../interaction-graph/InteractionGraph.vue'
import { graphReportsKey } from '../interaction-graph/context'
import { computed, ref, watch, inject } from 'vue'
import {
  supportedEvents,
  resolveDocument,
  serializeSource,
  validateDocument,
  type ComponentNode,
  type ComponentEventName,
  type EventBinding,
  type LinguiDocument,
} from '@lingui/renderer'
import EventStepsEditor from './EventStepsEditor.vue'
import { eventLabels, newEventAction } from './event-labels'
import { startupMode, updateEventBinding } from './startup-event'
const props = defineProps<{ node: ComponentNode; document: LinguiDocument }>()
const emit = defineEmits<{ update: [node: ComponentNode] }>()
const view = ref<'form' | 'graph'>('form')
const reports = inject(
  graphReportsKey,
  computed(() => []),
)
const relatedReports = computed(() =>
  reports.value.filter((row) => row.nodeId === props.node.id && row.event === selected.value),
)
const available = computed(() => supportedEvents(props.node.component))
const editor = ref<HTMLElement>()
const startup = computed(() => startupMode(props.node))
const autoStart = ref(false)
const selected = ref<ComponentEventName>('click'),
  draft = ref<EventBinding>(),
  error = ref(''),
  advanced = ref('')
function load() {
  autoStart.value = startup.value === 'shared'
  draft.value = props.node.events?.[selected.value]
    ? JSON.parse(JSON.stringify(props.node.events[selected.value]))
    : undefined
  advanced.value = JSON.stringify(draft.value ?? {}, null, 2)
  error.value = ''
}
watch(
  () => props.node,
  () => {
    if (!available.value.includes(selected.value)) selected.value = available.value[0] ?? 'click'
    load()
  },
  { immediate: true, deep: true },
)
watch(selected, load)
function create() {
  draft.value = {
    actions: [newEventAction('request')],
    concurrency: selected.value === 'input' ? 'latest' : 'drop',
    debounceMs: selected.value === 'input' ? 300 : 0,
  }
  advanced.value = JSON.stringify(draft.value, null, 2)
}
function save(binding: EventBinding | null | undefined = draft.value) {
  try {
    if (
      binding &&
      Array.from(editor.value?.querySelectorAll('input,textarea,select') ?? []).some(
        (field) => !(field as HTMLInputElement).reportValidity(),
      )
    )
      return
    const next = updateEventBinding(props.node, selected.value, binding, autoStart.value)
    const surface = resolveDocument(props.document)
    validateDocument({
      ...props.document,
      source: serializeSource(Object.values({ ...surface.nodes, [next.id]: next })),
    })
    emit('update', next)
    error.value = ''
    return true
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '事件配置无效'
  }
}
function path(key: 'loadingPath' | 'errorPath' | 'resultPath', value: string) {
  if (!draft.value) return
  if (value.trim()) draft.value[key] = value.trim()
  else delete draft.value[key]
}
function applyJson() {
  try {
    draft.value = JSON.parse(advanced.value)
    save()
  } catch {
    error.value = '事件配置需要有效 JSON'
  }
}
function remove() {
  if (save(null)) draft.value = undefined
}
</script>
<template>
  <section ref="editor" class="lu-event-editor">
    <header class="lu-event-editor-heading">
      <div>
        <h3>事件与动作</h3>
        <p class="lu-muted">让组件连接数据、业务逻辑和其他组件。</p>
      </div>
      <span class="lu-event-configured">{{ Object.keys(node.events ?? {}).length }} 个事件</span>
    </header>
    <template v-if="available.length">
      <label class="lu-field"
        ><span>触发事件</span
        ><select v-model="selected" aria-label="触发事件">
          <option v-for="event in available" :key="event" :value="event">
            {{ eventLabels[event] }}{{ node.events?.[event] ? ' · 已配置' : '' }}
          </option>
        </select></label
      >
      <p v-if="selected === 'mount'" class="lu-event-binding-help">
        每次打开作品自动执行一次。状态变化、主题切换不会重复执行；不需要刷新入口时，直接在根容器配置此事件即可，无需添加按钮。
      </p>
      <div v-if="!draft" class="lu-event-empty">
        <p>为「{{ eventLabels[selected] }}」连接 API、JS 回调或本地状态动作。</p>
        <button type="button" class="lu-button" @click="create">
          ＋ 配置{{ eventLabels[selected] }}事件
        </button>
      </div>
      <template v-else>
        <div v-if="selected === 'click'" class="lu-event-startup">
          <template v-if="startup !== 'independent'">
            <label>
              <input v-model="autoStart" type="checkbox" />
              <span>打开作品时自动执行</span>
            </label>
            <p>
              使用当前点击事件的动作和状态路径。自动获取数据后，按钮可用作刷新；保存配置后生效。
            </p>
          </template>
          <p v-else>
            已单独配置自动执行，请切换到「打开时自动执行」修改。保存点击事件会保留该配置。
          </p>
        </div>
        <div class="lu-segment" aria-label="交互配置视图">
          <button
            type="button"
            :class="{ active: view === 'form' }"
            :aria-pressed="view === 'form'"
            @click="view = 'form'"
          >
            表单</button
          ><button
            type="button"
            :class="{ active: view === 'graph' }"
            :aria-pressed="view === 'graph'"
            @click="view = 'graph'"
          >
            交互图
          </button>
        </div>
        <InteractionGraph
          v-if="view === 'graph'"
          :binding="draft"
          :node-id="node.id"
          :event="selected"
          :reports="relatedReports"
          @update="draft = $event"
        />
        <template v-else>
          <EventStepsEditor
            :actions="draft.actions"
            label="执行"
            @update="draft.actions = $event"
          />
          <details class="lu-event-extra">
            <summary>成功后 · {{ draft.onSuccess?.length ?? 0 }} 个动作</summary>
            <EventStepsEditor
              :actions="draft.onSuccess ?? []"
              label="成功"
              @update="draft.onSuccess = $event"
            />
          </details>
          <details class="lu-event-extra">
            <summary>失败后 · {{ draft.onError?.length ?? 0 }} 个动作</summary>
            <EventStepsEditor
              :actions="draft.onError ?? []"
              label="失败"
              @update="draft.onError = $event"
            />
          </details>
        </template>
        <details class="lu-event-extra">
          <summary>执行状态、结果与防抖</summary>
          <label class="lu-field"
            ><span>最终结果保存路径</span
            ><input
              :value="draft.resultPath"
              placeholder="/response"
              @change="path('resultPath', ($event.target as HTMLInputElement).value)"
          /></label>
          <label class="lu-field"
            ><span>加载状态路径</span
            ><input
              :value="draft.loadingPath"
              placeholder="/loading"
              @change="path('loadingPath', ($event.target as HTMLInputElement).value)"
          /></label>
          <label class="lu-field"
            ><span>错误信息路径</span
            ><input
              :value="draft.errorPath"
              placeholder="/error"
              @change="path('errorPath', ($event.target as HTMLInputElement).value)"
          /></label>
          <label class="lu-field"
            ><span>防抖（毫秒）</span
            ><input v-model.number="draft.debounceMs" type="number" min="0" max="5000"
          /></label>
          <label class="lu-field"
            ><span>重复触发时</span
            ><select v-model="draft.concurrency">
              <option value="drop">等待当前执行完成</option>
              <option value="latest">取消旧执行，以最新一次为准</option>
            </select></label
          >
        </details>
        <div class="lu-event-save">
          <button type="button" class="lu-button lu-primary" @click="save()">保存事件配置</button
          ><button type="button" class="lu-text-button" @click="remove">移除事件</button>
        </div>
        <details class="lu-event-extra" @toggle="advanced = JSON.stringify(draft, null, 2)">
          <summary>完整事件 JSON</summary>
          <textarea
            v-model="advanced"
            class="lu-code"
            rows="12"
            aria-label="事件 JSON"
            spellcheck="false"
          /><button type="button" class="lu-button" @click="applyJson">应用事件 JSON</button>
        </details>
      </template>
      <p class="lu-event-binding-help">
        参数引用：<code>{"$state":"/路径"}</code> 当前数据，<code>{"$event":"/value"}</code>
        事件值，<code>{"$result":"/"}</code> 上一步结果，<code>{"$error":"/message"}</code>
        错误信息。
      </p>
      <p v-if="error" class="lu-error" role="alert">{{ error }}</p>
    </template>
    <p v-else class="lu-muted">
      这个组件用于布局或内容展示。请选择按钮、输入、选择、导航或媒体组件配置事件。
    </p>
  </section>
</template>
