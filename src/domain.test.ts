import { describe, expect, it } from 'vitest'
import {
  addMonths,
  allocationOf,
  amountForYear,
  bucketSummary,
  bucketTimeline,
  categoryTotals,
  frequentCategories,
  activeAnnualCost,
  goalPlan,
  goalReserved,
  migrate,
  needsBackup,
  projectMonth,
  safeToSpend,
  type Goal,
  buildExpense,
  lastChargedMonth,
  configFor,
  emptyState,
  kindOf,
  monthsBetween,
  occurrencesIn,
  periodStats,
  portionIn,
  type AppState,
  type Expense,
} from './domain'

let seq = 0
const expense = (date: string, amount: number, categoryId: string): Expense => ({
  id: `e${seq++}`,
  date,
  amount,
  categoryId,
  note: '',
})

function stateWith(salary: number, firstMonth: string, expenses: Expense[]): AppState {
  const s = emptyState()
  s.months[firstMonth] = { salary, shares: { fixed: 50, wellbeing: 30, investment: 20 }, transferred: false }
  s.expenses = expenses
  return s
}

describe('month helpers', () => {
  it('adds months across year boundaries', () => {
    expect(addMonths('2026-11', 3)).toBe('2027-02')
    expect(addMonths('2026-01', -1)).toBe('2025-12')
  })
  it('counts months between', () => {
    expect(monthsBetween('2026-01', '2026-05')).toBe(4)
    expect(monthsBetween('2025-11', '2026-02')).toBe(3)
  })
})

describe('allocation', () => {
  it('splits salary 50/30/20', () => {
    const cfg = configFor(stateWith(500_000, '2026-01', []), '2026-01')
    expect(allocationOf(cfg, 'fixed')).toBe(250_000)
    expect(allocationOf(cfg, 'wellbeing')).toBe(150_000)
    expect(allocationOf(cfg, 'investment')).toBe(100_000)
  })
})

describe('config inheritance', () => {
  it('uses the latest earlier record for months without one', () => {
    const s = stateWith(3000, '2026-01', [])
    s.months['2026-03'] = { salary: 4000, shares: { fixed: 50, wellbeing: 30, investment: 20 }, transferred: true }
    expect(configFor(s, '2026-02').salary).toBe(3000)
    expect(configFor(s, '2026-05').salary).toBe(4000)
    expect(configFor(s, '2026-05').transferred).toBe(false)
  })
})

describe('rollover', () => {
  // The May-trip example from the plan: salary 3000 -> well-being gets 900 a month.
  const quiet = ['2026-01', '2026-02', '2026-03', '2026-04'].map((m) => expense(`${m}-15`, 300, 'eating-out'))
  const may = [expense('2026-05-10', 2500, 'travel'), expense('2026-05-20', 500, 'eating-out')]
  const s = stateWith(3000, '2026-01', [...quiet, ...may])

  it('accumulates unspent money', () => {
    expect(bucketSummary(s, '2026-01').wellbeing.remaining).toBe(600)
    expect(bucketSummary(s, '2026-02').wellbeing.remaining).toBe(1200)
    expect(bucketSummary(s, '2026-04').wellbeing.remaining).toBe(2400)
  })

  it('splits the rolled-over part from the current month', () => {
    const apr = bucketSummary(s, '2026-04').wellbeing
    expect(apr.carriedIn).toBe(1800)
    expect(apr.allocation).toBe(900)
    expect(apr.spent).toBe(300)
    expect(apr.monthLeft).toBe(600)
  })

  it('lets the trip spend the saved money', () => {
    expect(bucketSummary(s, '2026-05').wellbeing.remaining).toBe(300)
  })

  it('carries a deficit forward', () => {
    const over = stateWith(3000, '2026-01', [expense('2026-01-05', 1400, 'travel')])
    expect(bucketSummary(over, '2026-01').wellbeing.remaining).toBe(-500)
    expect(bucketSummary(over, '2026-02').wellbeing.remaining).toBe(400)
  })

  it('keeps buckets separate', () => {
    expect(bucketSummary(s, '2026-04').fixed.remaining).toBe(1500 * 4)
  })

  it('adds the opening balance to the first month', () => {
    const o = stateWith(3000, '2026-01', [])
    o.opening.wellbeing = 1000
    expect(bucketSummary(o, '2026-01').wellbeing.carriedIn).toBe(1000)
    expect(bucketSummary(o, '2026-01').wellbeing.remaining).toBe(1900)
  })

  it('returns zeros before the first configured month', () => {
    expect(bucketSummary(s, '2025-12').wellbeing.remaining).toBe(0)
  })

  it('ignores expenses whose category was removed', () => {
    const g = stateWith(3000, '2026-01', [expense('2026-01-05', 100, 'no-such-category')])
    expect(bucketSummary(g, '2026-01').wellbeing.spent).toBe(0)
  })
})

