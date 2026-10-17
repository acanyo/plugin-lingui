<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import type { Action, EventAction, JsonValue } from '@lingui/renderer'
import { integrationKey } from '../integrations/context'
import LocalActionProperties from './LocalActionProperties.vue'
const props = defineProps<{ action: EventAction }>()
const emit = defineEmits<{ update: [action: EventAction] }>()
const error = ref('')
const integrations = inject(integrationKey, undefined)
const namedAction = computed(() => ('name' in props.action ? props.action.name : ''))
function patch(key: string, value: unknown) {
  const next = { ...props.action } as Record<string, unknown>
  if (value === '' || value === undefined) delete next[key]
  else next[key] = value
  emit('update', next as unknown as EventAction)
}
function json(key: string, field: HTMLTextAreaElement) {
  try {
    patch(key, field.value.trim() ? JSON.parse(field.value) : undefined)
    error.value = ''
    field.setCustomValidity('')
  } catch {
    error.value = '参数需要有效 JSON；可以使用 {"$state":"/路径"} 或 {"$event":"/value"}。'
    field.setCustomValidity(error.value)
  }
}
function local(action: Action) {
  if (props.action.type !== 'local') return
  emit('update', { ...props.action, actions: action.functionCall.args.actions })
}
function format(value?: JsonValue) {
  return value === undefined ? '' : JSON.stringify(value, null, 2)
}
</script>
<template>
  <template v-if="action.type === 'api'">
    <label class="lu-field"
      ><span>已配置接口</span
      ><select
        :value="action.name"
        @change="patch('name', ($event.target as HTMLSelectElement).value)"
      >
        <option
          v-if="!integrations?.apis.some((api) => api.name === namedAction)"
          :value="action.name"
        >
          {{ action.name }}（尚未配置）
        </option>
        <option v-for="api in integrations?.apis ?? []" :key="api.name" :value="api.name">
          {{ api.label }} · {{ api.method }}
        </option>
      </select></label
    >
    <label class="lu-field"
      ><span>接口参数（JSON）</span
      ><textarea
        class="lu-code"
        :value="format(action.args)"
        rows="4"
        placeholder='{"q":{"$state":"/query"}}'
        @change="json('args', $event.target as HTMLTextAreaElement)"
      />
    </label>
    <p class="lu-muted">在工作台的“接口与回调”中维护地址、参数和响应示例。</p>
  </template>
  <template v-else-if="action.type === 'request'">
    <div class="lu-event-http-row">
      <label class="lu-field"
        ><span>请求方法</span
        ><select
          :value="action.method ?? 'GET'"
          @change="patch('method', ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="method in ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']" :key="method">
            {{ method }}
          </option>
        </select></label
      >
      <label class="lu-field"
        ><span>API 地址</span
        ><input
          :value="action.url"
          placeholder="/api/example 或 https://api.example.com/data"
          maxlength="2048"
          @change="patch('url', ($event.target as HTMLInputElement).value)"
      /></label>
    </div>
    <label class="lu-field"
      ><span>查询参数（JSON）</span
      ><textarea
        class="lu-code"
        :value="format(action.query)"
        rows="3"
        placeholder='{"q":{"$state":"/query"}}'
        @change="json('query', $event.target as HTMLTextAreaElement)"
      />
    </label>
    <label v-if="action.method && action.method !== 'GET'" class="lu-field"
      ><span>请求体（JSON）</span
      ><textarea
        class="lu-code"
        :value="format(action.body)"
        rows="4"
        placeholder='{"name":{"$state":"/name"}}'
        @change="json('body', $event.target as HTMLTextAreaElement)"
      />
    </label>
    <details class="lu-event-extra">
      <summary>请求头与响应格式</summary>
      <label class="lu-field"
        ><span>请求头（JSON）</span
        ><textarea
          class="lu-code"
          :value="format(action.headers)"
          rows="3"
          placeholder='{"X-Request-Source":"lingui"}'
          @change="json('headers', $event.target as HTMLTextAreaElement)"
        />
      </label>
      <p class="lu-muted">身份凭据由宿主适配器提供；作品中填写业务参数。</p>
      <label class="lu-field"
        ><span>响应格式</span
        ><select
          :value="action.response ?? 'json'"
          @change="patch('response', ($event.target as HTMLSelectElement).value)"
        >
          <option value="json">JSON</option>
          <option value="text">文本</option>
        </select></label
      >
    </details>
  </template>
  <template v-else-if="action.type === 'callback'">
    <label class="lu-field"
      ><span>JS 回调名称</span
      ><input
        :value="action.name"
        maxlength="80"
        placeholder="onSave"
        @change="patch('name', ($event.target as HTMLInputElement).value)"
    /></label>
    <label class="lu-field"
      ><span>回调参数（JSON）</span
      ><textarea
        class="lu-code"
        :value="format(action.args)"
        rows="4"
        placeholder='{"value":{"$event":"/value"}}'
        @change="json('args', $event.target as HTMLTextAreaElement)"
      />
    </label>
    <label v-if="integrations?.callbacks.length" class="lu-field"
      ><span>选择已声明回调</span
      ><select
        :value="action.name"
        @change="patch('name', ($event.target as HTMLSelectElement).value)"
      >
        <option :value="action.name">{{ action.name }}</option>
        <option
          v-for="callback in integrations.callbacks.filter((item) => item.name !== namedAction)"
          :key="callback.name"
          :value="callback.name"
        >
          {{ callback.label }} · {{ callback.name }}
        </option>
      </select></label
    >
    <p class="lu-muted">宿主注册同名函数，可返回值或 Promise。未注册时显示具体错误。</p>
  </template>
  <template v-else-if="action.type === 'local'">
    <LocalActionProperties
      :action="{ functionCall: { call: 'lingui.dispatch', args: { actions: action.actions } } }"
      @update="local"
    />
  </template>
  <template v-else-if="action.type === 'delay'">
    <label class="lu-field"
      ><span>等待时间（毫秒）</span
      ><input
        type="number"
        min="0"
        max="30000"
        :value="action.ms"
        @change="patch('ms', Number(($event.target as HTMLInputElement).value))"
    /></label>
  </template>
  <template v-else-if="action.type === 'emit'">
    <label class="lu-field"
      ><span>自定义事件名称</span
      ><input
        :value="action.name"
        maxlength="80"
        placeholder="work.saved"
        @change="patch('name', ($event.target as HTMLInputElement).value)"
    /></label>
    <label class="lu-field"
      ><span>事件数据（JSON）</span
      ><textarea
        class="lu-code"
        :value="format(action.detail)"
        rows="3"
        @change="json('detail', $event.target as HTMLTextAreaElement)"
      />
    </label>
  </template>
  <template v-if="action.type === 'request' || action.type === 'callback' || action.type === 'api'">
    <div class="lu-event-two-columns">
      <label class="lu-field"
        ><span>结果保存路径（选填）</span
        ><input
          :value="action.resultPath"
          placeholder="/response"
          @change="patch('resultPath', ($event.target as HTMLInputElement).value)"
      /></label>
      <label class="lu-field"
        ><span>超时（毫秒）</span
        ><input
          type="number"
          min="100"
          max="60000"
          :value="action.timeoutMs ?? 15000"
          @change="patch('timeoutMs', Number(($event.target as HTMLInputElement).value))"
      /></label>
    </div>
  </template>
  <p v-if="error" class="lu-error" role="alert">{{ error }}</p>
</template>
