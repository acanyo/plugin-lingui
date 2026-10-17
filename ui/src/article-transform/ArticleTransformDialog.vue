<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ArticleSource, TransformKind } from './source'
import { transformKinds, transformPrompt } from './source'
import StudioModal from '../shared/StudioModal.vue'
const props = defineProps<{ source: ArticleSource }>()
const emit = defineEmits<{ close: []; create: [source: ArticleSource, prompt: string] }>()
const kind = ref<TransformKind>('quiz'),
  context = ref(''),
  error = ref(''),
  consent = ref(false)
const length = computed(() => props.source.text.length + context.value.length)
function create() {
  try {
    const source = { ...props.source, context: context.value.trim() }
    emit('create', source, transformPrompt(source, kind.value))
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '无法生成'
  }
}
</script>
<template>
  <StudioModal title="文章选段转互动内容" :width="760" @close="emit('close')"
    ><section class="lingui-studio lu-dialog-body">
      <p class="lu-muted">
        仅将以下选段和你补充的上下文发送给
        AI。原文保留，生成后先在工作台核对并试用，再明确插入文章。
      </p>
      <h4>选中原文 · {{ source.text.length }} 字</h4>
      <blockquote class="lu-article-source">{{ source.text }}</blockquote>
      <FormKit
        v-model="kind"
        type="select"
        label="生成类型"
        :options="Object.entries(transformKinds).map(([value, label]) => ({ value, label }))"
      /><FormKit
        v-model="context"
        type="textarea"
        label="补充上下文（可选）"
        help="请只粘贴这次生成需要使用的上下文；不会自动发送整篇文章。"
        maxlength="1200"
      />
      <p :class="length > 3000 ? 'lu-error' : 'lu-muted'">内容范围合计 {{ length }} / 3000 字</p>
      <label
        ><input
          v-model="consent"
          type="checkbox"
        />确认使用以上内容，生成后我会核对答案、解释与补充推断</label
      >
      <p v-if="error" role="alert" class="lu-error">{{ error }}</p>
    </section>
    <template #footer
      ><button type="button" class="lu-button" @click="emit('close')">取消</button
      ><button
        type="button"
        class="lu-button primary"
        :disabled="!consent || length > 3000"
        @click="create"
      >
        进入工作台生成
      </button></template
    ></StudioModal
  >
</template>
<style scoped>
.lu-article-source {
  max-height: 260px;
  overflow: auto;
  white-space: pre-wrap;
  border-left: 3px solid var(--lu-border);
  padding: 12px 16px;
  margin: 10px 0;
  font-size: 13px;
  line-height: 1.8;
}
</style>
