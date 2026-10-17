<script setup lang="ts">
import SourceAttribution from '../remix/SourceAttribution.vue'
import DemoSharing from '../interaction-recordings/DemoSharing.vue'
import type { InteractionRecording } from '../interaction-recordings/model'
import DependencySummary from '../integrations/DependencySummary.vue'
import { computed, ref, shallowReactive } from 'vue'
import { Dialog, VButton } from '@halo-dev/components'
import VModal from '../shared/StudioModal.vue'
import { cloneJson } from '../shared/clone'
import LinguiRenderer from '../shared/LinguiRenderer.vue'
import { exportSubmission, licenses, type SubmissionDraft } from './submission'
import { downloadJson } from '../shared/download'
const props = defineProps<{
  recordings?: InteractionRecording[]
  draft: SubmissionDraft
  busy: boolean
  saveError?: string
  remoteEnabled?: boolean
}>()
const emit = defineEmits<{
  save: [draft: SubmissionDraft]
  submit: [draft: SubmissionDraft]
  close: []
}>()
const submitAfterSave = ref(false)
const form = shallowReactive(cloneJson(props.draft)),
  error = ref('')
const changed = computed(() => JSON.stringify(form) !== JSON.stringify(props.draft))
function close() {
  if (props.busy) return
  if (changed.value)
    Dialog.warning({
      title: '关闭投稿草稿？',
      description: '未保存的作品说明会丢失。',
      confirmText: '放弃修改',
      cancelText: '继续编辑',
      onConfirm: () => emit('close'),
    })
  else emit('close')
}
function save(values: Partial<SubmissionDraft>) {
  if (props.busy) return
  const draft = { ...form, ...values }
  if (submitAfterSave.value) {
    try {
      exportSubmission(draft)
      error.value = ''
      emit('submit', draft)
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '作品信息不完整'
    }
  } else emit('save', draft)
}
function exportWork() {
  try {
    downloadJson(`${form.title}-作品包`, exportSubmission(form))
    error.value = ''
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '导出失败'
  }
}
</script>
<template>
  <VModal title="编辑投稿草稿" :width="1000" :close-disabled="busy" @close="close">
    <div class="lingui-studio lu-submission-editor">
      <div class="lu-submission-preview">
        <div class="lu-panel-heading">
          <h3>{{ draft.kind === 'theme' ? '主题快照' : '作品快照' }}</h3>
          <span class="lu-tag">{{ draft.kind === 'theme' ? '主题投稿' : '组件投稿' }}</span>
        </div>
        <LinguiRenderer :instance="draft.instance" />
        <SourceAttribution :sources="form.provenance" />
        <DependencySummary :instance="draft.instance" />
        <p class="lu-muted">
          {{
            draft.kind === 'theme'
              ? '试用这套主题的控件样式。保留配色、字体与排版快照，后续修改不会改变这份投稿。'
              : '保留创建草稿时的组件与主题。项目后续修改不会改变这份快照。'
          }}
        </p>
      </div>
      <FormKit type="form" :actions="false" :disabled="busy" @submit="save">
        <FormKit
          v-model="form.title"
          type="text"
          name="title"
          :label="draft.kind === 'theme' ? '主题名称' : '作品名称'"
          validation="required|length:1,120"
        />
        <FormKit
          v-model="form.description"
          type="textarea"
          name="description"
          :label="draft.kind === 'theme' ? '主题简介' : '作品简介'"
          :placeholder="
            draft.kind === 'theme'
              ? '介绍配色、排版和适合的使用场景'
              : '介绍用途、特色与适合的使用场景'
          "
          validation="length:0,500"
        />
        <div class="lu-form-pair">
          <FormKit
            v-model="form.category"
            type="text"
            name="category"
            label="分类"
            validation="length:0,80"
          /><FormKit
            v-model="form.version"
            type="text"
            name="version"
            label="作品版本"
            placeholder="1.0.0"
            validation="length:0,30"
          />
        </div>
        <div class="lu-form-pair">
          <FormKit
            v-model="form.author"
            type="text"
            name="author"
            label="作者名称"
            validation="length:0,80"
          /><FormKit
            v-model="form.license"
            type="select"
            name="license"
            label="许可证"
            :options="[
              { label: '请选择', value: '' },
              ...licenses.map((value) => ({ label: value, value })),
            ]"
          />
        </div>
        <FormKit
          v-model="form.notes"
          type="textarea"
          name="notes"
          label="使用说明与来源"
          placeholder="如何使用，以及引用或改编的作品来源"
          validation="length:0,2000"
        />
        <DemoSharing
          :recordings="recordings ?? []"
          :instance="form.instance"
          :demos="form.demos"
          @update="form.demos = $event"
        />
        <p class="lu-muted">草稿保存在当前浏览器。保存后可从草稿列表提交到市场，也可导出作品包。</p>
        <p v-if="error || saveError" class="lu-error" role="alert">{{ error || saveError }}</p>
        <div class="lu-toolbar-actions">
          <button
            v-if="remoteEnabled"
            type="submit"
            class="lu-button primary"
            :disabled="busy"
            @click="submitAfterSave = true"
          >
            保存并投稿
          </button>
          <button type="submit" class="lu-button" :disabled="busy" @click="submitAfterSave = false">
            {{ busy ? '正在保存…' : '保存草稿' }}</button
          ><button type="button" class="lu-button" :disabled="busy" @click="exportWork">
            导出作品包
          </button>
        </div>
      </FormKit>
    </div>
    <template #footer
      ><VButton class="lu-button" :disabled="busy" @click="close">关闭</VButton></template
    >
  </VModal>
</template>
