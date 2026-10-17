<script setup lang="ts">
import { getCurrentInstance, toRaw } from 'vue'
const context = getCurrentInstance()?.appContext
import { computed } from 'vue'
import { NodeViewWrapper, nodeViewProps } from '@halo-dev/richtext-editor'
import { type ComponentInstance } from '@lingui/renderer'
import LinguiRenderer from '../shared/LinguiRenderer.vue'
import { openStudio } from './open-studio'
import { useComponentReference } from './useComponentReference'
import { nodeAttributes } from './serialization'
import { projectEditorUrl } from '../component-library/project-links'
const props = defineProps(nodeViewProps)
const componentId = computed(() => String(props.node.attrs.componentId ?? ''))
const { instance, loading, error, refresh } = useComponentReference(componentId)

function edit() {
  openStudio(
    toRaw(props.editor),
    async (value: ComponentInstance) => {
      props.updateAttributes(nodeAttributes(value))
      refresh()
    },
    undefined,
    context,
  )
}
</script>
<template>
  <NodeViewWrapper
    class="lingui-editor-node"
    :data-lingui-selected="selected"
    contenteditable="false"
    ><div class="lingui-node-toolbar">
      <span>灵构 UI · {{ instance?.document.title ?? '组件' }}</span>
      <div>
        <a
          v-if="componentId"
          :href="projectEditorUrl(componentId)"
          target="_blank"
          rel="noopener noreferrer"
          title="编辑并保存项目，文章中的组件将在刷新后更新"
          >编辑项目</a
        >
        <button type="button" :disabled="loading" @click="refresh">刷新预览</button>
        <button type="button" @click="edit">更换组件</button
        ><button type="button" @click="deleteNode">移除</button>
      </div>
    </div>
    <p v-if="loading" role="status">正在加载项目组件…</p>
    <LinguiRenderer v-else-if="instance" :instance="instance" />
    <p v-else role="alert">
      {{ error }} <button type="button" @click="refresh">重新加载</button>
    </p></NodeViewWrapper
  >
</template>
<style scoped>
.lingui-editor-node {
  border: 1px solid #e5e5e7;
  border-radius: 12px;
  margin: 20px 0;
  overflow: hidden;
}
.lingui-editor-node[data-lingui-selected='true'] {
  outline: 2px solid #b5b5ba;
}
.lingui-node-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #f7f7f8;
  border-bottom: 1px solid #e5e5e7;
  font-size: 11px;
  color: #797a82;
}
.lingui-node-toolbar button,
.lingui-node-toolbar a {
  border: 0;
  background: transparent;
  padding: 4px 8px;
  font-size: 11px;
  cursor: pointer;
  color: inherit;
  text-decoration: none;
}
.lingui-node-toolbar > div {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
}
</style>
