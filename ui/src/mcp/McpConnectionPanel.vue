<script setup lang="ts">
import { computed, ref } from 'vue'
import { VButton } from '@halo-dev/components'
import LinguiIcon from '../shared/LinguiIcon.vue'
import { clientConfiguration } from './client'
import ExternalAiDialog from './ExternalAiDialog.vue'
import McpClientSetupGuide from './McpClientSetupGuide.vue'

const props = defineProps<{
  endpoint: string
  available: boolean
  busy: boolean
  disabledReason: string
  status: string
  connected: boolean
  protocol?: string
  checkedAt: string
  elapsed: number
}>()
defineEmits<{ connect: [] }>()
const feedback = ref('')
const connectingExternalAi = ref(false)
const config = computed(() => clientConfiguration(props.endpoint))
async function copy(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value)
    feedback.value = `已复制${label}`
  } catch {
    feedback.value = '复制失败，请选中内容手动复制。'
  }
}
</script>
<template>
  <section class="lu-mcp-connection" aria-labelledby="mcp-connection-title">
    <div class="lu-mcp-card-heading">
      <div class="lu-mcp-server-name">
        <LinguiIcon name="layers" />
        <h2 id="mcp-connection-title">灵构创作服务</h2>
      </div>
      <span class="lu-mcp-status" :class="{ 'is-ready': connected }" role="status"
        ><i aria-hidden="true" />{{ status }}</span
      >
    </div>
    <p class="lu-muted">让支持 MCP 的 AI 客户端查询组件、读取作品和校验设计。</p>
    <div class="lu-mcp-endpoint">
      <span>Streamable HTTP</span>
      <div v-if="endpoint">
        <code>{{ endpoint }}</code
        ><button
          type="button"
          class="lu-icon-button"
          aria-label="复制 MCP 地址"
          @click="copy(endpoint, '连接地址')"
        >
          <LinguiIcon name="copy" />
        </button>
      </div>
      <p v-else>在 Halo 控制台打开此页，即可获取当前站点的连接地址。</p>
    </div>
    <div class="lu-mcp-connect-actions">
      <VButton
        v-if="endpoint"
        class="lu-button primary"
        :disabled="!available || busy"
        :loading="busy"
        @click="$emit('connect')"
        ><template #icon><LinguiIcon name="refresh" /></template
        >{{ busy ? '正在测试…' : connected ? '重新测试' : '测试连接' }}</VButton
      >
      <button v-else type="button" class="lu-button primary" disabled>测试连接</button>
      <span v-if="connected" class="lu-muted">{{ elapsed }} ms · {{ checkedAt }} 检查</span>
      <span v-else class="lu-muted">站内测试使用 Halo 登录身份</span>
    </div>
    <p v-if="disabledReason" class="lu-mcp-notice">{{ disabledReason }}</p>
    <VButton class="lu-button lu-mcp-onboarding" @click="connectingExternalAi = true"
      ><template #icon><LinguiIcon name="book" /></template>MCP 与 Skill 接入指引</VButton
    >
    <dl class="lu-mcp-facts">
      <div>
        <dt>协议版本</dt>
        <dd>{{ protocol || '连接后获取' }}</dd>
      </div>
      <div>
        <dt>执行权限</dt>
        <dd>查询与校验 · 草稿单独授权</dd>
      </div>
      <div>
        <dt>身份认证</dt>
        <dd>灵构 MCP 专用密钥</dd>
      </div>
    </dl>
    <details v-if="endpoint" class="lu-mcp-config">
      <summary>外部客户端接入配置</summary>
      <p class="lu-muted">
        将配置添加到支持 HTTP MCP 的客户端，用下方创建的 MCP
        专用密钥替换占位符。不同客户端字段可能有所不同。
      </p>
      <McpClientSetupGuide />
      <pre tabindex="0" aria-label="MCP 客户端配置">{{ config }}</pre>
      <VButton class="lu-button" @click="copy(config, '接入配置')"
        ><template #icon><LinguiIcon name="copy" /></template>复制配置</VButton
      >
    </details>
    <p v-if="feedback" class="lu-mcp-copy-feedback" role="status">{{ feedback }}</p>
  </section>
  <ExternalAiDialog
    v-if="connectingExternalAi"
    :mode="endpoint ? 'halo' : 'local'"
    :can-use-mcp="available"
    :allow-import="false"
    @close="connectingExternalAi = false"
  />
</template>
