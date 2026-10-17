<script setup lang="ts">
import type { JsonValue, LinguiDocument } from '@lingui/renderer'
import type { BindingImpact } from './impact'
import ResponseContractPanel from './ResponseContractPanel.vue'
defineProps<{ document: LinguiDocument; samples: Record<string, JsonValue> }>()
const emit = defineEmits<{ locate: [impact: BindingImpact] }>()
</script>
<template>
  <details v-if="Object.keys(samples).length" class="lu-advanced lu-observed-contracts" open>
    <summary>接口返回结构检查</summary>
    <template v-for="api in document.integrations?.apis ?? []" :key="api.name">
      <article v-if="Object.hasOwn(samples, api.name)">
        <strong>{{ api.label }} · {{ api.name }}</strong>
        <ResponseContractPanel
          :name="api.name"
          :expected="api.responseExample"
          :actual="samples[api.name]!"
          :document="document"
          @locate="emit('locate', $event)"
        />
      </article>
    </template>
  </details>
</template>
