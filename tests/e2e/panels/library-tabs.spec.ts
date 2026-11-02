import { readFile } from 'node:fs/promises'

import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

/** Builds a three-page file in the editor and returns its saved bytes. */
async function saveThreePageFile(page: Page) {
  await page.evaluate(async () => {
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
    const canvas = document.createElement('canvas')
    canvas.width = 4
    canvas.height = 4
    const context = canvas.getContext('2d')
    if (!context) throw new Error('2D context unavailable')
    context.fillStyle = '#e11d48'
    context.fillRect(0, 0, 4, 4)
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/png')
    })
    if (!blob) throw new Error('Could not encode the test image')
    const hash = '0123456789abcdef0123456789abcdef01234567'
    store.graph.images.set(hash, new Uint8Array(await blob.arrayBuffer()))
    store.graph.createNode('RECTANGLE', icons.id, {
      name: 'Hero photo',
      width: 40,
      height: 40,
      fills: [
        {
          type: 'IMAGE',
          imageHash: hash,
          imageScaleMode: 'FILL',
          color: { r: 0, g: 0, b: 0, a: 1 },
          visible: true,
          opacity: 1
        }
      ]
    })
    const more = store.graph.createNode('CANVAS', store.graph.rootId, { name: 'More' })
    store.graph.createNode('COMPONENT', more.id, {
      name: 'Component/Card/Wide',
      width: 200,
      height: 80
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
  return bytes
}

/** Opens saved bytes in the editor, so the file's pages load lazily. */
async function openSaved(page: Page, bytes: number[]) {
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
  const bytes = await saveThreePageFile(page)
  await openSaved(page, bytes)

  await page.getByTestId('left-panel-components-tab').click()
  const panel = page.getByTestId('assets-panel')
  // Every page has loaded, including the Icons page, before the icon filter is judged.
  await expect(panel.getByTestId('assets-loading-pages')).toBeHidden()
  const iconId = () =>
    page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      return (
        [...(store?.graph.nodes.values() ?? [])].find((node) => node.name === 'lucide/x/16x16')
          ?.id ?? null
      )
    })
  await expect.poll(iconId).not.toBeNull()
  const icon = await iconId()

  const group = panel.getByRole('region', { name: 'Button' })
  await expect(group).toBeVisible()
  const tile = group.getByTestId('asset-item').filter({ hasText: 'Primary' })
  await expect(tile).toHaveCount(1)
  await expect(panel.getByRole('region', { name: 'Card' })).toBeVisible()
  await expect(panel.locator(`[data-asset-id="${icon}"]`)).toHaveCount(0)
  await expect(panel.getByTestId('asset-item')).toHaveCount(2)

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

test('components tab lists a file reopened while it is open', async ({ page }) => {
  const canvas = new CanvasHelper(page)
  await page.goto('/?test')
  await canvas.waitForInit()
  const bytes = await saveThreePageFile(page)
  await page.getByTestId('left-panel-components-tab').click()
  const panel = page.getByTestId('assets-panel')
  await openSaved(page, bytes)

  await expect(panel.getByRole('region', { name: 'Card' })).toBeVisible()
  await expect(panel.getByTestId('assets-loading-pages')).toBeHidden()
  await expect(panel.getByTestId('asset-item')).toHaveCount(2)
  canvas.assertNoErrors()
})

test('assets tab shows icons and images and goes to an image', async ({ page }) => {
  const canvas = new CanvasHelper(page)
  await page.goto('/?test')
  await canvas.waitForInit()
  const bytes = await saveThreePageFile(page)
  await openSaved(page, bytes)

  await page.getByTestId('left-panel-assets-tab').click()
  const panel = page.getByTestId('assets-media-panel')
  await expect(panel).toBeVisible()
  await expect(panel.getByTestId('assets-loading-pages')).toBeHidden()

  // Icons and images sit on a page that was not open, so they appear once it has loaded.
  const icons = panel.getByTestId('icon-item')
  await expect(icons).toHaveCount(1)
  await expect(icons.first()).toHaveAttribute('aria-label', 'x · 16x16')
  await expect(panel.getByRole('region', { name: 'lucide' })).toBeVisible()
  const images = panel.getByTestId('image-item')
  await expect(images).toHaveCount(1)
  // Components belong to the Components tab.
  await expect(panel.getByTestId('asset-item')).toHaveCount(0)

  // Copy name copies the icon's full name.
  await page
    .context()
    .grantPermissions(['clipboard-read', 'clipboard-write'])
    .catch(() => undefined)
  await icons.first().hover()
  await panel.getByTestId('icon-copy-name').first().click()
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()).catch(() => null))
    .toBe('lucide/x/16x16')

  const startPage = await page.evaluate(() => window.openPencil?.getStore?.().state.currentPageId)
  await images.first().click()
  await expect
    .poll(() =>
      page.evaluate(() => {
        const store = window.openPencil?.getStore?.()
        const id = [...(store?.state.selectedIds ?? [])][0]
        const node = id ? store?.graph.getNode(id) : undefined
        const pageName = store?.graph.getNode(store.state.currentPageId)?.name
        return { selected: node?.name ?? null, pageName: pageName ?? null }
      })
    )
    .toEqual({ selected: 'Hero photo', pageName: 'Icons' })
  expect(startPage).not.toBe(
    await page.evaluate(() => window.openPencil?.getStore?.().state.currentPageId)
  )

  canvas.assertNoErrors()
})

test('assets tab shows an image no layer uses as disabled', async ({ page }) => {
  const canvas = new CanvasHelper(page)
  await page.goto('/?test')
  await canvas.waitForInit()
  await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.graph.images.set('fedcba9876543210fedcba9876543210fedcba98', new Uint8Array([1, 2, 3]))
    store.requestRender()
  })
  await page.getByTestId('left-panel-assets-tab').click()
  const image = page.getByTestId('assets-media-panel').getByTestId('image-item')
  await expect(image).toHaveCount(1)
  await expect(image).toHaveAttribute('aria-disabled', 'true')
  await expect(image.getByTestId('image-copy-name')).toHaveCount(0)
  canvas.assertNoErrors()
})
