<script setup lang="ts">
import { computed } from 'vue'
import { designValue, type DraftMerge, type DraftSelection } from './design-changes'
const props = defineProps<{
  merge: DraftMerge
  selection: DraftSelection
  disabled?: boolean
  appearanceOnly?: boolean
}>()
const emit = defineEmits<{ update: [selection: DraftSelection]; locate: [id: string] }>()
const selected = computed(() => new Set(props.selection.keys))
function toggle(key: string, value: boolean) {
  const keys = new Set(props.selection.keys)
  if (value) keys.add(key)
  else keys.delete(key)
  emit('update', { ...props.selection, keys: [...keys] })
}
function choose(all: boolean) {
  emit('update', {
    fingerprint: props.merge.fingerprint,
    keys: all ? props.merge.changes.map((change) => change.key) : [],
  })
}
</script>
<template>
  <section class="lu-draft-review" aria-label="逐项审核修改">
    <header>
      <strong>逐项审核 · 已选 {{ selection.keys.length }}/{{ merge.changes.length }}</strong>
      <div>
        <button type="button" class="lu-text-button" :disabled="disabled" @click="choose(true)">
          全部采用</button
        ><button type="button" class="lu-text-button" :disabled="disabled" @click="choose(false)">
          全部保留当前
        </button>
      </div>
    </header>
    <p class="lu-muted">
      勾选以采用 AI 修改，取消以保留当前值。{{
        appearanceOnly ? '冲突项默认保留你的修改。' : '结构与引用改动需一并选择。'
      }}
    </p>
    <p v-if="!merge.changes.length" class="lu-muted">草稿的修改已存在于当前作品中。</p>
    <ol>
      <li
        v-for="change in merge.changes"
        :key="change.key"
        :class="{ 'has-conflict': change.conflict }"
      >
        <FormKit
          type="checkbox"
          :model-value="selected.has(change.key)"
          :label="change.label"
          :disabled="disabled"
          :delay="0"
          @update:model-value="toggle(change.key, !!$event)"
        />
        <span v-if="change.conflict" class="lu-draft-conflict">{{
          selected.has(change.key) ? '存在冲突 · 已选择 AI 修改' : '存在冲突 · 保留当前值'
        }}</span>
        <button
          v-if="change.nodeId"
          type="button"
          class="lu-text-button"
          @click="emit('locate', change.nodeId)"
        >
          定位 {{ change.nodeId }}
        </button>
        <details>
          <summary>查看具体值</summary>
          <div class="lu-draft-values">
            <div v-if="change.conflict">
              <small>共同基准</small>
              <pre>{{ designValue(change.before) }}</pre>
            </div>
            <div>
              <small>当前作品</small>
              <pre>{{ designValue(change.current) }}</pre>
            </div>
            <div>
              <small>AI 修改</small>
              <pre>{{ designValue(change.after) }}</pre>
            </div>
          </div>
        </details>
      </li>
    </ol>
  </section>
</template>
