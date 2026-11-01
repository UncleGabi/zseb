// Pure budget logic: no React, no storage. Everything on screen is derived from AppState.
// Amounts are whole HUF. Months are 'YYYY-MM' strings, dates are 'YYYY-MM-DD'.

export type BucketId = 'fixed' | 'wellbeing' | 'investment'
/** Buckets that hold expenses and roll over. Investment is only a monthly transfer. */
export type SpendBucketId = 'fixed' | 'wellbeing'

export const BUCKETS: { id: BucketId; name: string }[] = [
  { id: 'fixed', name: 'Fixed costs' },
  { id: 'wellbeing', name: 'Well-being' },
  { id: 'investment', name: 'Investment' },
]
export const SPEND_BUCKETS: SpendBucketId[] = ['fixed', 'wellbeing']

export type Shares = Record<BucketId, number>
export const DEFAULT_SHARES: Shares = { fixed: 50, wellbeing: 30, investment: 20 }

export interface Category {
  id: string
  name: string
  bucket: SpendBucketId
}

export interface Expense {
  id: string
  date: string
  amount: number
  categoryId: string
  note: string
  /** Annual or periodic cost: the amount is charged in equal parts over this many months, starting with the month of `date`. */
  spreadMonths?: number
  /** The spread cost renews every `spreadMonths` months (annual cost: every year). */
  repeatYearly?: boolean
  /** Monthly cost (rent, subscription): the full amount is charged every month. A renewal is one month. */
  repeatMonthly?: boolean
  /** Last renewal (0 = the first) that is still charged; unset means it renews until stopped. */
  lastYear?: number
  /** New amounts from a renewal onward (renewal 0 is `amount` itself). Earlier renewals keep their amount. */
  priceChanges?: { year: number; amount: number }[]
}

export interface MonthConfig {
  salary: number
  shares: Shares
  /** The investment transfer for this month has been made. */
  transferred: boolean
}

/** A savings goal inside a bucket (e.g. a May trip): money is set aside in equal parts until the target month. */
export interface Goal {
  id: string
  name: string
  bucket: SpendBucketId
  target: number
  /** First month money is set aside. */
  startMonth: string
  /** Month the money is needed in; the last month of setting aside. */
  targetMonth: string
  /** Reached or cancelled: no longer reserves money. */
  done?: boolean
}

export const SCHEMA_VERSION = 2

export interface AppState {
  version: typeof SCHEMA_VERSION
  categories: Category[]
  expenses: Expense[]
  /** Explicit month records. A month without one inherits the latest earlier record. */
  months: Record<string, MonthConfig>
  /** Balance each spend bucket starts with in the first configured month. */
  opening: Record<SpendBucketId, number>
  goals: Goal[]
  /** Date (YYYY-MM-DD) of the last successful backup export. */
  lastBackupAt?: string
}

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'invoice', name: 'Invoice', bucket: 'fixed' },
  { id: 'rent', name: 'Rent / mortgage', bucket: 'fixed' },
  { id: 'utilities', name: 'Utilities', bucket: 'fixed' },
  { id: 'phone-internet', name: 'Phone & internet', bucket: 'fixed' },
  { id: 'insurance', name: 'Insurance', bucket: 'fixed' },
  { id: 'credit', name: 'Credit instalment', bucket: 'fixed' },
  { id: 'subscription', name: 'Subscription', bucket: 'fixed' },
  { id: 'car', name: 'Car', bucket: 'fixed' },
  { id: 'transport', name: 'Transport', bucket: 'fixed' },
  { id: 'health', name: 'Health', bucket: 'fixed' },
  { id: 'groceries', name: 'Groceries', bucket: 'fixed' },
  { id: 'shopping', name: 'Shopping', bucket: 'fixed' },
  { id: 'taxes-fees', name: 'Taxes & fees', bucket: 'fixed' },
  { id: 'other-fixed', name: 'Other', bucket: 'fixed' },
  { id: 'travel', name: 'Travel', bucket: 'wellbeing' },
  { id: 'eating-out', name: 'Eating out', bucket: 'wellbeing' },
  { id: 'coffee-snacks', name: 'Coffee & snacks', bucket: 'wellbeing' },
  { id: 'massage', name: 'Massage', bucket: 'wellbeing' },
  { id: 'gym-sports', name: 'Gym & sports', bucket: 'wellbeing' },
  { id: 'hobbies', name: 'Hobbies', bucket: 'wellbeing' },
  { id: 'entertainment', name: 'Entertainment', bucket: 'wellbeing' },
  { id: 'clothing', name: 'Clothing', bucket: 'wellbeing' },
  { id: 'beauty', name: 'Beauty', bucket: 'wellbeing' },
  { id: 'gifts', name: 'Gifts', bucket: 'wellbeing' },
  { id: 'learning', name: 'Books & learning', bucket: 'wellbeing' },
  { id: 'pets', name: 'Pets', bucket: 'wellbeing' },
  { id: 'other-wellbeing', name: 'Other', bucket: 'wellbeing' },
]

