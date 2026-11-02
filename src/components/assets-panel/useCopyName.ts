import { useClipboard } from '@vueuse/core'

import { useI18n } from '@open-pencil/vue/i18n'

import { toast } from '@/app/shell/ui'

/** Copies a name to the clipboard and says whether it worked. */
export function useCopyName(): (name: string) => Promise<void> {
  const { panels } = useI18n()
  const { copy, copied } = useClipboard({ legacy: true })
  return async (name) => {
    await copy(name)
    if (copied.value) toast.info(panels.value.nameCopied)
    else toast.error(panels.value.copyNameFailed)
  }
}