describe('averages', () => {
  const list = [
    expense('2026-01-03', 10_000, 'shopping'),
    expense('2026-01-20', 20_000, 'shopping'),
    expense('2026-03-11', 30_000, 'shopping'),
    expense('2026-02-02', 99_000, 'travel'),
  ]
  const shopping = new Set(['shopping'])

  it('averages over calendar months, counting empty ones', () => {
    const st = periodStats(list, shopping, '2026-01', '2026-03')
    expect(st.total).toBe(60_000)
    expect(st.months).toBe(3)
    expect(st.avgPerMonth).toBe(20_000)
    expect(st.perMonth.map((m) => m.total)).toEqual([30_000, 0, 30_000])
  })

  it('averages per transaction', () => {
    const st = periodStats(list, shopping, '2026-01', '2026-03')
    expect(st.count).toBe(3)
    expect(st.avgPerTransaction).toBe(20_000)
  })

  it('handles a period with no spending', () => {
    const st = periodStats(list, shopping, '2026-06', '2026-06')
    expect(st.avgPerMonth).toBe(0)
    expect(st.avgPerTransaction).toBe(0)
  })

  it('covers several categories at once', () => {
    const st = periodStats(list, new Set(['shopping', 'travel']), '2026-01', '2026-03')
    expect(st.total).toBe(159_000)
  })
})

describe('spread (annual) costs', () => {
  const insurance = (amount: number, date = '2026-03-10'): Expense => ({
    ...expense(date, amount, 'invoice'),
    spreadMonths: 12,
  })

  it('splits the amount over 12 months starting with the month of the date', () => {
    const e = insurance(120_000)
    expect(portionIn(e, '2026-02')).toBe(0)
    expect(portionIn(e, '2026-03')).toBe(10_000)
    expect(portionIn(e, '2027-02')).toBe(10_000)
    expect(portionIn(e, '2027-03')).toBe(0)
  })

  it('never loses a forint to rounding', () => {
    const e = insurance(100_000 + 4)
    const parts = Array.from({ length: 12 }, (_, k) => portionIn(e, addMonths('2026-03', k)))
    expect(parts.reduce((a, b) => a + b, 0)).toBe(100_004)
    expect(Math.max(...parts) - Math.min(...parts)).toBeLessThanOrEqual(1)
  })

  it('charges only the monthly part to the bucket', () => {
    const s = stateWith(800_000, '2026-01', [insurance(120_000)])
    expect(bucketSummary(s, '2026-03').fixed.spent).toBe(10_000)
    expect(bucketSummary(s, '2026-08').fixed.spent).toBe(10_000)
    expect(bucketSummary(s, '2027-03').fixed.spent).toBe(0)
    expect(bucketSummary(s, '2026-03').wellbeing.spent).toBe(0)
  })

  it('lists one occurrence per month with its instalment number', () => {
    const e = insurance(120_000, '2026-01-31')
    const feb = occurrencesIn([e], '2026-02')
    expect(feb).toHaveLength(1)
    expect(feb[0].amount).toBe(10_000)
    expect(feb[0].date).toBe('2026-02-28')
    expect(feb[0].part).toEqual({ index: 2, of: 12, year: 0 })
    expect(occurrencesIn([e], '2027-01')).toHaveLength(0)
  })

  it('counts in monthly averages but not as a purchase', () => {
    const list = [insurance(120_000, '2026-01-05'), expense('2026-02-10', 30_000, 'invoice')]
    const st = periodStats(list, new Set(['invoice']), '2026-01', '2026-03')
    expect(st.total).toBe(30_000 + 3 * 10_000)
    expect(st.avgPerMonth).toBe(20_000)
    expect(st.count).toBe(1)
    expect(st.avgPerTransaction).toBe(30_000)
  })
})

