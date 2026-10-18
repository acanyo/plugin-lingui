<script setup lang="ts">
import { computed } from 'vue'
import LinguiIcon from '../shared/LinguiIcon.vue'
import { useStudioAccess } from '../services/studio-access'
import { OFFICIAL_MCP_PATH, SKILL_TOOL } from './connection'
import McpConnectionPanel from './McpConnectionPanel.vue'
import './mcp.css'

const props = defineProps<{ mode: 'local' | 'halo' }>()
defineEmits<{ drafts: [] }>()
const access = useStudioAccess()
const endpoint = computed(() =>
  props.mode === 'halo' ? new URL(OFFICIAL_MCP_PATH, window.location.origin).href : '',
)
const canViewDrafts = computed(() => props.mode === 'halo' && access.allows('mcp:use'))
</script>
<template>
  <section class="lu-mcp-page" aria-label="MCP 管理">
    <header class="lu-page-title">
      <div>
        <h1>MCP 管理</h1>
        <p class="lu-muted">通过 Halo 官方 MCP 服务，让外部 AI 使用灵构创作工具。</p>
      </div>
      <button v-if="canViewDrafts" type="button" class="lu-button" @click="$emit('drafts')">
        <LinguiIcon name="clock" />草稿与操作记录
      </button>
      <span v-else class="lu-mcp-page-label"><LinguiIcon name="code" />开发者工具</span>
    </header>
    <div class="lu-mcp-overview">
      <McpConnectionPanel :endpoint="endpoint" :can-use-mcp="canViewDrafts" />
      <aside class="lu-mcp-access" aria-labelledby="mcp-access-title">
        <h2 id="mcp-access-title">接入步骤</h2>
        <div>
          <LinguiIcon name="layers" />
          <section>
            <h3>安装官方 MCP 服务</h3>
            <p>
              安装并启用 Halo 官方 MCP Server 1.3.0 或更高的 1.x 版本，灵构工具会自动加入工具目录。
            </p>
          </section>
        </div>
        <div>
          <LinguiIcon name="check" />
          <section>
            <h3>创建密钥并选择工具</h3>
            <p>
              在「工具 → MCP 服务」创建访问密钥，选择「灵构
              UI」下需要的工具。已有密钥也需要手动添加新工具。
            </p>
          </section>
        </div>
        <div>
          <LinguiIcon name="book" />
          <section>
            <h3>让 AI 读取创作 Skill</h3>
            <p>
              连接后先读取已授权的工具清单，再调用创作规则工具获取 Skill，按需查询组件与校验设计。
            </p>
          </section>
        </div>
        <p class="lu-mcp-access-note">
          工具目录、参数检查、访问密钥与调用记录统一在官方 MCP 服务中管理。工作台内置 AI
          的模型与凭据仍在 AI 基座中管理。
        </p>
      </aside>
    </div>
    <section class="lu-mcp-skill">
      <div class="lu-mcp-section-heading">
        <div>
          <h2>创作 Skill 与草稿</h2>
          <p class="lu-muted">把接入说明交给 AI，按当前插件的组件、交互与主题规则创作。</p>
        </div>
        <LinguiIcon name="book" />
      </div>
      <code>{{ SKILL_TOOL }}(topic="skill")</code>
      <p class="lu-muted">
        官方协议工具名以 <code>plugin-lingui__</code> 开头。AI
        客户端可能再添加服务别名前缀，请以客户端提供的可调用名称为准。
      </p>
      <p class="lu-muted">
        需要提交草稿时，在官方访问密钥中选中 <code>plugin-lingui__submit_design_draft</code>。
        草稿会进入「外部 AI 草稿」，由你预览、载入编辑器后确认保存。
      </p>
    </section>
  </section>
</template>
