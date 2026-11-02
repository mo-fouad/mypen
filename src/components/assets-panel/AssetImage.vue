<script setup lang="ts">
import { useObjectUrl } from '@vueuse/core'
import { computed } from 'vue'

import { useEditorStore } from '@/app/editor/active-store'

const { hash, alt } = defineProps<{
  hash: string
  alt: string
}>()

const editor = useEditorStore()
const blob = computed(() => {
  const bytes = editor.graph.images.get(hash)
  return bytes ? new Blob([new Uint8Array(bytes)]) : null
})
const url = useObjectUrl(blob)
</script>

<template>
  <div
    data-slot="asset-image"
    class="flex size-full items-center justify-center overflow-hidden rounded bg-canvas/60"
  >
    <img
      v-if="url"
      :src="url"
      :alt="alt"
      class="max-h-full max-w-full object-contain"
      draggable="false"
    />
    <icon-lucide-image v-else class="size-4 text-muted" aria-hidden="true" />
  </div>
</template>
