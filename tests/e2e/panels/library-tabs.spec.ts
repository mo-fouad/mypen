import { readFile } from 'node:fs/promises'

import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

/** Builds a two-page file in the editor, saves it, and reopens it so its pages load lazily. */
async function openTwoPageFile(page: Page) {
  await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const first = store.graph.getNode(store.state.currentPageId)
    if (!first) throw new Error('Current page missing')
    first.name = 'Components'
    store.graph.createNode('COMPONENT', first.id, {
      name: 'Component/Button/Primary',
      width: 96,
      height: 40
    })
    const icons = store.graph.createNode('CANVAS', store.graph.rootId, { name: 'Icons' })
    store.graph.createNode('COMPONENT', icons.id, {
      name: 'lucide/x/16x16',
      width: 16,
      height: 16
    })
  })
  const picker = await page.evaluateHandle(() => {
    const original = window.showSaveFilePicker
    window.showSaveFilePicker = undefined
    return {
      restore: () => {
        window.showSaveFilePicker = original
      }
    }
  })
  let bytes: number[]
  try {
    page.once('dialog', (dialog) => dialog.accept('Library.fig'))
    const download = page.waitForEvent('download')
    await page.evaluate(() => window.openPencil?.getStore?.().saveFigFileAs())
    bytes = [...(await readFile(await (await download).path()))]
  } finally {
    await picker.evaluate((handle) => handle.restore())
    await picker.dispose()
  }
  await page.evaluate(async (saved) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    await store.openFigFile(new File([new Uint8Array(saved)], 'Library.fig'))
  }, bytes)
}

test('components tab lists components without icons and goes to one', async ({ page }) => {
  const canvas = new CanvasHelper(page)
  await page.goto('/?test')
  await canvas.waitForInit()
  await openTwoPageFile(page)

  await page.getByTestId('left-panel-components-tab').click()
  const panel = page.getByTestId('assets-panel')
  const group = panel.getByRole('region', { name: 'Button' })
  await expect(group).toBeVisible()
  const tile = group.getByTestId('asset-item').filter({ hasText: 'Primary' })
  await expect(tile).toHaveCount(1)
  await expect(panel).not.toContainText('x · 16x16')
  await expect(panel.getByTestId('asset-item')).toHaveCount(1)

  await tile.click()
  await expect
    .poll(() =>
      page.evaluate(() => {
        const store = window.openPencil?.getStore?.()
        const id = [...(store?.state.selectedIds ?? [])][0]
        return id ? (store?.graph.getNode(id)?.name ?? null) : null
      })
    )
    .toBe('Component/Button/Primary')
  canvas.assertNoErrors()
})
