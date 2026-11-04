import type { EditorStore } from '@/app/editor/active-store'
import { notificationMessages } from '@/app/i18n/notifications'
import { toast } from '@/app/shell/ui'

function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  const bytes = new Uint8Array(data.length)
  bytes.set(data)
  return bytes.buffer
}

/** Copy as PNG: the selection rendered at 2x onto the system clipboard, as in Figma. */
export async function copySelectionAsPNG(
  store: EditorStore,
  ids: string[] = [...store.state.selectedIds]
) {
  if (ids.length === 0) return
  const messages = notificationMessages.get()
  if (typeof ClipboardItem === 'undefined') {
    toast.error(messages.pngClipboardUnavailable)
    return
  }
  // WebKit, which runs the desktop app, only lets a clipboard write start inside the click or key
  // press, so the image goes in as a promise instead of being rendered before the write.
  const png = store.renderExportImage(ids, 2, 'PNG').then((data) => {
    if (!data) throw new Error('Nothing to render')
    return new Blob([toArrayBuffer(data)], { type: 'image/png' })
  })
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
    toast.info(messages.copiedAs({ format: 'PNG' }))
  } catch (error) {
    console.warn('Copy as PNG failed', error)
    toast.error(messages.clipboardAccessBlocked)
  }
}
