<script setup lang="ts">
import { readPath, type ComponentNode, type Dynamic, type State } from '@lingui/renderer'
const props = defineProps<{ node: ComponentNode; state: State }>()
const emit = defineEmits<{
  update: [node: ComponentNode]
  text: [property: 'url', value: string]
}>()
function patch(key: string, value: unknown) {
  emit('update', { ...props.node, [key]: value })
}
function label(value: Dynamic | undefined) {
  return typeof value === 'object' && 'path' in value
    ? String(readPath(props.state, value.path) ?? '')
    : typeof value === 'object'
      ? '根据参数计算'
      : String(value ?? '')
}
</script>
<template>
  <template v-if="['Image', 'Video', 'AudioPlayer', 'LingUI.Avatar'].includes(node.component)">
    <label class="lu-field"
      ><span>资源地址</span
      ><input
        :value="label(node.url)"
        type="text"
        placeholder="https://… 或 /upload/…"
        :disabled="typeof node.url === 'object' && 'call' in node.url"
        @change="emit('text', 'url', ($event.target as HTMLInputElement).value)"
    /></label>
    <label v-if="node.description === undefined" class="lu-field"
      ><span>资源说明</span
      ><input @change="patch('description', ($event.target as HTMLInputElement).value)"
    /></label>
  </template>
  <template v-if="node.component === 'Image'">
    <label class="lu-field"
      ><span>图片尺寸</span
      ><select
        :value="node.variant ?? 'mediumFeature'"
        @change="patch('variant', ($event.target as HTMLSelectElement).value)"
      >
        <option value="icon">图标</option>
        <option value="avatar">头像</option>
        <option value="smallFeature">小图</option>
        <option value="mediumFeature">内容配图</option>
        <option value="largeFeature">大图</option>
        <option value="header">横幅</option>
      </select></label
    >
    <label class="lu-field"
      ><span>填充方式</span
      ><select
        :value="node.fit ?? 'cover'"
        @change="patch('fit', ($event.target as HTMLSelectElement).value)"
      >
        <option value="cover">裁切填满</option>
        <option value="contain">完整显示</option>
        <option value="fill">拉伸</option>
        <option value="none">原始尺寸</option>
        <option value="scaleDown">仅缩小</option>
      </select></label
    >
  </template>
</template>
