import { useSyncExternalStore } from 'react'
import {
  DEFAULT_SHARES,
  configFor,
  emptyState,
  migrate,
  monthOf,
  todayISO,
  type AppState,
  type Category,
  type Expense,
  type Goal,
  type MonthConfig,
  type SpendBucketId,
} from './domain'

// The key keeps its old name; the schema version lives inside the data (see migrate()).
const KEY = 'cost-tracker-v1'

/** Set when saved data existed but could not be read. A copy of it is kept under `key`. */
export interface LoadProblem {
  key: string
  message: string
}
let loadProblem: LoadProblem | null = null

function load(): AppState {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(KEY)
  } catch {
    return emptyState() // storage blocked (private mode)
  }
  if (!raw) return emptyState()
  try {
    return parse(raw)
  } catch (err) {
    // Never let the next save overwrite data we could not read: park a copy first.
    const key = `${KEY}-unreadable-${Date.now()}`
    try {
      localStorage.setItem(key, raw)
    } catch {
      // quota full: the copy cannot be kept, the problem is still reported
    }
    loadProblem = { key, message: err instanceof Error ? err.message : String(err) }
    return emptyState()
  }
}

/** Validates and upgrades imported or stored JSON. Throws on anything that is not this app's data. */
export function parse(raw: string): AppState {
  return migrate(JSON.parse(raw))
}

let state: AppState = load()
let selectedMonth = monthOf(todayISO())
const listeners = new Set<() => void>()

// useSyncExternalStore needs a stable snapshot between changes.
let snapshot: { state: AppState; selectedMonth: string; loadProblem: LoadProblem | null } = { state, selectedMonth, loadProblem }

function commit(next: Partial<Pick<typeof snapshot, 'state' | 'selectedMonth'>>) {
  if (next.state) {
    state = next.state
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      // ignore quota or private-mode errors; the JSON backup is the safety net
    }
  }
  if (next.selectedMonth) selectedMonth = next.selectedMonth
  snapshot = { state, selectedMonth, loadProblem }
  listeners.forEach((l) => l())
}

export function useStore() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => snapshot,
  )
}

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

export const actions = {
  selectMonth: (ym: string) => commit({ selectedMonth: ym }),

  saveExpense(e: Omit<Expense, 'id'> & { id?: string }) {
    const expense: Expense = { ...e, id: e.id ?? newId() }
    const exists = state.expenses.some((x) => x.id === expense.id)
    const expenses = exists
      ? state.expenses.map((x) => (x.id === expense.id ? expense : x))
      : [...state.expenses, expense]
    commit({ state: { ...state, expenses } })
  },

  deleteExpense: (id: string) =>
    commit({ state: { ...state, expenses: state.expenses.filter((x) => x.id !== id) } }),

  /** Creates or updates the explicit record for a month. Later months without a record inherit it. */
  saveMonth(ym: string, patch: Partial<MonthConfig>) {
    const current = configFor(state, ym)
    const next: MonthConfig = { ...current, ...patch }
    commit({ state: { ...state, months: { ...state.months, [ym]: next } } })
  },

  setOpening: (bucket: SpendBucketId, amount: number) =>
    commit({ state: { ...state, opening: { ...state.opening, [bucket]: amount } } }),

  addCategory(name: string, bucket: SpendBucketId) {
    const category: Category = { id: newId(), name, bucket }
    commit({ state: { ...state, categories: [...state.categories, category] } })
  },

  updateCategory: (id: string, patch: Partial<Pick<Category, 'name' | 'bucket'>>) =>
    commit({
      state: {
        ...state,
        categories: state.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      },
    }),

  /** Returns false when expenses still use the category. */
  deleteCategory(id: string): boolean {
    if (state.expenses.some((e) => e.categoryId === id)) return false
    commit({ state: { ...state, categories: state.categories.filter((c) => c.id !== id) } })
    return true
  },

  saveGoal(g: Omit<Goal, 'id'> & { id?: string }) {
    const goal: Goal = { ...g, id: g.id ?? newId() }
    const goals = state.goals.some((x) => x.id === goal.id)
      ? state.goals.map((x) => (x.id === goal.id ? goal : x))
      : [...state.goals, goal]
    commit({ state: { ...state, goals } })
  },

  deleteGoal: (id: string) => commit({ state: { ...state, goals: state.goals.filter((g) => g.id !== id) } }),

  exportJSON: () => JSON.stringify(state, null, 2),

  markBackedUp: () => commit({ state: { ...state, lastBackupAt: todayISO() } }),

  /** The raw text of data that could not be read at startup, for exporting it. */
  unreadableCopy: (): string | null => {
    try {
      return loadProblem ? localStorage.getItem(loadProblem.key) : null
    } catch {
      return null
    }
  },

  dismissLoadProblem() {
    loadProblem = null
    commit({})
  },

  importJSON(raw: string) {
    commit({ state: parse(raw) })
  },
}

export { DEFAULT_SHARES }

// Ask the browser not to evict our data when storage is tight.
navigator.storage?.persist?.().catch(() => {})
