<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import { computed, ref } from 'vue'

import { fontManager } from '@open-pencil/core/text'
import { useI18n } from '@open-pencil/vue/i18n'
import { vTestId } from '@open-pencil/vue/testing'

import { useEditorStore } from '@/app/editor/active-store'
import { openVariablesDialog } from '@/app/editor/tokens/dialog'
import { tokenSections, type TokenPanelRow } from '@/app/editor/tokens/panel'
import { toast } from '@/app/shell/ui'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppPlaceholder from '@/components/ui/feedback/AppPlaceholder.vue'
import Tip from '@/components/ui/overlay/Tip.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'
import SegmentedControl from '@/components/ui/select/SegmentedControl.vue'
import { VARIABLE_TYPE_ICONS } from '@/components/variables/type-icons'

const editor = useEditorStore()
const { panels } = useI18n()
const { copy, copied } = useClipboard({ legacy: true })

/** The mode shown per collection; view-only, so it never reaches the document or its history. */
const shownModes = ref<Record<string, string>>({})

const sections = computed(() => {
  void editor.state.sceneVersion
  return tokenSections(editor.graph, shownModes.value)
})

const fillTargets = computed(() => {
  void editor.state.sceneVersion
  return [...editor.state.selectedIds].filter(
    (id) => editor.graph.getNode(id)?.fills[0]?.type === 'SOLID'
  )
})

const rowButton = {
  color: 'neutral' as const,
  variant: 'ghost' as const,
  size: 'sm' as const
}

async function copyName(name: string) {
  await copy(name)
  if (copied.value) toast.info(panels.value.nameCopied)
  else toast.error(panels.value.copyNameFailed)
}

function applyToFill(variableId: string) {
  editor.undo.runBatch('Bind variable', () => {
    for (const id of fillTargets.value) editor.bindVariable(id, 'fills/0/color', variableId)
  })
}

/** Strings that name a font the editor has loaded are shown set in it. */
function fontFamily(row: TokenPanelRow): string | undefined {
  return row.type === 'STRING' && fontManager.isLoaded(row.display) ? row.display : undefined
}
</script>

<template>
  <section data-test-id="tokens-panel" class="flex min-h-0 flex-1 flex-col overflow-hidden">
    <div class="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
      <AppPlaceholder
        v-if="sections.every((section) => section.rows.length === 0)"
        data-test-id="tokens-empty"
        :label="panels.noTokens"
        size="compact"
      >
        <template #icon>
          <icon-lucide-swatch-book class="size-4" />
        </template>
      </AppPlaceholder>
      <template v-else>
        <PanelSection v-for="section in sections" :key="section.collectionId" :label="section.name">
          <SegmentedControl
            v-if="section.modes.length > 1"
            class="mb-1"
            :model-value="section.modeId"
            :options="section.modes.map((mode) => ({ value: mode.id, label: mode.name }))"
            :label="section.name"
            @change="shownModes = { ...shownModes, [section.collectionId]: $event }"
          >
            <template #option="{ option }">
              <span v-test-id="`token-mode-${option.value}`">{{ option.label }}</span>
            </template>
          </SegmentedControl>
          <ul class="flex flex-col">
            <li
              v-for="row in section.rows"
              :key="row.id"
              data-test-id="token-row"
              :data-token-id="row.id"
              class="group/token flex min-w-0 items-center gap-2 rounded px-1 py-0.5 hover:bg-hover"
            >
              <button
                type="button"
                class="flex min-w-0 flex-1 items-center gap-2 text-left outline-none focus-visible:ring-1 focus-visible:ring-panel-focus"
                @click="copyName(row.name)"
              >
                <span
                  v-if="row.color"
                  data-test-id="token-swatch"
                  class="size-4 shrink-0 rounded-sm border border-border"
                  :style="{ backgroundColor: row.color }"
                />
                <component
                  :is="VARIABLE_TYPE_ICONS[row.type]"
                  v-else
                  class="size-4 shrink-0 text-muted"
                />
                <span class="min-w-0 flex-1 truncate text-xs">
                  {{ row.name }}
                  <span v-if="row.aliasOf" class="text-muted">→ {{ row.aliasOf }}</span>
                </span>
                <span
                  class="max-w-24 shrink-0 truncate text-[11px] text-muted"
                  :style="{ fontFamily: fontFamily(row) }"
                >
                  {{ row.display }}
                </span>
              </button>
              <Tip
                v-if="row.type === 'COLOR' && fillTargets.length > 0"
                :label="panels.applyToFill"
              >
                <AppButton
                  v-bind="rowButton"
                  data-test-id="token-apply-fill"
                  :aria-label="panels.applyToFill"
                  class="opacity-0 group-focus-within/token:opacity-100 group-hover/token:opacity-100"
                  @click="applyToFill(row.id)"
                >
                  <icon-lucide-paint-bucket class="size-3.5" />
                </AppButton>
              </Tip>
            </li>
          </ul>
        </PanelSection>
      </template>
    </div>
    <footer class="shrink-0 border-t border-border p-2">
      <AppButton
        color="neutral"
        variant="ghost"
        size="sm"
        data-test-id="tokens-edit-in-variables"
        @click="openVariablesDialog(editor)"
      >
        <icon-lucide-square-arrow-out-up-right class="size-3.5" />
        {{ panels.editInVariables }}
      </AppButton>
    </footer>
  </section>
</template>
