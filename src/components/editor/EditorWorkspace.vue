<script setup lang="ts">
import { SplitterGroup, SplitterPanel, SplitterResizeHandle } from 'reka-ui'
import { tv } from 'tailwind-variants'
import { computed, ref, useTemplateRef } from 'vue'

import { resolveEditorProfile } from '@open-pencil/core'
import { formatShortcut } from '@open-pencil/vue/editor/commands'
import { useViewportKind } from '@open-pencil/vue/editor/viewport-kind'
import { useI18n } from '@open-pencil/vue/i18n'

import { provideTabEditorStore } from '@/app/editor/active-store'
import { appRuntimeConfig } from '@/app/runtime/config'
import { loadEditorLayout, saveEditorLayout } from '@/app/shell/layout-storage'
import { appMenuShortcut } from '@/app/shell/menu/shortcut'
import type { Tab } from '@/app/tabs'
import CanvasSplitRoot from '@/components/canvas/CanvasSplitRoot.vue'
import CollabPanel from '@/components/collab-panel/CollabPanel.vue'
import ActiveRoomOverlay from '@/components/collab-room/ActiveRoomOverlay.vue'
import { useRoomActions } from '@/components/collab-room/useRoomActions'
import CommentDeleteDialog from '@/components/comments/CommentDeleteDialog.vue'
import EditorCanvas from '@/components/EditorCanvas.vue'
import LayersPanel from '@/components/LayersPanel.vue'
import MobileDrawer from '@/components/MobileDrawer.vue'
import MobileHud from '@/components/MobileHud/MobileHud.vue'
import PropertiesPanel from '@/components/PropertiesPanel.vue'
import StatusesDialog from '@/components/statuses/StatusesDialog.vue'
import EditorToolbar from '@/components/toolbar/EditorToolbar.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import VariablesDialog from '@/components/variables/VariablesDialog.vue'
import splitterTheme from '@/theme/splitter'

import WorkspacePill from './WorkspacePill.vue'

const showChrome = appRuntimeConfig.showChrome
/**
 * The document tab this workspace edits. WorkspaceView keys the workspace by tab, so the tab and
 * its store are fixed for its lifetime, and its editor UI stays bound to that document rather
 * than following the active tab to the next document when this one closes.
 */
const { tab } = defineProps<{ tab: Tab }>()
const store = tab.store
provideTabEditorStore(store)
const { isMobile } = useViewportKind()
/**
 * The layout the panels have. The splitter opens with it, also when showing the panels again
 * remounts it, so its opening report matches and only a resize differs.
 */
let editorLayout = loadEditorLayout()
/** How far apart two sizes, in percent, still count as one; the splitter rounds sizes finer. */
const LAYOUT_TOLERANCE = 1e-6
/**
 * Saves a layout the panels were resized to. The splitter also reports the layout it opens with,
 * which must not be saved: the right panel's default is a fixed width, and saved as a share of
 * this window it would open wider on a wider one.
 */
function saveResizedLayout(layout: number[]) {
  if (layout.every((size, index) => Math.abs(size - editorLayout[index]) < LAYOUT_TOLERANCE)) return
  editorLayout = layout
  saveEditorLayout(layout)
}
/** The right panel's share of the window when it last stood open, which showing it again restores. */
const RIGHT_PANEL_FALLBACK = 20
const rightPanel = useTemplateRef('rightPanel')
const rightPanelCollapsed = ref(editorLayout[2] === 0)
let rightPanelOpenSize = editorLayout[2] > 0 ? editorLayout[2] : RIGHT_PANEL_FALLBACK
function rememberRightPanelSize(size: number) {
  if (size > 0) rightPanelOpenSize = size
}
function showRightPanel() {
  rightPanel.value?.resize(rightPanelOpenSize)
}
const horizontalSplitterStyles = tv(splitterTheme)({ direction: 'horizontal' })
/**
 * A canvas whose view hides the panels takes the whole window when it is the only one shown, in the
 * canvas-only layout; split view keeps the panels for the other panes.
 */
const canvasAlone = computed(
  () => !resolveEditorProfile(store.state).panels && store.visiblePaneCount.value <= 1
)
const { editor } = useI18n()
// Until a room's document arrives there is nothing to edit, so its screen replaces the editor.
const { pending: roomPending } = useRoomActions()
</script>

