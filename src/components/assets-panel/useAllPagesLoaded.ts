import { onBeforeUnmount, ref, type Ref } from 'vue'

import { isFigPagePending } from '@open-pencil/core/io/formats/fig'
import { useEditorEvent } from '@open-pencil/vue/editor/events'

import { useEditorStore } from '@/app/editor/active-store'
import { loadAllPages } from '@/app/editor/library/pages'

/**
 * Loads every page of the open document in the background while the library tabs are shown, so
 * they can list the whole file. A document that replaces the graph restarts the load for the
 * new one; closing the tab stops it. A page that fails to load is logged and skipped, so the
 * rest still load and nothing becomes an unhandled rejection.
 */
export function useAllPagesLoaded(): { loading: Ref<boolean>; pending: Ref<number> } {
  const editor = useEditorStore()
  const loading = ref(false)
  const pending = ref(0)
  let unmounted = false
  let run = 0

  const countPending = (graph: typeof editor.graph) =>
    graph.getPages().filter((page) => isFigPagePending(graph, page.id)).length

  async function start(graph: typeof editor.graph) {
    const id = ++run
    const current = () => id === run && !unmounted
    pending.value = countPending(graph)
    loading.value = pending.value > 0
    if (!loading.value) return
    try {
      await loadAllPages(
        {
          graph,
          loadPageNodes: async (pageId) => {
            try {
              await editor.loadPageNodes(pageId)
            } catch (error) {
              console.warn('[Library] Loading a document page failed', pageId, error)
            }
            if (current()) pending.value = countPending(graph)
          }
        },
        () => !current()
      )
    } finally {
      if (current()) {
        loading.value = false
        pending.value = 0
      }
    }
  }

  // The graph is replaced in place when a file is opened over this one, so the event, not the
  // reference, says to load the new document's pages.
  useEditorEvent('graph:replaced', () => void start(editor.graph))
  void start(editor.graph)

  onBeforeUnmount(() => {
    unmounted = true
  })

  return { loading, pending }
}
