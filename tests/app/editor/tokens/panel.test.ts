import { describe, expect, test } from 'bun:test'

import { SceneGraph, type Variable, type VariableValue } from '@open-pencil/scene-graph'
import { parseColor } from '@open-pencil/scene-graph/color'

import { tokenSections } from '@/app/editor/tokens/panel'

function graphWith(variables: Array<[string, Variable['type'], Record<string, VariableValue>]>) {
  const graph = new SceneGraph()
  graph.addCollection({
    id: 'c',
    name: 'Theme',
    modes: [
      { modeId: 'light', name: 'Light' },
      { modeId: 'dark', name: 'Dark' }
    ],
    defaultModeId: 'light',
    variableIds: []
  })
  for (const [id, type, valuesByMode] of variables)
    graph.addVariable({
      id,
      name: id,
      type,
      collectionId: 'c',
      valuesByMode,
      description: '',
      hiddenFromPublishing: false
    })
  return graph
}

function onlyRow(graph: SceneGraph, modes: Record<string, string>, id: string) {
  const row = tokenSections(graph, modes)[0]?.rows.find((candidate) => candidate.id === id)
  if (!row) throw new Error(`missing ${id}`)
  return row
}

describe('tokenSections', () => {
  test('reads values for the chosen mode', () => {
    const graph = graphWith([
      ['bg', 'COLOR', { light: parseColor('#ffffff'), dark: parseColor('#000000') }]
    ])
    const before = structuredClone(graph.variables.get('bg'))
    const light = onlyRow(graph, {}, 'bg')
    const dark = onlyRow(graph, { c: 'dark' }, 'bg')
    expect(light.color).not.toBeNull()
    expect(dark.color).not.toBeNull()
    expect(light.color).not.toBe(dark.color)
    expect(light.color).toBe('rgb(255, 255, 255)')
    expect(dark.color).toBe('rgb(0, 0, 0)')
    expect(structuredClone(graph.variables.get('bg'))).toEqual(before)
    const section = tokenSections(graph, {})[0]
    expect(section?.modes).toEqual([
      { id: 'light', name: 'Light' },
      { id: 'dark', name: 'Dark' }
    ])
  })

  test('shows an alias by its target', () => {
    const graph = graphWith([
      ['A', 'COLOR', { light: parseColor('#3B2AA8'), dark: parseColor('#3B2AA8') }],
      ['B', 'COLOR', { light: { aliasId: 'A' }, dark: { aliasId: 'A' } }]
    ])
    const a = onlyRow(graph, {}, 'A')
    const b = onlyRow(graph, {}, 'B')
    expect(b.aliasOf).toBe('A')
    expect(b.color).toBe(a.color)
    expect(a.aliasOf).toBeNull()
  })

  test('formats numbers and strings', () => {
    const graph = graphWith([
      ['gap', 'FLOAT', { light: 12, dark: 12 }],
      ['font', 'STRING', { light: 'Inter', dark: 'Inter' }]
    ])
    expect(onlyRow(graph, {}, 'gap')).toMatchObject({
      display: '12',
      color: null
    })
    expect(onlyRow(graph, {}, 'font')).toMatchObject({
      display: 'Inter',
      color: null
    })
  })

  test('lists rows in the collection variableIds order', () => {
    const graph = graphWith([
      ['first', 'FLOAT', { light: 1, dark: 1 }],
      ['second', 'FLOAT', { light: 2, dark: 2 }],
      ['third', 'FLOAT', { light: 3, dark: 3 }]
    ])
    const collection = graph.variableCollections.get('c')
    if (!collection) throw new Error('missing collection')
    collection.variableIds = ['third', 'first', 'second']
    expect(tokenSections(graph, {})[0]?.rows.map((row) => row.id)).toEqual([
      'third',
      'first',
      'second'
    ])
  })
})

describe('tokenSections modes and empty collections', () => {
  test('reports the mode used and skips empty collections', () => {
    const graph = graphWith([['bg', 'COLOR', { light: parseColor('#fff'), dark: parseColor('#000') }]])
    graph.addCollection({
      id: 'empty',
      name: 'Empty',
      modes: [{ modeId: 'm', name: 'Mode 1' }],
      defaultModeId: 'm',
      variableIds: []
    })
    const sections = tokenSections(graph, {})
    expect(sections.map((section) => section.collectionId)).toEqual(['c'])
    expect(sections[0]?.modeId).toBe('light')
    expect(tokenSections(graph, { c: 'dark' })[0]?.modeId).toBe('dark')
  })
})
