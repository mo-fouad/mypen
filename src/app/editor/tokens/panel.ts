import { compact } from 'es-toolkit/array'

import type { SceneGraph, Variable, VariableType } from '@open-pencil/scene-graph'
import { colorToCSS, colorToHex } from '@open-pencil/scene-graph/color'

import { tokenValueText } from '@/app/editor/tokens/model'

export interface TokenPanelRow {
  id: string
  name: string
  type: VariableType
  display: string
  /** CSS color for a swatch; null for tokens that are not colors. */
  color: string | null
  /** Name of the variable this token points at in the shown mode. */
  aliasOf: string | null
}

export interface TokenPanelSection {
  collectionId: string
  name: string
  modes: { id: string; name: string }[]
  rows: TokenPanelRow[]
}

function panelRow(graph: SceneGraph, variable: Variable, modeId: string): TokenPanelRow {
  const stored = variable.valuesByMode[modeId]
  const target =
    typeof stored === 'object' && 'aliasId' in stored
      ? graph.variables.get(stored.aliasId)
      : undefined
  const resolved = graph.resolveVariable(variable.id, modeId)
  const color = typeof resolved === 'object' && 'r' in resolved ? resolved : undefined
  return {
    id: variable.id,
    name: variable.name,
    type: variable.type,
    display: color ? colorToHex(color) : tokenValueText(variable, resolved),
    color: color ? colorToCSS(color) : null,
    aliasOf: target?.name ?? null
  }
}

/** One section per collection, each token read in the chosen mode or the collection's default. */
export function tokenSections(
  graph: SceneGraph,
  modeByCollection: Record<string, string>
): TokenPanelSection[] {
  return [...graph.variableCollections.values()].map((collection) => {
    const modeId = modeByCollection[collection.id] ?? collection.defaultModeId
    const variables = compact(collection.variableIds.map((id) => graph.variables.get(id)))
    return {
      collectionId: collection.id,
      name: collection.name,
      modes: collection.modes.map((mode) => ({
        id: mode.modeId,
        name: mode.name
      })),
      rows: variables.map((variable) => panelRow(graph, variable, modeId))
    }
  })
}
