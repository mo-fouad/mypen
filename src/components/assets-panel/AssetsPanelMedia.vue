<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import { groupBy } from 'es-toolkit'
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuPortal,
  ContextMenuRoot,
  ContextMenuTrigger
} from 'reka-ui'
import { computed } from 'vue'

import { useI18n } from '@open-pencil/vue/i18n'

import { useEditorStore } from '@/app/editor/active-store'
import { documentImages } from '@/app/editor/library/images'
import { libraryItems } from '@/app/editor/library/items'
import { focusNodesOnTheirPage } from '@/app/editor/selection/focus'
import { toast } from '@/app/shell/ui'
import AssetImage from '@/components/assets-panel/AssetImage.vue'
import AssetThumbnail from '@/components/assets-panel/AssetThumbnail.vue'
import { useAllPagesLoaded } from '@/components/assets-panel/useAllPagesLoaded'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppCollapsible from '@/components/ui/collapsible/AppCollapsible.vue'
import AppPlaceholder from '@/components/ui/feedback/AppPlaceholder.vue'
import { useMenuUI } from '@/components/ui/menu/menu'
import MenuScrollArea from '@/components/ui/menu/MenuScrollArea.vue'
import Tip from '@/components/ui/overlay/Tip.vue'
import { ASSET_ICON_THUMBNAIL_SIZE } from '@/constants'

const editor = useEditorStore()
const { panels } = useI18n()
const { loading: loadingPages, pending: pendingPages } = useAllPagesLoaded()
const { copy, copied } = useClipboard({ legacy: true })
const contextMenu = useMenuUI({ content: 'min-w-44' })
const copyButton = {
  color: 'neutral' as const,
  variant: 'ghost' as const,
  size: 'sm' as const,
  shape: 'square' as const
}

const iconGroups = computed(() => {
  // Reading the version recomputes the lists as background page loads add icons and images.
  void editor.state.sceneVersion
  const icons = libraryItems(editor.graph).filter((item) => item.kind === 'icon')
  return Object.entries(groupBy(icons, (item) => item.group))
    .map(([name, items]) => ({ name, items }))
    .sort((a, b) => a.name.localeCompare(b.name))
})
const iconCount = computed(() => iconGroups.value.reduce((n, group) => n + group.items.length, 0))

const images = computed(() => {
  void editor.state.sceneVersion
  return documentImages(editor.graph).map((image) => {
    const firstId = image.nodeIds[0]
    const name = firstId ? (editor.graph.getNode(firstId)?.name ?? null) : null
    return { ...image, name, firstId: firstId ?? null }
  })
})

async function copyName(name: string) {
  await copy(name)
  if (copied.value) toast.info(panels.value.nameCopied)
  else toast.error(panels.value.copyNameFailed)
}

function goToImage(firstId: string | null) {
  if (firstId) void focusNodesOnTheirPage(editor, [firstId])
}
</script>

