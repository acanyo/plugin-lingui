<script setup lang="ts">
import { computed, ref } from 'vue'
import type { EventAction, EventBinding, EventReport } from '@lingui/renderer'
import EventActionFields from '../component-studio/EventActionFields.vue'
import { newEventAction, eventActionLabels } from '../component-studio/event-labels'
import {
  branches,
  branchLabels,
  moveGraphAction,
  replaceGraphAction,
  graphActionSummary,
  graphStepReport,
  type Branch,
} from './model'
import './graph.css'
const props = defineProps<{
  binding: EventBinding
  nodeId: string
  event: string
  reports: EventReport[]
}>()
const emit = defineEmits<{ update: [binding: EventBinding] }>()
const selected = ref<{ branch: Branch; index: number }>()
const selectedAction = computed(() =>
  selected.value ? props.binding[selected.value.branch]?.[selected.value.index] : undefined,
)
const known = (action: EventAction) => Object.hasOwn(eventActionLabels, action.type)
function change(action?: EventAction) {
  if (selected.value)
    emit(
      'update',
      replaceGraphAction(props.binding, selected.value.branch, selected.value.index, action),
    )
}
function move(branch: Branch, index: number, delta: number) {
  emit('update', moveGraphAction(props.binding, branch, index, delta))
  selected.value = undefined
}
function remove(branch: Branch, index: number) {
  emit('update', replaceGraphAction(props.binding, branch, index))
  selected.value = undefined
}
const report = (branch: Branch, index: number) => graphStepReport(props.reports, branch, index)
</script>
<template>
  <section class="lu-interaction-graph" aria-label="可视化交互图">
    <div class="lu-graph-trigger">
      <strong>{{ nodeId }}</strong
      ><span>{{ event }} → 开始</span>
    </div>
    <p class="lu-muted">
      点击动作编辑；箭头表示分支内的执行顺序。分支由成功或失败决定，不能连接成循环。保存事件配置后生效。
    </p>
    <div class="lu-graph-branches">
      <section v-for="branch in branches" :key="branch">
        <h4>{{ branchLabels[branch] }}</h4>
        <ol>
          <li
            v-for="(action, index) in binding[branch] ?? []"
            :key="index"
            :data-phase="report(branch, index)?.phase"
          >
            <button
              type="button"
              class="lu-graph-node"
              :aria-pressed="selected?.branch === branch && selected.index === index"
              @click="selected = { branch, index }"
            >
              <strong>{{ index + 1 }} · {{ eventActionLabels[action.type] ?? action.type }}</strong
              ><span>{{ graphActionSummary(action) }}</span
              ><small v-if="report(branch, index)"
                >{{ report(branch, index)?.phase }} ·
                {{ report(branch, index)?.durationMs ?? 0 }} ms</small
              >
            </button>
            <p v-if="report(branch, index)?.error" role="status" class="lu-error">
              {{ report(branch, index)?.error }}
            </p>
            <div class="lu-graph-tools" v-if="known(action)">
              <button
                type="button"
                :disabled="index === 0"
                :aria-label="`上移${branchLabels[branch]}动作 ${index + 1}`"
                @click="move(branch, index, -1)"
              >
                ↑</button
              ><button
                type="button"
                :disabled="index === (binding[branch]?.length ?? 0) - 1"
                :aria-label="`下移${branchLabels[branch]}动作 ${index + 1}`"
                @click="move(branch, index, 1)"
              >
                ↓</button
              ><button
                type="button"
                :aria-label="`删除${branchLabels[branch]}动作 ${index + 1}`"
                @click="remove(branch, index)"
              >
                删除
              </button>
            </div>
          </li>
        </ol>
        <button
          type="button"
          class="lu-button"
          :disabled="(binding[branch]?.length ?? 0) >= 16"
          @click="
            emit(
              'update',
              replaceGraphAction(
                binding,
                branch,
                binding[branch]?.length ?? 0,
                newEventAction('request'),
              ),
            )
          "
        >
          ＋ 添加动作
        </button>
      </section>
    </div>
    <div class="lu-graph-end">
      结束 → {{ binding.loadingPath ? `${binding.loadingPath} = false` : '恢复可交互状态'
      }}<span v-if="binding.resultPath">结果写入 {{ binding.resultPath }}</span
      ><span v-if="binding.errorPath">错误写入 {{ binding.errorPath }}</span>
    </div>
    <section v-if="selectedAction" class="lu-graph-edit">
      <h4>编辑 {{ branchLabels[selected!.branch] }} · 第 {{ selected!.index + 1 }} 步</h4>
      <template v-if="known(selectedAction)"
        ><label class="lu-field"
          ><span>动作类型</span
          ><select
            :value="selectedAction.type"
            @change="
              change(
                newEventAction(($event.target as HTMLSelectElement).value as EventAction['type']),
              )
            "
          >
            <option v-for="(label, type) in eventActionLabels" :key="type" :value="type">
              {{ label }}
            </option>
          </select></label
        ><EventActionFields :action="selectedAction" @update="change"
      /></template>
      <pre v-else>{{ JSON.stringify(selectedAction, null, 2) }}</pre>
      <button type="button" class="lu-text-button" @click="selected = undefined">收起配置</button>
    </section>
  </section>
</template>
