import { afterEach, describe, expect, test } from 'bun:test'

import { copySelectionAsPNG } from '@/app/editor/clipboard/png'
import { createEditorStore } from '@/app/editor/session/create'

class FakeClipboardItem {
  constructor(readonly items: Record<string, Promise<Blob>>) {}
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'ClipboardItem')
  Reflect.deleteProperty(navigator, 'clipboard')
})

describe('copy as PNG', () => {
  test('starts the clipboard write before the image finishes rendering', async () => {
    const store = createEditorStore()
    let finishRender: (data: Uint8Array) => void = () => undefined
    store.renderExportImage = () =>
      new Promise((resolve) => {
        finishRender = resolve
      })
    const written: FakeClipboardItem[] = []
    Object.assign(globalThis, { ClipboardItem: FakeClipboardItem })
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        write: async (items: FakeClipboardItem[]) => {
          written.push(...items)
          await Promise.all(items.flatMap((item) => Object.values(item.items)))
        }
      }
    })

    const copied = copySelectionAsPNG(store, ['frame'])
    // WebKit drops a write that starts after the click or key press has been handled.
    expect(written).toHaveLength(1)

    finishRender(new Uint8Array([137, 80, 78, 71]))
    await copied
    const blob = await written[0]?.items['image/png']
    expect(blob?.type).toBe('image/png')
    expect([...new Uint8Array((await blob?.arrayBuffer()) ?? new ArrayBuffer(0))]).toEqual([
      137, 80, 78, 71
    ])
  })
})
