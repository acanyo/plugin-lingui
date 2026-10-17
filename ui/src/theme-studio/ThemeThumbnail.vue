<script setup lang="ts">
import { tokenStyle, type ThemeTokens } from '@lingui/renderer'
defineProps<{ theme: ThemeTokens }>()
</script>
<template>
  <span class="lu-theme-thumbnail" :style="tokenStyle(theme)" aria-hidden="true">
    <span class="lu-theme-mini-heading"><i class="lu-theme-dot" /><i /></span>
    <span class="lu-theme-mini-body"><i class="lu-theme-block" /><i class="lu-theme-block" /></span>
    <span class="lu-theme-mini-footer"><i /><i /></span>
  </span>
</template>
