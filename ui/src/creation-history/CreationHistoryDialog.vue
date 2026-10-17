<script setup lang="ts">
import { computed, ref } from 'vue'
import StudioModal from '../shared/StudioModal.vue'
import StudioSearch from '../shared/StudioSearch.vue'
import LinguiIcon from '../shared/LinguiIcon.vue'
import { creationTitle, originLabels, type CreationRecord } from './types'
const props = defineProps<{
  records: CreationRecord[]
  activeId: string
  loading: boolean
  busy: boolean
  error?: string
}>()
const emit = defineEmits<{
  close: []
  open: [record: CreationRecord]
  remove: [record: CreationRecord]
  refresh: []
  new: []
}>()
const search = ref('')
const filter = ref<'all' | 'ai' | 'work'>('all')
const pageSize = 20
const visibleCount = ref(pageSize)
const matches = computed(() => {
  const query = search.value.trim().toLocaleLowerCase()
  return props.records.filter((record) => {
    if (filter.value === 'ai' && !record.messages.length) return false
    if (filter.value === 'work' && record.messages.length) return false
    return (
      !query ||
      [creationTitle(record), record.instruction, ...record.messages.map((message) => message.text)]
        .join('\n')
        .toLocaleLowerCase()
        .includes(query)
    )
  })
})
const visible = computed(() => matches.value.slice(0, visibleCount.value))
function selectFilter(value: typeof filter.value) {
  filter.value = value
  visibleCount.value = pageSize
}
function date(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}
function excerpt(record: CreationRecord) {
  return (
    [...record.messages].reverse().find((message) => message.role === 'user')?.text ||
    record.instruction ||
    (record.instance ? '作品快照已保留，可继续预览和手动修改。' : '待发送的需求已保留。')
  )
}
</script>
<template>
  <StudioModal title="创作历史" :width="860" @close="emit('close')">
    <section class="lingui-studio lu-history" aria-label="创作历史列表">
      <p class="lu-history-intro">
        自动保留 AI 对话与作品草稿。保存在当前浏览器中，按账号区分；保存的项目仍在“我的项目”中。
      </p>
      <div class="lu-history-tools">
        <StudioSearch
          v-model="search"
          label="搜索创作历史"
          placeholder="搜索作品名称或对话内容…"
          @update:model-value="visibleCount = pageSize"
        />
        <button
          type="button"
          class="lu-icon-button"
          aria-label="刷新创作历史"
          :disabled="loading"
          @click="emit('refresh')"
        >
          <LinguiIcon name="refresh" />
        </button>
      </div>
      <div class="lu-history-filters" aria-label="历史类型">
        <button
          v-for="(label, key) in { all: '全部', ai: 'AI 对话', work: '手动与导入' }"
          :key="key"
          type="button"
          :aria-pressed="filter === key"
          @click="selectFilter(key)"
        >
          {{ label }}
        </button>
        <span>{{ matches.length }} 段创作</span>
      </div>
      <p v-if="error" class="lu-error" role="alert">{{ error }}</p>
      <div class="lu-history-list">
        <p v-if="loading" class="lu-history-empty" role="status">正在载入历史…</p>
        <div v-else-if="!visible.length" class="lu-history-empty">
          <LinguiIcon name="clock" />
          <h3>{{ records.length ? '没有找到匹配的创作' : '从这一段创作开始' }}</h3>
          <p>
            {{
              records.length
                ? '试试其他关键词或切换类型。'
                : '发送需求、手动新建或导入作品后，历史会自动出现在这里。'
            }}
          </p>
        </div>
        <article
          v-for="record in visible"
          v-else
          :key="record.id"
          class="lu-history-row"
          :class="{ 'is-current': record.id === activeId }"
        >
          <span class="lu-history-icon"
            ><LinguiIcon :name="record.messages.length ? 'sparkles' : 'code'"
          /></span>
          <button
            type="button"
            class="lu-history-open"
            :disabled="busy"
            :aria-label="`继续创作：${creationTitle(record)}`"
            @click="emit('open', record)"
          >
            <span class="lu-history-title"
              >{{ creationTitle(record) }}<small v-if="record.id === activeId">当前</small></span
            >
            <span class="lu-history-excerpt">{{ excerpt(record) }}</span>
            <span class="lu-history-meta"
              ><time :datetime="record.updatedAt">{{ date(record.updatedAt) }}</time
              ><span>{{ originLabels[record.origin] }}</span
              ><span v-if="record.messages.length"
                >{{
                  record.messages.filter((message) => message.role === 'user').length
                }}
                轮对话</span
              ><span>{{ record.dirty || !record.project ? '草稿' : '已存项目' }}</span></span
            >
          </button>
          <button
            type="button"
            class="lu-icon-button lu-history-delete"
            :disabled="busy"
            :aria-label="`删除历史：${creationTitle(record)}`"
            @click="emit('remove', record)"
          >
            <LinguiIcon name="trash" />
          </button>
        </article>
        <button
          v-if="visible.length < matches.length"
          type="button"
          class="lu-button full"
          @click="visibleCount += pageSize"
        >
          查看更多历史
        </button>
      </div>
      <p v-if="busy" class="lu-muted" role="status">当前生成或保存完成后，可以切换或删除历史。</p>
    </section>
    <template #footer>
      <button type="button" class="lu-button" @click="emit('close')">返回创作</button>
      <button type="button" class="lu-button primary" :disabled="busy" @click="emit('new')">
        <LinguiIcon name="plus" />新建对话
      </button>
    </template>
  </StudioModal>
</template>
