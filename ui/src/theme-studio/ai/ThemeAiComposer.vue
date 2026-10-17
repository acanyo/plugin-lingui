<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import type { ThemeTokens } from '@lingui/renderer'
import LinguiIcon from '../../shared/LinguiIcon.vue'
import { useRepository } from '../../services/repository'
import { useStudioAccess } from '../../services/studio-access'
import ExternalAiDialog from '../../mcp/ExternalAiDialog.vue'
import { useThemeGeneration } from './useThemeGeneration'
const props = defineProps<{ theme: ThemeTokens; revision: number; blocked: boolean }>()
const emit = defineEmits<{ generated: [theme: ThemeTokens]; import: [] }>()
const repository = useRepository()
const access = useStudioAccess()
const instruction = ref('')
const connectingExternalAi = ref(false)
const inputId = useId()
const canGenerate = computed(() => repository.mode === 'halo' && access.allows('ai:generate'))
const { busy, candidate, problem, status, generate, accept, discard } = useThemeGeneration(
  repository,
  () => props.theme,
  () => props.revision,
  () => canGenerate.value && !props.blocked,
  (theme) => emit('generated', theme),
)
const suggestions = [
  {
    label: '清爽蓝白',
    text: '改成清爽蓝白的浅色主题，正文清晰，圆角 8px，轻阴影，系统无衬线字体。',
  },
  {
    label: '柔和阅读',
    text: '改成适合长文阅读的浅色主题，柔和纸张色，宋体衬线，留白舒适，配色要清晰可读。',
  },
  {
    label: '深色开发',
    text: '改成深色开发工具的风格，冷灰底色，蓝色强调，等宽字体，小圆角，层次克制。',
  },
]
function importExternalResult() {
  connectingExternalAi.value = false
  emit('import')
}
function keydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' || (!event.ctrlKey && !event.metaKey) || event.isComposing) return
  if (!canGenerate.value || props.blocked) return
  event.preventDefault()
  void generate(instruction.value)
}
</script>
<template>
  <section class="lu-theme-ai" aria-label="AI 主题设计">
    <header class="lu-theme-ai-heading">
      <div>
        <LinguiIcon name="sparkles" />
        <h2>让 AI 调整主题</h2>
      </div>
      <span class="lu-muted">以当前主题为起点</span>
    </header>
    <form @submit.prevent="generate(instruction)">
      <label class="lu-theme-ai-label" :for="inputId">描述你想要的风格</label>
      <textarea
        :id="inputId"
        name="theme-instruction"
        v-model="instruction"
        rows="3"
        maxlength="4000"
        placeholder="例如：深蓝科技感，等宽字体，小圆角；保留我现在的强调色。"
        @keydown="keydown"
      />
      <div class="lu-theme-ai-suggestions" role="group" aria-label="主题风格灵感">
        <button
          v-for="suggestion in suggestions"
          :key="suggestion.label"
          type="button"
          @click="instruction = suggestion.text"
        >
          {{ suggestion.label }}
        </button>
      </div>
      <div class="lu-theme-ai-actions">
        <div>
          <button type="button" class="lu-text-button" @click="connectingExternalAi = true">
            <LinguiIcon name="code" />连接外部 AI
          </button>
          <button type="button" class="lu-text-button" @click="emit('import')">导入 AI 主题</button>
        </div>
        <button
          v-if="canGenerate"
          type="submit"
          class="lu-button primary"
          :disabled="busy || blocked || !!candidate || !instruction.trim()"
          :aria-busy="busy"
        >
          <LinguiIcon name="sparkles" />{{ busy ? '正在设计…' : '生成主题' }}
        </button>
      </div>
    </form>
    <p class="lu-theme-ai-hint lu-muted">
      {{
        canGenerate
          ? '先预览，再保存。可以继续描述修改要求，也能手动微调。'
          : repository.mode === 'local'
            ? '在 Halo 工作台可直接生成；也可连接 Halo MCP 与 Skill，使用外部 AI 创作后导入主题。'
            : '需要 AI 生成权限；也可连接外部 AI，通过 MCP 与 Skill 创作后导入主题。'
      }}
    </p>
    <p v-if="blocked" class="lu-theme-ai-hint lu-muted" role="status">
      请先修正当前主题的无效配置。
    </p>
    <p v-if="theme.customFont" class="lu-theme-ai-hint lu-muted">
      AI 调整会保留「{{ theme.customFont.name }}」，其他字体可在左侧选择。
    </p>
    <p v-if="busy" class="lu-theme-ai-status" role="status">
      正在搭配颜色和排版，期间可以继续手动调整。
    </p>
    <p v-else-if="status" class="lu-theme-ai-status" role="status">{{ status }}</p>
    <div v-if="candidate" class="lu-theme-ai-candidate">
      <strong>{{ candidate.name }}</strong>
      <div class="lu-theme-ai-palette" aria-hidden="true">
        <i
          v-for="key in ['background', 'surface', 'accent', 'text'] as const"
          :key="key"
          :style="{ background: candidate.colors[key] }"
        />
      </div>
      <div class="lu-theme-ai-actions">
        <button type="button" class="lu-button primary" @click="accept">使用 AI 主题</button
        ><button type="button" class="lu-button" @click="discard">保留我的修改</button>
      </div>
    </div>
    <div v-if="problem" class="lu-theme-ai-error" role="alert">
      <p>{{ problem.text }}</p>
      <details>
        <summary>查看错误详情</summary>
        <p>{{ problem.details }}</p>
      </details>
      <button
        v-if="canGenerate"
        type="button"
        class="lu-text-button"
        :disabled="busy || blocked"
        @click="generate(instruction)"
      >
        重试生成
      </button>
    </div>
  </section>
  <ExternalAiDialog
    v-if="connectingExternalAi"
    :mode="repository.mode"
    :can-use-mcp="access.allows('mcp:use')"
    kind="theme"
    :instruction="instruction"
    :theme="theme"
    @close="connectingExternalAi = false"
    @import="importExternalResult"
  />
</template>
