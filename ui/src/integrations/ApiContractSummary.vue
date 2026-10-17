<script setup lang="ts">
import type { ApiDefinition } from '@lingui/renderer'
defineProps<{ apis: ApiDefinition[] }>()
</script>
<template>
  <details v-if="apis.length" class="lu-api-contract-summary">
    <summary>接口参数与响应示例 · {{ apis.length }} 项</summary>
    <article v-for="api in apis" :key="api.name">
      <strong>{{ api.method }} · {{ api.label }}</strong>
      <code>{{ api.name }}</code>
      <p v-if="api.description">{{ api.description }}</p>
      <h4>{{ api.method === 'GET' ? '查询参数' : 'JSON 请求体' }}</h4>
      <pre>{{ JSON.stringify(api.inputExample ?? {}, null, 2) }}</pre>
      <h4>响应示例</h4>
      <pre>{{ JSON.stringify(api.responseExample ?? {}, null, 2) }}</pre>
    </article>
  </details>
</template>
<style scoped>
.lu-api-contract-summary {
  margin-top: 16px;
  padding: 12px;
  border: 1px solid var(--lu-border);
  border-radius: 10px;
  font-size: 12px;
}
summary {
  cursor: pointer;
}
article {
  margin-top: 16px;
  min-width: 0;
}
article > code {
  display: block;
  color: var(--lu-muted);
  margin: 6px 0;
}
p {
  color: var(--lu-muted);
  line-height: 1.7;
}
h4 {
  margin: 12px 0 6px;
  font-weight: 500;
}
pre {
  max-height: 240px;
  overflow: auto;
  border-radius: 6px;
  background: var(--lu-sidebar);
  padding: 10px;
  font-size: 11px;
  line-height: 1.7;
}
</style>
