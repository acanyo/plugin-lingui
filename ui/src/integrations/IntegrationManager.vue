<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import {
  createInstance,
  validateIntegrations,
  eventActions,
  resolveDocument,
  isDemoApi,
  type ApiDefinition,
  type CallbackDefinition,
  type ComponentInstance,
  type IntegrationDefinitions,
  type JsonValue,
} from '@lingui/renderer'
import StudioModal from '../shared/StudioModal.vue'
import StudioSearch from '../shared/StudioSearch.vue'
import { createBlankDocument, updateInstanceDocument } from '../component-studio/document-editor'
import { useIntegrationTest } from './useIntegrationTest'
import ResponseContractPanel from './contracts/ResponseContractPanel.vue'
import type { BindingImpact } from './contracts/impact'
const props = defineProps<{ instance?: ComponentInstance }>()
const formId = useId()
const emit = defineEmits<{
  update: [instance: ComponentInstance]
  close: []
  sample: [name: string, value: JsonValue]
  market: []
  locate: [impact: BindingImpact]
}>()
const definitions = computed(
  () => props.instance?.document.integrations ?? { apis: [], callbacks: [] },
)
const kind = ref<'apis' | 'callbacks'>('apis'),
  search = ref(''),
  selected = ref(''),
  editing = ref(false)
const name = ref(''),
  label = ref(''),
  description = ref(''),
  url = ref(''),
  method = ref<ApiDefinition['method']>('GET'),
  input = ref('{}'),
  response = ref('{}'),
  error = ref('')
