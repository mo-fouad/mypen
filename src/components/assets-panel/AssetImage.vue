<script setup lang="ts">
import { useElementVisibility, useObjectUrl } from '@vueuse/core'
import { computed, useTemplateRef } from 'vue'

import { imageMimeType } from '@open-pencil/scene-graph/images'

import { useEditorStore } from '@/app/editor/active-store'

const { hash, alt } = defineProps<{
  hash: string
  alt: string
}>()

const editor = useEditorStore()
const root = useTemplateRef<HTMLElement>('root')
const isVisible = useElementVisibility(root)
// Decoding waits until the tile scrolls into view, so a large library opens quickly.
const blob = computed(() => {
  if (!isVisible.value) return null
  const bytes = editor.graph.images.get(hash)
  return bytes ? new Blob([new Uint8Array(bytes)], { type: imageMimeType(bytes) }) : null
})
const url = useObjectUrl(blob)
</script>

<template>
  <div
    ref="root"
    data-slot="asset-image"
    class="flex size-full items-center justify-center overflow-hidden rounded bg-canvas/60"
  >
    <img
      v-if="url"
      :src="url"
      :alt="alt"
      class="max-h-full max-w-full object-contain"
      loading="lazy"
      decoding="async"
      draggable="false"
    />
    <icon-lucide-image v-else class="size-4 text-muted" aria-hidden="true" />
  </div>
</template>
