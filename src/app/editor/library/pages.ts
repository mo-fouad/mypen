import type { FocusStore } from '@/app/editor/selection/focus'

/**
 * Loads every page's layers without showing any page, so the library tabs can list the whole
 * document. Pages load one at a time through the editor's own loader; never populate them all
 * at once, which misorders children. `cancelled` is checked before each page.
 */
export async function loadAllPages(
  store: Pick<FocusStore, 'graph' | 'loadPageNodes'>,
  cancelled: () => boolean
): Promise<'done' | 'cancelled'> {
  for (const page of store.graph.getPages()) {
    if (cancelled()) return 'cancelled'
    await store.loadPageNodes(page.id)
  }
  return 'done'
}
