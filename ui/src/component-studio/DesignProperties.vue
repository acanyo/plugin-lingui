<script setup lang="ts">
import { ref } from 'vue'
import type { ComponentNode } from '@lingui/renderer'
const props = defineProps<{ node: ComponentNode }>()
const error = ref('')
const emit = defineEmits<{ update: [node: ComponentNode] }>()
function patch(key: string, value: unknown) {
  if (
    key === 'data' &&
    props.node.component === 'LingUI.FunnelChart' &&
    (value as { value: number }[]).some(
      (item, index, data) => index > 0 && item.value > data[index - 1]!.value,
    )
  ) {
    error.value = '漏斗数值必须按阶段非递增排列。'
    return
  }
  error.value = ''
  emit('update', { ...props.node, [key]: value })
}
function entry(index: number, key: 'label' | 'value', value: string) {
  patch(
    'entries',
    props.node.entries!.map((item, i) => (i === index ? { ...item, [key]: value } : item)),
  )
}
function datum(index: number, key: 'label' | 'value', value: string) {
  if (key === 'value' && (!value.trim() || !Number.isFinite(Number(value)))) return
  patch(
    'data',
    props.node.data!.map((item, i) =>
      i === index
        ? {
            ...item,
            [key]:
              key === 'value'
                ? Math.max(
                    ['LingUI.LineChart', 'LingUI.Sparkline', 'LingUI.WaterfallChart'].includes(
                      props.node.component,
                    )
                      ? -1e12
                      : 0,
                    Math.min(1e12, Number(value)),
                  )
                : value,
          }
        : item,
    ),
  )
}
</script>
<template>
  <label v-if="node.component === 'List'" class="lu-field"
    ><span>列表方向</span
    ><select
      :value="node.direction ?? 'vertical'"
      @change="patch('direction', ($event.target as HTMLSelectElement).value)"
    >
      <option value="vertical">纵向</option>
      <option value="horizontal">横向（窄屏折行）</option>
    </select></label
  >

  <label v-if="node.component === 'Card'" class="lu-field">
    <span>卡片外观</span>
    <select
      :value="node.variant ?? 'outlined'"
      @change="patch('variant', ($event.target as HTMLSelectElement).value)"
    >
      <option value="outlined">细边框</option>
      <option value="soft">浅色背景</option>
      <option value="plain">无边框</option>
    </select>
  </label>
  <label v-if="node.component === 'LingUI.Grid'" class="lu-field">
    <span>最大列数（窄屏自动折行）</span>
    <select
      :value="node.maxColumns ?? 2"
      @change="patch('maxColumns', Number(($event.target as HTMLSelectElement).value))"
    >
      <option :value="2">2 列</option>
      <option :value="3">3 列</option>
      <option :value="4">4 列</option>
    </select>
  </label>
  <template v-if="node.component === 'LingUI.Section'">
    <label v-if="node.label === undefined" class="lu-field"
      ><span>章节标记</span
      ><input @change="patch('label', ($event.target as HTMLInputElement).value)"
    /></label>
    <label v-if="node.description === undefined" class="lu-field"
      ><span>章节说明</span
      ><textarea
        rows="3"
        @change="patch('description', ($event.target as HTMLTextAreaElement).value)"
      />
    </label>
  </template>
  <template v-if="node.component === 'LingUI.CodeBlock'">
    <label v-if="node.label === undefined" class="lu-field"
      ><span>文件名</span
      ><input @change="patch('label', ($event.target as HTMLInputElement).value)"
    /></label>
    <label class="lu-field"
      ><span>语言</span
      ><select
        :value="node.language ?? 'text'"
        @change="patch('language', ($event.target as HTMLSelectElement).value)"
      >
        <option
          v-for="language in [
            'text',
            'java',
            'javascript',
            'typescript',
            'json',
            'python',
            'bash',
            'sql',
          ]"
          :key="language"
          :value="language"
        >
          {{ language }}
        </option>
      </select></label
    >
    <label class="lu-field"
      ><span>代码内容</span
      ><textarea
        class="lu-code"
        rows="12"
        spellcheck="false"
        :value="node.code"
        @change="patch('code', ($event.target as HTMLTextAreaElement).value)"
      />
    </label>
  </template>
  <section
    v-if="node.component === 'LingUI.KeyValue'"
    class="lu-table-editor"
    aria-label="信息列表编辑"
  >
    <div v-for="(item, index) in node.entries" :key="index" class="lu-table-editor-row">
      <label class="lu-field"
        ><span>第 {{ index + 1 }} 项名称</span
        ><input
          :value="item.label"
          @change="entry(index, 'label', ($event.target as HTMLInputElement).value)"
      /></label>
      <label class="lu-field"
        ><span>第 {{ index + 1 }} 项内容</span
        ><textarea
          rows="2"
          :value="item.value"
          @change="entry(index, 'value', ($event.target as HTMLTextAreaElement).value)"
        />
      </label>
      <button
        type="button"
        class="lu-text-button danger"
        :disabled="node.entries!.length <= 1"
        @click="
          patch(
            'entries',
            node.entries!.filter((_, i) => i !== index),
          )
        "
      >
        移除此项
      </button>
    </div>
    <button
      type="button"
      class="lu-button"
      :disabled="node.entries!.length >= 20"
      @click="patch('entries', [...node.entries!, { label: '名称', value: '内容' }])"
    >
      添加信息项
    </button>
  </section>
  <section
    v-if="
      [
        'LingUI.BarChart',
        'LingUI.LineChart',
        'LingUI.DonutChart',
        'LingUI.Sparkline',
        'LingUI.FunnelChart',
        'LingUI.WaterfallChart',
      ].includes(node.component)
    "
    class="lu-table-editor"
    aria-label="图表数据编辑"
  >
    <label class="lu-field"
      ><span>数值单位</span
      ><input
        :value="node.unit ?? ''"
        maxlength="40"
        @change="patch('unit', ($event.target as HTMLInputElement).value)"
    /></label>
    <div v-for="(item, index) in node.data" :key="index" class="lu-table-editor-row">
      <label class="lu-field"
        ><span>第 {{ index + 1 }} 组名称</span
        ><input
          :value="item.label"
          @change="datum(index, 'label', ($event.target as HTMLInputElement).value)"
      /></label>
      <label class="lu-field"
        ><span>第 {{ index + 1 }} 组数值</span
        ><input
          type="number"
          :min="
            ['LingUI.LineChart', 'LingUI.Sparkline', 'LingUI.WaterfallChart'].includes(
              node.component,
            )
              ? -1000000000000
              : 0
          "
          max="1000000000000"
          :value="item.value"
          @change="datum(index, 'value', ($event.target as HTMLInputElement).value)"
      /></label>
      <button
        type="button"
        class="lu-text-button danger"
        :disabled="node.data!.length <= (node.component === 'LingUI.FunnelChart' ? 2 : 1)"
        @click="
          patch(
            'data',
            node.data!.filter((_, i) => i !== index),
          )
        "
      >
        移除此组
      </button>
    </div>
    <button
      type="button"
      class="lu-button"
      :disabled="node.data!.length >= 12"
      @click="patch('data', [...node.data!, { label: '新数据', value: 0 }])"
    >
      添加数据组
    </button>
  </section>
  <p v-if="error" class="lu-error" role="alert">{{ error }}</p>
</template>
