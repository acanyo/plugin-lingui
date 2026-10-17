<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from 'vue'

const dialog = ref<HTMLDialogElement>()
const fullscreen = ref(false)
const mode = ref<'preview' | 'edit'>('preview')
let previousFocus: HTMLElement | null = null
let previousOverflow = ''

async function open(value: 'preview' | 'edit' = 'preview') {
  mode.value = value
  if (!dialog.value || fullscreen.value) return
  previousFocus = document.activeElement as HTMLElement | null
  previousOverflow = document.body.style.overflow
  dialog.value.showModal()
  document.body.style.overflow = 'hidden'
  fullscreen.value = true
  await nextTick()
  dialog.value?.querySelector<HTMLButtonElement>('[data-preview-fullscreen]')?.focus()
}
function restore() {
  if (!fullscreen.value) return
  fullscreen.value = false
  document.body.style.overflow = previousOverflow
  void nextTick(() => previousFocus?.focus({ preventScroll: true }))
}
function close() {
  if (!fullscreen.value) return
  dialog.value?.close()
  restore()
}
function toggle() {
  if (fullscreen.value) close()
  else void open()
}
defineExpose({
  close,
  editIfFullscreen: () => {
    if (fullscreen.value) void open('edit')
  },
})
onBeforeUnmount(() => {
  if (fullscreen.value) {
    dialog.value?.close()
    document.body.style.overflow = previousOverflow
  }
})
</script>
<template>
  <div class="lu-preview-presentation">
    <Teleport to="body">
      <dialog
        ref="dialog"
        class="lingui-studio lu-fullscreen-preview"
        :aria-label="mode === 'edit' ? '全屏组件编辑' : '全屏组件预览'"
        @cancel.prevent="close"
        @close="restore"
      />
    </Teleport>
    <Teleport :to="dialog ?? 'body'" :disabled="!fullscreen">
      <slot :fullscreen="fullscreen" :mode="mode" :open="open" :toggle="toggle" />
    </Teleport>
  </div>
</template>
