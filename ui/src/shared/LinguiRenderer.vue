<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  mountRenderer,
  type ComponentInstance,
  type RendererHandle,
  type InteractionHost,
} from '@lingui/renderer'
import { usePreviewSelection } from '../scoped-edit/preview-selection'
const props = withDefaults(
  defineProps<{
    instance: ComponentInstance
    interactions?: InteractionHost
    selecting?: boolean
    selectedNode?: string
    autoStart?: boolean
  }>(),
  { autoStart: undefined },
)
const emit = defineEmits<{ select: [id: string]; cancelSelection: [] }>()
const host = ref<HTMLElement>(),
  error = ref('')
let handle: RendererHandle | undefined
const selection = usePreviewSelection(
  host,
  () => !!props.selecting,
  () => props.selectedNode,
  (id) => emit('select', id),
  () => emit('cancelSelection'),
)
function locateNode(id: string) {
  const shadow = host.value?.shadowRoot
  if (!shadow) return false
  for (const previous of shadow.querySelectorAll('[data-lingui-review-focus]'))
    previous.removeAttribute('data-lingui-review-focus')
  const element = [...shadow.querySelectorAll<HTMLElement>('[data-lingui-node]')].find(
    (node) => node.dataset.linguiNode === id && node.getClientRects().length,
  )
  if (!element) return false
  if (!shadow.querySelector('[data-lingui-review-style]')) {
    const style = document.createElement('style')
    style.dataset.linguiReviewStyle = 'true'
    style.textContent =
      '[data-lingui-review-focus] { outline: 2px solid #2563eb !important; outline-offset: 3px; }'
    shadow.append(style)
  }
  element.dataset.linguiReviewFocus = 'true'
  element.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  return true
}
defineExpose({ locateNode })
function update() {
  if (!host.value) return
  try {
    if (handle) handle.update(props.instance)
    else
      handle = mountRenderer(host.value, props.instance, {
        inheritRegistered: false,
        ...props.interactions,
        ...(props.autoStart === undefined ? {} : { autoStart: props.autoStart }),
      })
    error.value = ''
    void nextTick(selection.refresh)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '组件数据无效'
  }
}
onMounted(update)
watch(
  () => [props.interactions, props.autoStart] as const,
  ([value, autoStart]) =>
    handle?.setInteractions({
      inheritRegistered: false,
      ...value,
      ...(autoStart === undefined ? {} : { autoStart }),
    }),
)
watch(
  () => props.instance,
  async () => {
    await nextTick()
    update()
  },
  { deep: true },
)
onBeforeUnmount(() => {
  void handle?.destroy()
})
</script>
<template>
  <div ref="host" class="lingui-renderer-host" />
  <p v-if="error" role="alert">此组件暂时无法展示：{{ error }}</p>
</template>
<style scoped>
.lingui-renderer-host {
  display: block;
  min-width: 0;
  width: 100%;
}
</style>