<template>
  <section data-test-id="assets-media-panel" class="flex min-h-0 flex-1 flex-col overflow-hidden">
    <p
      v-if="loadingPages"
      data-test-id="assets-loading-pages"
      role="status"
      class="shrink-0 px-3 py-1 text-[11px] text-muted"
    >
      {{ panels.loadingPages({ count: pendingPages }) }}
    </p>

    <div class="scrollbar-thin flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 py-2">
      <AppCollapsible :label="panels.icons" :open="true" data-test-id="assets-icons-section">
        <section
          v-for="group in iconGroups"
          :key="group.name"
          :aria-label="group.name"
          class="mb-2"
        >
          <h2 class="mb-1 px-1 text-[11px] font-semibold text-muted">{{ group.name }}</h2>
          <div class="flex flex-wrap gap-1">
            <ContextMenuRoot v-for="item in group.items" :key="item.id">
              <ContextMenuTrigger as-child>
                <div class="group/icon relative">
                  <Tip :label="item.name">
                    <div
                      role="button"
                      tabindex="0"
                      data-test-id="icon-item"
                      :data-asset-id="item.id"
                      :aria-label="item.label"
                      class="rounded outline-none hover:bg-hover focus-visible:ring-1 focus-visible:ring-panel-focus"
                      @click="void editor.focusComponent(item.id)"
                      @keydown.enter.self.prevent="void editor.focusComponent(item.id)"
                      @keydown.space.self.prevent="void editor.focusComponent(item.id)"
                    >
                      <AssetThumbnail
                        :node-id="item.id"
                        :alt="item.label"
                        :size="ASSET_ICON_THUMBNAIL_SIZE"
                      />
                    </div>
                  </Tip>
                  <Tip :label="panels.copyName">
                    <AppButton
                      v-bind="copyButton"
                      data-test-id="icon-copy-name"
                      :aria-label="panels.copyName"
                      class="absolute -top-1 -right-1 size-4 opacity-0 group-focus-within/icon:opacity-100 group-hover/icon:opacity-100"
                      @pointerdown.stop
                      @click.stop="copyName(item.name)"
                    >
                      <icon-lucide-copy class="size-2.5" />
                    </AppButton>
                  </Tip>
                </div>
              </ContextMenuTrigger>
              <ContextMenuPortal>
                <ContextMenuContent :class="contextMenu.content">
                  <MenuScrollArea>
                    <ContextMenuItem
                      data-test-id="icon-context-copy-name"
                      :class="contextMenu.item"
                      @select="void copyName(item.name)"
                    >
                      {{ panels.copyName }}
                    </ContextMenuItem>
                  </MenuScrollArea>
                </ContextMenuContent>
              </ContextMenuPortal>
            </ContextMenuRoot>
          </div>
        </section>
        <AppPlaceholder
          v-if="iconCount === 0 && !loadingPages"
          data-test-id="assets-no-icons"
          :label="panels.noIcons"
          size="compact"
        >
          <template #icon>
            <icon-lucide-shapes class="size-4" />
          </template>
        </AppPlaceholder>
      </AppCollapsible>

      <AppCollapsible :label="panels.images" :open="true" data-test-id="assets-images-section">
        <div class="grid grid-cols-3 gap-2">
          <ContextMenuRoot v-for="image in images" :key="image.hash">
            <ContextMenuTrigger as-child>
              <div
                role="button"
                data-test-id="image-item"
                :data-image-hash="image.hash"
                :tabindex="image.firstId ? 0 : -1"
                :aria-disabled="!image.firstId"
                :aria-label="image.name ?? image.hash"
                :class="[
                  'group/image relative aspect-square rounded p-0.5 outline-none focus-visible:ring-1 focus-visible:ring-panel-focus',
                  image.firstId ? 'cursor-pointer hover:bg-hover' : 'cursor-default opacity-60'
                ]"
                @click="goToImage(image.firstId)"
                @keydown.enter.self.prevent="goToImage(image.firstId)"
                @keydown.space.self.prevent="goToImage(image.firstId)"
              >
                <AssetImage :hash="image.hash" :alt="image.name ?? image.hash" />
                <Tip v-if="image.name" :label="panels.copyName">
                  <AppButton
                    v-bind="copyButton"
                    data-test-id="image-copy-name"
                    :aria-label="panels.copyName"
                    class="absolute top-1 right-1 opacity-0 group-focus-within/image:opacity-100 group-hover/image:opacity-100"
                    @pointerdown.stop
                    @click.stop="image.name && copyName(image.name)"
                  >
                    <icon-lucide-copy class="size-3" />
                  </AppButton>
                </Tip>
              </div>
            </ContextMenuTrigger>
            <ContextMenuPortal v-if="image.name">
              <ContextMenuContent :class="contextMenu.content">
                <MenuScrollArea>
                  <ContextMenuItem
                    data-test-id="image-context-copy-name"
                    :class="contextMenu.item"
                    @select="image.name && void copyName(image.name)"
                  >
                    {{ panels.copyName }}
                  </ContextMenuItem>
                </MenuScrollArea>
              </ContextMenuContent>
            </ContextMenuPortal>
          </ContextMenuRoot>
        </div>
        <AppPlaceholder
          v-if="images.length === 0 && !loadingPages"
          data-test-id="assets-no-images"
          :label="panels.noImages"
          size="compact"
        >
          <template #icon>
            <icon-lucide-image class="size-4" />
          </template>
        </AppPlaceholder>
      </AppCollapsible>
    </div>
  </section>
</template>
