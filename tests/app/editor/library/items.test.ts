import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { componentGroup, isIconComponent, libraryItems } from '@/app/editor/library/items'

describe('isIconComponent', () => {
  test.each([
    ['lucide/search/18x18', 'Components', true],
    ['Material Symbols Rounded/home/24x24', 'Library', true],
    ['anything', 'Icons', true],
    ['Material Symbols/Rounded/home/24x24', 'Components', true],
    ['Component/CourseCardSmall/Dark', 'Components', false],
    ['Button', 'Design System', false]
  ])('%s on %s → %s', (name, page, expected) => expect(isIconComponent(name, page)).toBe(expected))
})

describe('componentGroup', () => {
  test('groups by the part after a generic Component prefix', () => {
    expect(componentGroup('Component/Button/Primary', 'Components')).toBe('Button')
    expect(componentGroup('Component/StatCard', 'Components')).toBe('StatCard')
  })
  test('groups a single-word name under its page', () => {
    expect(componentGroup('KPICard', 'Design System')).toBe('Design System')
  })
  test('groups an icon under its icon set', () => {
    expect(componentGroup('lucide/search/18x18', 'Icons')).toBe('lucide')
    expect(componentGroup('Material Symbols Rounded/home/24x24', 'Library')).toBe(
      'Material Symbols Rounded'
    )
  })
})

describe('four-part icon names', () => {
  test('group by set and label by icon and size', () => {
    expect(componentGroup('Material Symbols/Rounded/home/24x24', 'Components')).toBe(
      'Material Symbols/Rounded'
    )
    const graph = new SceneGraph()
    const page = graph.addPage('Components')
    graph.createNode('COMPONENT', page.id, { name: 'Material Symbols/Rounded/home/24x24' })
    expect(libraryItems(graph)[0]).toMatchObject({ kind: 'icon', label: 'home · 24x24' })
  })
  test('an empty segment after Component/ falls back to the page', () => {
    expect(componentGroup('Component/', 'Components')).toBe('Components')
  })
})

describe('libraryItems', () => {
  test('lists a component set once and skips its variants', () => {
    const graph = new SceneGraph()
    const page = graph.addPage('Components')
    const set = graph.createNode('COMPONENT_SET', page.id, { name: 'Component/Button' })
    graph.createNode('COMPONENT', set.id, { name: 'Variant=A' })
    graph.createNode('COMPONENT', set.id, { name: 'Variant=B' })
    const items = libraryItems(graph)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      id: set.id,
      kind: 'component',
      group: 'Button',
      label: 'Button'
    })
  })

  test('splits icons from components by page and name', () => {
    const graph = new SceneGraph()
    const icons = graph.addPage('Icons')
    const comps = graph.addPage('Components')
    graph.createNode('COMPONENT', icons.id, { name: 'lucide/search/18x18' })
    graph.createNode('COMPONENT', comps.id, { name: 'Component/CourseCardSmall/Dark' })
    const items = libraryItems(graph)
    expect(items.map((i) => [i.kind, i.group, i.label])).toEqual([
      ['component', 'CourseCardSmall', 'Dark'],
      ['icon', 'lucide', 'search · 18x18']
    ])
    expect(items[1]?.pageName).toBe('Icons')
  })

  test('keeps every size of one icon', () => {
    const graph = new SceneGraph()
    const icons = graph.addPage('Icons')
    for (const size of ['18x18', '14x14', '16x16'])
      graph.createNode('COMPONENT', icons.id, { name: `lucide/search/${size}` })
    expect(libraryItems(graph).map((i) => i.label)).toEqual([
      'search · 14x14',
      'search · 16x16',
      'search · 18x18'
    ])
  })
})

describe('libraryItems order', () => {
  test('sorts naturally and ignoring case', () => {
    const graph = new SceneGraph()
    const page = graph.addPage('Components')
    for (const name of ['Icon10', 'icon2', 'Icon1']) {
      graph.createNode('COMPONENT', page.id, { name })
    }
    for (const name of ['lucide/a/16x16', 'lucide/a/8x8']) {
      graph.createNode('COMPONENT', page.id, { name })
    }
    const names = libraryItems(graph).map((item) => item.name)
    expect(names.filter((n) => n.startsWith('Icon') || n.startsWith('icon'))).toEqual([
      'Icon1',
      'icon2',
      'Icon10'
    ])
    expect(names.filter((n) => n.startsWith('lucide'))).toEqual([
      'lucide/a/8x8',
      'lucide/a/16x16'
    ])
  })
})
