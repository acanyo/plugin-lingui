<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  workDependencies,
  mapWorkDependencies,
  type ComponentInstance,
  type IntegrationDefinitions,
} from '@lingui/renderer'
import StudioModal from '../shared/StudioModal.vue'
const props = defineProps<{ instance: ComponentInstance; targets: IntegrationDefinitions }>()
const emit = defineEmits<{ use: [instance: ComponentInstance]; close: [] }>()
const dependencies = computed(() => workDependencies(props.instance))
const mapping = ref<Record<string, string>>({}),
  error = ref('')
function apply() {
  try {
    emit('use', mapWorkDependencies(props.instance, props.targets, mapping.value))
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '映射失败'
  }
}
</script>
<template>
  <StudioModal title="配置作品依赖" :width="720" @close="emit('close')">
    <section class="lingui-studio lu-integrations">
      <p class="lu-muted">
        选择当前作品已有的接口或回调，也可以保留原配置，进入工作台后继续调整。参数与字段绑定会保留，请确认目标接口的响应结构兼容。
      </p>
      <div
        v-for="item in dependencies"
        :key="`${item.kind}:${item.name}`"
        class="lu-dependency-list"
      >
        <label class="lu-field"
          ><span>{{ item.kind === 'callback' ? 'JS 回调' : 'API 接口' }} · {{ item.label }}</span
          ><select v-model="mapping[`${item.kind}:${item.name}`]">
            <option :value="undefined">保留原配置{{ !item.configured ? '（待配置）' : '' }}</option>
            <option
              v-for="target in item.kind === 'callback'
                ? targets.callbacks
                : targets.apis.filter(
                    (api) => item.kind !== 'request' || api.method === item.method,
                  )"
              :key="target.name"
              :value="target.name"
            >
              {{ target.label }} · {{ target.name }}
            </option>
          </select></label
        ><code v-if="item.url">{{ item.method }} {{ item.url }}</code>
      </div>
      <p v-if="!targets.apis.length && !targets.callbacks.length" class="lu-muted">
        当前作品还没有可映射的业务能力。导入后可从“接口与回调”添加配置。
      </p>
      <p v-if="error" role="alert" class="lu-error">{{ error }}</p>
    </section>
    <template #footer
      ><button type="button" class="lu-button" @click="emit('close')">取消</button
      ><button type="button" class="lu-button primary" @click="apply">
        应用并进入工作台
      </button></template
    >
  </StudioModal>
</template>
