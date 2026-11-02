import type { SceneGraph } from '@open-pencil/scene-graph'

export interface DocumentImage {
  hash: string
  /** Every loaded layer with an image fill of this hash, in document order. */
  nodeIds: string[]
  /** The page of the first of those layers, or null when none is loaded yet. */
  pageId: string | null
}

/** One entry per stored image, ordered by first use; images no loaded layer uses come last. */
export function documentImages(graph: SceneGraph): DocumentImage[] {
  const used = new Map<string, DocumentImage>()
  const visit = (nodeId: string, pageId: string) => {
    for (const node of graph.getChildren(nodeId)) {
      for (const fill of node.fills) {
        if (fill.type !== 'IMAGE' || !fill.imageHash) continue
        const entry = used.get(fill.imageHash) ?? {
          hash: fill.imageHash,
          nodeIds: [],
          pageId
        }
        // Nodes are visited once, so a layer with the same image twice repeats as the last push.
        if (entry.nodeIds.at(-1) !== node.id) entry.nodeIds.push(node.id)
        used.set(fill.imageHash, entry)
      }
      visit(node.id, pageId)
    }
  }
  for (const page of graph.getPages()) visit(page.id, page.id)

  const stored = [...graph.images.keys()]
  const usedFirst = [...used.values()].filter((entry) => graph.images.has(entry.hash))
  const unused = stored
    .filter((hash) => !used.has(hash))
    .map((hash): DocumentImage => ({ hash, nodeIds: [], pageId: null }))
  return [...usedFirst, ...unused]
}
