import { compact } from 'es-toolkit/array'
import { omit } from 'es-toolkit/object'
import { isEqual } from 'es-toolkit/predicate'

import type { NodeType, SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import { PROPERTY_FIELDS } from '../nodes'
import type { PenJSON } from '../schema'
import { penProperties, WRITTEN_PROPERTIES } from './properties'
import { changedFields, jsonChildren, penSourceOf, type PenSource } from './source'

/** A change the writer could not keep, so the file still has the layer as it was. */
export interface PenWriteIssue {
  nodeId: string
  /** The pen.dev property that changed, or `layer` for a layer the writer cannot write at all. */
  property: string
}

export interface PenWriteResult {
  /** The file's JSON: its own keys in its own order wherever the graph left them alone. */
  doc: PenJSON
  issues: PenWriteIssue[]
}

/** Layers whose children are drawn from elsewhere: an instance's from its component, an icon's glyph. */
const OPAQUE_TYPES = new Set(['ref', 'icon', 'icon_font'])

/** Layers reading leaves out of the graph, which writing keeps where the file had them. */
const UNREAD_TYPES = new Set(['prompt'])

const PEN_TYPES: Partial<Record<NodeType, string>> = {
  FRAME: 'frame',
  COMPONENT: 'frame',
  TEXT: 'text',
  RECTANGLE: 'rectangle',
  ELLIPSE: 'ellipse',
  POLYGON: 'polygon',
  GROUP: 'group',
  VECTOR: 'path'
}

const WRITTEN = new Set<string>(WRITTEN_PROPERTIES)

/** The pen.dev property each layer field is written by, for naming a change the writer drops. */
const PROPERTY_OF_FIELD = new Map<string, string>()
for (const [property, fields] of Object.entries(PROPERTY_FIELDS)) {
  for (const field of fields) {
    if (!PROPERTY_OF_FIELD.has(field)) PROPERTY_OF_FIELD.set(field, property)
  }
}
// Fields the written properties own are theirs, whichever property names them first.
for (const property of WRITTEN_PROPERTIES) {
  for (const field of PROPERTY_FIELDS[property]) PROPERTY_OF_FIELD.set(field, property)
}

interface Writer {
  graph: SceneGraph
  source: PenSource | undefined
  issues: PenWriteIssue[]
}

/** `pen` with `property` set, in its place if the layer had it, or left out when undefined. */
function withProperty(pen: PenJSON, property: string, value: unknown): PenJSON {
  return value === undefined ? omit(pen, [property]) : { ...pen, [property]: value }
}

/** Properties the writer cannot write yet that changed since reading, reported, not written. */
function reportUnwritten(writer: Writer, node: SceneNode, source: PenSource): void {
  const reported = new Set<string>()
  for (const field of changedFields(source, node)) {
    const property = PROPERTY_OF_FIELD.get(field) ?? field
    if (WRITTEN.has(property) || reported.has(property)) continue
    reported.add(property)
    writer.issues.push({ nodeId: node.id, property })
  }
}

/** The file's layer with the written properties that changed since reading taken from the graph. */
function updatedNode(writer: Writer, node: SceneNode, raw: PenJSON, source: PenSource): PenJSON {
  let pen: PenJSON = raw
  const before = source.properties.get(node.id)
  const now = penProperties(writer.graph, node)
  for (const property of WRITTEN_PROPERTIES) {
    if (!before || !isEqual(before[property], now[property])) {
      pen = withProperty(pen, property, now[property])
    }
  }
  reportUnwritten(writer, node, source)
  return pen
}

/** A layer the file did not have, written from the graph. */
function newNode(writer: Writer, node: SceneNode): PenJSON | null {
  const type = PEN_TYPES[node.type]
  if (!type) {
    writer.issues.push({ nodeId: node.id, property: 'layer' })
    return null
  }
  let pen: PenJSON =
    node.type === 'COMPONENT' ? { type, id: node.id, reusable: true } : { type, id: node.id }
  const properties = penProperties(writer.graph, node)
  for (const property of WRITTEN_PROPERTIES) pen = withProperty(pen, property, properties[property])
  return pen
}

/** The children the file had that reading left out, kept at their place among the written ones. */
function withUnread(written: PenJSON[], raw: PenJSON | undefined): PenJSON[] {
  const children = [...written]
  for (const [index, child] of (raw ? jsonChildren(raw) : []).entries()) {
    if (typeof child.type === 'string' && UNREAD_TYPES.has(child.type)) {
      children.splice(Math.min(index, children.length), 0, child)
    }
  }
  return children
}

function writeNode(writer: Writer, id: string): PenJSON | null {
  const node = writer.graph.getNode(id)
  if (!node) return null
  const { source } = writer
  const raw = source?.nodes.get(id)
  const pen = raw && source ? updatedNode(writer, node, raw, source) : newNode(writer, node)
  if (!pen) return null
  if (typeof pen.type === 'string' && OPAQUE_TYPES.has(pen.type)) return pen

  const children = compact(node.childIds.map((childId) => writeNode(writer, childId)))
  const kept = withUnread(children, raw)
  // The file's layer is kept as read; its children are a new list on a copy.
  return withProperty(
    pen,
    'children',
    kept.length > 0 || raw?.children !== undefined ? kept : undefined
  )
}

/**
 * The `.pen` file of `graph`. A graph read from a `.pen` file keeps the file: layers the person left
 * alone are written as the file had them, and only what changed is written from the graph, so
 * variables, components, and fields this editor does not read survive. Changes the writer cannot
 * write yet are reported in `issues` and left as the file had them.
 */
export function writePenDocument(graph: SceneGraph): PenWriteResult {
  const source = penSourceOf(graph)
  const writer: Writer = { graph, source, issues: [] }
  const pageId = source?.pageId ?? graph.getPages()[0]?.id
  const page = pageId ? graph.getNode(pageId) : undefined
  const children = compact((page?.childIds ?? []).map((id) => writeNode(writer, id)))
  const doc: PenJSON = source
    ? { ...source.file, children: withUnread(children, source.file) }
    : { version: '2.21', children }
  return { doc, issues: writer.issues }
}

/** `writePenDocument` as the text of a `.pen` file, indented as pen.dev writes it. */
export function writePenFile(graph: SceneGraph): { text: string; issues: PenWriteIssue[] } {
  const { doc, issues } = writePenDocument(graph)
  return { text: JSON.stringify(doc, null, 2), issues }
}
