<script setup lang="ts">
import type { WorkSource } from './provenance'
defineProps<{ sources?: WorkSource[] }>()
</script>
<template>
  <aside v-if="sources?.length" class="lu-source-attribution" aria-label="改编来源">
    <strong>基于社区作品创作</strong>
    <ol>
      <li v-for="source in sources" :key="`${source.site}/${source.workId}/${source.version}`">
        <span>{{ source.title }} · v{{ source.version }}</span
        ><small
          >{{ source.author }} · {{ source.license }} ·
          <a :href="source.site" target="_blank" rel="noopener noreferrer">来源站点</a></small
        ><code>{{ source.workId }}</code>
      </li>
    </ol>
    <p>保留原作者署名与许可证声明。来源与作品快照分别保存；投稿时市场会核对原作记录。</p>
  </aside>
</template>
<style scoped>
.lu-source-attribution {
  border: 1px solid var(--lu-border);
  border-radius: 10px;
  padding: 12px;
  margin: 12px;
  font-size: 12px;
  background: var(--lu-bg);
}
ol {
  padding-left: 18px;
  margin: 8px 0;
}
li {
  padding: 4px 0;
  overflow-wrap: anywhere;
}
small,
code {
  display: block;
  color: var(--lu-muted);
  margin-top: 3px;
}
p {
  margin: 8px 0 0;
  color: var(--lu-muted);
}
a {
  color: var(--lu-accent);
}
</style>