<template>
  <div v-if="roomPending" :key="'room-' + tab.id" class="relative flex flex-1 overflow-hidden">
    <ActiveRoomOverlay />
  </div>

  <SplitterGroup
    v-else-if="!isMobile && showChrome && store.state.showUI && !canvasAlone"
    :key="tab.id"
    direction="horizontal"
    class="flex-1 overflow-hidden"
    @layout="saveResizedLayout"
  >
    <SplitterPanel
      id="layers"
      :default-size="editorLayout[0]"
      :min-size="10"
      :max-size="30"
      class="flex"
    >
      <LayersPanel />
    </SplitterPanel>
    <SplitterResizeHandle
      data-test-id="left-splitter-handle"
      :class="horizontalSplitterStyles.handle()"
    >
      <div :class="horizontalSplitterStyles.divider()" />
    </SplitterResizeHandle>
    <SplitterPanel id="canvas" :default-size="editorLayout[1]" :min-size="30" class="flex">
      <div class="relative flex min-w-0 flex-1">
        <CanvasSplitRoot />
        <ActiveRoomOverlay />
        <EditorToolbar />
        <IconButton
          v-if="rightPanelCollapsed"
          :label="editor.showRightPanel"
          class="absolute top-7 right-1.5 z-10 bg-panel"
          data-test-id="editor-show-right-panel"
          @click="showRightPanel"
        >
          <icon-lucide-panel-right-open class="size-3.5" />
        </IconButton>
      </div>
    </SplitterPanel>
    <SplitterResizeHandle
      data-test-id="right-splitter-handle"
      :class="horizontalSplitterStyles.handle()"
    >
      <div :class="horizontalSplitterStyles.divider()" />
    </SplitterResizeHandle>
    <SplitterPanel
      id="properties"
      ref="rightPanel"
      :default-size="editorLayout[2]"
      :min-size="10"
      :max-size="30"
      collapsible
      :collapsed-size="0"
      class="flex flex-col"
      @resize="rememberRightPanelSize"
      @collapse="rightPanelCollapsed = true"
      @expand="rightPanelCollapsed = false"
    >
      <div class="flex shrink-0 items-center gap-1 border-b border-border px-1.5 py-1.5">
        <CollabPanel class="min-w-0 flex-1" />
        <IconButton
          :label="
            editor.startPreview({
              shortcut: formatShortcut(appMenuShortcut('toggle-preview')) ?? ''
            })
          "
          data-test-id="editor-start-preview"
          @click="store.startPlay()"
        >
          <icon-lucide-play class="size-3.5" />
        </IconButton>
        <IconButton
          :label="editor.hideRightPanel"
          data-test-id="editor-hide-right-panel"
          @click="rightPanel?.collapse()"
        >
          <icon-lucide-panel-right-close class="size-3.5" />
        </IconButton>
      </div>
      <PropertiesPanel />
    </SplitterPanel>
  </SplitterGroup>

  <div
    v-else-if="isMobile && showChrome && store.state.showUI"
    :key="'mobile-' + tab.id"
    class="flex flex-1 overflow-hidden"
  >
    <div class="relative flex min-w-0 flex-1">
      <EditorCanvas />
      <ActiveRoomOverlay />
      <MobileHud />
      <EditorToolbar />
    </div>
    <MobileDrawer />
  </div>

  <div v-else-if="showChrome" :key="'collapsed-' + tab.id" class="flex flex-1 overflow-hidden">
    <div class="relative flex min-w-0 flex-1">
      <EditorCanvas />
      <ActiveRoomOverlay />
      <WorkspacePill
        v-if="!isMobile && canvasAlone"
        mode="preview"
        :document-name="store.state.documentName"
        :shortcut="formatShortcut(appMenuShortcut('toggle-preview')) ?? ''"
        @reset="store.resetPlay()"
        @leave="store.stopPlay()"
      />
      <WorkspacePill
        v-else-if="!isMobile"
        mode="collapsed"
        :document-name="store.state.documentName"
        :shortcut="formatShortcut(appMenuShortcut('toggle-ui')) ?? ''"
        @show-ui="store.state.showUI = true"
      />
    </div>
  </div>

  <div v-else :key="'bare-' + tab.id" class="flex flex-1 overflow-hidden">
    <div class="relative flex min-w-0 flex-1">
      <EditorCanvas />
      <ActiveRoomOverlay />
    </div>
  </div>

  <VariablesDialog />
  <StatusesDialog />
  <CommentDeleteDialog />
</template>
