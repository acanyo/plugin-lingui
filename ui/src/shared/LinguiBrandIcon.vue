<script setup lang="ts">
import logoUrl from '../assets/logo.svg'
import markUrl from '../assets/logo-mark.svg'

defineProps<{ badge?: boolean }>()
</script>

<template>
  <img
    class="lu-brand-icon"
    :src="badge ? logoUrl : markUrl"
    alt=""
    aria-hidden="true"
    width="32"
    height="32"
    draggable="false"
  />
</template>

<style scoped>
.lu-brand-icon {
  display: inline-block;
  width: 1em;
  height: 1em;
  flex-shrink: 0;
  object-fit: contain;
  vertical-align: middle;
}
</style>