export function emptyState(): AppState {
  return {
    version: SCHEMA_VERSION,
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    expenses: [],
    months: {},
    opening: { fixed: 0, wellbeing: 0 },
    goals: [],
  }
}

// ---------- stored data ----------

/** Default categories that arrived with schema 2; older data gets the ones it is missing. */
const ADDED_IN_V2 = ['rent', 'utilities', 'phone-internet', 'insurance', 'car', 'transport', 'health', 'taxes-fees', 'other-fixed',
  'coffee-snacks', 'gym-sports', 'hobbies', 'entertainment', 'clothing', 'beauty', 'gifts', 'learning', 'pets']

/**
 * Turns stored or imported JSON into the current AppState, upgrading older versions step by step.
 * Throws on anything that is not this app's data, or data written by a newer version of the app.
 */
export function migrate(data: unknown): AppState {
  const d = data as Record<string, unknown> | null
  if (!d || typeof d.version !== 'number' || !Array.isArray(d.categories) || !Array.isArray(d.expenses)) {
    throw new Error('Not a valid backup file')
  }
  if (d.version > SCHEMA_VERSION) throw new Error('This data was saved by a newer version of the app. Update the app first.')

  const base = emptyState()
  let categories = (d.categories as Category[]).map((c) => (c.name?.trim() ? c : { ...c, name: 'Unnamed category' }))
  if (d.version < 2) {
    const have = new Set(categories.map((c) => c.id))
    categories = [...categories, ...DEFAULT_CATEGORIES.filter((c) => ADDED_IN_V2.includes(c.id) && !have.has(c.id))]
  }
  return {
    version: SCHEMA_VERSION,
    categories,
    expenses: d.expenses as Expense[],
    months: (d.months as AppState['months']) ?? {},
    opening: { ...base.opening, ...((d.opening as AppState['opening']) ?? {}) },
    goals: (d.goals as Goal[]) ?? [],
    lastBackupAt: d.lastBackupAt as string | undefined,
  }
}

/** Whether to nudge for a backup: never backed up with real data, or the last one is over 30 days old. */
export function needsBackup(state: AppState, today: string): boolean {
  if (state.expenses.length === 0) return false
  if (!state.lastBackupAt) return state.expenses.length >= 10
  return daysBetween(state.lastBackupAt, today) > 30
}

// ---------- month helpers ----------

export const monthOf = (date: string): string => date.slice(0, 7)

