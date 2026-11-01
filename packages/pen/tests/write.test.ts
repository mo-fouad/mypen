import { describe, expect, test } from 'bun:test'

import { parsePenFile, writePenDocument, writePenFile, type PenNode } from '@open-pencil/pen'
import { SceneGraph } from '@open-pencil/scene-graph'

import { getNodeOrThrow } from './helpers/assert'
import { parseDocument } from './helpers/document'

const card: PenNode = {
  id: 'card',
  type: 'frame',
  name: 'Card',
  x: 40,
  y: 60,
  width: 320,
  layout: 'vertical',
  gap: '$space',
  fill: '$surface',
  metadata: { type: 'unsplash', author: 'Someone' },
  children: [
    { id: 'title', type: 'text', content: 'Hello', fill: '#111111', fontFamily: '$font' },
    { id: 'note', type: 'prompt', content: 'make it pop' },
    { id: 'body', type: 'text', content: 'World', width: 'fill_container' },
    { id: 'heart', type: 'icon', library: 'lucide', icon: 'heart', width: 16, height: 16 }
  ]
}

const variables = {
  space: { type: 'number', value: 12 },
  surface: { type: 'color', value: '#FFFFFF' },
  font: { type: 'string', value: 'Inter' }
}

function read(children: PenNode[] = [card]) {
  return parseDocument(children, { variables, fileToken: 'abc' })
}

function written(graph: SceneGraph) {
  return writePenDocument(graph)
}

type JSONLayer = Record<string, unknown>

const layers = (value: unknown): JSONLayer[] =>
  Array.isArray(value)
    ? value.filter((item): item is JSONLayer => typeof item === 'object' && item !== null)
    : []

function child(doc: JSONLayer, ...ids: string[]): JSONLayer | undefined {
  let nodes = layers(doc.children)
  let found: JSONLayer | undefined
  for (const id of ids) {
    found = nodes.find((node) => node.id === id)
    nodes = layers(found?.children)
  }
  return found
}

describe('writePenDocument', () => {
  test('writes a document no one changed as the file had it, key for key', () => {
    const file = JSON.stringify(
      { version: '2.21', variables, fileToken: 'abc', children: [card] },
      null,
      2
    )
    const { text, issues } = writePenFile(read())
    expect(text).toBe(file)
    expect(issues).toEqual([])
  })

  test('leaves the file it keeps untouched, so writing again writes the same', () => {
    const graph = read()
    graph.deleteNode('title')
    const first = writePenFile(graph).text
    graph.updateNode('card', { name: 'Renamed' })
    graph.updateNode('card', { name: 'Card' })
    expect(writePenFile(graph).text).toBe(first)
  })

  test('keeps the older form of a layer it reads in the newer one', () => {
    const glyph = { type: 'icon_font', id: 'g', iconFontName: 'heart', iconFontFamily: 'lucide' }
    const file = JSON.stringify({ version: '2.8', children: [glyph] }, null, 2)
    expect(writePenFile(parsePenFile(file)).text).toBe(file)
  })

  test('writes the file text with the indent pen.dev uses', () => {
    const { text } = writePenFile(read())
    expect(text.startsWith('{\n  "version": "2.21"')).toBe(true)
    expect(text.endsWith('}')).toBe(true)
  })

  test('writes only the property a person changed', () => {
    const graph = read()
    graph.updateNode('title', { name: 'Headline' })
    graph.updateNode('card', { x: 100 })
    const { doc, issues } = written(graph)
    expect(child(doc, 'card', 'title')).toEqual({
      ...card.children?.[0],
      name: 'Headline'
    })
    expect(child(doc, 'card')).toMatchObject({ x: 100, y: 60, gap: '$space', fill: '$surface' })
    expect(issues).toEqual([])
  })

  test('writes a fixed size as a number and keeps fill and fit sizing as pen.dev names them', () => {
    const graph = read()
    graph.updateNode('card', { width: 400 })
    const { doc } = written(graph)
    expect(child(doc, 'card')?.width).toBe(400)
    expect(child(doc, 'card', 'body')?.width).toBe('fill_container')
    expect(child(doc, 'card')?.height).toBeUndefined()
  })

  test('writes hiding a layer as pen.dev does, and showing it again drops the field', () => {
    const graph = read()
    graph.updateNode('body', { visible: false, opacity: 0.5 })
    expect(child(written(graph).doc, 'card', 'body')).toMatchObject({
      enabled: false,
      opacity: 0.5
    })
    graph.updateNode('body', { visible: true, opacity: 1 })
    const body = child(written(graph).doc, 'card', 'body')
    expect(body?.enabled).toBeUndefined()
    expect(body?.opacity).toBeUndefined()
  })

  test('drops deleted layers and follows the new order, keeping layers reading skips', () => {
    const graph = read()
    graph.deleteNode('title')
    graph.insertChildAt('heart', 'card', 0)
    const ids = layers(child(written(graph).doc, 'card')?.children).map((node) => node.id)
    expect(ids).toEqual(['heart', 'note', 'body'])
  })

  test('keeps an icon as its glyph, not the paths drawn for it', () => {
    const graph = read()
    graph.createNode('VECTOR', 'heart', { name: 'glyph' })
    expect(child(written(graph).doc, 'card', 'heart')).toEqual({ ...card.children?.[3] })
  })

  test('reports a change it cannot write yet and keeps the file value', () => {
    const graph = read()
    graph.updateNode('title', { text: 'Changed' })
    const { doc, issues } = written(graph)
    expect(child(doc, 'card', 'title')?.content).toBe('Hello')
    expect(issues).toEqual([{ nodeId: 'title', property: 'content' }])
  })

  test('writes a new layer with its type, place, and size', () => {
    const graph = read()
    const page = graph.getPages()[0]
    const added = graph.createNode('RECTANGLE', page?.id ?? '', {
      name: 'Box',
      x: 5,
      y: 6,
      width: 7,
      height: 8
    })
    expect(child(written(graph).doc, added.id)).toEqual({
      type: 'rectangle',
      id: added.id,
      name: 'Box',
      x: 5,
      y: 6,
      width: 7,
      height: 8
    })
  })

  test('writes a graph no .pen file made as a new document', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const frame = graph.createNode('FRAME', page?.id ?? '', {
      name: 'Screen',
      width: 390,
      height: 844
    })
    const { doc } = written(graph)
    expect(doc.version).toBe('2.21')
    expect(doc.children).toEqual([
      { type: 'frame', id: frame.id, name: 'Screen', x: 0, y: 0, width: 390, height: 844 }
    ])
    expect(getNodeOrThrow(graph, frame.id).name).toBe('Screen')
  })
})
