import type { Editor, EditorState } from '@open-pencil/core'
import type { ViewportTransform } from '@open-pencil/core/geometry'

export type ReloadStateSnapshot = {
  viewport: ViewportTransform
  pageId: string
}

export function captureReloadState(state: EditorState): ReloadStateSnapshot {
  return {
    viewport: { panX: state.panX, panY: state.panY, zoom: state.zoom },
    pageId: state.currentPageId
  }
}

export async function restoreReloadState(
  editor: Editor,
  state: EditorState,
  snapshot: ReloadStateSnapshot
) {
  editor.clearSelection()
  const pageId = editor.graph.getNode(snapshot.pageId)
    ? snapshot.pageId
    : (editor.graph.getPages()[0]?.id ?? editor.graph.rootId)
  // A reload reads only the first page's layers; switch through the editor so the page that was
  // open loads too, rather than showing it, and handing it to agents, as an empty page.
  await editor.switchPage(pageId)
  state.panX = snapshot.viewport.panX
  state.panY = snapshot.viewport.panY
  state.zoom = snapshot.viewport.zoom
}
