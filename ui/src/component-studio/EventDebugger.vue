<script setup lang="ts">
import { computed, ref } from 'vue'
import { eventLabels, eventActionLabels } from './event-labels'
import { groupDebugReports, type DebugReport } from './debug-records'
import { downloadJson } from '../shared/download'
const props = defineProps<{ reports: DebugReport[] }>()
defineEmits<{ clear: [] }>()
const search = ref(''),
  filter = ref('all')
const runs = computed(() =>
  groupDebugReports(props.reports).filter((run) => {
    if (filter.value === 'error' && run.status !== 'error') return false
    if (filter.value === 'request' && !run.reports.some((report) => report.scope === 'request'))
      return false
    if (
      filter.value === 'callback' &&
      !run.reports.some((report) => report.actionType === 'callback')
    )
      return false
    if (filter.value === 'state' && !run.reports.some((report) => report.stateChanges?.length))
      return false
    return `${run.nodeId} ${run.reports.map((report) => `${report.name ?? ''} ${report.http?.url ?? ''}`).join(' ')}`
      .toLowerCase()
      .includes(search.value.trim().toLowerCase())
  }),
)
const phases = {
  start: '执行中',
  success: '已完成',
  error: '失败',
  cancelled: '已取消',
  emit: '事件通知',
}
const branches = { actions: '主流程', onSuccess: '成功分支', onError: '错误分支' }
const pretty = (value: unknown) => (value === undefined ? '未设置' : JSON.stringify(value, null, 2))
</script>
<template>
  <details class="lu-event-debugger">
    <summary>
      <span>交互调试</span
      ><span class="lu-event-debug-count">{{
        reports.length ? `${groupDebugReports(reports).length} 次交互` : '等待交互'
      }}</span>
    </summary>
    <div class="lu-event-debug-settings">
      <span class="lu-muted">API、回调与状态变化</span>
      <div>
        <button
          type="button"
          class="lu-text-button"
          :disabled="!reports.length"
          @click="
            downloadJson('灵构交互调试', {
              schemaVersion: 'lingui.debug/1',
              exportedAt: new Date().toISOString(),
              runs,
            })
          "
        >
          导出记录</button
        ><button
          type="button"
          class="lu-text-button"
          :disabled="!reports.length"
          @click="$emit('clear')"
        >
          清空记录
        </button>
      </div>
    </div>
    <p class="lu-muted">
      直接操作预览即可调试接口。跨域请求需接口允许 CORS；JS 回调由宿主注册，预览内可用
      lingui.log、lingui.notify。记录仅保存在本页，常见凭据字段会隐藏，最多保留 300 条步骤。
    </p>
    <div class="lu-debug-filters">
      <FormKit
        v-model="search"
        type="search"
        label="查找交互"
        placeholder="组件 ID、接口或回调名称"
        :delay="0"
      /><FormKit
        v-model="filter"
        type="select"
        label="记录类型"
        :options="[
          { label: '全部交互', value: 'all' },
          { label: '仅失败', value: 'error' },
          { label: '包含 API', value: 'request' },
          { label: '包含回调', value: 'callback' },
          { label: '状态有变化', value: 'state' },
        ]"
        :delay="0"
      />
    </div>
    <ol v-if="runs.length" class="lu-event-debug-list" aria-label="事件执行记录">
      <li v-for="(run, index) in runs" :key="run.id" :class="`is-${run.status}`">
        <details :open="index === 0" class="lu-debug-run">
          <summary>
            <time>{{ run.time }}</time
            ><strong>{{ run.nodeId }} · {{ eventLabels[run.event] }}</strong
            ><span
              >{{ phases[run.status]
              }}<template v-if="run.durationMs !== undefined">
                · {{ run.durationMs }} ms</template
              ></span
            >
          </summary>
          <ol class="lu-debug-steps">
            <li v-for="report in run.steps" :key="report.id" :class="`is-${report.phase}`">
              <header>
                <strong
                  >{{
                    report.scope === 'request'
                      ? 'API 请求'
                      : report.actionType
                        ? `${branches[report.branch ?? 'actions']} · ${report.step} · ${eventActionLabels[report.actionType]}`
                        : report.phase === 'emit'
                          ? `通知 ${report.name ?? ''}`
                          : '事件'
                  }}<template v-if="report.name && report.phase !== 'emit'">
                    · {{ report.name }}</template
                  ></strong
                ><span
                  >{{ phases[report.phase]
                  }}<template v-if="report.durationMs !== undefined">
                    · {{ report.durationMs }} ms</template
                  ></span
                >
              </header>
              <p v-if="report.http" class="lu-debug-http">
                <code>{{ report.http.method }} {{ report.http.url }}</code
                ><b v-if="report.http.status">HTTP {{ report.http.status }}</b>
              </p>
              <p v-if="report.error" class="lu-debug-error">{{ report.error }}</p>
              <details v-if="report.phase === 'start' && !report.scope">
                <summary>事件参数</summary>
                <pre>{{ pretty(report.data) }}</pre>
              </details>
              <details v-if="report.result !== undefined">
                <summary>返回结果</summary>
                <pre>{{ pretty(report.result) }}</pre>
              </details>
              <details v-if="report.stateChanges?.length">
                <summary>状态变化 · {{ report.stateChanges.length }} 项</summary>
                <div
                  v-for="change in report.stateChanges"
                  :key="change.path"
                  class="lu-debug-state"
                >
                  <code>{{ change.path }}</code>
                  <pre>
之前 {{ pretty(change.before) }}
之后 {{ pretty(change.after) }}</pre>
                </div>
              </details>
            </li>
          </ol>
        </details>
      </li>
    </ol>
    <p v-else class="lu-event-debug-empty">
      {{
        reports.length
          ? '没有匹配的交互记录。'
          : '操作预览中的组件，查看每一步请求、回调、返回结果和状态变化。'
      }}
    </p>
  </details>
</template>
