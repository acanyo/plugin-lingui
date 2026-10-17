<script setup lang="ts">
import { computed, inject, onBeforeUnmount, ref } from 'vue'
import { VButton } from '@halo-dev/components'
import { isComponentReference, type ComponentInstance } from '@lingui/renderer'
import StudioModal from '../shared/StudioModal.vue'
import { componentReferenceHtml } from './html'
import { repositoryKey } from '../services/repository'
import { useStudioAccess } from '../services/studio-access'
import { createEmbedClient, embedClientKey } from './client'
import { useEmbedReference } from './useEmbedReference'

const props = defineProps<{ instance: ComponentInstance }>()
const emit = defineEmits<{ close: [] }>()
const title = props.instance.document.title
const name = props.instance.templateId
const repository = inject(repositoryKey, undefined)
const client = inject(embedClientKey, undefined)
const available = repository?.mode === 'halo' && !!name && isComponentReference(name)
const canManage = repository ? useStudioAccess().allows('components:manage') : false
const reference = useEmbedReference(
  available ? name : undefined,
  available ? (client ?? createEmbedClient()) : undefined,
)
const { status, busy, error } = reference
const code = available ? componentReferenceHtml(name!) : ''
const blocked = computed(
  () => !available || busy.value || !status.value || (!status.value.enabled && !canManage),
)
const copied = ref(false)
const copyError = ref('')
const field = ref<HTMLTextAreaElement>()
let alive = true
onBeforeUnmount(() => {
  alive = false
})
function selectCode() {
  field.value?.focus()
  field.value?.select()
}
function clearCopyStatus() {
  copied.value = false
  copyError.value = ''
}
async function copy() {
  clearCopyStatus()
  if (blocked.value) return
  if (!status.value?.enabled && (!canManage || !(await reference.enable()) || !alive)) return
  try {
    if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable')
    await navigator.clipboard.writeText(code)
    if (alive) copied.value = true
  } catch {
    if (!alive) return
    selectCode()
    copyError.value = '无法访问剪贴板，代码已选中，请按 Ctrl+C 或 ⌘C 复制。'
  }
}
async function disable() {
  clearCopyStatus()
  await reference.disable()
}
</script>
<template>
  <StudioModal title="复制嵌入代码" :width="720" @close="emit('close')">
    <section class="lingui-studio lu-embed-code">
      <div>
        <h3>{{ title }}</h3>
        <p class="lu-muted">粘贴到主题模板、侧边栏或页脚中支持 HTML 的位置，即可渲染。</p>
      </div>
      <p class="lu-embed-note">
        按 ID
        引用项目最新保存版本，插件自动加载渲染资源。保存项目后刷新页面即可更新；未保存的修改、预览参数与历史版本不会影响标签。
      </p>
      <p v-if="!available" class="lu-muted" role="status">
        请先在 Halo 中将作品保存为项目，再复制嵌入代码。
      </p>
      <template v-else>
        <p v-if="busy" role="status" class="lu-muted">正在读取或更新公开嵌入设置…</p>
        <p v-else-if="status?.enabled" class="lu-embed-success">
          已开启公开嵌入 · 最新保存 v{{ status.revision
          }}<button v-if="canManage" type="button" class="lu-text-button" @click="disable">
            关闭公开嵌入
          </button>
        </p>
        <p v-else-if="status" class="lu-muted">
          开启后，访客可通过组件 ID 读取项目最新保存的内容与配置。<span v-if="!canManage"
            >请联系拥有组件管理权限的管理员开启。</span
          >
        </p>
        <p v-if="error" class="lu-error" role="alert">
          {{ error }}
          <button type="button" class="lu-text-button" :disabled="busy" @click="reference.refresh">
            重新检查
          </button>
        </p>
        <div class="lu-embed-code-heading">
          <span>HTML · 项目 ID</span
          ><button type="button" class="lu-text-button" @click="selectCode">全选代码</button>
        </div>
        <textarea
          ref="field"
          :value="code"
          class="lu-code lu-embed-source is-short"
          aria-label="组件嵌入代码"
          readonly
          spellcheck="false"
          :rows="3"
        />
        <p class="lu-muted">删除项目或关闭公开嵌入后，文章与主题中的引用将无法加载。</p>
        <p v-if="copied" role="status" class="lu-embed-success">已复制，可粘贴到主题中。</p>
        <p v-if="copyError" role="alert" class="lu-error">{{ copyError }}</p>
      </template>
    </section>
    <template #footer>
      <VButton class="lu-button" @click="emit('close')">关闭</VButton>
      <VButton class="lu-button primary" type="secondary" :disabled="blocked" @click="copy">{{
        copied ? '再次复制' : status && !status.enabled ? '开启公开嵌入并复制' : '复制嵌入代码'
      }}</VButton>
    </template>
  </StudioModal>
</template>
<style scoped>
.lu-embed-code {
  display: grid;
  gap: 14px;
  padding: 4px 0;
}
.lu-embed-code h3 {
  margin: 0 0 6px;
  font-size: 15px;
}
.lu-embed-code p {
  margin: 0;
  line-height: 1.7;
  font-size: 12px;
}
.lu-embed-note {
  padding: 12px 14px;
  background: var(--lu-sidebar);
  border: 1px solid var(--lu-border);
  border-radius: 8px;
  color: var(--lu-muted);
}
.lu-embed-code-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: var(--lu-muted);
}
.lu-embed-source {
  width: 100%;
  min-height: 200px;
  max-height: 45vh;
  resize: vertical;
  overflow-wrap: anywhere;
}
.lu-embed-success {
  color: var(--lu-accent);
}
.lu-embed-source.is-short {
  min-height: 88px;
}
.lu-embed-success .lu-text-button {
  margin-left: 12px;
}
</style>
