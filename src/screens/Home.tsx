import { useState } from 'react'
import {
  BUCKETS,
  SPEND_BUCKETS,
  allocationOf,
  bucketSummary,
  configFor,
  goalReserved,
  monthOf,
  needsBackup,
  occurrencesIn,
  safeToSpend,
  todayISO,
  type BucketMonth,
  type Expense,
  type SpendBucketId,
} from '../domain'
import { formatAmountInput, formatHuf, monthLabel, parseAmount } from '../format'
import { actions, useStore } from '../store'
import { exportBackup, exportUnreadableCopy } from '../backup'
import { showToast } from '../toast'
import { MonthSwitcher } from '../components/MonthSwitcher'
import { ExpenseRow } from '../components/ExpenseRow'
import { BucketSheet } from '../components/BucketSheet'

interface Props {
  onEdit: (e?: Expense, month?: string) => void
  onSeeAll: () => void
}

export function Home({ onEdit, onSeeAll }: Props) {
  const { state, selectedMonth, loadProblem } = useStore()
  const [detail, setDetail] = useState<SpendBucketId | null>(null)
  const today = todayISO()
  const cfg = configFor(state, selectedMonth)
  const summary = bucketSummary(state, selectedMonth)
  const recent = occurrencesIn(state.expenses, selectedMonth)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)

  return (
    <>
      <MonthSwitcher />

      {loadProblem && (
        <section className="card alert">
          <strong>Your saved data could not be read</strong>
          <p className="hint">
            The app started empty, but a copy of the old data was kept on this device. Export it before you continue and send it
            for recovery, or import an earlier backup in Settings.
          </p>
          <div className="field-row">
            <button className="secondary" onClick={() => actions.dismissLoadProblem()}>
              Dismiss
            </button>
            <button className="primary" onClick={exportUnreadableCopy}>
              Export copy
            </button>
          </div>
        </section>
      )}

      {needsBackup(state, today) && (
        <button className="banner" onClick={exportBackup}>
          {state.lastBackupAt ? 'Your last backup is over a month old.' : 'Your data is only on this phone.'} Tap to back up now →
        </button>
      )}

      <MonthCheck key={selectedMonth} ym={selectedMonth} />

      {SPEND_BUCKETS.map((id) => (
        <BucketCard key={id} id={id} data={summary[id]} ym={selectedMonth} today={today} onOpen={() => setDetail(id)} />
      ))}

      <InvestmentCard
        share={cfg.shares.investment}
        amount={allocationOf(cfg, 'investment')}
        done={cfg.transferred}
        onToggle={(v) => actions.saveMonth(selectedMonth, { transferred: v })}
      />

      <div className="section-head">
        <h2>Latest expenses</h2>
        <button className="link" onClick={onSeeAll}>
          See all
        </button>
      </div>
      <div className="list">
        {recent.length === 0 && <p className="empty">No expenses this month yet. Tap + to add one.</p>}
        {recent.map((o) => (
          <ExpenseRow key={o.expense.id} occ={o} state={state} onClick={() => onEdit(o.expense, selectedMonth)} />
        ))}
      </div>

      {detail && <BucketSheet bucket={detail} ym={selectedMonth} onClose={() => setDetail(null)} />}
    </>
  )
}

/** Start-of-month step: confirm (or enter, on first use) the month's salary before trusting the numbers. */
function MonthCheck({ ym }: { ym: string }) {
  const { state } = useStore()
  const firstUse = Object.keys(state.months).length === 0
  const inherited = configFor(state, ym)
  const [salary, setSalary] = useState(inherited.salary ? formatAmountInput(String(inherited.salary)) : '')
  // Past months quietly inherit; only the current and future ones ask.
  if (state.months[ym] || (!firstUse && ym < monthOf(todayISO()))) return null

  const amount = parseAmount(salary)
  const confirm = () => {
    actions.saveMonth(ym, { salary: amount })
    showToast(`${monthLabel(ym)} is set up`)
  }
  return (
    <section className="card form month-check">
      <h2>{firstUse ? 'Welcome! Let’s set up your budget' : `Set up ${monthLabel(ym)}`}</h2>
      <p className="hint">
        {firstUse
          ? `Enter your net salary for ${monthLabel(ym)}. It is split 50 / 30 / 20; you can change the split and add opening balances in Settings.`
          : 'Confirm your net salary for this month. It is filled in from last month.'}
      </p>
      <label>
        Net salary (Ft)
        <input inputMode="numeric" placeholder="0" value={salary} onChange={(e) => setSalary(formatAmountInput(e.target.value))} />
      </label>
      <button className="primary" disabled={!(amount > 0)} onClick={confirm}>
        {firstUse ? 'Start' : 'Confirm salary'}
      </button>
    </section>
  )
}

