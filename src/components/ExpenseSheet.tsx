import { useMemo, useRef, useState } from 'react'
import {
  BUCKETS,
  SPEND_BUCKETS,
  activeAnnualCost,
  addDays,
  amountForYear,
  buildExpense,
  frequentCategories,
  kindOf,
  lastChargedMonth,
  slotIn,
  todayISO,
  type Category,
  type CostKind,
  type Expense,
} from '../domain'
import { foldText, formatAmountInput, formatHuf, monthLabel, parseAmount } from '../format'
import { actions, useStore } from '../store'
import { showToast } from '../toast'

const KINDS: [CostKind, string][] = [
  ['once', 'One-time'],
  ['monthly', 'Monthly'],
  ['annual', 'Annual'],
]

export function ExpenseSheet({ expense, month, onClose }: { expense?: Expense; month?: string; onClose: () => void }) {
  const { state } = useStore()
  const lastUsed = state.expenses[state.expenses.length - 1]?.categoryId
  const wasKind: CostKind = expense ? kindOf(expense) : 'once'
  // Renewal being edited (0 = first): the year of an annual cost, the month of a monthly one. The amount shown is its own.
  const idx = expense && month ? (slotIn(expense, month)?.year ?? 0) : 0
  const [amountText, setAmountText] = useState(expense ? formatAmountInput(String(amountForYear(expense, idx))) : '')
  const amountRef = useRef<HTMLInputElement>(null)
  const [categoryId, setCategoryId] = useState(expense?.categoryId ?? lastUsed ?? state.categories[0]?.id ?? '')
  const [date, setDate] = useState(expense?.date ?? todayISO())
  const [note, setNote] = useState(expense?.note ?? '')
  const [kind, setKind] = useState<CostKind>(wasKind)
  // undefined until the user touches "Stop", so saving other edits never moves a series' end.
  const [stop, setStop] = useState<boolean | undefined>(undefined)

  const [catQuery, setCatQuery] = useState('')
  const [showAll, setShowAll] = useState(false)
  const today = todayISO()

  const amount = parseAmount(amountText)
  const frequent = useMemo(() => frequentCategories(state, 6), [state])
  // Keep the chosen category visible among the quick picks.
  const quick = !categoryId || frequent.includes(categoryId) ? frequent : [categoryId, ...frequent.slice(0, 5)]
  const catMode = catQuery.trim() ? 'search' : showAll || frequent.length === 0 ? 'all' : 'frequent'
  const annualHere = kind === 'once' ? activeAnnualCost(state.expenses, categoryId, date, expense?.id) : undefined
  const categoryById = (id: string) => state.categories.find((c) => c.id === id)
  const valid = amount > 0 && !!categoryId && !!date
  const unit = kind === 'monthly' ? 'month' : 'year'
  const inSeries = !!expense && wasKind !== 'once' && wasKind === kind
  const stopped = stop ?? (inSeries && expense!.lastYear !== undefined)
  const lastMonth = stopped
    ? lastChargedMonth(
        { date, spreadMonths: kind === 'annual' ? 12 : undefined, repeatMonthly: kind === 'monthly' },
        stop === undefined ? expense!.lastYear : idx,
      )
    : null

  const save = () => {
    if (!valid) return
    const categoryName = state.categories.find((c) => c.id === categoryId)?.name ?? ''
    showToast(
      expense
        ? 'Changes saved'
        : kind === 'once'
          ? `Added ${formatHuf(amount)} · ${categoryName}`
          : kind === 'monthly'
            ? `Monthly cost added · ${formatHuf(amount)} a month`
            : `Annual cost added · ${formatHuf(Math.round(amount / 12))} a month`,
    )
    actions.saveExpense(buildExpense(expense, idx, { amount, categoryId, date, note: note.trim(), kind, stop: inSeries ? stop : undefined }))
    onClose()
  }
  const chip = (c: Category) => (
    <button
      key={c.id}
      className={`chip ${c.bucket} ${c.id === categoryId ? 'on' : ''}`}
      onClick={() => {
        setCategoryId(c.id)
        setCatQuery('')
      }}
    >
      {c.name}
    </button>
  )

  // No confirmation dialog: deleting is instant and the snackbar offers Undo.
  const remove = () => {
    if (!expense) return
    actions.deleteExpense(expense.id)
    showToast(wasKind === 'once' ? 'Expense deleted' : `${wasKind === 'monthly' ? 'Monthly' : 'Annual'} cost deleted`, {
      label: 'Undo',
      run: () => actions.saveExpense(expense),
    })
    onClose()
  }

  return (
    <div className="backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={expense ? 'Edit expense' : 'Add expense'} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-body">
          <div className="sheet-head">
            <strong>{expense ? 'Edit expense' : 'New expense'}</strong>
          </div>

          <div className="amount-input">
            <input
              autoFocus
              inputMode="numeric"
              placeholder="0"
              aria-label="Amount"
              ref={amountRef}
              value={amountText}
              onChange={(e) => setAmountText(formatAmountInput(e.target.value))}
            />
            <span>Ft</span>
            <button
              className="plus-key"
              aria-label="Add another amount"
              onClick={() => {
                setAmountText((t) => (!t || t.trimEnd().endsWith('+') ? t : formatAmountInput(t + '+')))
                amountRef.current?.focus()
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          {amountText.includes('+') && <p className="hint center">{amount > 0 ? `= ${formatHuf(amount)}` : 'Finish the sum'}</p>}
          {inSeries && idx > 0 && (
            <p className="hint center">
              {unit === 'year' ? 'Year' : 'Month'} {idx + 1} of this {kind} cost. A new amount applies from this {unit} on; earlier{' '}
              {unit}s keep theirs.
            </p>
          )}

          <div className="segmented" role="tablist" aria-label="Cost type">
            {KINDS.map(([id, label]) => (
              <button key={id} className={kind === id ? 'on' : ''} onClick={() => setKind(id)}>
                {label}
              </button>
            ))}
          </div>

          {kind !== 'once' && (
            <p className="hint center">
              {kind === 'annual'
                ? amount > 0
                  ? `${formatHuf(Math.round(amount / 12))} a month${idx === 0 ? ` from ${monthLabel(date.slice(0, 7))}` : ''}, renews every year`
                  : 'Spread over 12 months and renewed every year, e.g. home insurance or a gym pass'
                : `Charged in full every month${idx === 0 ? ` from ${monthLabel(date.slice(0, 7))}` : ''} until you stop it`}
            </p>
          )}

          <input
            className="cat-search"
            type="search"
            placeholder={`Search ${state.categories.length} categories`}
            aria-label="Search categories"
            value={catQuery}
            onChange={(e) => setCatQuery(e.target.value)}
          />
          {catMode === 'search' && (
            <div className="chips">
              {state.categories
                .filter((c) => foldText(c.name).includes(foldText(catQuery.trim())))
                .map((c) => chip(c))}
              {!state.categories.some((c) => foldText(c.name).includes(foldText(catQuery.trim()))) && (
                <p className="hint">No category matches "{catQuery.trim()}". You can add one in Settings.</p>
              )}
            </div>
          )}
          {catMode === 'frequent' && (
            <>
              <div className="chip-title">Frequent</div>
              <div className="chips">
                {quick.map((id) => categoryById(id)).filter((c): c is Category => !!c).map((c) => chip(c))}
                <button className="chip more" onClick={() => setShowAll(true)}>
                  All categories…
                </button>
              </div>
            </>
          )}
          {catMode === 'all' &&
            SPEND_BUCKETS.map((b) => (
              <div key={b} className="chip-group">
                <div className="chip-title">{BUCKETS.find((x) => x.id === b)!.name}</div>
                <div className="chips">{state.categories.filter((c) => c.bucket === b).map((c) => chip(c))}</div>
              </div>
            ))}

          {annualHere && (
            <p className="warn">
              {categoryById(categoryId)?.name} already has an annual cost ({formatHuf(Math.round(annualHere.amount / 12))} a month). If
              this payment is that bill, it is already counted; adding it again counts it twice.
            </p>
          )}

          <div className="field-row">
            <label>
              {kind === 'once' ? 'Date' : 'Starts'}
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label>
              Note
              <input type="text" placeholder="Optional" value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
          </div>
          <div className="quick-dates">
            <button className={date === today ? 'on' : ''} onClick={() => setDate(today)}>
              Today
            </button>
            <button className={date === addDays(today, -1) ? 'on' : ''} onClick={() => setDate(addDays(today, -1))}>
              Yesterday
            </button>
          </div>

          {inSeries && (
            <label className="toggle">
              <input type="checkbox" checked={stopped} onChange={(e) => setStop(e.target.checked)} />
              <span>
                <strong>Stop after this {unit}</strong>
                <span className="hint">
                  {lastMonth ? `Last charge: ${monthLabel(lastMonth)}` : `Repeats every ${unit} until you stop it`}
                </span>
              </span>
            </label>
          )}

          {expense && (
            <button className="danger" onClick={remove}>
              {wasKind === 'once' ? 'Delete expense' : 'Delete from all months'}
            </button>
          )}
        </div>

        <div className="sheet-foot">
          <button className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={!valid} onClick={save}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
