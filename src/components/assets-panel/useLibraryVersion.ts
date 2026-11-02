import { refThrottled } from '@vueuse/core'
import { toRef, type Ref } from 'vue'

import { useEditorStore } from '@/app/editor/active-store'
import { LIBRARY_REFRESH_MS } from '@/constants'

/**
 * The scene version, at most once per `LIBRARY_REFRESH_MS`. Every render request bumps the raw
 * version (each drag or nudge step), and the library lists walk the whole graph, so they read
 * this instead; the trailing edge still fires, so the last edit and background page loads show.
 */
export function useLibraryVersion(): Ref<number> {
  const editor = useEditorStore()
  return refThrottled(toRef(editor.state, 'sceneVersion'), LIBRARY_REFRESH_MS)
}