function BucketCard({
  id,
  data,
  ym,
  today,
  onOpen,
}: {
  id: SpendBucketId
  data: BucketMonth
  ym: string
  today: string
  onOpen: () => void
}) {
  const { state } = useStore()
  const name = BUCKETS.find((b) => b.id === id)!.name
  const usedPct = data.allocation > 0 ? Math.min(100, Math.max(0, (data.spent / data.allocation) * 100)) : 0
  const safe = safeToSpend(state, id, ym, today)
  const goals = state.goals.filter((g) => g.bucket === id && !g.done)

  return (
    <section
      className={`card bucket ${id} clickable`}
      role="button"
      tabIndex={0}
      aria-label={`${name} details`}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onOpen()}
    >
      <div className="card-top">
        <span className="card-name">{name}</span>
        <span className="card-sub">
          {formatHuf(data.allocation)} / month <span className="chev">›</span>
        </span>
      </div>
      <div className={`big ${data.remaining < 0 ? 'neg' : ''}`}>{formatHuf(data.remaining)}</div>
      <div className="card-sub">
        remaining in total{safe.reserved > 0 ? ` · ${formatHuf(safe.reserved)} set aside for goals` : ''}
      </div>

      {safe.perDay !== null && (data.allocation > 0 || data.remaining !== 0) && (
        <div className={`safe ${safe.free <= 0 ? 'neg' : ''}`}>
          {safe.free > 0 ? (
            <>
              Safe to spend: <strong>≈ {formatHuf(safe.perDay)} a day</strong> for the next {safe.daysLeft}{' '}
              {safe.daysLeft === 1 ? 'day' : 'days'}
            </>
          ) : (
            <>Nothing left to spend freely this month{safe.reserved > 0 ? ' without touching your goals' : ''}</>
          )}
        </div>
      )}

      <div className="bar" aria-label={`${Math.round(usedPct)}% of this month's amount spent`}>
        <div className="bar-fill" style={{ width: `${usedPct}%` }} />
      </div>
      <div className="split">
        <div>
          <div className="card-sub">This month</div>
          <div className={`mid ${data.monthLeft < 0 ? 'neg' : ''}`}>{formatHuf(data.monthLeft)}</div>
          <div className="card-sub">left of {formatHuf(data.allocation)}</div>
        </div>
        <div>
          <div className="card-sub">Rolled over</div>
          <div className={`mid ${data.carriedIn < 0 ? 'neg' : ''}`}>{formatHuf(data.carriedIn)}</div>
          <div className="card-sub">from earlier months</div>
        </div>
      </div>
      {data.spent > 0 && (
        <div className="card-sub spent-split">
          Spent {formatHuf(data.spent)}: {formatHuf(data.committed)} recurring · {formatHuf(data.variable)} day-to-day
        </div>
      )}
      {goals.length > 0 && (
        <div className="goal-mini">
          {goals.map((g) => {
            const pct = Math.round((goalReserved(g, ym) / g.target) * 100)
            return (
              <div key={g.id} className="goal-mini-row">
                <span>{g.name}</span>
                <span className="goal-mini-bar">
                  <span style={{ width: `${pct}%` }} />
                </span>
                <span className="card-sub">{pct}%</span>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

function InvestmentCard({
  share,
  amount,
  done,
  onToggle,
}: {
  share: number
  amount: number
  done: boolean
  onToggle: (v: boolean) => void
}) {
  return (
    <section className="card bucket investment">
      <div className="card-top">
        <span className="card-name">Investment</span>
        <span className="card-sub">transfer to the separate account</span>
      </div>
      {share === 0 ? (
        <div className="card-sub no-transfer">No transfer this month (0%)</div>
      ) : (
        <label className="check">
          <input type="checkbox" checked={done} onChange={(e) => onToggle(e.target.checked)} />
          <span className="mid">{formatHuf(amount)}</span>
          <span className="card-sub">{done ? 'transferred' : 'not transferred yet'}</span>
        </label>
      )}
    </section>
  )
}
