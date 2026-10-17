<script setup lang="ts">
import { computed, ref } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { resolveDocument, pureTheme } from '@lingui/renderer'
import { templateInstance, type TemplateRecord } from './types'
import LinguiRenderer from '../shared/LinguiRenderer.vue'
import LinguiIcon from '../shared/LinguiIcon.vue'
import { useCopyEmbedCode } from '../component-embed/useCopyEmbedCode'
const props = defineProps<{ template: TemplateRecord; canManage: boolean }>()
const emit = defineEmits<{
  (
    event:
      | 'open'
      | 'preview'
      | 'history'
      | 'duplicate'
      | 'rename'
      | 'export'
      | 'embed'
      | 'delete'
      | 'submission',
  ): void
}>()
const menu = ref<HTMLDetailsElement>()
const { copying, copied, copy } = useCopyEmbedCode(
  () => props.template.id,
  () => emit('embed'),
)
const instance = computed(() => templateInstance(props.template, pureTheme))
const revision = computed(() => props.template.revisions.at(-1)!)
const nodeCount = computed(() => Object.keys(resolveDocument(instance.value.document).nodes).length)
const updated = computed(() =>
  new Date(revision.value.createdAt).toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
  }),
)
onClickOutside(menu, () => {
  if (menu.value) menu.value.open = false
})
function action(name: 'history' | 'duplicate' | 'rename' | 'export' | 'embed' | 'submission') {
  if (menu.value) menu.value.open = false
  emit(name)
}
function closeMenu() {
  if (!menu.value?.open) return
  menu.value.open = false
  menu.value.querySelector('summary')?.focus()
}
</script>
<template>
  <article class="lu-project-card" :aria-label="template.name">
    <div class="lu-project-cover">
      <div class="lu-project-thumbnail" inert aria-hidden="true">
        <div class="lu-project-miniature">
          <LinguiRenderer :instance="instance" :auto-start="false" />
        </div>
      </div>
      <button
        type="button"
        class="lu-project-preview-button"
        :aria-label="`预览${template.name}`"
        @click="emit('preview')"
      >
        <span><LinguiIcon name="expand" /> 交互预览</span>
      </button>
    </div>
    <div class="lu-project-card-body">
      <div class="lu-project-card-heading">
        <h3 :title="template.name">{{ template.name }}</h3>
        <details ref="menu" class="lu-project-menu" @keydown.esc.stop.prevent="closeMenu">
          <summary :aria-label="`${template.name}更多操作`"><LinguiIcon name="more" /></summary>
          <div class="lu-dropdown">
            <button type="button" @click="action('submission')">
              <LinguiIcon name="layers" />准备投稿
            </button>
            <button v-if="canManage" type="button" @click="action('rename')">
              <LinguiIcon name="edit" />重命名与分类
            </button>
            <button v-if="canManage" type="button" @click="action('duplicate')">
              <LinguiIcon name="copy" />创建副本
            </button>
            <button type="button" @click="action('embed')">
              <LinguiIcon name="code" />复制嵌入代码
            </button>
            <button type="button" @click="action('export')">
              <LinguiIcon name="download" />导出当前版本
            </button>
            <button type="button" @click="action('history')">
              <LinguiIcon name="clock" />版本记录
            </button>
          </div>
        </details>
      </div>
      <p class="lu-project-description" :title="template.description">
        {{
          template.description ||
          `${nodeCount} 个节点 · ${instance.document.parameters.length} 个可配置参数`
        }}
      </p>
      <div class="lu-project-card-meta">
        <span class="lu-project-category">{{ template.category }}</span
        ><span class="lu-project-version">v{{ revision.version }}</span>
      </div>
      <div class="lu-project-card-footer">
        <time
          :datetime="revision.createdAt"
          :title="new Date(revision.createdAt).toLocaleString('zh-CN')"
          >{{ updated }}更新</time
        >
        <div class="lu-project-card-actions">
          <button
            v-if="canManage"
            type="button"
            class="lu-project-delete"
            :aria-label="`删除项目「${template.name}」`"
            @click="emit('delete')"
          >
            <LinguiIcon name="trash" />删除
          </button>
          <button
            type="button"
            class="lu-project-copy"
            :aria-label="`复制项目「${template.name}」的嵌入代码`"
            title="复制 ID 嵌入代码，未开启公开嵌入时可先设置"
            :disabled="copying"
            :aria-busy="copying"
            @click="copy"
          >
            <LinguiIcon :name="copied ? 'check' : 'code'" />{{
              copying ? '复制中…' : copied ? '已复制' : '复制代码'
            }}
          </button>
          <button type="button" class="lu-project-edit" @click="emit('open')">
            编辑 <LinguiIcon name="arrow" />
          </button>
        </div>
      </div>
    </div>
  </article>
</template>