const {
  testing,
  result,
  error: testError,
  canAdopt,
  test: runTest,
  clear: clearTest,
} = useIntegrationTest({
  requestKey: () =>
    JSON.stringify([kind.value, selected.value, name.value, url.value, method.value, input.value]),
  configuration: () => configuration() as ApiDefinition,
  onSample: (apiName, value) => {
    if (selected.value === apiName && matchesSavedApi.value) emit('sample', apiName, value)
  },
})
const demo = computed(() => kind.value === 'apis' && isDemoApi({ url: url.value }))
const savedApi = computed(() => definitions.value.apis.find((api) => api.name === selected.value))
const matchesSavedApi = computed(
  () => savedApi.value?.url === url.value.trim() && savedApi.value?.method === method.value,
)
const testedResponse = computed<JsonValue | undefined>(() =>
  result.value ? JSON.parse(result.value) : undefined,
)
const items = computed(() =>
  definitions.value[kind.value].filter((item) =>
    `${item.name} ${item.label}`.toLowerCase().includes(search.value.toLowerCase()),
  ),
)
function switchKind(value: 'apis' | 'callbacks') {
  kind.value = value
  editing.value = false
}
function open(item?: CallbackDefinition) {
  selected.value = item?.name ?? ''
  name.value = item?.name ?? ''
  label.value = item?.label ?? ''
  description.value = item?.description ?? ''
  url.value = item && 'url' in item ? String(item.url) : ''
  method.value = item && 'method' in item ? (item.method as ApiDefinition['method']) : 'GET'
  input.value = JSON.stringify(item?.inputExample === undefined ? {} : item.inputExample, null, 2)
  response.value = JSON.stringify(
    item?.responseExample === undefined ? {} : item.responseExample,
    null,
    2,
  )
  error.value = ''
  clearTest()
  editing.value = true
}
function configuration(): CallbackDefinition | ApiDefinition {
  return {
    name: name.value.trim(),
    label: label.value.trim(),
    description: description.value.trim(),
    inputExample: JSON.parse(input.value),
    responseExample: JSON.parse(response.value),
    ...(kind.value === 'apis' ? { url: url.value.trim(), method: method.value } : {}),
  }
}
function commit(next: IntegrationDefinitions) {
  validateIntegrations(next)
  const instance = props.instance ?? createInstance(createBlankDocument())
  emit('update', updateInstanceDocument(instance, { ...instance.document, integrations: next }))
}
function save() {
  try {
    const item = configuration()
    const list = definitions.value[kind.value]
    if (list.some((entry) => entry.name === item.name && entry.name !== selected.value))
      throw new Error('名称已存在，请使用不同名称')
    if (selected.value && selected.value !== item.name)
      throw new Error('编辑时请保留标识；需要新标识时请新增，以免已有事件失效')
    commit({
      ...definitions.value,
      [kind.value]: [...list.filter((entry) => entry.name !== selected.value), item],
    })
    editing.value = false
    error.value = ''
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '配置无效'
  }
}
function remove() {
  try {
    const used = Object.values(props.instance ? resolveDocument(props.instance.document).nodes : {})
      .flatMap(eventActions)
      .some(
        (action) =>
          action.type === (kind.value === 'apis' ? 'api' : 'callback') &&
          'name' in action &&
          action.name === selected.value,
      )
    if (used) throw new Error('此配置正在被组件事件使用，请先修改或移除对应事件')
    commit({
      ...definitions.value,
      [kind.value]: definitions.value[kind.value].filter((item) => item.name !== selected.value),
    })
    editing.value = false
    error.value = ''
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '删除失败'
  }
}
function test() {
  error.value = ''
  return runTest()
}
function adoptResult() {
  if (canAdopt.value) response.value = result.value
}
</script>
<template>
  <StudioModal title="接口与回调" :width="1000" :close-disabled="testing" @close="emit('close')">
    <section class="lingui-studio lu-integrations">
      <p class="lu-muted">
        为当前作品配置业务能力。AI 会读取参数与响应示例，生成相应的数据绑定和交互。
        <button type="button" class="lu-text-button" :disabled="testing" @click="emit('market')">
          去市场找接口应用 →
        </button>
      </p>
      <p v-if="!instance" class="lu-muted">
        可以先配置，再让 AI 创作。保存第一项配置后会建立当前创作草稿，不会自动添加项目。
      </p>
      <div class="lu-integration-layout">
        <aside class="lu-integration-sidebar">
          <div class="lu-segment">
            <button
              type="button"
              :disabled="testing"
              :class="{ active: kind === 'apis' }"
              @click="switchKind('apis')"
            >
              API 接口</button
            ><button
              type="button"
              :disabled="testing"
              :class="{ active: kind === 'callbacks' }"
              @click="switchKind('callbacks')"
            >
              JS 回调
            </button>
          </div>
          <StudioSearch v-model="search" label="搜索接口与回调" placeholder="搜索名称…" />
          <button type="button" class="lu-button primary" :disabled="testing" @click="open()">
            新增{{ kind === 'apis' ? '接口' : '回调' }}
          </button>
          <div class="lu-integration-list">
            <button
              v-for="item in items"
              :key="item.name"
              type="button"
              :disabled="testing"
              :class="['lu-integration-item', { active: selected === item.name && editing }]"
              @click="open(item)"
            >
              <strong>{{ item.label }}</strong
              ><code>{{ item.name }}</code
              ><span v-if="'method' in item">{{ item.method }}</span>
            </button>
          </div>
          <p v-if="!items.length" class="lu-muted">
            {{ search ? '没有匹配项。' : '添加业务能力后，可在组件事件中选择。' }}
          </p>
        </aside>
        <form v-if="editing" :id="formId" class="lu-integration-form" @submit.prevent="save">
          <div class="lu-event-two-columns">
            <label class="lu-field"
              ><span>显示名称</span
              ><input v-model="label" required maxlength="120" placeholder="搜索文章" /></label
            ><label class="lu-field"
              ><span>标识</span
              ><input
                v-model="name"
                required
                pattern="[a-zA-Z][a-zA-Z0-9_.-]{0,79}"
                :readonly="!!selected"
                placeholder="searchArticles"
            /></label>
          </div>
          <label class="lu-field"
            ><span>用途说明</span
            ><textarea
              v-model="description"
              rows="2"
              maxlength="500"
              placeholder="根据关键词返回文章列表"
            />
          </label>
          <div v-if="kind === 'apis'" class="lu-event-http-row">
            <label class="lu-field"
              ><span>方法</span
              ><select v-model="method">
                <option v-for="verb in ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']" :key="verb">
                  {{ verb }}
                </option>
              </select></label
            ><label class="lu-field"
              ><span>API 地址</span
              ><input v-model="url" required maxlength="2048" placeholder="/business-api/articles"
            /></label>
          </div>
          <label class="lu-field"
            ><span>{{
              kind === 'apis' && method === 'GET' ? '查询参数示例（JSON）' : '输入参数示例（JSON）'
            }}</span
            ><textarea v-model="input" class="lu-code" rows="5" spellcheck="false" />
          </label>
          <label class="lu-field"
            ><span>响应示例（JSON）</span
            ><textarea v-model="response" class="lu-code" rows="6" spellcheck="false" />
          </label>
          <p class="lu-muted">
            {{
              kind === 'apis'
                ? '只保存业务配置；认证由宿主提供，浏览器请求仍需目标接口允许跨域。'
                : '这里声明回调名称与参数；实际 JS 函数由站点注册。作品不会保存或执行脚本源码。'
            }}
          </p>
          <p v-if="error || testError" class="lu-error" role="alert">{{ error || testError }}</p>
          <details v-if="kind === 'apis'" class="lu-advanced">
            <summary>测试接口</summary>
            <p v-if="demo" class="lu-muted">本地模拟接口：测试使用模拟数据，不发送网络请求。</p>
            <div class="lu-api-test-actions">
              <button
                type="button"
                class="lu-button"
                :disabled="testing"
                :title="testing ? '接口请求进行中，请稍候' : undefined"
                @click="test"
              >
                {{ testing ? '请求中…' : demo ? '用模拟数据测试' : '用参数示例测试' }}
              </button>
              <button
                v-if="result"
                type="button"
                class="lu-button"
                :disabled="!canAdopt"
                @click="adoptResult"
              >
                采用为响应示例
              </button>
            </div>
            <p v-if="result" class="lu-muted">
              采用后请点击「保存配置」，再保存作品，供 AI 和数据绑定使用。
            </p>
            <pre v-if="result" class="lu-code" aria-label="API 测试结果">{{ result }}</pre>
            <ResponseContractPanel
              v-if="testedResponse !== undefined"
              :name="name"
              :expected="savedApi?.responseExample"
              :actual="testedResponse"
              :document="matchesSavedApi ? instance?.document : undefined"
              @locate="emit('locate', $event)"
            />
          </details>
        </form>
        <div v-else class="lu-integration-welcome">
          <span class="lu-eyebrow">当前作品</span>
          <h3>连接数据与交互</h3>
          <p>先定义接口与响应结构，再告诉 AI 如何使用它们。</p>
          <p class="lu-muted">例如：“用搜索文章接口做一个搜索列表，点击后查看详情。”</p>
        </div>
      </div>
    </section>
    <template #footer>
      <span class="lu-muted">配置随当前作品保存</span>
      <button
        v-if="editing && selected"
        type="button"
        class="lu-text-button danger"
        :disabled="testing"
        @click="remove"
      >
        删除配置
      </button>
      <button
        v-if="editing"
        type="submit"
        :form="formId"
        class="lu-button primary"
        :disabled="testing"
      >
        保存配置
      </button>
      <button v-else type="button" class="lu-button" @click="emit('close')">完成</button>
    </template>
  </StudioModal>
</template>
