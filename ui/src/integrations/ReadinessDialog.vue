<script setup lang="ts">
import { computed } from 'vue'
import { workDependencies, type ComponentInstance } from '@lingui/renderer'
import { checkContracts } from '../ai-adapter/contract-check'
import StudioModal from '../shared/StudioModal.vue'
import DependencySummary from './DependencySummary.vue'
const props = defineProps<{ instance: ComponentInstance }>()
const issues = computed(() => checkContracts(props.instance.document))
const errors = computed(() => issues.value.filter((issue) => issue.level === 'error'))
const dependencies = computed(() => workDependencies(props.instance))
defineEmits<{ close: [] }>()
</script>
<template>
  <StudioModal title="发布前检查" :width="760" @close="$emit('close')">
    <section class="lingui-studio lu-readiness">
      <h3>
        {{ errors.length ? `${errors.length} 处配置需要修复` : '结构与已知数据映射已通过检查' }}
      </h3>
      <p class="lu-muted">
        此检查不发送网络请求。实际接口权限、返回数据与回调注册需要在目标页面验证。
      </p>
      <ul v-if="issues.length">
        <li
          v-for="issue in issues"
          :key="`${issue.nodeId}-${issue.message}`"
          :class="issue.level === 'error' ? 'lu-error' : 'lu-muted'"
        >
          <code>{{ issue.nodeId }}</code> · {{ issue.message }}
        </li>
      </ul>
      <DependencySummary :instance="instance" />
      <p v-if="dependencies.some((item) => item.kind !== 'callback')" class="lu-muted">
        接口联调：在预览下方的「API
        测试场景」中检查成功、空数据、失败和慢响应，再切回原始接口验证实际请求与重试。
      </p>
      <p v-if="dependencies.some((item) => item.kind === 'callback')" class="lu-muted">
        JS 回调需要嵌入页面注册实际函数；声明回调名称不会自动执行脚本。
      </p>
    </section>
    <template #footer
      ><button type="button" class="lu-button" @click="$emit('close')">返回创作</button></template
    >
  </StudioModal>
</template>