export function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number)
  const idx = y * 12 + (m - 1) + n
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`
}

/** Number of months from a to b, positive when b is later. */
export function monthsBetween(a: string, b: string): number {
  const [ay, am] = a.split('-').map(Number)
  const [by, bm] = b.split('-').map(Number)
  return (by - ay) * 12 + (bm - am)
}

export const daysInMonth = (ym: string): number => new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0).getDate()

export function daysBetween(a: string, b: string): number {
  const t = (d: string) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)))
  return Math.round((t(b) - t(a)) / 86_400_000)
}

export function addDays(date: string, n: number): string {
  const d = new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)) + n)
  return todayISO(d)
}

export function todayISO(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
}

// ---------- balances ----------

export function configFor(state: AppState, ym: string): MonthConfig {
  const explicit = state.months[ym]
  if (explicit) return explicit
  let best: string | null = null
  for (const key of Object.keys(state.months)) {
    if (key < ym && (best === null || key > best)) best = key
  }
  if (best) return { ...state.months[best], transferred: false }
  return { salary: 0, shares: { ...DEFAULT_SHARES }, transferred: false }
}

export function startMonth(state: AppState): string | null {
  const keys = Object.keys(state.months).sort()
  return keys.length ? keys[0] : null
}

export const allocationOf = (cfg: MonthConfig, bucket: BucketId): number =>
  Math.round((cfg.salary * cfg.shares[bucket]) / 100)

export interface BucketMonth {
  /** Money rolled over from earlier months (may be negative). */
  carriedIn: number
  allocation: number
  spent: number
  /** The part of `spent` that is monthly costs and annual-cost parts. */
  committed: number
  /** The part of `spent` that is one-time expenses (day-to-day spending). */
  variable: number
  /** What this month's own allocation has left: allocation - spent. */
  monthLeft: number
  /** Total remaining: carriedIn + allocation - spent. */
  remaining: number
}

const ZERO: BucketMonth = { carriedIn: 0, allocation: 0, spent: 0, committed: 0, variable: 0, monthLeft: 0, remaining: 0 }

// ---------- spread (annual) costs ----------

/** How many months an expense is spread over; 1 for an ordinary expense. */
export const spreadOf = (e: Expense): number => Math.max(1, e.spreadMonths ?? 1)

/** A one-time expense: not spread over months and not recurring. */
export const isOrdinary = (e: Expense): boolean => spreadOf(e) === 1 && !e.repeatMonthly

export type CostKind = 'once' | 'monthly' | 'annual'
export const kindOf = (e: Expense): CostKind => (e.repeatMonthly ? 'monthly' : spreadOf(e) > 1 ? 'annual' : 'once')

/**
 * Where month `ym` falls in a spread cost: which renewal year (0 = first) and which instalment
 * within it (0-based), or null when the cost is not charged in that month.
 */
export function slotIn(e: Expense, ym: string): { year: number; k: number } | null {
  const n = spreadOf(e)
  const offset = monthsBetween(monthOf(e.date), ym)
  if (offset < 0) return null
  const year = Math.floor(offset / n)
  const lastYear = e.repeatYearly || e.repeatMonthly ? (e.lastYear ?? Infinity) : 0
  if (year > lastYear) return null
  return { year, k: offset % n }
}

/** The total amount of renewal year `year`, after any price changes. */
export function amountForYear(e: Expense, year: number): number {
  let amount = e.amount
  let from = 0
  for (const change of e.priceChanges ?? []) {
    if (change.year <= year && change.year >= from) {
      amount = change.amount
      from = change.year
    }
  }
  return amount
}

/** The part of an expense charged to month `ym`. Whole forints; the remainder goes to the first months. */
export function portionIn(e: Expense, ym: string): number {
  const slot = slotIn(e, ym)
  if (!slot) return 0
  const n = spreadOf(e)
  const amount = amountForYear(e, slot.year)
  return Math.floor(amount / n) + (slot.k < amount % n ? 1 : 0)
}

export interface Occurrence {
  expense: Expense
  /** Date to show: the real date in the first month, the same day of the month afterwards. */
  date: string
  amount: number
  /** Set for spread costs: which instalment this is, and in which renewal year (0 = first). */
  part?: { index: number; of: number; year: number }
  /** Set for monthly recurring costs. */
  recurring?: boolean
}

/** Everything charged in month `ym`: ordinary expenses plus that month's part of spread costs. */
export function occurrencesIn(expenses: Expense[], ym: string): Occurrence[] {
  const out: Occurrence[] = []
  for (const e of expenses) {
    const slot = slotIn(e, ym)
    if (!slot) continue
    if (isOrdinary(e)) {
      out.push({ expense: e, date: e.date, amount: e.amount })
      continue
    }
    const daysInMonth = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0).getDate()
    const day = Math.min(Number(e.date.slice(8, 10)), daysInMonth)
    const first = slot.year === 0 && slot.k === 0
    out.push({
      expense: e,
      date: first ? e.date : `${ym}-${String(day).padStart(2, '0')}`,
      amount: portionIn(e, ym),
      part: e.repeatMonthly ? undefined : { index: slot.k + 1, of: spreadOf(e), year: slot.year },
      recurring: e.repeatMonthly ? true : undefined,
    })
  }
  return out
}

type Spent = Record<SpendBucketId, { committed: number; variable: number }>
const noSpend = (): Spent => ({ fixed: { committed: 0, variable: 0 }, wellbeing: { committed: 0, variable: 0 } })

function spentByMonth(state: AppState, through: string): Map<string, Spent> {
  const bucketOf = new Map(state.categories.map((c) => [c.id, c.bucket]))
  const out = new Map<string, Spent>()
  for (const e of state.expenses) {
    const bucket = bucketOf.get(e.categoryId)
    if (!bucket) continue
    const part = isOrdinary(e) ? 'variable' : 'committed'
    // Renewing costs have no end, so only walk months up to the one being asked about.
    for (let ym = monthOf(e.date); ym <= through && slotIn(e, ym); ym = addMonths(ym, 1)) {
      const row = out.get(ym) ?? noSpend()
      row[bucket][part] += portionIn(e, ym)
      out.set(ym, row)
    }
  }
  return out
}

/** Rollover per spend bucket for every month from the first configured month through `through`. */
export function bucketTimeline(state: AppState, through: string): { ym: string; buckets: Record<SpendBucketId, BucketMonth> }[] {
  const start = startMonth(state)
  if (!start || through < start) return []
  const spent = spentByMonth(state, through)
  const carry: Record<SpendBucketId, number> = { ...state.opening }
  const out: { ym: string; buckets: Record<SpendBucketId, BucketMonth> }[] = []
  for (let m = start; m <= through; m = addMonths(m, 1)) {
    const cfg = configFor(state, m)
    const row = spent.get(m) ?? noSpend()
    const buckets = {} as Record<SpendBucketId, BucketMonth>
    for (const b of SPEND_BUCKETS) {
      const allocation = allocationOf(cfg, b)
      const { committed, variable } = row[b]
      const monthLeft = allocation - committed - variable
      buckets[b] = { carriedIn: carry[b], allocation, spent: committed + variable, committed, variable, monthLeft, remaining: carry[b] + monthLeft }
      carry[b] = buckets[b].remaining
    }
    out.push({ ym: m, buckets })
  }
  return out
}

/** Rollover per spend bucket for month `ym`, computed from the first configured month. */
export function bucketSummary(state: AppState, ym: string): Record<SpendBucketId, BucketMonth> {
  const timeline = bucketTimeline(state, ym)
  return timeline.length ? timeline[timeline.length - 1].buckets : { fixed: { ...ZERO }, wellbeing: { ...ZERO } }
}

// ---------- goals and safe-to-spend ----------

/** How a goal is funded: equal monthly parts from its start month through its target month. */
export function goalPlan(g: Goal): { months: number; perMonth: number } {
  const months = Math.max(1, monthsBetween(g.startMonth, g.targetMonth) + 1)
  return { months, perMonth: Math.ceil(g.target / months) }
}

/** Money a goal has set aside by the end of month `ym` (capped at its target; 0 once done). */
export function goalReserved(g: Goal, ym: string): number {
  if (g.done || ym < g.startMonth) return 0
  return Math.min(g.target, goalPlan(g).perMonth * (monthsBetween(g.startMonth, ym) + 1))
}

export interface SafeToSpend {
  /** Remaining money minus what goals have set aside. */
  free: number
  reserved: number
  /** Days left in the month including today; null when `ym` is not the current month. */
  daysLeft: number | null
  perDay: number | null
}

export function safeToSpend(state: AppState, bucket: SpendBucketId, ym: string, today: string): SafeToSpend {
  const remaining = bucketSummary(state, ym)[bucket].remaining
  const reserved = state.goals.filter((g) => g.bucket === bucket).reduce((sum, g) => sum + goalReserved(g, ym), 0)
  const free = remaining - reserved
  const daysLeft = monthOf(today) === ym ? daysInMonth(ym) - Number(today.slice(8, 10)) + 1 : null
  return { free, reserved, daysLeft, perDay: daysLeft ? Math.floor(Math.max(0, free) / daysLeft) : null }
}

// ---------- averages ----------

export interface PeriodStats {
  total: number
  count: number
  months: number
  avgPerMonth: number
  avgPerTransaction: number
  perMonth: { ym: string; total: number }[]
}

/** Stats for the given categories over the inclusive month range [from, to]. */
export function periodStats(
  expenses: Expense[],
  categoryIds: ReadonlySet<string>,
  from: string,
  to: string,
): PeriodStats {
  const months = Math.max(1, monthsBetween(from, to) + 1)
  const perMonth = Array.from({ length: months }, (_, i) => ({ ym: addMonths(from, i), total: 0 }))
  let total = 0
  let count = 0
  let countedTotal = 0
  for (const e of expenses) {
    if (!categoryIds.has(e.categoryId)) continue
    // Spread costs contribute their monthly part to totals and averages per month...
    for (const slot of perMonth) {
      const part = portionIn(e, slot.ym)
      slot.total += part
      total += part
    }
    // ...but annual costs are not purchases: "average per purchase" counts one-time expenses,
    // and each charged month of a monthly cost (e.g. every rent payment).
    if (e.repeatMonthly) {
      for (const slot of perMonth) {
        const part = portionIn(e, slot.ym)
        if (part > 0) {
          count += 1
          countedTotal += part
        }
      }
    } else if (spreadOf(e) === 1) {
      const ym = monthOf(e.date)
      if (ym >= from && ym <= to) {
        count += 1
        countedTotal += e.amount
      }
    }
  }
  return {
    total,
    count,
    months,
    avgPerMonth: Math.round(total / months),
    avgPerTransaction: count ? Math.round(countedTotal / count) : 0,
    perMonth,
  }
}

// ---------- editing ----------

export interface ExpenseForm {
  amount: number
  categoryId: string
  date: string
  note: string
  kind: CostKind
  /** true = stop after the renewal being edited, false = keep repeating, undefined = leave the end as it is. */
  stop?: boolean
}

/**
 * Builds the expense to save from the sheet's form. `original` is the expense being edited (if any) and
 * `idx` the renewal it was opened at. Monthly and annual costs repeat unless explicitly stopped; a new
 * amount applies from `idx` onward while earlier renewals keep theirs.
 */
export function buildExpense(original: Expense | undefined, idx: number, form: ExpenseForm): Omit<Expense, 'id'> & { id?: string } {
  const base = { id: original?.id, categoryId: form.categoryId, date: form.date, note: form.note }
  if (form.kind === 'once') return { ...base, amount: form.amount }

  const inSeries = !!original && kindOf(original) === form.kind
  let amount = form.amount
  let changes = inSeries ? (original.priceChanges ?? []) : []
  if (inSeries) {
    amount = original.amount
    if (form.amount !== amountForYear(original, idx)) {
      if (idx === 0) amount = form.amount
      else changes = [...changes.filter((c) => c.year !== idx), { year: idx, amount: form.amount }]
    }
  }
  const lastYear = form.stop === undefined ? (inSeries ? original.lastYear : undefined) : form.stop ? idx : undefined
  if (lastYear !== undefined) changes = changes.filter((c) => c.year <= lastYear)
  return {
    ...base,
    amount,
    spreadMonths: form.kind === 'annual' ? 12 : undefined,
    repeatYearly: form.kind === 'annual' ? true : undefined,
    repeatMonthly: form.kind === 'monthly' ? true : undefined,
    lastYear,
    priceChanges: changes.length ? changes : undefined,
  }
}

/** The last month a stopped series is charged in, or null when it repeats until stopped. */
export function lastChargedMonth(e: Pick<Expense, 'date' | 'spreadMonths' | 'repeatMonthly'>, lastYear: number | undefined): string | null {
  if (lastYear === undefined) return null
  const n = e.repeatMonthly ? 1 : Math.max(1, e.spreadMonths ?? 1)
  return addMonths(monthOf(e.date), lastYear * n + n - 1)
}

// ---------- insights helpers ----------

/** Total per category over [from, to], largest first; spread and recurring costs count their monthly parts. */
export function categoryTotals(
  expenses: Expense[],
  categoryIds: ReadonlySet<string>,
  from: string,
  to: string,
): { categoryId: string; total: number }[] {
  const totals = new Map<string, number>()
  for (const e of expenses) {
    if (!categoryIds.has(e.categoryId)) continue
    for (let ym = from; ym <= to; ym = addMonths(ym, 1)) {
      const part = portionIn(e, ym)
      if (part) totals.set(e.categoryId, (totals.get(e.categoryId) ?? 0) + part)
    }
  }
  return [...totals].map(([categoryId, total]) => ({ categoryId, total })).sort((a, b) => b.total - a.total)
}

/**
 * Expected total for the current month: recurring parts in full, plus one-time spending
 * extrapolated from the days gone so far.
 */
export function projectMonth(expenses: Expense[], categoryIds: ReadonlySet<string>, today: string): { soFar: number; projected: number } {
  const ym = monthOf(today)
  let committed = 0
  let variable = 0
  for (const o of occurrencesIn(expenses, ym)) {
    if (!categoryIds.has(o.expense.categoryId)) continue
    if (isOrdinary(o.expense)) {
      if (o.date <= today) variable += o.amount
    } else committed += o.amount
  }
  const day = Number(today.slice(8, 10))
  return { soFar: committed + variable, projected: committed + Math.round((variable / day) * daysInMonth(ym)) }
}

/** Categories most used for expenses, most frequent first. */
export function frequentCategories(state: AppState, limit: number): string[] {
  const counts = new Map<string, number>()
  for (const e of state.expenses) counts.set(e.categoryId, (counts.get(e.categoryId) ?? 0) + 1)
  return state.categories
    .filter((c) => counts.has(c.id))
    .sort((a, b) => counts.get(b.id)! - counts.get(a.id)!)
    .slice(0, limit)
    .map((c) => c.id)
}

/** An annual cost in this category that is charged in the month of `date`, if any. */
export function activeAnnualCost(expenses: Expense[], categoryId: string, date: string, excludeId?: string): Expense | undefined {
  return expenses.find((e) => e.id !== excludeId && e.categoryId === categoryId && kindOf(e) === 'annual' && slotIn(e, monthOf(date)))
}
