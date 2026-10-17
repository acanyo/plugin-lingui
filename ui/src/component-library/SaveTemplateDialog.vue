<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { VButton } from '@halo-dev/components'
import VModal from '../shared/StudioModal.vue'
const props = defineProps<{
  name: string
  category?: string
  categories?: string[]
  nativeCategoryInput?: boolean
  description?: string
  updating: boolean
  renaming?: boolean
  busy?: boolean
  error?: string
}>()
const emit = defineEmits<{
  save: [name: string, category: string, description: string]
  close: []
}>()
const title = ref(props.name),
  category = ref(props.category ?? '未分类'),
  description = ref(props.description ?? '')
const categoryListId = useId()
const categoryOptions = computed(() => {
  const names = new Set(
    [...(props.categories ?? []), props.category ?? ''].map((name) => name.trim()).filter(Boolean),
  )
  names.delete('未分类')
  return ['未分类', ...[...names].sort((a, b) => a.localeCompare(b, 'zh-CN'))].map((name) => ({
    label: name,
    value: name,
  }))
})
function close() {
  if (!props.busy) emit('close')
}
function save() {
  if (!props.busy) emit('save', title.value, category.value.trim(), description.value)
}
</script>
<template>
  <VModal
    :title="renaming ? '编辑项目资料' : updating ? '保存新版本' : '保存项目'"
    :width="520"
    :close-disabled="busy"
    @close="close"
    ><div class="lingui-studio lu-dialog-body">
      <FormKit type="form" :actions="false" :disabled="busy" @submit="save"
        ><FormKit
          v-model="title"
          type="text"
          name="name"
          label="组件名称"
          validation="required|length:1,120"
        /><FormKit
          v-model="category"
          :type="nativeCategoryInput ? 'text' : 'select'"
          name="category"
          label="分类"
          :options="categoryOptions"
          :searchable="true"
          :allow-create="true"
          :auto-select="false"
          :list="nativeCategoryInput ? categoryListId : undefined"
          placeholder="选择已有分类，或输入新分类"
          help="可选择已有分类，或输入新名称；新分类将在保存项目后出现在列表中。"
          validation="required|length:1,80"
        />
        <!-- The standalone studio uses standard FormKit inputs rather than Halo's enhanced select. -->
        <datalist v-if="nativeCategoryInput" :id="categoryListId">
          <option v-for="option in categoryOptions" :key="option.value" :value="option.value" />
        </datalist>
        <FormKit
          v-model="description"
          type="textarea"
          name="description"
          label="说明"
          validation="length:0,500"
        />
        <p class="lu-muted">
          {{
            renaming
              ? '修改项目名称、分类和说明，保留已保存的作品版本。'
              : updating
                ? '保存会产生新版本，文章与主题中的组件引用将在刷新后更新。'
                : '项目保存在工作空间，可在文章中复用；Halo 项目由获授权作者共享。'
          }}
        </p>
        <p v-if="error" role="alert" class="lu-error">{{ error }}</p>
        <button type="submit" class="lu-button primary full" :disabled="busy">
          {{ busy ? '正在保存…' : renaming ? '保存修改' : updating ? '保存新版本' : '保存项目' }}
        </button></FormKit
      >
    </div>
    <template #footer
      ><div class="lingui-studio lu-dialog-actions">
        <VButton class="lu-button" :disabled="busy" @click="close">取消</VButton>
      </div></template
    ></VModal
  >
</template>
