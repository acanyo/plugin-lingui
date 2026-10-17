<script setup lang="ts">
import { ref } from 'vue'
import { safeMediaUrl, type ComponentNode } from '@lingui/renderer'
const props = defineProps<{ node: ComponentNode }>()
const emit = defineEmits<{ update: [node: ComponentNode] }>()
const error = ref('')
function patch(key: string, value: unknown) {
  error.value = ''
  emit('update', { ...props.node, [key]: value })
}
function keys(text: string) {
  const keys = text
    .split('\n')
    .map((key) => key.trim())
    .filter(Boolean)
  if (!keys.length || keys.length > 6 || keys.some((key) => key.length > 24)) {
    error.value = '请填写 1–6 个按键，每行一个，每个不超过 24 字。'
    return
  }
  patch('keys', keys)
}
function member(index: number, key: 'label' | 'url', value: string) {
  if ((key === 'url' && value && !safeMediaUrl(value)) || (key === 'label' && !value.trim())) {
    error.value = '成员名称不能为空，图片请填写有效地址。'
    return
  }
  patch(
    'members',
    props.node.members!.map((item, i) => (i === index ? { ...item, [key]: value } : item)),
  )
}
</script>
<template>
  <label v-if="node.component === 'LingUI.ScrollArea'" class="lu-field"
    ><span>可见高度</span
    ><select
      aria-label="可见高度"
      :value="node.maxHeight ?? 240"
      @change="patch('maxHeight', Number(($event.target as HTMLSelectElement).value))"
    >
      <option v-for="height in [160, 240, 320, 480]" :key="height" :value="height">
        {{ height }} px
      </option>
    </select></label
  >
  <label v-if="node.component === 'LingUI.AspectRatio'" class="lu-field"
    ><span>内容比例</span
    ><select
      aria-label="内容比例"
      :value="node.ratio ?? 'wide'"
      @change="patch('ratio', ($event.target as HTMLSelectElement).value)"
    >
      <option value="square">1:1 方形</option>
      <option value="landscape">4:3 横向</option>
      <option value="wide">16:9 宽屏</option>
      <option value="portrait">3:4 竖向</option>
    </select></label
  >
  <label v-if="node.component === 'LingUI.KeyboardShortcut'" class="lu-field"
    ><span>按键组合（每行一个）</span
    ><textarea
      rows="4"
      :value="node.keys?.join('\n')"
      @change="keys(($event.target as HTMLTextAreaElement).value)"
    />
  </label>
  <label v-if="node.component === 'LingUI.FileCard'" class="lu-field"
    ><span>文件信息</span
    ><input
      :value="node.metadata ?? ''"
      @change="patch('metadata', ($event.target as HTMLInputElement).value)"
  /></label>
  <template v-if="node.component === 'LingUI.AvatarGroup'">
    <label class="lu-field"
      ><span>最多可见头像</span
      ><select
        aria-label="最多可见头像"
        :value="node.maxVisible ?? 4"
        @change="patch('maxVisible', Number(($event.target as HTMLSelectElement).value))"
      >
        <option v-for="count in 8" :key="count" :value="count">{{ count }}</option>
      </select></label
    >
    <section class="lu-table-editor" aria-label="成员编辑">
      <div v-for="(item, index) in node.members" :key="index" class="lu-table-editor-row">
        <label class="lu-field"
          ><span>成员 {{ index + 1 }} 名称</span
          ><input
            :value="item.label"
            maxlength="120"
            @change="member(index, 'label', ($event.target as HTMLInputElement).value)" /></label
        ><label class="lu-field"
          ><span>头像地址（可选）</span
          ><input
            :value="item.url ?? ''"
            @change="member(index, 'url', ($event.target as HTMLInputElement).value)" /></label
        ><button
          type="button"
          class="lu-text-button danger"
          :disabled="node.members!.length <= 1"
          @click="
            patch(
              'members',
              node.members!.filter((_, i) => i !== index),
            )
          "
        >
          移除成员
        </button>
      </div>
      <button
        type="button"
        class="lu-button"
        :disabled="node.members!.length >= 20"
        @click="patch('members', [...node.members!, { label: '新成员' }])"
      >
        添加成员
      </button>
    </section>
  </template>
  <p v-if="error" class="lu-error" role="alert">{{ error }}</p>
</template>
