<script setup lang="ts">
import { computed, ref } from 'vue'
import { VButton } from '@halo-dev/components'
import LinguiIcon from '../shared/LinguiIcon.vue'
import { clientConfiguration, codexConfiguration, OFFICIAL_MCP_CONSOLE_PATH } from './connection'
import ExternalAiDialog from './ExternalAiDialog.vue'
import McpClientSetupGuide from './McpClientSetupGuide.vue'

const props = defineProps<{ endpoint: string; canUseMcp: boolean }>()
const feedback = ref('')
const connectingExternalAi = ref(false)
const config = computed(() => clientConfiguration(props.endpoint))
const codexConfig = computed(() => codexConfiguration(props.endpoint))
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
        <h2 id="mcp-connection-title">Halo 官方 MCP 服务</h2>
      </div>
      <span class="lu-mcp-status">MCP Server 1.x ≥ 1.3.0</span>
    </div>
    <p class="lu-muted">统一连接 Halo 与灵构工具，使用官方访问密钥按工具授权。</p>
    <div class="lu-mcp-endpoint">
      <span>Streamable HTTP</span>
      <div v-if="endpoint">
        <code>{{ endpoint }}</code>
        <button
          type="button"
          class="lu-icon-button"
          aria-label="复制 MCP 地址"
          @click="copy(endpoint, '连接地址')"
        >
          <LinguiIcon name="copy" />
        </button>
      </div>
      <p v-else>
        当前是独立前端工作空间。接入外部 AI 时，请填写已安装官方 MCP Server 和灵构 UI 的 Halo 站点。
      </p>
    </div>
    <div class="lu-mcp-connect-actions">
      <a v-if="endpoint" :href="OFFICIAL_MCP_CONSOLE_PATH" class="lu-button primary"
        >打开官方 MCP 服务</a
      >
      <VButton class="lu-button" @click="connectingExternalAi = true"
        ><template #icon><LinguiIcon name="book" /></template>MCP 与 Skill 接入指引</VButton
      >
    </div>
    <p class="lu-mcp-notice">
      请先安装并启用官方插件，再到「工具 → MCP 服务」创建访问密钥，选择「灵构 UI」工具。
    </p>
    <dl class="lu-mcp-facts">
      <div>
        <dt>服务地址</dt>
        <dd>Halo 站点 /mcp</dd>
      </div>
      <div>
        <dt>工具授权</dt>
        <dd>官方访问密钥逐项选择</dd>
      </div>
      <div>
        <dt>身份认证</dt>
        <dd>Authorization: Bearer</dd>
      </div>
    </dl>
    <details v-if="endpoint" class="lu-mcp-config">
      <summary>外部客户端接入配置</summary>
      <p class="lu-muted">
        将官方访问密钥设置到 AI 客户端环境变量 HALO_MCP_TOKEN，配置中仅引用变量名。
      </p>
      <McpClientSetupGuide />
      <pre tabindex="0" aria-label="Codex MCP 配置">{{ codexConfig }}</pre>
      <VButton class="lu-button" @click="copy(codexConfig, 'Codex 配置')">复制 Codex 配置</VButton>
      <p class="lu-muted">以下为支持环境变量引用的 HTTP MCP 客户端示例，请按客户端要求调整。</p>
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
    :can-use-mcp="canUseMcp"
    :allow-import="false"
    @close="connectingExternalAi = false"
  />
</template>
