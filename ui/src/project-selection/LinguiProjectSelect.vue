<script setup lang="ts">
import { computed, inject, onScopeDispose, toRef, useId } from 'vue'
import { FormKit, type useFormKitContext } from '@formkit/vue'
import { VButton, VPagination } from '@halo-dev/components'
import type { ProjectOption } from '../api/project-selection'
import LinguiProjectRender from '../project-rendering/LinguiProjectRender.vue'
import { createProjectSelectionClient, projectSelectionClientKey } from './client'
import { useProjectOptions } from './useProjectOptions'

const props = withDefaults(
  defineProps<{
    modelValue?: string
    category?: string
    publicOnly?: boolean
    clearable?: boolean
    disabled?: boolean
    placeholder?: string
    pageSize?: number
    showPreview?: boolean
    id?: string
  }>(),
  {
    publicOnly: true,
    clearable: true,
    disabled: false,
    placeholder: '选择灵构 UI 作品',
    pageSize: 20,
    showPreview: false,
  },
)
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const uid = useId()
const inputId = computed(() => props.id || `lingui-project-select-${uid}`)
const client = inject(projectSelectionClientKey, undefined) ?? createProjectSelectionClient()
const {
  page,
  keyword,
  size,
  items,
  total,
  loading,
  error,
  selected,
  selectedLoading,
  selectedError,
  unavailable,
  reload,
  reloadSelected,
} = useProjectOptions(client, {
  modelValue: toRef(props, 'modelValue'),
  category: toRef(props, 'category'),
  publicOnly: toRef(props, 'publicOnly'),
  pageSize: toRef(props, 'pageSize'),
})

function title(item: ProjectOption) {
  return `${item.displayName || item.id}${item.embedEnabled ? '' : '（未公开）'}`
}
const selectOptions = computed(() => {
  const options: { label: string; value: string; attrs?: { disabled: boolean } }[] =
    items.value.map((item) => ({ label: title(item), value: item.id }))
  if (props.modelValue && !options.some((option) => option.value === props.modelValue)) {
    options.unshift({
      value: props.modelValue,
      label: selected.value
        ? title(selected.value)
        : `${props.modelValue}${unavailable.value ? '（不可用）' : selectedLoading.value ? '（加载中）' : ''}`,
      attrs: { disabled: !selected.value },
    })
  }
  return [
    {
      label: props.placeholder,
      value: '',
      attrs: { disabled: !props.clearable },
    },
    ...options,
  ]
})

function choose(value: unknown) {
  if (props.disabled || typeof value !== 'string' || value === props.modelValue) return
  if (value === '') {
    if (props.clearable) emit('update:modelValue', '')
    return
  }
  if (items.value.some((item) => item.id === value)) emit('update:modelValue', value)
}
let stopInput: (() => void) | undefined
function observeInput(node: NonNullable<ReturnType<typeof useFormKitContext>['value']>['node']) {
  stopInput?.()
  // An ignored inner input is outside the parent form's settlement tree. Relay its raw
  // input event immediately so the outer field is unsettled before a rapid submit.
  const receipt = node.on('input', ({ payload }) => choose(payload))
  stopInput = () => node.off(receipt)
}
onScopeDispose(() => stopInput?.())
function search(value: string) {
  if (!props.disabled) keyword.value = value
}
function changePage(value: number) {
  if (!props.disabled && !loading.value) page.value = value
}
</script>

<template>
  <fieldset class="lingui-project-select" :disabled="disabled" :aria-busy="loading">
    <SearchInput
      :model-value="keyword"
      placeholder="搜索作品名称或描述，回车确认"
      aria-label="搜索灵构 UI 作品"
      @keydown.enter.prevent
      @update:model-value="search"
    />
    <div class="lingui-project-select-control">
      <FormKit
        :id="inputId"
        type="select"
        :name="`lingui-project-options-${uid}`"
        :ignore="true"
        :model-value="modelValue || ''"
        :options="selectOptions"
        :disabled="disabled"
        :clearable="false"
        :auto-select="false"
        :placeholder="placeholder"
        :delay="0"
        :aria-describedby="`${inputId}-status`"
        aria-label="选择灵构 UI 作品"
        @node="observeInput"
      />
      <VButton v-if="clearable && modelValue" size="sm" :disabled="disabled" @click="choose('')">
        清空
      </VButton>
    </div>
    <div :id="`${inputId}-status`" class="lingui-project-select-status" aria-live="polite">
      <p v-if="loading" role="status">正在加载作品…</p>
      <div v-else-if="error" role="alert">
        <span>{{ error }}</span>
        <VButton size="sm" :disabled="disabled" @click="reload">重试加载作品</VButton>
      </div>
      <p v-else-if="!items.length" role="status">
        {{
          keyword || category
            ? '没有符合条件的作品。'
            : publicOnly
              ? '还没有开启公开嵌入的作品。'
              : '还没有作品。'
        }}
      </p>
      <p v-if="unavailable" role="status">
        所选作品不可用，可能已删除{{ publicOnly ? '或关闭公开嵌入' : '' }}。已保留原项目 ID。
      </p>
      <div v-else-if="selectedError" role="alert">
        <span>{{ selectedError }}</span>
        <VButton size="sm" :disabled="disabled" @click="reloadSelected">重试读取所选作品</VButton>
      </div>
      <template v-else-if="selected">
        <p v-if="selected.description">{{ selected.description }}</p>
        <p v-if="!selected.embedEnabled">此作品未开启公开嵌入，公开页面暂时无法展示。</p>
      </template>
    </div>
    <VPagination
      v-if="total > size"
      :page="page"
      :total="total"
      :size="size"
      :size-options="[size]"
      :show-total="true"
      page-label="页"
      size-label="每页"
      total-label="共"
      @update:page="changePage"
    />
    <div
      v-if="showPreview && selected?.embedEnabled && selected.id"
      class="lingui-project-select-preview"
    >
      <LinguiProjectRender :project-id="selected.id" :preview="true" />
    </div>
  </fieldset>
</template>

<style scoped>
.lingui-project-select {
  display: grid;
  gap: 0.625rem;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}
.lingui-project-select-control {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}
.lingui-project-select-control :deep(.formkit-outer) {
  flex: 1;
  min-width: 0;
  margin-bottom: 0;
}
.lingui-project-select-control :deep(.formkit-wrapper) {
  max-width: none;
}
.lingui-project-select-status {
  color: #6b7280;
  font-size: 0.75rem;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.lingui-project-select-status p {
  margin: 0;
}
.lingui-project-select-status [role='alert'] {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  color: #b91c1c;
}
.lingui-project-select-preview {
  max-height: 24rem;
  overflow: auto;
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
}
</style>
