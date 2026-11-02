import { sortBy } from 'es-toolkit'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

export interface LibraryItem {
  id: string
  name: string
  label: string
  pageId: string
  pageName: string
  group: string
  kind: 'component' | 'icon'
}

const ICON_NAME = /^[^/]+(\/[^/]+)+\/\d+x\d+$/
const ICON_PAGE = /^icons?$/i
const GENERIC_PREFIX = /^components?$/i

/** Icons live on a page named Icons, or are named `<set>/<icon>/<WxH>`. */
export function isIconComponent(name: string, pageName: string): boolean {
  return ICON_PAGE.test(pageName.trim()) || ICON_NAME.test(name)
}

/** The first segment after a generic `Component` prefix, the icon set for icons, else the page. */
export function componentGroup(name: string, pageName: string): string {
  const segments = name.split('/')
  if (segments.length < 2) return pageName
  if (ICON_NAME.test(name)) return segments.slice(0, -2).join('/')
  const [first = '', second = ''] = segments
  return (GENERIC_PREFIX.test(first) ? second : first) || pageName
}

function itemLabel(name: string, kind: LibraryItem['kind']): string {
  const segments = name.split('/')
  if (kind === 'icon') {
    return ICON_NAME.test(name) ? `${segments.at(-2)} · ${segments.at(-1)}` : name
  }
  if (segments.length < 2) return name
  const rest = GENERIC_PREFIX.test(segments[0] ?? '') ? segments.slice(1) : segments
  return rest.length > 1 ? rest.slice(1).join('/') : rest.join('/')
}

function pageItems(page: SceneNode, graph: SceneGraph): LibraryItem[] {
  const items: LibraryItem[] = []
  const visit = (node: SceneNode, parent: SceneNode) => {
    const isSet = node.type === 'COMPONENT_SET'
    if (isSet || (node.type === 'COMPONENT' && parent.type !== 'COMPONENT_SET')) {
      const kind = isIconComponent(node.name, page.name) ? 'icon' : 'component'
      items.push({
        id: node.id,
        name: node.name,
        label: itemLabel(node.name, kind),
        pageId: page.id,
        pageName: page.name,
        group: componentGroup(node.name, page.name),
        kind
      })
    }
    if (!isSet) for (const child of graph.getChildren(node.id)) visit(child, node)
  }
  for (const child of graph.getChildren(page.id)) visit(child, page)
  return items
}

/** Component sets and standalone components across all loaded pages, by group then name. */
export function libraryItems(graph: SceneGraph): LibraryItem[] {
  return sortBy(
    graph.getPages().flatMap((page) => pageItems(page, graph)),
    ['group', 'name']
  )
}
