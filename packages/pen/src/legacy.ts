import type { PenDocument, PenNode, PenOverride } from './schema'

/** The icon font pen.dev 2.8 draws an `icon_font` layer from when it names none. */
const DEFAULT_ICON_FONT = 'Material Symbols Sharp'

/**
 * A layer or override as pen.dev 2.21 writes it: 2.8's `icon_font` layer, which names its glyph in
 * `iconFontName` and its library in `iconFontFamily`, is an `icon` layer naming them in `icon` and
 * `library`, so it is drawn and loaded as an icon rather than as text in a font no host has.
 */
function upgradeOverride<T extends PenOverride>(node: T): T {
  const { iconFontName, iconFontFamily, ...rest } = node
  const isIconFont = node.type === 'icon_font'
  const upgraded: PenOverride = { ...rest }
  if (isIconFont) {
    upgraded.type = 'icon'
    upgraded.library = iconFontFamily ?? DEFAULT_ICON_FONT
  } else if (iconFontFamily !== undefined) {
    upgraded.library = iconFontFamily
  }
  if (iconFontName !== undefined) upgraded.icon = iconFontName
  if (node.children) upgraded.children = node.children.map(upgradeOverride)
  if (node.descendants) {
    upgraded.descendants = Object.fromEntries(
      Object.entries(node.descendants).map(([id, override]) => [id, upgradeOverride(override)])
    )
  }
  return upgraded as T
}

/** `doc` with the layers older versions of pen.dev wrote in the form 2.21 writes them. */
export function upgradeLegacyNodes(doc: PenDocument): PenDocument {
  return { ...doc, children: doc.children.map((node: PenNode) => upgradeOverride(node)) }
}
