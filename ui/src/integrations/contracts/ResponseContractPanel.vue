<script setup lang="ts">
import { computed } from 'vue'
import type { JsonValue, LinguiDocument } from '@lingui/renderer'
import { responseChanges } from './shape'
import { affectedBindings, type BindingImpact } from './impact'
const props = defineProps<{
  name: string
  expected?: JsonValue
  actual: JsonValue
  document?: LinguiDocument
}>()
const emit = defineEmits<{ locate: [impact: BindingImpact] }>()
const changes = computed(() =>
  props.expected === undefined
    ? []
    : responseChanges(props.expected, props.actual).map((change) => ({
        ...change,
        impacts: props.document ? affectedBindings(props.document, props.name, change) : [],
      })),
)
</script>
<template>
  <section class="lu-response-contract" aria-label="接口字段变化" role="status">
    <strong>接口字段检查</strong>
    <p v-if="expected === undefined">尚无保存的响应示例，可先采用本次结果作为参考。</p>
    <p v-else-if="!changes.length">
      本次返回结构与响应示例一致。空数组内的字段需要有记录后再确认。
    </p>
    <template v-else>
      <p>发现 {{ changes.length }} 处结构变化。请核对受影响的绑定，再决定是否更新响应示例。</p>
      <ul>
        <li v-for="change in changes" :key="change.path + change.kind">
          <code>{{ change.path }}</code>
          <span>{{
            change.kind === 'missing'
              ? '字段缺失'
              : change.kind === 'added'
                ? `新增字段 · ${change.after}`
                : `类型变化 · ${change.before} → ${change.after}`
          }}</span>
          <div v-if="change.impacts.length" class="lu-contract-impacts">
            <button
              v-for="impact in change.impacts"
              :key="impact.nodeId + impact.property + impact.path"
              type="button"
              class="lu-text-button"
              :aria-label="`定位组件 ${impact.nodeId} 的 ${impact.property}`"
              @click="emit('locate', impact)"
            >
              {{ impact.nodeId }} · {{ impact.property }} → 编辑绑定
            </button>
          </div>
          <small v-else-if="change.kind !== 'added'">未发现直接引用此字段的组件。</small>
        </li>
      </ul>
    </template>
    <small
      >按示例抽样检查（最多 10 层、500 个字段、每数组 50
      项），字段可选性和业务含义仍需确认；不会自动修改作品。</small
    >
  </section>
</template>
<style scoped>
.lu-response-contract {
  margin: 12px 0;
  padding: 14px 16px;
  border: 1px solid var(--lu-border);
  border-radius: 10px;
  font-size: 13px;
  overflow-wrap: anywhere;
}
p {
  margin: 8px 0;
  color: var(--lu-muted);
}
ul {
  max-height: 300px;
  overflow: auto;
  list-style: none;
  padding: 0;
  margin: 10px 0;
}
li {
  padding: 10px 0;
  border-top: 1px solid var(--lu-border);
  display: grid;
  gap: 5px;
}
code {
  white-space: pre-wrap;
}
.lu-contract-impacts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
}
small {
  color: var(--lu-muted);
}
</style>
