import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

import { isFigPagePending } from '@open-pencil/core/io/formats/fig'

import { useEditorStore } from '@/app/editor/active-store'
import { loadAllPages } from '@/app/editor/library/pages'

/**
 * Loads every page of the open document in the background while the library tabs are shown, so
 * they can list the whole file. Stops when the tab closes or another document replaces the
 * graph; a failed page ends the load without surfacing as an unhandled rejection.
 */
export function useAllPagesLoaded(): { loading: Ref<boolean>; pending: Ref<number> } {
  const editor = useEditorStore()
  const loading = ref(false)
  const pending = ref(0)
  let unmounted = false

  const countPending = (graph: typeof editor.graph) =>
    graph.getPages().filter((page) => isFigPagePending(graph, page.id)).length

  onMounted(async () => {
    const graph = editor.graph
    const cancelled = () => unmounted || editor.graph !== graph
    pending.value = countPending(graph)
    if (pending.value === 0) return
    loading.value = true
    try {
      await loadAllPages(
        {
          graph,
          loadPageNodes: async (pageId) => {
            await editor.loadPageNodes(pageId)
            pending.value = countPending(graph)
          }
        },
        cancelled
      )
    } catch (error) {
      console.warn('[Library] Loading the document pages failed', error)
    } finally {
      if (!unmounted) {
        loading.value = false
        pending.value = 0
      }
    }
  })

  onBeforeUnmount(() => {
    unmounted = true
  })

  return { loading, pending }
}
