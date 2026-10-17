<script setup lang="ts">
import type { ArticleSource } from '../article-transform/source'
import { computed, inject, onBeforeUnmount, provide, ref } from 'vue'
import { Toast } from '@halo-dev/components'
import VModal from '../shared/StudioModal.vue'
import type { ComponentInstance } from '@lingui/renderer'
import StudioView from '../views/StudioView.vue'
import { repositoryKey } from '../services/repository'
import { createHaloRepository } from '../services/halo-repository'
import ArticleProjectPicker from './ArticleProjectPicker.vue'
import { prepareArticleProject } from './prepare-project'
import { createEmbedClient, embedClientKey } from '../component-embed/client'
import { ensurePublicEmbed } from '../component-embed/ensure-public'
import { studioAccess } from '../services/studio-access'
import type { WorkSource } from '../remix/provenance'
const props = defineProps<{
  instance?: ComponentInstance
  article?: { source: ArticleSource; prompt: string }
  apply?: (instance: ComponentInstance, source?: ArticleSource) => Promise<void>
}>()
const emit = defineEmits<{
  insert: [instance: ComponentInstance, source?: ArticleSource]
  close: []
}>()
const repository = createHaloRepository()
provide(repositoryKey, repository)
const access = studioAccess(repository)
const client = inject(embedClientKey, undefined) ?? createEmbedClient()
const controller = new AbortController()
onBeforeUnmount(() => controller.abort())
let prepared: { fingerprint: string; instance: ComponentInstance } | undefined
const selecting = computed(() => !props.instance && !props.article)
const busy = ref(false)
async function apply(
  instance: ComponentInstance,
  source?: ArticleSource,
  provenance?: WorkSource[],
) {
  const fingerprint = JSON.stringify({ instance, provenance })
  const candidate = prepared?.fingerprint === fingerprint ? prepared.instance : instance
  const saved = await prepareArticleProject(
    candidate,
    repository,
    access.allows('components:manage'),
    controller.signal,
    provenance,
  )
  // Retain the saved identity if publication or editor insertion fails, so retry cannot create duplicates.
  prepared = { fingerprint, instance: saved }
  if (controller.signal.aborted) return
  await ensurePublicEmbed(
    client,
    prepared.instance.templateId!,
    access.allows('components:manage'),
    controller.signal,
  )
  if (controller.signal.aborted) return
  if (props.apply) await props.apply(prepared.instance, source)
  else emit('insert', prepared.instance, source)
}
async function applyEdited(
  instance: ComponentInstance,
  source?: ArticleSource,
  provenance?: WorkSource[],
) {
  if (busy.value) return
  busy.value = true
  try {
    await apply(instance, source, provenance)
  } catch (cause) {
    Toast.error(
      `${cause instanceof Error ? cause.message : '组件未能应用到文章'}。当前修改已保留。`,
    )
  } finally {
    busy.value = false
  }
}
</script>
<template>
  <VModal
    :title="selecting ? '选择灵构 UI 组件' : '灵构 UI · 文章组件'"
    :width="selecting ? 1120 : 1400"
    height="85vh"
    :close-disabled="busy"
    @close="emit('close')"
    ><ArticleProjectPicker v-if="selecting" :insert="apply" @busy="busy = $event" />
    <div v-else class="lu-article-creation" :aria-busy="busy">
      <p class="lu-article-reference-note">
        插入时保存到我的项目并开启公开嵌入，文章引用项目最新保存版本。
      </p>
      <p v-if="busy" role="status" class="lu-article-reference-note">正在保存项目并插入文章…</p>
      <div :inert="busy">
        <StudioView
          :initial-instance="instance"
          :article="article"
          embedding
          @insert="applyEdited"
          @close="!busy && emit('close')"
        />
      </div></div
  ></VModal>
</template>
<style scoped>
.lu-article-reference-note {
  margin: 0 0 12px;
  color: #797a82;
  font-size: 12px;
}
</style>
