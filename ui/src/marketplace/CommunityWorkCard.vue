<script setup lang="ts">
import { onMounted, onUnmounted, shallowRef, ref } from 'vue'
import type { MarketplaceWork } from './catalog'
import { marketService, marketError, type CommunityWork } from './market-service'
import WorkCard from './WorkCard.vue'
import LinguiIcon from '../shared/LinguiIcon.vue'
const props = defineProps<{ work: CommunityWork; actionLabel?: string; actionDisabled?: boolean }>()
defineEmits<{ preview: [work: MarketplaceWork]; use: [work: MarketplaceWork] }>()
const loaded = shallowRef<MarketplaceWork>(),
  error = ref(''),
  loading = ref(false)
let mounted = true
async function load() {
  if (!props.work.name || loading.value) return
  loading.value = true
  error.value = ''
  try {
    const work = await marketService.get(props.work.name)
    if (mounted) loaded.value = work
  } catch (cause) {
    if (mounted) error.value = marketError(cause)
  } finally {
    loading.value = false
  }
}
onMounted(load)
onUnmounted(() => {
  mounted = false
})
</script>
<template>
  <WorkCard
    v-if="loaded"
    :example="loaded"
    :action-label="actionLabel"
    :action-disabled="actionDisabled"
    @preview="$emit('preview', loaded)"
    @use="$emit('use', loaded)"
  />
  <article v-else class="lu-builtin-card" :aria-label="work.title" :aria-busy="loading">
    <div class="lu-community-cover">
      <LinguiIcon name="layers" /><span>{{ loading ? '正在加载预览…' : '预览暂不可用' }}</span>
    </div>
    <div class="lu-builtin-copy">
      <div class="lu-builtin-title">
        <h3>{{ work.title }}</h3>
        <span class="lu-builtin-source">社区</span>
      </div>
      <p>{{ work.description }}</p>
      <p v-if="error" class="lu-error" role="alert">{{ error }}</p>
      <div class="lu-builtin-actions">
        <span class="lu-builtin-category">{{ work.author }} · v{{ work.version }}</span
        ><button type="button" class="lu-button" :disabled="loading" @click="load">重新加载</button>
      </div>
    </div>
  </article>
</template>