describe('repeating annual costs', () => {
  const policy = (extra: Partial<Expense> = {}): Expense => ({
    ...expense('2026-03-10', 120_000, 'invoice'),
    spreadMonths: 12,
    repeatYearly: true,
    ...extra,
  })

  it('renews every year until stopped', () => {
    const e = policy()
    expect(portionIn(e, '2027-03')).toBe(10_000)
    expect(portionIn(e, '2030-02')).toBe(10_000)
    expect(portionIn(e, '2026-02')).toBe(0)
  })

  it('charges renewals to the bucket and rolls them over', () => {
    const s = stateWith(800_000, '2026-01', [policy()])
    expect(bucketSummary(s, '2027-06').fixed.spent).toBe(10_000)
    // Mar 2026 - Jun 2027 = 16 months charged
    expect(bucketSummary(s, '2027-06').fixed.carriedIn).toBe(17 * 400_000 - 15 * 10_000)
  })

  it('applies a price change from its year onward and keeps earlier years', () => {
    const e = policy({ priceChanges: [{ year: 1, amount: 144_000 }] })
    expect(amountForYear(e, 0)).toBe(120_000)
    expect(amountForYear(e, 1)).toBe(144_000)
    expect(amountForYear(e, 5)).toBe(144_000)
    expect(portionIn(e, '2027-02')).toBe(10_000)
    expect(portionIn(e, '2027-03')).toBe(12_000)
    expect(portionIn(e, '2028-03')).toBe(12_000)
  })

  it('later price changes override earlier ones regardless of order', () => {
    const e = policy({
      priceChanges: [
        { year: 3, amount: 180_000 },
        { year: 1, amount: 144_000 },
      ],
    })
    expect(amountForYear(e, 2)).toBe(144_000)
    expect(amountForYear(e, 3)).toBe(180_000)
  })

  it('stops after the last year', () => {
    const e = policy({ lastYear: 1 })
    expect(portionIn(e, '2028-02')).toBe(10_000)
    expect(portionIn(e, '2028-03')).toBe(0)
    expect(occurrencesIn([e], '2028-03')).toHaveLength(0)
  })

  it('numbers instalments and shows the renewal year', () => {
    const [occ] = occurrencesIn([policy()], '2027-05')
    expect(occ.part).toEqual({ index: 3, of: 12, year: 1 })
  })

  it('a non-repeating spread cost still ends after 12 months', () => {
    expect(portionIn(policy({ repeatYearly: false }), '2027-03')).toBe(0)
  })
})

describe('monthly recurring costs', () => {
  const rent = (extra: Partial<Expense> = {}): Expense => ({
    ...expense('2026-02-05', 200_000, 'rent'),
    repeatMonthly: true,
    ...extra,
  })

  it('charges the full amount every month from the start month', () => {
    const e = rent()
    expect(kindOf(e)).toBe('monthly')
    expect(portionIn(e, '2026-01')).toBe(0)
    expect(portionIn(e, '2026-02')).toBe(200_000)
    expect(portionIn(e, '2029-07')).toBe(200_000)
  })

  it('reduces the bucket each month and rolls the rest over', () => {
    const s = stateWith(800_000, '2026-01', [rent()])
    // Feb..Apr: 3 charges against 4 allocations of 400 000
    expect(bucketSummary(s, '2026-04').fixed.remaining).toBe(4 * 400_000 - 3 * 200_000)
    expect(bucketSummary(s, '2026-04').fixed.spent).toBe(200_000)
  })

  it('applies a price change from a month onward', () => {
    const e = rent({ priceChanges: [{ year: 3, amount: 220_000 }] }) // renewal 3 = May 2026
    expect(portionIn(e, '2026-04')).toBe(200_000)
    expect(portionIn(e, '2026-05')).toBe(220_000)
    expect(portionIn(e, '2027-05')).toBe(220_000)
  })

  it('stops after the last month', () => {
    const e = rent({ lastYear: 2 }) // Feb, Mar, Apr
    expect(portionIn(e, '2026-04')).toBe(200_000)
    expect(portionIn(e, '2026-05')).toBe(0)
  })

  it('lists one occurrence per month, marked as recurring, without instalment numbers', () => {
    const [occ] = occurrencesIn([rent()], '2026-09')
    expect(occ.recurring).toBe(true)
    expect(occ.part).toBeUndefined()
    expect(occ.amount).toBe(200_000)
    expect(occ.date).toBe('2026-09-05')
  })

  it('counts every charged month as a purchase in the averages', () => {
    const st = periodStats([rent()], new Set(['rent']), '2026-01', '2026-04')
    expect(st.total).toBe(600_000)
    expect(st.avgPerMonth).toBe(150_000)
    expect(st.count).toBe(3)
    expect(st.avgPerTransaction).toBe(200_000)
  })
})

