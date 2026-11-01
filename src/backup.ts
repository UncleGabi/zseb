import { todayISO } from './domain'
import { saveTextFile } from './files'
import { actions } from './store'
import { showToast } from './toast'

/** Exports all data as a JSON file (share sheet on iPhone) and remembers the date when it went through. */
export async function exportBackup() {
  const saved = await saveTextFile(`zseb-backup-${todayISO()}.json`, actions.exportJSON())
  if (!saved) return
  actions.markBackedUp()
  showToast('Backup created. Keep it in Files or iCloud Drive.')
}

/** Exports the copy of data that could not be read at startup, so nothing is lost. */
export async function exportUnreadableCopy() {
  const raw = actions.unreadableCopy()
  if (!raw) return showToast('The unreadable copy could not be found')
  if (await saveTextFile(`zseb-unreadable-${todayISO()}.json`, raw)) showToast('Copy exported')
}
