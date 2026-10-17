<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue'
import { onClickOutside } from '@vueuse/core'
import type { ThemeTokens, FontFamilyDefinition } from '@lingui/renderer'
import { cloneJson } from '../shared/clone'
import FontSpecimen from '../font-library/FontSpecimen.vue'
import LinguiIcon from '../shared/LinguiIcon.vue'
import StudioSearch from '../shared/StudioSearch.vue'
import { builtinFontOptions, builtinFontStyle } from './font-options'

type FontOption = {
  key: string
  label: string
  builtin?: ThemeTokens['font']
  definition?: FontFamilyDefinition
}
const font = defineModel<ThemeTokens['font']>({ required: true })
const customFont = defineModel<FontFamilyDefinition | undefined>('customFont')
const props = withDefaults(defineProps<{ fonts?: FontFamilyDefinition[] }>(), { fonts: () => [] })
const emit = defineEmits<{ manage: [] }>()
const root = ref<HTMLElement>()
const trigger = ref<HTMLButtonElement>()
const panel = ref<HTMLElement>()
const list = ref<HTMLElement>()
const open = ref(false)
const query = ref('')
const active = ref(0)
const id = useId()
const available = computed<FontOption[]>(() => [
  ...builtinFontOptions.map((item) => ({
    key: `builtin:${item.value}`,
    label: item.label,
    builtin: item.value,
  })),
  ...[
    ...new Map(
      // A saved theme keeps its font snapshot even if the library entry changes.
      [...props.fonts, ...(customFont.value ? [customFont.value] : [])].map((item) => [
        item.id,
        item,
      ]),
    ).values(),
  ].map((item) => ({ key: `custom:${item.id}`, label: item.name, definition: item })),
])
const selectedKey = computed(() =>
  customFont.value ? `custom:${customFont.value.id}` : `builtin:${font.value}`,
)
const selected = computed(() => available.value.find((item) => item.key === selectedKey.value)!)
const builtin = computed(() => builtinFontOptions.find((item) => item.value === font.value)!)
const filtered = computed(() => {
  const search = query.value.trim().toLocaleLowerCase()
  return available.value.filter((item) => item.label.toLocaleLowerCase().includes(search))
})
watch(filtered, () => {
  active.value = Math.max(
    0,
    filtered.value.findIndex((item) => item.key === selectedKey.value),
  )
})
onClickOutside(root, () => close(false))

function close(restoreFocus = true) {
  open.value = false
  if (restoreFocus) trigger.value?.focus()
}
async function show(focusList = false) {
  query.value = ''
  open.value = true
  await nextTick()
  active.value = Math.max(
    0,
    filtered.value.findIndex((item) => item.key === selectedKey.value),
  )
  if (focusList) focusOption(active.value)
  else panel.value?.querySelector('input')?.focus()
}
function choose(option: FontOption) {
  if (option.definition) customFont.value = cloneJson(option.definition)
  else if (option.builtin) {
    font.value = option.builtin
    customFont.value = undefined
  }
  close()
}
function focusOption(index: number) {
  if (!filtered.value.length) return
  active.value = (index + filtered.value.length) % filtered.value.length
  const option = list.value?.querySelectorAll<HTMLButtonElement>('[role="option"]')[active.value]
  option?.focus({ preventScroll: true })
  option?.scrollIntoView?.({ block: 'nearest' })
}
function searchKey(event: KeyboardEvent) {
  if (event.isComposing || !(event.target instanceof HTMLInputElement)) return
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    focusOption(event.key === 'ArrowDown' ? active.value : filtered.value.length - 1)
  } else if (event.key === 'Enter' && filtered.value[active.value]) {
    event.preventDefault()
    choose(filtered.value[active.value]!)
  }
}
function optionKey(event: KeyboardEvent, index: number) {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    focusOption(index + (event.key === 'ArrowDown' ? 1 : -1))
  } else if (event.key === 'Home' || event.key === 'End') {
    event.preventDefault()
    focusOption(event.key === 'Home' ? 0 : filtered.value.length - 1)
  }
}
function escape(event: KeyboardEvent) {
  if (!open.value) return
  event.preventDefault()
  event.stopPropagation()
  close()
}
function focusout(event: FocusEvent) {
  if (event.relatedTarget instanceof Node && !root.value?.contains(event.relatedTarget))
    close(false)
}
function manage() {
  close(false)
  emit('manage')
}
</script>
<template>
  <fieldset
    ref="root"
    class="lu-theme-font-picker"
    :data-lingui-escape-scope="open ? 'open' : undefined"
    @keydown.esc="escape"
    @focusout="focusout"
  >
    <legend>字体</legend>
    <button
      ref="trigger"
      type="button"
      class="lu-theme-font-trigger"
      :aria-label="`选择字体，当前：${selected.label}`"
      :aria-expanded="open"
      :aria-controls="`${id}-panel`"
      aria-haspopup="dialog"
      @click="open ? close() : show()"
      @keydown.down.prevent="show(true)"
      @keydown.up.prevent="show(true)"
    >
      <span :title="selected.label">{{ selected.label }}</span>
      <LinguiIcon name="chevronDown" />
    </button>
    <div
      v-if="open"
      :id="`${id}-panel`"
      ref="panel"
      class="lu-theme-font-panel"
      role="dialog"
      aria-label="选择字体"
      data-lingui-escape-scope="open"
    >
      <StudioSearch
        v-model="query"
        label="搜索字体"
        placeholder="搜索字体名称"
        @keydown="searchKey"
      />
      <div ref="list" class="lu-theme-font-list" role="listbox" aria-label="可用字体">
        <button
          v-for="(option, index) in filtered"
          :key="option.key"
          type="button"
          class="lu-theme-font-row"
          role="option"
          :data-font-key="option.key"
          :aria-label="option.label"
          :aria-selected="selectedKey === option.key"
          :tabindex="active === index ? 0 : -1"
          @focus="active = index"
          @keydown="optionKey($event, index)"
          @click="choose(option)"
        >
          <span
            ><span :title="option.label">{{ option.label }}</span
            ><small>{{ option.definition ? '我的字体' : '基础字体' }}</small></span
          >
          <LinguiIcon v-if="selectedKey === option.key" name="check" />
        </button>
      </div>
      <p v-if="!filtered.length" class="lu-theme-font-empty" role="status">没有找到匹配的字体</p>
      <footer class="lu-theme-font-footer">
        <span
          >{{
            query.trim() ? `${filtered.length} / ${available.length}` : available.length
          }}
          种字体</span
        >
        <button type="button" class="lu-text-button" @click="close()">收起</button>
      </footer>
    </div>
    <div class="lu-theme-font-preview">
      <FontSpecimen v-if="customFont" :font="customFont" text="灵感成形 Design" />
      <template v-else>
        <p :style="builtinFontStyle(font)">{{ builtin.sample }}</p>
        <small>{{ builtin.description }}</small>
      </template>
    </div>
    <button type="button" class="lu-text-button lu-theme-manage-fonts" @click="manage">
      <LinguiIcon name="book" />管理我的字体
    </button>
  </fieldset>
</template>
