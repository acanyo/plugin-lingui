<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { createDemoRequests, isDemoApi, type ComponentInstance } from '@lingui/renderer'
import LinguiRenderer from '../shared/LinguiRenderer.vue'
import LinguiIcon from '../shared/LinguiIcon.vue'
import PreviewPresentation from '../workspace/PreviewPresentation.vue'
const props = defineProps<{ instance: ComponentInstance; theme?: boolean }>()
const mobile = ref(false),
  reset = ref(0)
const requests = shallowRef(createDemoRequests({ allowReal: () => true }))
const interactions = computed(() => ({ inheritRegistered: false, requests: requests.value }))
const demo = computed(() => props.instance.document.integrations?.apis.some(isDemoApi))
function resetPreview() {
  requests.value = createDemoRequests({ allowReal: () => true })
  reset.value++
}
watch(() => props.instance, resetPreview)
const paper = computed(() => ({
  background: props.instance.theme.colors.background,
  borderColor: props.instance.theme.colors.border,
  borderRadius: `${props.instance.theme.radius}px`,
}))
</script>
<template>
  <PreviewPresentation v-slot="{ fullscreen, toggle }">
    <section
      :class="['lu-market-preview', { 'is-fullscreen': fullscreen }]"
      :aria-label="theme ? '主题交互预览' : '作品交互预览'"
    >
      <div class="lu-canvas-toolbar">
        <span class="lu-inline-icon"
          ><span class="lu-status-dot" />{{ theme ? '主题试用' : '交互预览' }}</span
        >
        <div class="lu-market-preview-tools">
          <div class="lu-segment" role="group" aria-label="预览尺寸">
            <button
              type="button"
              :class="{ active: !mobile }"
              :aria-pressed="!mobile"
              @click="mobile = false"
            >
              桌面
            </button>
            <button
              type="button"
              :class="{ active: mobile }"
              :aria-pressed="mobile"
              @click="mobile = true"
            >
              手机
            </button>
          </div>
          <button
            type="button"
            class="lu-icon-button"
            title="重置预览"
            aria-label="重置预览"
            @click="resetPreview"
          >
            <LinguiIcon name="reset" />
          </button>
          <button
            type="button"
            class="lu-icon-button"
            data-preview-fullscreen
            :title="fullscreen ? '退出全屏 · Esc' : '全屏预览'"
            :aria-label="fullscreen ? '退出全屏预览' : '全屏预览'"
            @click="toggle"
          >
            <LinguiIcon :name="fullscreen ? 'shrink' : 'expand'" />
          </button>
        </div>
      </div>
      <div class="lu-market-preview-scroll">
        <div class="lu-detail-preview" :class="{ mobile }" :style="paper">
          <LinguiRenderer :key="reset" :instance="instance" :interactions="interactions" />
        </div>
      </div>
      <p class="lu-canvas-hint">
        {{
          demo
            ? '本地模拟接口，可直接试用，不发送网络请求。使用后可替换为自己的 API；重置预览可重新体验失败重试。'
            : theme
              ? '试用输入、按钮和选择器，查看这套主题的实际效果。'
              : '点击、输入或切换选项，试用这个组件。'
        }}
      </p>
    </section>
  </PreviewPresentation>
</template>
