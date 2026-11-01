import { uniq } from 'es-toolkit/array'
import { isEqual } from 'es-toolkit/predicate'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import { PROPERTY_FIELDS } from '../nodes'
import type { PenDocument, PenJSON } from '../schema'
import { penProperties, type PenProperties } from './properties'

/** A layer's own fields, as they were once the document was read. */
export type SceneSnapshot = Partial<Record<keyof SceneNode, unknown>>

/**
 * The file a graph was read from, so writing it keeps what the graph does not hold: every layer
 * the person left alone is written as the file had it, and only what they changed is written from
 * the graph. Layers are kept as the file's own JSON, in its key order and older forms.
 */
export interface PenSource {
  file: PenJSON
  /** The page the document's layers are on. */
  pageId: string
  /** Each layer the file holds, by its pen.dev ID; layers an instance shows are not among them. */
  nodes: Map<string, PenJSON>
  /** The properties the writer writes, as each layer had them once read. */
  properties: Map<string, PenProperties>
  /** Every field the file's properties set, as each layer had them once read. */
  fields: Map<string, SceneSnapshot>
}

const sources = new WeakMap<SceneGraph, PenSource>()
const fileJSON = new WeakMap<PenDocument, PenJSON>()

const SNAPSHOT_FIELDS = uniq(Object.values(PROPERTY_FIELDS).flat())

function snapshotFields(node: SceneNode): SceneSnapshot {
  return Object.fromEntries(SNAPSHOT_FIELDS.map((field) => [field, structuredClone(node[field])]))
}

const isJSON = (value: unknown): value is PenJSON =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** The layers in a JSON `children` array. */
export function jsonChildren(node: PenJSON): PenJSON[] {
  return Array.isArray(node.children) ? node.children.filter(isJSON) : []
}

function collectNodes(nodes: PenJSON[], into: Map<string, PenJSON>): void {
  for (const node of nodes) {
    if (typeof node.id === 'string') into.set(node.id, node)
    collectNodes(jsonChildren(node), into)
  }
}

/** Keeps the JSON `doc` was validated from, so writing can keep the file's own form. */
export function rememberFileJSON(doc: PenDocument, json: PenJSON): void {
  fileJSON.set(doc, json)
}

/** Remembers that `graph` was read from `doc`, once it is fully built. */
export function recordPenSource(graph: SceneGraph, doc: PenDocument, pageId: string): void {
  const file = fileJSON.get(doc) ?? doc
  const nodes = new Map<string, PenJSON>()
  collectNodes(jsonChildren(file), nodes)
  const properties = new Map<string, PenProperties>()
  const fields = new Map<string, SceneSnapshot>()
  for (const id of nodes.keys()) {
    const node = graph.getNode(id)
    if (!node) continue
    properties.set(id, penProperties(graph, node))
    fields.set(id, snapshotFields(node))
  }
  sources.set(graph, { file, pageId, nodes, properties, fields })
}

/** The file `graph` was read from, or undefined for a graph no `.pen` file made. */
export function penSourceOf(graph: SceneGraph): PenSource | undefined {
  return sources.get(graph)
}

/** The fields of `node` that differ from how the file had them. */
export function changedFields(source: PenSource, node: SceneNode): Set<keyof SceneNode> {
  const before = source.fields.get(node.id)
  const changed = new Set<keyof SceneNode>()
  if (!before) return changed
  for (const field of SNAPSHOT_FIELDS) {
    if (!isEqual(before[field], node[field])) changed.add(field)
  }
  return changed
}
