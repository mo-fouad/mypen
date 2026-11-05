import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'
import { expectDefined } from '#tests/helpers/assert'

const editor = useEditorSetup('/?test')

test('right-clicking a frame name selects the frame and offers copy', async () => {
  const frame = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const outer = store.graph.createNode('FRAME', store.state.currentPageId, {
      name: 'Outer frame',
      x: 100,
      y: 100,
      width: 400,
      height: 300
    })
    // A child covering the whole frame, as a screen's layout does.
    store.graph.createNode('FRAME', outer.id, { name: 'Inner', width: 400, height: 300 })
    store.clearSelection()
    store.requestRender()
    const { zoom, panX, panY } = store.state
    return { id: outer.id, sx: 100 * zoom + panX, sy: 100 * zoom + panY }
  })
  await editor.canvas.waitForRender()

  const box = expectDefined(await editor.canvas.canvas.boundingBox(), 'canvas bounds')
  await editor.page.mouse.click(box.x + frame.sx + 10, box.y + frame.sy - 8, { button: 'right' })

  const selected = await editor.page.evaluate(() => [
    ...(window.openPencil?.getStore?.()?.state.selectedIds ?? [])
  ])
  expect(selected).toEqual([frame.id])
  await expect(editor.page.getByTestId('context-copy')).toBeEnabled()
})
