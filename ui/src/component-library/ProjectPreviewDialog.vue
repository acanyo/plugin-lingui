<script setup lang="ts">
import { computed, ref } from 'vue'
import { VButton } from '@halo-dev/components'
import VModal from '../shared/StudioModal.vue'
import { createInstance, pureTheme } from '@lingui/renderer'
import type { TemplateRecord } from './types'
import LinguiRenderer from '../shared/LinguiRenderer.vue'
import LinguiIcon from '../shared/LinguiIcon.vue'
import EmbedCodeDialog from '../component-embed/EmbedCodeDialog.vue'
const props = defineProps<{ template: TemplateRecord; history?: boolean }>()
const showEmbed = ref(false)
const emit = defineEmits<{ close: []; edit: [version: number] }>()
const version = ref(props.template.revisions.at(-1)!.version),
  mobile = ref(false),
  reset = ref(0)
const revisions = computed(() => [...props.template.revisions].reverse())
const revision = computed(() =>
  props.template.revisions.find((item) => item.version === version.value)!,
)
const instance = computed(() => ({
  ...createInstance(
    { ...revision.value.document, title: props.template.name },
    revision.value.theme ?? pureTheme,
  ),
  templateId: props.template.id,
  templateVersion: version.value,
}))
</script>
<template>
  <VModal
    :title="`${template.name} · ${history ? '版本记录' : '项目预览'}`"
    :width="1080"
    @close="emit('close')"
  >
    <div class="lingui-studio lu-project-preview-dialog">
      <div class="lu-project-preview-layout" :class="{ 'with-history': history }">
        <aside v-if="history" class="lu-project-history" aria-label="项目版本记录">
          <h3>
            版本记录 <span>{{ revisions.length }}</span>
          </h3>
          <button
            v-for="item in revisions"
            :key="item.version"
            type="button"
            :class="{ active: item.version === version }"
            :aria-pressed="item.version === version"
            @click="version = item.version"
          >
            <span>v{{ item.version }}<small v-if="item === revisions[0]">最新版本</small></span
            ><time :datetime="item.createdAt">{{
              new Date(item.createdAt).toLocaleString('zh-CN')
            }}</time>
          </button>
        </aside>
        <div class="lu-project-preview-stage">
          <div class="lu-canvas-toolbar">
            <span class="lu-inline-icon"
              ><span class="lu-status-dot" /> 交互预览
              <span class="lu-project-version">v{{ version }}</span></span
            >
            <div class="lu-segment" aria-label="项目预览尺寸">
              <button
                type="button"
                :class="{ active: !mobile }"
                :aria-pressed="!mobile"
                @click="mobile = false"
              >
                桌面</button
              ><button
                type="button"
                :class="{ active: mobile }"
                :aria-pressed="mobile"
                @click="mobile = true"
              >
                手机
              </button>
            </div>
            <button type="button" class="lu-text-button lu-inline-icon" @click="reset++">
              <LinguiIcon name="reset" /> 重置预览
            </button>
          </div>
          <div class="lu-project-preview-surface" :class="{ mobile }">
            <LinguiRenderer :key="`${version}-${reset}`" :instance="instance" />
          </div>
          <p class="lu-canvas-hint">可以直接试用交互，项目内容不会改变。</p>
        </div>
      </div>
    </div>
    <template #footer>
      <div class="lingui-studio lu-dialog-actions">
        <VButton class="lu-button" @click="emit('close')">关闭</VButton>
        <VButton class="lu-button" @click="showEmbed = true">复制嵌入代码</VButton>
        <VButton type="secondary" class="lu-button primary" @click="emit('edit', version)">{{
          history ? `编辑 v${version}` : '编辑项目'
        }}</VButton>
      </div>
    </template>
  </VModal>
  <EmbedCodeDialog v-if="showEmbed" :instance="instance" @close="showEmbed = false" />
</template>
