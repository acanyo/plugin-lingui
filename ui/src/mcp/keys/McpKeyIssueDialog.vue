<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { VButton } from '@halo-dev/components'
import StudioModal from '../../shared/StudioModal.vue'
import LinguiIcon from '../../shared/LinguiIcon.vue'
import { clientConfiguration } from '../client'
import {
  createMcpKeyClient,
  keyDate,
  keyError,
  keyWorkScope,
  type McpKeyClient,
  type IssuedMcpKey,
  type WorkChoice,
} from './client'
import './keys.css'

const props = defineProps<{ endpoint: string; client?: McpKeyClient }>()
const emit = defineEmits<{ close: []; created: [] }>()
const client = props.client ?? createMcpKeyClient()
const name = ref('')
const days = ref('30')
const grantWorks = ref(false)
const submitDrafts = ref(false)
const workScope = ref<'selected' | 'all'>('selected')
const choices = ref<WorkChoice[]>([])
const search = ref('')
const selected = ref<string[]>([])
const loadingWorks = ref(false)
const worksError = ref('')
const busy = ref(false)
const error = ref('')
const issued = ref<IssuedMcpKey>()
const feedback = ref('')
const copyFailed = ref(false)
let disposed = false
const filtered = computed(() =>
  choices.value.filter((work) =>
    `${work.label} ${work.value}`.toLowerCase().includes(search.value.toLowerCase()),
  ),
)
const tooManyWorks = computed(
  () => grantWorks.value && workScope.value === 'selected' && selected.value.length > 50,
)
watch([grantWorks, workScope], async ([enabled, scope]) => {
  if (!enabled) {
    selected.value = []
    return
  }
  if (scope === 'selected' && !choices.value.length) await loadWorks()
})
async function loadWorks() {
  loadingWorks.value = true
  worksError.value = ''
  try {
    choices.value = await client.works()
  } catch (cause) {
    worksError.value = keyError(cause)
  } finally {
    loadingWorks.value = false
  }
}
async function create() {
  if (busy.value || !name.value.trim() || tooManyWorks.value) return
  busy.value = true
  error.value = ''
  try {
    const result = await client.create({
      name: name.value.trim(),
      expiresInDays: Number(days.value),
      workNames: grantWorks.value && workScope.value === 'selected' ? [...selected.value] : [],
      allWorks: grantWorks.value && workScope.value === 'all',
      submitDrafts: submitDrafts.value,
    })
    if (!result.token || !result.key) throw new Error('服务未返回完整密钥，请返回列表检查后重试。')
    if (!disposed) {
      issued.value = result
      emit('created')
    }
  } catch (cause) {
    error.value = keyError(cause)
  } finally {
    busy.value = false
  }
}
async function copy(config: boolean) {
  if (!issued.value?.token) return
  try {
    await navigator.clipboard.writeText(
      config ? clientConfiguration(props.endpoint, issued.value.token) : issued.value.token,
    )
    feedback.value = config ? '已复制含密钥的 MCP 配置，请保存在 AI 客户端设置中。' : '已复制密钥。'
    copyFailed.value = false
  } catch {
    feedback.value = '复制失败，请选中密钥后手动复制。'
    copyFailed.value = true
  }
}
function close() {
  if (busy.value) return
  issued.value = undefined
  emit('close')
}
onBeforeUnmount(() => {
  disposed = true
  issued.value = undefined
})
</script>
<template>
  <StudioModal
    :title="issued ? 'MCP 密钥已创建' : '创建 MCP 密钥'"
    :width="620"
    :close-disabled="busy"
    @close="close"
  >
    <div class="lingui-studio lu-dialog-body lu-mcp-key-dialog">
      <template v-if="issued">
        <div class="lu-key-success">
          <LinguiIcon name="check" />
          <div>
            <h3>{{ issued.key?.name }}</h3>
            <p>密钥仅在这次显示，关闭前请复制保存。</p>
          </div>
        </div>
        <p class="lu-muted">
          有效期至 {{ keyDate(issued.key?.expiresAt) }} ·
          {{ keyWorkScope(issued.key ?? {}) }}
        </p>
        <p v-if="issued.key?.submitDrafts" class="lu-muted">
          已单独授权提交创作草稿，保存项目仍需用户确认。
        </p>
        <pre tabindex="0" aria-label="新创建的 MCP 密钥" class="lu-key-token">{{
          issued.token
        }}</pre>
        <div class="lu-key-actions">
          <VButton class="lu-button primary" @click="copy(true)"
            ><template #icon><LinguiIcon name="copy" /></template>复制 MCP 配置（含密钥）</VButton
          ><VButton class="lu-button" @click="copy(false)">仅复制密钥</VButton>
        </div>
        <p
          v-if="feedback"
          :class="copyFailed ? 'lu-error' : 'lu-key-feedback'"
          :role="copyFailed ? 'alert' : 'status'"
        >
          {{ feedback }}
        </p>
        <p class="lu-muted lu-key-footnote">
          请将密钥填入客户端设置，接入说明无需包含密钥。遗失后可撤销并重新创建。
        </p>
      </template>
      <template v-else>
        <p class="lu-key-intro">为每个 AI 客户端创建独立密钥，随时可在这里撤销。</p>
        <FormKit type="form" :actions="false" :disabled="busy" @submit="create">
          <FormKit
            v-model="name"
            name="mcp-key-name"
            type="text"
            label="密钥名称"
            placeholder="例如：我的 Codex"
            validation="required|length:1,80"
            :maxlength="80"
            :delay="0"
            autocomplete="off"
          />
          <FormKit
            v-model="days"
            name="mcp-key-expiry"
            type="select"
            label="有效期"
            :options="[
              { label: '7 天', value: '7' },
              { label: '30 天', value: '30' },
              { label: '90 天', value: '90' },
              { label: '365 天', value: '365' },
            ]"
          />
          <div class="lu-key-scope">
            <strong>基础权限</strong>
            <p>查询组件参数、读取创作 Skill、校验设计与主题规则。</p>
          </div>
          <FormKit
            v-model="submitDrafts"
            :delay="0"
            name="mcp-key-submit-drafts"
            type="checkbox"
            label="允许提交创作草稿（可选）"
            help="AI 可提交组件或主题草稿供你预览，不能直接保存或发布。修改已有项目还需授权读取该项目。"
          />
          <FormKit
            v-model="grantWorks"
            :delay="0"
            name="mcp-key-grant"
            type="checkbox"
            label="允许读取项目（可选）"
            help="只读取项目的最新保存版本，不包含浏览器未保存内容。"
          />
          <section
            v-if="grantWorks"
            class="lu-key-work-picker"
            aria-label="项目读取授权"
            :aria-busy="workScope === 'selected' && loadingWorks"
          >
            <div class="lu-key-work-scope">
              <FormKit
                v-model="workScope"
                name="mcp-key-work-scope"
                type="radio"
                label="读取范围"
                :options="[
                  { label: '指定项目', value: 'selected' },
                  { label: '全部项目', value: 'all' },
                ]"
                :delay="0"
              />
            </div>
            <p v-if="workScope === 'all'" class="lu-muted lu-key-all-works">
              允许读取当前账号有权访问的全部项目，包含以后新建的项目，无需逐项勾选。
            </p>
            <p v-else-if="loadingWorks" role="status">正在获取可选项目…</p>
            <template v-else-if="worksError"
              ><p class="lu-error" role="alert">{{ worksError }}</p>
              <VButton class="lu-button" @click="loadWorks">重试获取项目</VButton></template
            >
            <template v-else-if="choices.length">
              <FormKit
                v-model="search"
                name="mcp-key-work-search"
                type="search"
                label="搜索项目"
                placeholder="名称或资源标识"
                :delay="0"
              />
              <p class="lu-muted">已选择 {{ selected.length }} / 50 项</p>
              <div class="lu-key-work-options">
                <FormKit
                  v-model="selected"
                  name="mcp-key-works"
                  type="checkbox"
                  :options="filtered"
                  :delay="0"
                />
              </div>
              <p v-if="!filtered.length" class="lu-muted">没有匹配的项目</p>
              <p v-if="selected.length > 50" class="lu-error" role="alert">
                最多授权 50 个项目，请减少选择。
              </p>
            </template>
            <p v-else class="lu-muted">还没有已保存的项目，可以先创建仅查询与校验的密钥。</p>
          </section>
          <p v-if="error" class="lu-error" role="alert">{{ error }}</p>
          <button
            type="submit"
            class="lu-button primary lu-key-submit"
            :disabled="busy || !name.trim() || tooManyWorks"
          >
            {{ busy ? '正在创建…' : '创建密钥' }}
          </button>
        </FormKit>
      </template>
    </div>
    <template #footer
      ><VButton class="lu-button" :disabled="busy" @click="close">{{
        issued ? '已保存，关闭' : '取消'
      }}</VButton></template
    >
  </StudioModal>
</template>
