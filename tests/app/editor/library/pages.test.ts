import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { loadAllPages } from '@/app/editor/library/pages'
import type { FocusStore } from '@/app/editor/selection/focus'

function fakeStore(pageCount: number) {
  const graph = new SceneGraph()
  for (let i = graph.getPages().length; i < pageCount; i++) graph.addPage(`Page ${i + 1}`)
  const loaded: string[] = []
  const store: Pick<FocusStore, 'graph' | 'loadPageNodes'> = {
    graph,
    loadPageNodes: async (pageId) => {
      loaded.push(pageId)
    }
  }
  return { store, loaded, pageIds: graph.getPages().map((page) => page.id) }
}

describe('loadAllPages', () => {
  test('loads each page once, in order, without switching', async () => {
    const { store, loaded, pageIds } = fakeStore(3)
    expect(await loadAllPages(store, () => false)).toBe('done')
    expect(loaded).toEqual(pageIds)
  })

  test('stops when cancelled', async () => {
    const { store, loaded, pageIds } = fakeStore(3)
    expect(await loadAllPages(store, () => loaded.length >= 1)).toBe('cancelled')
    expect(loaded).toEqual([pageIds[0]])
  })
})
