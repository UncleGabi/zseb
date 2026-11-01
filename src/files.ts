/**
 * Hands a text file to the user. On iPhone (and other devices that support it) this opens the share
 * sheet, where "Save to Files" works even from a Home Screen app; elsewhere it falls back to a download.
 * Resolves false when the user cancelled.
 */
export async function saveTextFile(name: string, text: string, type = 'application/json'): Promise<boolean> {
  const file = new File([text], name, { type })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name })
      return true
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return false
      // share failed for another reason: fall through to a download
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}
