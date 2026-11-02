<script setup lang="ts">
import { tv } from 'tailwind-variants'

import brandMarkTheme from '@/theme/brand'

import type { BrandMarkProps } from './types'

const brandMark = tv(brandMarkTheme)

const { decorative = false, class: className } = defineProps<BrandMarkProps>()

// MyPen: one raster logo for every variant and appearance.
const source = '/mypen/mark.png'
</script>

<template>
  <img
    :src="source"
    :class="brandMark({ class: className })"
    :alt="decorative ? '' : 'MyPen'"
    width="16"
    height="16"
  />
</template>
