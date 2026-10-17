<script setup lang="ts">
import { computed } from 'vue'
import { workDependencies, type ComponentInstance } from '@lingui/renderer'
const props = defineProps<{ instance: ComponentInstance }>()
const dependencies = computed(() => workDependencies(props.instance))
</script>
<template>
  <section v-if="dependencies.length" aria-label="作品依赖" class="lu-dependency-list">
    <h3>接口与回调依赖</h3>
    <p class="lu-muted">
      导入时可映射到自己的接口。预览支持原始请求与模拟响应，JS 回调需要宿主注册。
    </p>
    <div v-for="item in dependencies" :key="`${item.kind}:${item.name}`" class="lu-dependency-item">
      <span class="lu-tag">{{ item.kind === 'callback' ? 'JS' : 'API' }}</span
      ><strong>{{ item.label }}</strong
      ><code v-if="item.url">{{ item.url }}</code
      ><small v-if="!item.configured">待配置</small>
    </div>
  </section>
</template>