describe('saving from the expense sheet', () => {
  const form = { amount: 200_000, categoryId: 'rent', date: '2026-10-05', note: '' }

  it('a new monthly cost repeats every month without any extra setting', () => {
    const saved = { id: 'x', ...buildExpense(undefined, 0, { ...form, kind: 'monthly' }) }
    expect(saved.lastYear).toBeUndefined()
    expect(portionIn(saved, '2026-10')).toBe(200_000)
    expect(portionIn(saved, '2026-11')).toBe(200_000)
    expect(portionIn(saved, '2027-10')).toBe(200_000)
  })

  it('a new annual cost renews every year', () => {
    const saved = { id: 'x', ...buildExpense(undefined, 0, { ...form, amount: 96_000, kind: 'annual' }) }
    expect(portionIn(saved, '2027-10')).toBe(8_000)
  })

  it('stopping ends the series after the month being edited', () => {
    const rentSeries: Expense = { id: 'r', ...form, repeatMonthly: true }
    const saved = { id: 'r', ...buildExpense(rentSeries, 2, { ...form, kind: 'monthly', stop: true }) }
    expect(saved.lastYear).toBe(2)
    expect(portionIn(saved, '2026-12')).toBe(200_000)
    expect(portionIn(saved, '2027-01')).toBe(0)
    expect(lastChargedMonth(saved, saved.lastYear)).toBe('2026-12')
  })

  it('editing an earlier month of a stopped series keeps its end', () => {
    const stopped: Expense = { id: 'r', ...form, repeatMonthly: true, lastYear: 5 }
    const saved = buildExpense(stopped, 1, { ...form, note: 'renamed', kind: 'monthly' })
    expect(saved.lastYear).toBe(5)
  })

  it('resuming removes the end', () => {
    const stopped: Expense = { id: 'r', ...form, repeatMonthly: true, lastYear: 5 }
    expect(buildExpense(stopped, 5, { ...form, kind: 'monthly', stop: false }).lastYear).toBeUndefined()
  })

  it('a new amount applies from the edited month and keeps earlier ones', () => {
    const rentSeries: Expense = { id: 'r', ...form, repeatMonthly: true }
    const saved = { id: 'r', ...buildExpense(rentSeries, 3, { ...form, amount: 220_000, kind: 'monthly' }) }
    expect(portionIn(saved, '2026-12')).toBe(200_000)
    expect(portionIn(saved, '2027-01')).toBe(220_000)
  })

  it('reports the last charged month of a stopped annual cost', () => {
    expect(lastChargedMonth({ date: '2026-10-05', spreadMonths: 12 }, 1)).toBe('2028-09')
  })
})

