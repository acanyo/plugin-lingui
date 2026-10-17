<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ComponentInstance } from '@lingui/renderer'
import type { ApiScenario } from '../integrations/scenarios/model'
import type { useInteractionRecordings } from './useInteractionRecordings'
import RecordingReplay from './RecordingReplay.vue'
import './recordings.css'
const props = defineProps<{
  controller: ReturnType<typeof useInteractionRecordings>
  instance?: ComponentInstance
  rules?: Record<string, ApiScenario>
}>()
const { records, recording, count, error } = props.controller
const name = ref(''),
  selectedId = ref('')
const selected = computed(() => records.value.find((item) => item.id === selectedId.value))
</script>
<template>
  <details class="lu-recording-panel">
    <summary>
      交互录制与回放 · {{ recording ? `录制中 ${count} 步` : `${records.length} 条演示` }}
    </summary>
    <div class="lu-recording-toolbar">
      <input
        v-model="name"
        placeholder="演示名称"
        aria-label="演示名称"
        maxlength="120"
        :disabled="recording"
      /><button
        v-if="!recording"
        type="button"
        class="lu-button"
        :disabled="!instance"
        @click="controller.start(name)"
      >
        开始录制</button
      ><button v-else type="button" class="lu-button primary" @click="controller.stop">
        结束并保存 {{ count }} 步
      </button>
    </div>
    <p class="lu-muted">
      从作品初始状态开始操作，再结束录制。最多 100 步、12
      条；仅存本地创作历史，不进入文章或自动投稿。请使用演示输入，避免填写个人信息。
    </p>
    <p v-if="error" role="alert" class="lu-error">{{ error }}</p>
    <ol class="lu-recording-list">
      <li v-for="item in records" :key="item.id">
        <input
          :value="item.name"
          :aria-label="`重命名 ${item.name}`"
          maxlength="120"
          @change="controller.rename(item.id, ($event.target as HTMLInputElement).value)"
        /><small>{{ item.steps.length }} 步</small>
        <div class="lu-recording-actions">
          <button
            type="button"
            class="lu-text-button"
            @click="selectedId = selectedId === item.id ? '' : item.id"
          >
            {{ selectedId === item.id ? '收起回放' : '查看与回放' }}</button
          ><button type="button" class="lu-text-button" @click="controller.remove(item.id)">
            删除
          </button>
        </div>
      </li>
    </ol>
    <RecordingReplay
      v-if="selected"
      :key="selected.id"
      :recording="selected"
      :current="instance"
      :rules="rules"
    />
  </details>
</template>
