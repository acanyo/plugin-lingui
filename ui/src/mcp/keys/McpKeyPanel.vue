<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { VButton, Dialog } from '@halo-dev/components'
import LinguiIcon from '../../shared/LinguiIcon.vue'
import {
  createMcpKeyClient,
  keyDate,
  keyError,
  keyStatus,
  keyWorkScope,
  type McpKeyClient,
  type McpKeyInfo,
} from './client'
import McpKeyIssueDialog from './McpKeyIssueDialog.vue'
import './keys.css'
const props = defineProps<{ endpoint: string; client?: McpKeyClient }>()
const client = props.client ?? createMcpKeyClient()
const keys = ref<McpKeyInfo[]>([])
const loading = ref(false)
const error = ref('')
const creating = ref(false)
const pending = ref('')
const feedback = ref('')
async function load() {
  loading.value = true
  error.value = ''
  try {
    keys.value = await client.list()
  } catch (cause) {
    error.value = keyError(cause)
  } finally {
    loading.value = false
  }
}
function confirmAction(key: McpKeyInfo, action: 'revoke' | 'delete') {
  if (!key.id || pending.value) return
  Dialog.warning({
    title: action === 'revoke' ? '撤销这个接入密钥？' : '删除密钥记录？',
    description:
      action === 'revoke'
        ? `「${key.name}」的 AI 客户端将无法继续连接，可重新创建密钥恢复。`
        : `删除「${key.name}」的停用记录。`,
    confirmText: action === 'revoke' ? '撤销密钥' : '删除记录',
    cancelText: '取消',
    onConfirm: async () => {
      pending.value = key.id!
      error.value = ''
      feedback.value = ''
      try {
        await client[action](key.id!)
        feedback.value = action === 'revoke' ? '密钥已撤销，后续请求将被拒绝。' : '已删除密钥记录。'
        await load()
      } catch (cause) {
        error.value = keyError(cause)
      } finally {
        pending.value = ''
      }
    },
  })
}
onMounted(load)
</script>
<template>
  <section class="lu-mcp-keys" aria-label="MCP 接入密钥" :aria-busy="loading">
    <header class="lu-mcp-section-heading">
      <div>
        <h2>
          MCP 接入密钥 <span>{{ keys.length }}</span>
        </h2>
        <p class="lu-muted">仅用于灵构 MCP，默认不允许读取项目。</p>
      </div>
      <VButton class="lu-button primary" @click="creating = true"
        ><template #icon><LinguiIcon name="plus" /></template>创建密钥</VButton
      >
    </header>
    <p v-if="error" class="lu-error" role="alert">
      {{ error }} <VButton class="lu-button" :disabled="loading" @click="load">刷新列表</VButton>
    </p>
    <p v-if="feedback" class="lu-key-feedback" role="status">{{ feedback }}</p>
    <p v-if="loading && !keys.length" class="lu-key-empty" role="status">正在读取密钥…</p>
    <div v-else-if="!error && !keys.length" class="lu-key-empty">
      <LinguiIcon name="code" /><strong>还没有接入密钥</strong>
      <p>为外部 AI 创建一把密钥，复制配置后即可连接。</p>
    </div>
    <ul v-else class="lu-key-list">
      <li v-for="key in keys" :key="key.id">
        <div class="lu-key-list-main">
          <div class="lu-key-list-title">
            <h3>{{ key.name }}</h3>
            <span class="lu-mcp-status" :class="{ 'is-ready': keyStatus(key) === '使用中' }">{{
              keyStatus(key)
            }}</span>
          </div>
          <code>{{ key.prefix }}…</code>
          <p>
            到期 {{ keyDate(key.expiresAt) }} <span>最近使用 {{ keyDate(key.lastUsedAt) }}</span>
          </p>
          <details v-if="!key.allWorks && key.workNames?.length">
            <summary>{{ keyWorkScope(key) }}</summary>
            <p v-for="name in key.workNames" :key="name">
              <code>{{ name }}</code>
            </p>
          </details>
          <p v-else>{{ keyWorkScope(key) }}</p>
          <p v-if="key.submitDrafts">可提交创作草稿 · 保存需确认</p>
        </div>
        <div class="lu-key-actions">
          <VButton
            v-if="keyStatus(key) === '使用中'"
            class="lu-button"
            :disabled="!!pending"
            :loading="pending === key.id"
            @click="confirmAction(key, 'revoke')"
            >撤销</VButton
          ><VButton
            v-else
            class="lu-button"
            :disabled="!!pending"
            :loading="pending === key.id"
            @click="confirmAction(key, 'delete')"
            >删除记录</VButton
          >
        </div>
      </li>
    </ul>
  </section>
  <McpKeyIssueDialog
    v-if="creating"
    :endpoint="endpoint"
    :client="client"
    @created="load"
    @close="creating = false"
  />
</template>