describe('stored data migration', () => {
  const v1 = {
    version: 1,
    categories: [
      { id: 'invoice', name: 'Invoice', bucket: 'fixed' },
      { id: 'mine', name: '', bucket: 'wellbeing' },
    ],
    expenses: [{ id: 'a', date: '2026-01-02', amount: 100, categoryId: 'invoice', note: '' }],
    months: { '2026-01': { salary: 1000, shares: { fixed: 50, wellbeing: 30, investment: 20 }, transferred: false } },
  }

  it('upgrades version 1 data to the current schema without losing anything', () => {
    const s = migrate(v1)
    expect(s.version).toBe(2)
    expect(s.expenses).toHaveLength(1)
    expect(s.months['2026-01'].salary).toBe(1000)
    expect(s.goals).toEqual([])
    expect(s.opening).toEqual({ fixed: 0, wellbeing: 0 })
  })

  it('adds the new default categories but keeps custom ones', () => {
    const ids = migrate(v1).categories.map((c) => c.id)
    expect(ids).toContain('mine')
    expect(ids).toContain('rent')
    expect(ids).toContain('gym-sports')
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('repairs blank category names', () => {
    expect(migrate(v1).categories.find((c) => c.id === 'mine')!.name).toBe('Unnamed category')
  })

  it('refuses data that is not from this app or from a newer version', () => {
    expect(() => migrate({ hello: 1 })).toThrow()
    expect(() => migrate(null)).toThrow()
    expect(() => migrate({ ...v1, version: 99 })).toThrow(/newer version/)
  })

  it('leaves current data as it is', () => {
    const current = { ...emptyState(), lastBackupAt: '2026-05-01' }
    expect(migrate(JSON.parse(JSON.stringify(current)))).toEqual(current)
  })
})

describe('backup reminder', () => {
  const withExpenses = (n: number, lastBackupAt?: string): AppState => ({
    ...emptyState(),
    lastBackupAt,
    expenses: Array.from({ length: n }, (_, i) => expense('2026-01-01', 1, `c${i}`)),
  })
  it('is quiet with little data and no backup yet', () => expect(needsBackup(withExpenses(3), '2026-10-31')).toBe(false))
  it('asks once there is real data and no backup', () => expect(needsBackup(withExpenses(10), '2026-10-31')).toBe(true))
  it('asks again after 30 days', () => {
    expect(needsBackup(withExpenses(20, '2026-10-01'), '2026-10-31')).toBe(false)
    expect(needsBackup(withExpenses(20, '2026-09-30'), '2026-10-31')).toBe(true)
  })
})

describe('committed vs day-to-day spending', () => {
  it('splits the month into recurring parts and one-time expenses', () => {
    const s = stateWith(800_000, '2026-01', [
      { ...expense('2026-01-05', 200_000, 'rent'), repeatMonthly: true },
      { ...expense('2026-01-10', 120_000, 'insurance'), spreadMonths: 12, repeatYearly: true },
      expense('2026-01-12', 30_000, 'groceries'),
    ])
    const jan = bucketSummary(s, '2026-01').fixed
    expect(jan.committed).toBe(210_000)
    expect(jan.variable).toBe(30_000)
    expect(jan.spent).toBe(240_000)
  })

  it('gives a month-by-month history that chains up', () => {
    const s = stateWith(3000, '2026-01', [expense('2026-02-01', 1000, 'travel')])
    const t = bucketTimeline(s, '2026-03')
    expect(t.map((r) => r.ym)).toEqual(['2026-01', '2026-02', '2026-03'])
    expect(t.map((r) => r.buckets.wellbeing.remaining)).toEqual([900, 800, 1700])
    expect(t[1].buckets.wellbeing.carriedIn).toBe(t[0].buckets.wellbeing.remaining)
  })
})

describe('savings goals', () => {
  const trip: Goal = { id: 'g', name: 'May trip', bucket: 'wellbeing', target: 400_000, startMonth: '2026-11', targetMonth: '2027-05' }

  it('sets aside equal monthly parts until the target month', () => {
    expect(goalPlan(trip)).toEqual({ months: 7, perMonth: 57_143 })
    expect(goalReserved(trip, '2026-10')).toBe(0)
    expect(goalReserved(trip, '2026-11')).toBe(57_143)
    expect(goalReserved(trip, '2027-01')).toBe(3 * 57_143)
    expect(goalReserved(trip, '2027-05')).toBe(400_000)
    expect(goalReserved(trip, '2027-09')).toBe(400_000)
  })

  it('releases the money once done', () => {
    expect(goalReserved({ ...trip, done: true }, '2027-01')).toBe(0)
  })

  it('reduces what is safe to spend and gives a daily figure for the current month', () => {
    const s = { ...stateWith(1_000_000, '2026-11', []), goals: [trip] }
    // well-being: 300 000 allocated in Nov, 57 143 set aside for the trip
    const safe = safeToSpend(s, 'wellbeing', '2026-11', '2026-11-21')
    expect(safe.reserved).toBe(57_143)
    expect(safe.free).toBe(300_000 - 57_143)
    expect(safe.daysLeft).toBe(10)
    expect(safe.perDay).toBe(Math.floor((300_000 - 57_143) / 10))
    expect(safeToSpend(s, 'fixed', '2026-11', '2026-11-21').reserved).toBe(0)
  })

  it('has no daily figure for other months, and never a negative one', () => {
    const s = stateWith(1000, '2026-11', [expense('2026-11-02', 5000, 'travel')])
    expect(safeToSpend(s, 'wellbeing', '2026-11', '2026-12-01').perDay).toBeNull()
    expect(safeToSpend(s, 'wellbeing', '2026-11', '2026-11-30').perDay).toBe(0)
  })
})

describe('insights helpers', () => {
  const list = [
    expense('2026-03-02', 10_000, 'groceries'),
    expense('2026-03-09', 20_000, 'groceries'),
    expense('2026-03-05', 5_000, 'shopping'),
    { ...expense('2026-03-01', 200_000, 'rent'), repeatMonthly: true },
  ]

  it('ranks categories by total', () => {
    const top = categoryTotals(list, new Set(['groceries', 'shopping', 'rent']), '2026-03', '2026-04')
    expect(top).toEqual([
      { categoryId: 'rent', total: 400_000 },
      { categoryId: 'groceries', total: 30_000 },
      { categoryId: 'shopping', total: 5_000 },
    ])
  })

  it('projects the month: recurring in full, one-time spending extrapolated', () => {
    // 10 days into a 31-day month, 35 000 one-time spent so far
    const p = projectMonth(list, new Set(['groceries', 'shopping', 'rent']), '2026-03-10')
    expect(p.soFar).toBe(235_000)
    expect(p.projected).toBe(200_000 + Math.round((35_000 / 10) * 31))
  })

  it('lists most used categories first', () => {
    const s = { ...emptyState(), expenses: list }
    expect(frequentCategories(s, 2)).toEqual(['groceries', 'rent'])
  })

  it('finds an annual cost active in a month', () => {
    const annual = { ...expense('2026-01-10', 120_000, 'insurance'), spreadMonths: 12, repeatYearly: true }
    expect(activeAnnualCost([annual], 'insurance', '2026-06-01')).toBe(annual)
    expect(activeAnnualCost([annual], 'insurance', '2025-12-01')).toBeUndefined()
    expect(activeAnnualCost([annual], 'car', '2026-06-01')).toBeUndefined()
  })
})

describe('temporary change of the split', () => {
  // 50/30/20 until October, no investing (70/30/0) from November to May, back to 50/30/20 from June.
  const s = stateWith(1_000_000, '2026-10', [])
  s.months['2026-11'] = { salary: 1_000_000, shares: { fixed: 70, wellbeing: 30, investment: 0 }, transferred: false }
  s.months['2027-06'] = { salary: 1_000_000, shares: { fixed: 50, wellbeing: 30, investment: 20 }, transferred: false }

  it('uses each month its own split, inheriting until the next change', () => {
    expect(allocationOf(configFor(s, '2026-10'), 'investment')).toBe(200_000)
    expect(allocationOf(configFor(s, '2027-02'), 'fixed')).toBe(700_000)
    expect(allocationOf(configFor(s, '2027-05'), 'investment')).toBe(0)
    expect(allocationOf(configFor(s, '2027-06'), 'investment')).toBe(200_000)
    expect(allocationOf(configFor(s, '2027-09'), 'fixed')).toBe(500_000)
  })

  it('keeps rollover continuous across the changes', () => {
    // nothing spent: fixed gets 500k (Oct) + 7 x 700k (Nov-May) + 500k (Jun)
    expect(bucketSummary(s, '2027-06').fixed.remaining).toBe(500_000 + 7 * 700_000 + 500_000)
    expect(bucketSummary(s, '2027-06').wellbeing.remaining).toBe(9 * 300_000)
  })
})
