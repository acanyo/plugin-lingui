<script setup lang="ts">
import type { EventAction } from '@lingui/renderer'
import EventActionFields from './EventActionFields.vue'
import { eventActionLabels, newEventAction } from './event-labels'
const props = defineProps<{ actions: EventAction[]; label: string }>()
const emit = defineEmits<{ update: [actions: EventAction[]] }>()
function change(index: number, action: EventAction) {
  emit(
    'update',
    props.actions.map((item, i) => (i === index ? action : item)),
  )
}
function move(index: number, delta: number) {
  const next = [...props.actions],
    target = index + delta
  if (target < 0 || target >= next.length) return
  ;[next[index], next[target]] = [next[target]!, next[index]!]
  emit('update', next)
}
</script>
<template>
  <section class="lu-event-steps" :aria-label="label">
    <div v-for="(action, index) in actions" :key="index" class="lu-event-step">
      <header>
        <span class="lu-event-step-number">{{ index + 1 }}</span>
        <label class="lu-field"
          ><span class="lu-sr-only">{{ label }}动作 {{ index + 1 }} 类型</span
          ><select
            :value="action.type"
            @change="
              change(
                index,
                newEventAction(($event.target as HTMLSelectElement).value as EventAction['type']),
              )
            "
          >
            <option v-for="(name, key) in eventActionLabels" :key="key" :value="key">
              {{ name }}
            </option>
          </select></label
        >
        <div class="lu-event-step-tools">
          <button
            type="button"
            :disabled="index === 0"
            :aria-label="`上移${label}动作 ${index + 1}`"
            @click="move(index, -1)"
          >
            ↑</button
          ><button
            type="button"
            :disabled="index === actions.length - 1"
            :aria-label="`下移${label}动作 ${index + 1}`"
            @click="move(index, 1)"
          >
            ↓</button
          ><button
            type="button"
            :aria-label="`移除${label}动作 ${index + 1}`"
            @click="
              emit(
                'update',
                actions.filter((_, i) => i !== index),
              )
            "
          >
            ×
          </button>
        </div>
      </header>
      <EventActionFields :action="action" @update="change(index, $event)" />
    </div>
    <button
      type="button"
      class="lu-button lu-event-add"
      :disabled="actions.length >= 16"
      @click="emit('update', [...actions, newEventAction('request')])"
    >
      ＋ 添加{{ label }}动作
    </button>
  </section>
</template>
