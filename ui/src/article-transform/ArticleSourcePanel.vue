<script setup lang="ts">
import type { ArticleSource } from './source'
defineProps<{ source: ArticleSource }>()
</script>
<template>
  <details class="lu-article-reference" open>
    <summary>文章内容依据 · 插入前核对</summary>
    <p>
      请逐条核对题目、答案和解析是否有原文依据。AI 的补充推断仍需作者确认；生成内容不代表已经核实。
    </p>
    <blockquote>{{ source.text }}</blockquote>
    <template v-if="source.context"
      ><strong>作者补充的上下文</strong>
      <blockquote>{{ source.context }}</blockquote></template
    >
  </details>
</template>
<style scoped>
.lu-article-reference {
  margin: 12px;
  border: 1px solid var(--lu-border);
  border-radius: 10px;
  padding: 12px;
  font-size: 12px;
}
.lu-article-reference summary {
  cursor: pointer;
  font-weight: 600;
}
p {
  color: var(--lu-muted);
}
blockquote {
  white-space: pre-wrap;
  max-height: 220px;
  overflow: auto;
  padding: 10px 12px;
  margin: 10px 0;
  border-left: 3px solid var(--lu-border);
  line-height: 1.8;
}
</style>
