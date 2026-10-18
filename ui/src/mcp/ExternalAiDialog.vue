<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { VButton } from '@halo-dev/components'
import type { ComponentInstance, ThemeTokens } from '@lingui/renderer'
import StudioModal from '../shared/StudioModal.vue'
import LinguiIcon from '../shared/LinguiIcon.vue'
import {
  clientConfiguration,
  codexConfiguration,
  OFFICIAL_MCP_PATH,
  OFFICIAL_MCP_CONSOLE_PATH,
  SKILL_TOOL,
} from './connection'
import { endpointForHaloSite, externalAiInstructions } from './external-ai'
import McpClientSetupGuide from './McpClientSetupGuide.vue'
import './external-ai.css'

const props = withDefaults(
  defineProps<{
    mode: 'local' | 'halo'
    canUseMcp: boolean
    kind?: 'component' | 'theme'
    instruction?: string
    instance?: ComponentInstance
    dirty?: boolean
    theme?: ThemeTokens
    allowImport?: boolean
  }>(),
  { kind: 'component', dirty: true, allowImport: true },
)
const emit = defineEmits<{ close: []; import: [] }>()
const site = ref('')
const fieldId = useId()
const feedback = ref('')
const copyFailed = ref(false)
const connection = computed(() => {
  if (props.mode === 'halo')
    return { endpoint: new URL(OFFICIAL_MCP_PATH, window.location.origin).href, error: '' }
  if (!site.value.trim()) return { endpoint: '', error: '' }
  try {
    return { endpoint: endpointForHaloSite(site.value), error: '' }
  } catch (cause) {
    return {
      endpoint: '',
      error:
        cause instanceof TypeError
          ? '请输入完整的 Halo 站点地址，例如 https://halo.example.com。'
          : (cause as Error).message,
    }
  }
})
const config = computed(() => clientConfiguration(connection.value.endpoint))
const codexConfig = computed(() => codexConfiguration(connection.value.endpoint))
const officialConsole = computed(() =>
  connection.value.endpoint
    ? new URL(OFFICIAL_MCP_CONSOLE_PATH, connection.value.endpoint).href
    : '',
)
const workName = computed(() => (props.mode === 'halo' ? props.instance?.templateId : undefined))
const instructions = computed(() =>
  externalAiInstructions({
    endpoint: connection.value.endpoint,
    kind: props.kind,
    instruction: props.instruction,
    workName: workName.value,
    hasUnsavedChanges: props.dirty,
    theme: props.theme,
  }),
)
watch([site, instructions], () => {
  feedback.value = ''
  copyFailed.value = false
})
async function copy(value: string, label: string) {
  if (!connection.value.endpoint) return
  try {
    await navigator.clipboard.writeText(value)
    feedback.value = `已复制${label}`
    copyFailed.value = false
  } catch {
    feedback.value = '复制失败，请展开下方内容并选中后手动复制。'
    copyFailed.value = true
  }
}
</script>
<template>
  <StudioModal title="连接外部 AI" :width="760" @close="emit('close')">
    <div class="lingui-studio lu-dialog-body lu-external-ai">
      <div class="lu-external-ai-intro">
        <span class="lu-external-ai-mark"><LinguiIcon name="code" /></span>
        <div>
          <h3>用你熟悉的 AI 继续创作</h3>
          <p>连接 MCP 获取真实工具，读取 Skill 学习设计与交互规则。</p>
        </div>
      </div>
      <ol class="lu-external-ai-steps">
        <li>
          <span>1</span>
          <div>
            <strong>配置 MCP 服务</strong>
            <p>
              安装并启用 Halo 官方 MCP Server 1.3.0 或更高的 1.x 版本，在「工具 → MCP
              服务」创建访问密钥并选择「灵构 UI」工具，然后配置 AI 客户端。
            </p>
          </div>
        </li>
        <li>
          <span>2</span>
          <div>
            <strong>让 AI 读取 Skill</strong>
            <p>把接入说明交给 AI，由它调用创作规则工具读取 Skill、查询组件并校验设计。</p>
          </div>
        </li>
        <li>
          <span>3</span>
          <div>
            <strong>回工作台确认</strong>
            <p>
              {{
                kind === 'theme'
                  ? '授权提交草稿后，在所连接 Halo 的「外部 AI 草稿」中预览主题，再载入编辑器保存。也可手动导入主题 JSON。'
                  : '授权提交草稿后，在所连接 Halo 的「外部 AI 草稿」中查看预览与改动，再载入编辑并保存。也可手动导入 JSON。'
              }}
            </p>
          </div>
        </li>
      </ol>
      <section class="lu-external-ai-connection" aria-label="外部 AI 连接配置">
        <template v-if="mode === 'local'">
          <FormKit
            :id="fieldId"
            v-model="site"
            name="halo-site"
            type="url"
            label="Halo 站点地址"
            help="当前是本机工作空间，没有 MCP 服务。请填写已安装官方 MCP Server 和灵构 UI 的 Halo 站点。"
            placeholder="https://halo.example.com"
            autocomplete="off"
            :spellcheck="false"
            :delay="0"
            :errors="connection.error ? [connection.error] : []"
          />
        </template>
        <div v-if="connection.endpoint" class="lu-external-ai-endpoint">
          <span>Streamable HTTP</span><code>{{ connection.endpoint }}</code>
        </div>
        <p v-if="mode === 'halo' && !canUseMcp" class="lu-external-ai-notice">
          当前账号没有灵构 MCP 创作工具权限。请管理员授予「使用 MCP
          创作工具」；读取已有作品还需要目标作品的读取权限。
        </p>
        <p class="lu-external-ai-help">
          将官方访问密钥设为 AI 客户端环境变量 HALO_MCP_TOKEN。客户端需支持 HTTP MCP
          与工具调用；仅粘贴接入说明不会自动完成配置。
        </p>
        <p v-if="mode === 'local' && connection.endpoint" class="lu-external-ai-help">
          请到该 Halo 站点的「工具 → MCP 服务」创建访问密钥并选择需要的工具。
        </p>
        <McpClientSetupGuide v-if="connection.endpoint" />
        <div class="lu-external-ai-actions">
          <a
            v-if="officialConsole"
            :href="officialConsole"
            class="lu-button"
            target="_blank"
            rel="noopener noreferrer"
            >打开官方 MCP 服务</a
          >
          <VButton
            class="lu-button"
            :disabled="!connection.endpoint"
            @click="copy(codexConfig, 'Codex 配置')"
            >复制 Codex 配置</VButton
          >
          <VButton
            class="lu-button"
            :disabled="!connection.endpoint"
            @click="copy(config, 'MCP 配置')"
            ><template #icon><LinguiIcon name="copy" /></template>复制 MCP 配置</VButton
          >
          <VButton
            class="lu-button primary"
            :disabled="!connection.endpoint"
            @click="copy(instructions, 'AI 接入说明')"
            ><template #icon><LinguiIcon name="book" /></template>复制 AI 接入说明</VButton
          >
        </div>
        <p
          v-if="feedback"
          :class="copyFailed ? 'lu-error' : 'lu-external-ai-feedback'"
          :role="copyFailed ? 'alert' : 'status'"
        >
          {{ feedback }}
        </p>
        <details v-if="connection.endpoint" :open="copyFailed">
          <summary>查看配置与接入说明</summary>
          <pre tabindex="0" aria-label="Codex MCP 配置">{{ codexConfig }}</pre>
          <pre tabindex="0" aria-label="MCP 客户端配置">{{ config }}</pre>
          <pre tabindex="0" aria-label="AI 接入说明">{{ instructions }}</pre>
        </details>
      </section>
      <aside class="lu-external-ai-scope">
        <p>
          <LinguiIcon name="book" /><span
            >创作 Skill <code>{{ SKILL_TOOL }}(topic="skill")</code></span
          >
        </p>
        <p v-if="kind === 'theme'">
          说明会携带当前主题和风格需求，不包含自定义字体资源地址；所选字体由工作台保留。纯主题在导入时校验。
        </p>
        <template v-else>
          <p v-if="workName">
            作品资源名称：<code>{{ workName }}</code
            >。选中读取工具且账号具有目标作品读取权限后，MCP 读取最近保存的版本。<strong
              v-if="dirty"
              >当前还有未保存修改，需要这些内容时请先保存。</strong
            >
          </p>
          <p v-else-if="instance">
            当前作品{{ mode === 'local' ? '仅在本机' : '尚未保存' }}，MCP 无法读取。可先导出作品
            JSON 交给外部 AI，或保存到所连接的 Halo 站点。
          </p>
          <p>
            在官方访问密钥中选择
            <code>plugin-lingui__submit_design_draft</code>
            即可授权提交草稿。工具不会保存项目、发布作品或执行 API / JS
            回调；草稿由你预览、载入后再保存。
          </p>
        </template>
      </aside>
    </div>
    <template #footer
      ><VButton class="lu-button" @click="emit('close')">{{
        allowImport ? '返回创作' : '返回 MCP 管理'
      }}</VButton
      ><VButton v-if="allowImport" class="lu-button primary" @click="emit('import')">{{
        kind === 'theme' ? '导入 AI 主题' : '导入生成结果'
      }}</VButton></template
    >
  </StudioModal>
</template>
