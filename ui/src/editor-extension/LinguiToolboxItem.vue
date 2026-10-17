<script setup lang="ts">
import { openArticleTransform } from '../article-transform/open-transform'
import { getCurrentInstance, toRaw } from 'vue'
import IconSparkling from '~icons/ri/sparkling-line'
import LinguiBrandIcon from '../shared/LinguiBrandIcon.vue'
const context = getCurrentInstance()?.appContext
import { NodeSelection, ToolboxItem, type Editor } from '@halo-dev/richtext-editor'
import { openStudio } from './open-studio'
import { nodeAttributes } from './serialization'
const props = withDefaults(defineProps<{ editor: Editor; mode?: 'insert' | 'transform' }>(), {
  mode: 'insert',
})
function activate() {
  if (props.mode === 'transform') openArticleTransform(toRaw(props.editor), context)
  else void insert(props.editor)
}
async function insert(editor: Editor) {
  const rawEditor = toRaw(editor)
  openStudio(
    rawEditor,
    async (instance) => {
      const attrs = nodeAttributes(instance)
      const { selection } = rawEditor.state
      // Inserting from the menu must not discard a selected existing component.
      const range =
        selection instanceof NodeSelection && selection.node.type.name === 'linguiComponent'
          ? selection.to
          : { from: selection.from, to: selection.to }
      if (
        !rawEditor.chain().focus().insertContentAt(range, { type: 'linguiComponent', attrs }).run()
      )
        throw new Error('文章组件插入失败')
    },
    undefined,
    context,
  )
}
</script>
<template>
  <ToolboxItem
    :editor="editor"
    :icon="mode === 'transform' ? IconSparkling : LinguiBrandIcon"
    :title="mode === 'transform' ? '选段转互动' : '插入灵构 UI'"
    :description="
      mode === 'transform' ? '选中原文，生成测验、流程或对比' : '从我的项目或应用市场选择交互组件'
    "
    :action="activate"
  />
</template>
