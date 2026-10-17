<script setup lang="ts">
import { provide } from 'vue'
import StudioView from '../views/StudioView.vue'
import ComponentPreview from './ComponentPreview.vue'
import { examples } from '@lingui/renderer'
import { repositoryKey } from '../services/repository'
import { createLocalRepository } from './local-repository'
provide(repositoryKey, createLocalRepository())
const requestedPreview = new URLSearchParams(location.search).get('preview')
const previewId = examples.find((example) => example.id === requestedPreview)?.id
</script>
<template>
  <ComponentPreview v-if="previewId" :example-id="previewId" /><StudioView
    v-else
    class="lu-standalone"
  />
</template>
