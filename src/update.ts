import { useSyncExternalStore } from 'react'

// Set when a new app version has been downloaded and is waiting; calling it reloads into the new version.
let apply: (() => void) | null = null
const listeners = new Set<() => void>()

export function setUpdateReady(fn: () => void) {
  apply = fn
  listeners.forEach((l) => l())
}

export function useUpdateReady(): (() => void) | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => apply,
  )
}
