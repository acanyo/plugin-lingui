<script setup lang="ts">
import { computed, onMounted, onUpdated, ref } from 'vue'
import { VPagination } from '@halo-dev/components'

const props = withDefaults(
  defineProps<{ page: number; total: number; size?: number; label: string }>(),
  {
    size: 9,
  },
)
const emit = defineEmits<{ 'update:page': [page: number] }>()
const root = ref<HTMLElement>()
const first = computed(() => (props.total ? (props.page - 1) * props.size + 1 : 0))
const last = computed(() => Math.min(props.page * props.size, props.total))

function labelControls() {
  // Halo 2.26 pagination has no props for the labels of its icon buttons and selects.
  const labels: Record<string, string> = {
    '.pagination__nav': props.label,
    '.pagination__btn--prev': '上一页',
    '.pagination__btn--next': '下一页',
    '.pagination__select': '跳转页码',
  }
  for (const [selector, label] of Object.entries(labels))
    root.value?.querySelector(selector)?.setAttribute('aria-label', label)
}
onMounted(labelControls)
onUpdated(labelControls)
</script>
<template>
  <div ref="root" class="lu-pagination">
    <p class="lu-pagination-summary" role="status">
      第 {{ first }}–{{ last }} 件，共 {{ total }} 件
    </p>
    <VPagination
      :page="page"
      :total="total"
      :size="size"
      :size-options="[size]"
      :show-total="false"
      @update:page="emit('update:page', $event)"
    />
  </div>
</template>
