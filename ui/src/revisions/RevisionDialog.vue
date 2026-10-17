<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ComponentInstance } from '@lingui/renderer'
import { allRevisions, type RevisionHistory } from './types'
import { revisionDiff } from './diff'
import StudioModal from '../shared/StudioModal.vue'
import LinguiRenderer from '../shared/LinguiRenderer.vue'
const props = defineProps<{
  history?: RevisionHistory
  current?: ComponentInstance
  busy: boolean
}>()
const emit = defineEmits<{ close: []; restore: [id: string] }>()
const selected = ref(props.history?.entries.at(-1)?.id ?? '')
const versions = computed(() => allRevisions(props.history).reverse())
const revision = computed(() => versions.value.find((entry) => entry.id === selected.value))
const changes = computed(() => revisionDiff(props.current, revision.value?.instance))
</script>
<template>
  <StudioModal title="作品版本" :width="1080" @close="emit('close')">
    <section class="lingui-studio lu-revisions">
      <p class="lu-muted">
        保留最近 30 次修改与 AI 结果。预览不会调用业务接口；恢复后仍可撤销，对话保持不变。
      </p>
      <div v-if="history" class="lu-revision-grid">
        <nav aria-label="作品版本列表">
          <button
            v-for="entry in versions"
            :key="entry.id"
            type="button"
            :aria-pressed="selected === entry.id"
            @click="selected = entry.id"
          >
            <strong>{{ entry.label }}</strong
            ><small
              >{{ new Date(entry.createdAt).toLocaleTimeString('zh-CN')
              }}{{
                entry.id === history.entries[history.cursor]?.id
                  ? ' · 当前'
                  : history.archived?.some((item) => item.id === entry.id)
                    ? ' · 其他分支'
                    : ''
              }}</small
            >
          </button>
        </nav>
        <div class="lu-revision-detail">
          <h3>与当前作品比较</h3>
          <ul v-if="changes.length">
            <li v-for="change in changes" :key="change">{{ change }}</li>
          </ul>
          <p v-else class="lu-muted">内容与当前作品一致。</p>
          <div class="lu-revision-previews">
            <div>
              <h4>当前作品</h4>
              <LinguiRenderer :auto-start="false" v-if="current" :instance="current" />
              <p v-else>空白作品</p>
            </div>
            <div>
              <h4>所选版本</h4>
              <LinguiRenderer
                :auto-start="false"
                v-if="revision?.instance"
                :instance="revision.instance"
              />
              <p v-else>空白作品</p>
            </div>
          </div>
        </div>
      </div>
      <p v-else class="lu-muted">修改作品或生成新结果后，版本会显示在这里。</p>
    </section>
    <template #footer
      ><button type="button" class="lu-button" @click="emit('close')">返回创作</button
      ><button
        type="button"
        class="lu-button primary"
        :disabled="busy || !revision || !changes.length"
        @click="revision && emit('restore', revision.id)"
      >
        恢复所选版本
      </button></template
    >
  </StudioModal>
</template>
