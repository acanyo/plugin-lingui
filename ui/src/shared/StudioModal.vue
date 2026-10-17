<script setup lang="ts">
import { nextTick, onBeforeUnmount } from 'vue'
import { VModal } from '@halo-dev/components'
import LinguiIcon from './LinguiIcon.vue'
withDefaults(
  defineProps<{ title: string; width?: number; height?: string; closeDisabled?: boolean }>(),
  {
    width: 720,
    closeDisabled: false,
  },
)
const emit = defineEmits<{ close: [] }>()
const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
onBeforeUnmount(() => {
  void nextTick(() => {
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
  })
})
function escape(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  // Open component dialogs and Halo selects handle their first Esc before this modal.
  const nested = event
    .composedPath()
    .some(
      (target) =>
        target instanceof Element &&
        target !== event.currentTarget &&
        target.matches(
          'dialog[open], [role="dialog"], details[open].lg-multi-select, .v-popper--shown:has(.select-container), [data-lingui-escape-scope="open"]',
        ),
    )
  if (nested) return
  event.preventDefault()
  event.stopImmediatePropagation()
  emit('close')
}
</script>
<template>
  <VModal
    :title="title"
    :width="width"
    :height="height"
    class="lu-studio-modal"
    :aria-label="title"
    @keydown.capture="!closeDisabled && escape($event)"
    @keyup.esc.capture.stop.prevent
    @close="!closeDisabled && emit('close')"
  >
    <template #header>
      <div class="lingui-studio lu-modal-heading">
        <h2>{{ title }}</h2>
        <button
          type="button"
          class="lu-icon-button"
          :aria-label="`关闭${title}`"
          :disabled="closeDisabled"
          @click="emit('close')"
        >
          <LinguiIcon name="close" />
        </button>
      </div>
    </template>
    <slot />
    <template v-if="$slots.footer" #footer>
      <div class="lingui-studio lu-dialog-actions lu-modal-footer"><slot name="footer" /></div>
    </template>
  </VModal>
</template>
