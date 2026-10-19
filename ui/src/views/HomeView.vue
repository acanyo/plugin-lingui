<script setup lang="ts">
import { provide } from 'vue'
import { repositoryKey } from '../services/repository'
import { createHaloRepository } from '../services/halo-repository'
import StudioView from './StudioView.vue'
defineProps<{ projectId?: string }>()
provide(repositoryKey, createHaloRepository())
</script>
<template><StudioView class="lu-console" :project-id="projectId" /></template>
