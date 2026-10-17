<script setup lang="ts">
import { ref } from 'vue'
import type { ComponentInstance } from '@lingui/renderer'
import type { InteractionRecording } from './model'
import { shareRecording, type SharedDemo } from './shared-demo'
const props = defineProps<{
  recordings: InteractionRecording[]
  instance: ComponentInstance
  demos?: SharedDemo[]
}>()
const emit = defineEmits<{ update: [value: SharedDemo[]] }>()
const selected = ref(''),
  consent = ref(false),
  error = ref('')
function add() {
  try {
    const recording = props.recordings.find((item) => item.id === selected.value)
    if (!recording || !consent.value) return
    emit('update', [...(props.demos ?? []), shareRecording(recording, props.instance)])
    consent.value = false
    error.value = ''
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '无法分享'
  }
}
</script>
<template>
  <details class="lu-event-extra">
    <summary>公开演示（可选）· {{ demos?.length ?? 0 }} 条</summary>
    <p class="lu-muted">
      仅选择并确认的演示进入作品包，经市场审核后公开。接口仅使用作品内示例，不包含调试响应或宿主回调。
    </p>
    <ol>
      <li v-for="(demo, index) in demos" :key="index">
        {{ demo.name }} · {{ demo.steps.length }} 步<button
          type="button"
          class="lu-text-button"
          @click="
            emit(
              'update',
              demos!.filter((_, i) => i !== index),
            )
          "
        >
          移除
        </button>
        <pre class="lu-code">{{ JSON.stringify(demo.steps, null, 2) }}</pre>
      </li>
    </ol>
    <label class="lu-field"
      ><span>选择本地录制</span
      ><select v-model="selected">
        <option value="">请选择</option>
        <option v-for="item in recordings" :key="item.id" :value="item.id">{{ item.name }}</option>
      </select></label
    >
    <pre v-if="selected" class="lu-code">{{
      JSON.stringify(recordings.find((item) => item.id === selected)?.steps, null, 2)
    }}</pre>
    <label
      ><input
        v-model="consent"
        type="checkbox"
      />我已检查全部输入，确认使用演示数据并允许随作品公开</label
    ><button
      type="button"
      class="lu-button"
      :disabled="!selected || !consent || (demos?.length ?? 0) >= 3"
      @click="add"
    >
      加入公开演示
    </button>
    <p v-if="error" class="lu-error" role="alert">{{ error }}</p>
  </details>
</template>
<style scoped>
pre {
  max-height: 180px;
  overflow: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: 11px;
}
</style>
