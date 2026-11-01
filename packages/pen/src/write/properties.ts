import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { layoutSizing, type LayoutSizingAxis } from '@open-pencil/scene-graph/layout'

/**
 * The pen.dev properties the writer writes from the graph, each as the value pen.dev stores, or
 * undefined where pen.dev leaves the property out.
 */
export interface PenProperties {
  name: string | undefined
  x: number | undefined
  y: number | undefined
  width: number | string | undefined
  height: number | string | undefined
  enabled: false | undefined
  opacity: number | undefined
}

export type PenProperty = keyof PenProperties

/** Whether the layer sits in its parent's auto layout, which places it, so it has no position. */
function inFlow(graph: SceneGraph, node: SceneNode): boolean {
  const parent = node.parentId ? graph.getNode(node.parentId) : undefined
  return (
    parent !== undefined &&
    parent.type !== 'CANVAS' &&
    parent.layoutMode !== 'NONE' &&
    node.layoutPositioning !== 'ABSOLUTE'
  )
}

/**
 * pen.dev's size along one axis: `fill_container` and `fit_content` for the sizes layout gives,
 * the number otherwise. Text that fits its content leaves the size out, as pen.dev writes it.
 */
function size(
  graph: SceneGraph,
  node: SceneNode,
  axis: LayoutSizingAxis
): number | string | undefined {
  const sizing = layoutSizing(graph, node, axis)
  if (sizing === 'FILL') return 'fill_container'
  if (sizing === 'HUG') return node.type === 'TEXT' ? undefined : 'fit_content'
  return axis === 'HORIZONTAL' ? node.width : node.height
}

/** The properties of `node` the writer writes, as pen.dev would store them. */
export function penProperties(graph: SceneGraph, node: SceneNode): PenProperties {
  const placed = !inFlow(graph, node)
  return {
    name: node.name,
    x: placed ? node.x : undefined,
    y: placed ? node.y : undefined,
    width: size(graph, node, 'HORIZONTAL'),
    height: size(graph, node, 'VERTICAL'),
    enabled: node.visible ? undefined : false,
    opacity: node.opacity === 1 ? undefined : node.opacity
  }
}

/** The pen.dev properties `penProperties` covers, in the order pen.dev writes them. */
export const WRITTEN_PROPERTIES = [
  'name',
  'x',
  'y',
  'width',
  'height',
  'enabled',
  'opacity'
] as const satisfies readonly PenProperty[]
