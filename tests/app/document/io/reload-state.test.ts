import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'

import { captureReloadState, restoreReloadState } from '@/app/document/io/reload-state'

describe('reload state', () => {
  test('switches back to the open page through the editor, so its layers load', async () => {
    const editor = createEditor()
    const second = editor.graph.addPage('Second')
    editor.state.currentPageId = second.id
    editor.state.zoom = 2
    const snapshot = captureReloadState(editor.state)
    editor.state.currentPageId = editor.graph.getPages()[0].id

    const switched: string[] = []
    const switchPage = editor.switchPage
    editor.switchPage = async (pageId, options) => {
      switched.push(pageId)
      await switchPage(pageId, options)
    }
    await restoreReloadState(editor, editor.state, snapshot)

    expect(switched).toEqual([second.id])
    expect(editor.state.currentPageId).toBe(second.id)
    expect(editor.state.zoom).toBe(2)
  })
})
