<script setup lang="ts">
import { computed } from 'vue'
import LinguiIcon from '../shared/LinguiIcon.vue'
import { useStudioAccess } from '../services/studio-access'
import { createMcpClient, EXTERNAL_MCP_PATH, SKILL_URI, type McpClient } from './client'
import { useMcpManager } from './useMcpManager'
import McpConnectionPanel from './McpConnectionPanel.vue'
import McpToolInspector from './McpToolInspector.vue'
import McpKeyPanel from './keys/McpKeyPanel.vue'
import './mcp.css'

const props = defineProps<{ mode: 'local' | 'halo'; client?: McpClient }>()
defineEmits<{ drafts: [] }>()
const client = props.client ?? createMcpClient()
const access = useStudioAccess()
const manager = useMcpManager(client)
const endpoint = computed(() =>
  props.mode === 'halo' ? new URL(EXTERNAL_MCP_PATH, window.location.origin).href : '',
)
const available = computed(() => props.mode === 'halo' && access.allows('mcp:use'))
const disabledReason = computed(() =>
  props.mode === 'local'
    ? '当前是独立前端工作空间，没有 Halo MCP 服务。请在 Halo 控制台 → 灵构 UI → MCP 管理中连接。'
    : !available.value
      ? '当前账号没有 MCP 使用权限，请管理员授予「使用 MCP 创作工具」后重新登录。'
      : '',
)
const status = computed(
  () =>
    ({ idle: '尚未测试', connecting: '正在连接', ready: '连接正常', error: '连接失败' })[
      manager.state.value
    ],
)
function connect() {
  if (available.value) void manager.connect()
}
</script>
<template>
  <section class="lu-mcp-page" aria-label="MCP 管理">
    <header class="lu-page-title">
      <div>
        <h1>MCP 管理</h1>
        <p class="lu-muted">把灵构的组件与创作能力，交给你使用的 AI。</p>
      </div>
      <button v-if="available" type="button" class="lu-button" @click="$emit('drafts')">
        <LinguiIcon name="clock" />草稿与操作记录
      </button>
      <span v-else class="lu-mcp-page-label"><LinguiIcon name="code" />开发者工具</span>
    </header>
    <div class="lu-mcp-overview">
      <McpConnectionPanel
        :endpoint="endpoint"
        :available="available"
        :busy="manager.state.value === 'connecting'"
        :disabled-reason="disabledReason"
        :status="status"
        :connected="manager.state.value === 'ready'"
        :protocol="manager.server.value?.protocolVersion"
        :checked-at="manager.checkedAt.value"
        :elapsed="manager.elapsed.value"
        @connect="connect"
      />
      <aside class="lu-mcp-access" aria-labelledby="mcp-access-title">
        <h2 id="mcp-access-title">连接之前</h2>
        <div>
          <LinguiIcon name="book" />
          <section>
            <h3>Skill 指导创作</h3>
            <p>设计风格、组件组合、交互与主题规则，由创作 Skill 提供。用户指定的风格优先。</p>
          </section>
        </div>
        <div>
          <LinguiIcon name="code" />
          <section>
            <h3>MCP 提供真实工具</h3>
            <p>按需获取组件参数、已保存的作品和校验结果，减少每次生成重复发送的内容。</p>
          </section>
        </div>
        <div>
          <LinguiIcon name="check" />
          <section>
            <h3>专用密钥，按项目授权</h3>
            <p>
              在下方创建灵构 MCP 密钥，配置到外部
              AI。密钥可过期或撤销，默认不读取项目；账号权限收回后也会停止访问。
            </p>
          </section>
        </div>
        <p class="lu-mcp-access-note">
          工作台内置 AI 直接调用同一套工具，模型与凭据仍在 AI 基座中管理。外部 MCP
          连接测试不消耗模型 Token。
        </p>
      </aside>
    </div>
    <McpKeyPanel v-if="available" :endpoint="endpoint" />
    <p v-if="manager.error.value" class="lu-mcp-error" role="alert">
      <LinguiIcon name="warning" />{{ manager.error.value }}
    </p>
    <template v-if="manager.state.value === 'ready'">
      <McpToolInspector
        :tools="manager.tools.value"
        :version="manager.server.value!.protocolVersion"
        :client="client"
      />
      <section class="lu-mcp-skill">
        <div class="lu-mcp-section-heading">
          <div>
            <h2>创作 Skill</h2>
            <p class="lu-muted">随当前插件提供，外部 AI 可通过 MCP 资源读取。</p>
          </div>
          <LinguiIcon name="book" />
        </div>
        <code>{{ SKILL_URI }}</code>
        <details>
          <summary>查看完整创作规则</summary>
          <pre tabindex="0">{{ manager.skill.value }}</pre>
        </details>
      </section>
    </template>
    <section v-else class="lu-mcp-empty" :aria-busy="manager.state.value === 'connecting'">
      <LinguiIcon name="code" />
      <h2>
        {{
          manager.state.value === 'connecting' ? '正在检查工具与 Skill' : '连接后查看工具与 Skill'
        }}
      </h2>
      <p>测试连接会完成协议握手、心跳检查，并读取实时工具清单与创作规则。</p>
    </section>
  </section>
</template>
