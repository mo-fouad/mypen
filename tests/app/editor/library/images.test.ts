import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'
import type { Fill } from '@open-pencil/scene-graph'

import { documentImages } from '@/app/editor/library/images'

function imageFill(imageHash: string): Fill {
  return {
    type: 'IMAGE',
    color: { r: 0, g: 0, b: 0, a: 1 },
    opacity: 1,
    visible: true,
    imageHash
  }
}

describe('documentImages', () => {
  test('finds images inside components and on other pages', () => {
    const graph = new SceneGraph()
    graph.addPage('One')
    const page2 = graph.addPage('Two')
    const component = graph.createNode('COMPONENT', page2.id, { name: 'Card' })
    const rect = graph.createNode('RECTANGLE', component.id, { fills: [imageFill('abc')] })
    graph.images.set('abc', new Uint8Array([1]))
    expect(documentImages(graph)).toEqual([{ hash: 'abc', nodeIds: [rect.id], pageId: page2.id }])
  })

  test('keeps an image no loaded layer uses yet, with no page', () => {
    const graph = new SceneGraph()
    graph.addPage('One')
    graph.images.set('orphan', new Uint8Array([1]))
    expect(documentImages(graph)).toEqual([{ hash: 'orphan', nodeIds: [], pageId: null }])
  })

  test('orders by first use, then unused images', () => {
    const graph = new SceneGraph()
    const page = graph.addPage('One')
    graph.images.set('unused', new Uint8Array([1]))
    graph.images.set('b', new Uint8Array([2]))
    graph.images.set('a', new Uint8Array([3]))
    const first = graph.createNode('RECTANGLE', page.id, { fills: [imageFill('a')] })
    const second = graph.createNode('RECTANGLE', page.id, { fills: [imageFill('b')] })
    const third = graph.createNode('RECTANGLE', page.id, { fills: [imageFill('a')] })
    expect(documentImages(graph).map((i) => i.hash)).toEqual(['a', 'b', 'unused'])
    expect(documentImages(graph)[0]?.nodeIds).toEqual([first.id, third.id])
    expect(documentImages(graph)[1]?.nodeIds).toEqual([second.id])
  })
})
