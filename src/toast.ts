import { useSyncExternalStore } from 'react'

// One snackbar at a time; a new message replaces the current one.

export interface Toast {
  id: number
  message: string
  action?: { label: string; run: () => void }
}

let current: Toast | null = null
let timer: ReturnType<typeof setTimeout> | undefined
let nextId = 1
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

/** Shows a snackbar. Ones with an action (e.g. Undo) stay a little longer. */
export function showToast(message: string, action?: Toast['action'], ms = action ? 6000 : 3000) {
  clearTimeout(timer)
  current = { id: nextId++, message, action }
  emit()
  timer = setTimeout(dismissToast, ms)
}

export function dismissToast() {
  clearTimeout(timer)
  current = null
  emit()
}

export function useToast(): Toast | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => current,
  )
}
