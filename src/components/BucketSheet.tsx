import { useState } from 'react'
import {
  BUCKETS,
  bucketTimeline,
  categoryTotals,
  goalPlan,
  goalReserved,
  monthOf,
  safeToSpend,
  todayISO,
  type Goal,
  type SpendBucketId,
} from '../domain'
import { formatAmountInput, formatCompact, formatHuf, monthLabel, monthLabelShort, parseAmount } from '../format'
import { actions, useStore } from '../store'
import { showToast } from '../toast'
import { ConfirmButton } from './ConfirmButton'

/** Everything behind one bucket card: goals, where the money went this month, and the rollover history. */
export function BucketSheet({ bucket, ym, onClose }: { bucket: SpendBucketId; ym: string; onClose: () => void }) {
  const { state } = useStore()
  // undefined = list view, null = new goal, Goal = editing that goal
  const [editing, setEditing] = useState<Goal | null | undefined>(undefined)
  const name = BUCKETS.find((b) => b.id === bucket)!.name
  const today = todayISO()
  const safe = safeToSpend(state, bucket, ym, today)
  const timeline = bucketTimeline(state, ym)
  const history = timeline.slice(-12).reverse()
  const current = timeline[timeline.length - 1]?.buckets[bucket]
  const ids = new Set(state.categories.filter((c) => c.bucket === bucket).map((c) => c.id))
  const byCategory = categoryTotals(state.expenses, ids, ym, ym)
  const peak = Math.max(1, ...byCategory.map((r) => r.total))
  const goals = state.goals.filter((g) => g.bucket === bucket).sort((a, b) => Number(!!a.done) - Number(!!b.done))

  return (
    <div className="backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={`${name} details`} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-body">
          <div className="sheet-head">
            <strong>
              {name} · {monthLabel(ym)}
            </strong>
          </div>

          {editing !== undefined ? (
            <GoalForm goal={editing} bucket={bucket} ym={ym} onDone={() => setEditing(undefined)} />
          ) : (
            <>
              <div className="stat-grid compact">
                <div className="card stat">
                  <div className="card-sub">Remaining</div>
                  <div className={`mid ${(current?.remaining ?? 0) < 0 ? 'neg' : ''}`}>{formatHuf(current?.remaining ?? 0)}</div>
                </div>
                <div className="card stat">
                  <div className="card-sub">Free after goals</div>
                  <div className={`mid ${safe.free < 0 ? 'neg' : ''}`}>{formatHuf(safe.free)}</div>
                </div>
              </div>

              <div className="section-head">
                <h2>Savings goals</h2>
                <button className="link" onClick={() => setEditing(null)}>
                  + Add goal
                </button>
              </div>
              {goals.length === 0 && (
                <p className="hint">
                  Saving up for something, like a trip in May? Add a goal and the app sets money aside for it every month, so the
                  "safe to spend" figure leaves it alone.
                </p>
              )}
              {safe.free < 0 && safe.reserved > 0 && (
                <p className="warn">This bucket does not have enough money to cover what your goals have set aside.</p>
              )}
              <div className="list">
                {goals.map((g) => {
                  const reserved = goalReserved(g, ym)
                  const pct = g.done ? 100 : Math.round((reserved / g.target) * 100)
                  return (
                    <button key={g.id} className={`row goal-row ${g.done ? 'done' : ''}`} onClick={() => setEditing(g)}>
                      <span className="row-main">
                        <span className="row-title">{g.name}</span>
                        <span className="goal-bar">
                          <span style={{ width: `${pct}%` }} />
                        </span>
                        <span className="row-sub">
                          {g.done
                            ? 'Done'
                            : reserved >= g.target
                              ? 'Fully set aside, ready to spend'
                              : `${formatHuf(goalPlan(g).perMonth)} a month until ${monthLabel(g.targetMonth)}`}
                        </span>
                      </span>
                      <span className="row-amount">
                        {g.done ? formatHuf(g.target) : `${formatHuf(reserved)} / ${formatCompact(g.target)}`}
                      </span>
                    </button>
                  )
                })}
              </div>

              <div className="section-head">
                <h2>Spent in {monthLabel(ym)}</h2>
              </div>
              <div className="list bars">
                {byCategory.length === 0 && <p className="empty">Nothing spent yet.</p>}
                {byCategory.map((r) => (
                  <div className="bar-row wide" key={r.categoryId}>
                    <span className="bar-label">{state.categories.find((c) => c.id === r.categoryId)?.name}</span>
                    <span className="bar-track">
                      <span className={`bar-fill-h ${bucket}`} style={{ width: `${(r.total / peak) * 100}%` }} />
                    </span>
                    <span className="bar-value">{formatHuf(r.total)}</span>
                  </div>
                ))}
              </div>

              <div className="section-head">
                <h2>Rollover history</h2>
              </div>
              {history.length === 0 ? (
                <p className="hint">No months set up yet.</p>
              ) : (
                <div className="list">
                  <table className="history">
                    <thead>
                      <tr>
                        <th>Month</th>
                        <th>Carried in</th>
                        <th>Budget</th>
                        <th>Spent</th>
                        <th>Left</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map(({ ym: m, buckets }) => {
                        const r = buckets[bucket]
                        return (
                          <tr key={m}>
                            <td>{monthLabelShort(m)}</td>
                            <td className={r.carriedIn < 0 ? 'neg' : ''}>{formatCompact(r.carriedIn)}</td>
                            <td>{formatCompact(r.allocation)}</td>
                            <td>{formatCompact(r.spent)}</td>
                            <td className={r.remaining < 0 ? 'neg' : ''}>
                              <strong>{formatCompact(r.remaining)}</strong>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  <p className="hint table-note">Amounts in Ft. Left = carried in + budget − spent, and carries into the next month.</p>
                </div>
              )}
            </>
          )}
        </div>

        {editing === undefined && (
          <div className="sheet-foot single">
            <button className="secondary" onClick={onClose}>
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function GoalForm({ goal, bucket, ym, onDone }: { goal: Goal | null; bucket: SpendBucketId; ym: string; onDone: () => void }) {
  const thisMonth = monthOf(todayISO())
  const [name, setName] = useState(goal?.name ?? '')
  const [targetText, setTargetText] = useState(goal ? formatAmountInput(String(goal.target)) : '')
  const startMonth = goal?.startMonth ?? (ym > thisMonth ? ym : thisMonth)
  const [targetMonth, setTargetMonth] = useState(goal?.targetMonth ?? '')
  const target = parseAmount(targetText)
  const valid = !!name.trim() && target > 0 && !!targetMonth && targetMonth >= startMonth
  const plan = valid ? goalPlan({ id: '', name, bucket, target, startMonth, targetMonth }) : null

  const save = () => {
    actions.saveGoal({ id: goal?.id, name: name.trim(), bucket, target, startMonth, targetMonth, done: goal?.done })
    showToast(goal ? 'Goal saved' : `Goal "${name.trim()}" added`)
    onDone()
  }

  return (
    <div className="form goal-form">
      <h2>{goal ? 'Edit goal' : 'New savings goal'}</h2>
      <label>
        What for
        <input type="text" placeholder="e.g. May trip" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="field-row">
        <label>
          Amount (Ft)
          <input inputMode="numeric" placeholder="0" value={targetText} onChange={(e) => setTargetText(formatAmountInput(e.target.value))} />
        </label>
        <label>
          Needed in
          <input type="month" min={startMonth} value={targetMonth} onChange={(e) => setTargetMonth(e.target.value)} />
        </label>
      </div>
      <p className="hint">
        {plan
          ? `${formatHuf(plan.perMonth)} a month is set aside from ${monthLabel(startMonth)} to ${monthLabel(targetMonth)} (${plan.months} ${plan.months === 1 ? 'month' : 'months'}).`
          : targetMonth && targetMonth < startMonth
            ? `The month must be ${monthLabel(startMonth)} or later.`
            : 'Money is set aside in equal parts every month until then.'}
      </p>

      <div className="field-row">
        <button className="secondary" onClick={onDone}>
          Cancel
        </button>
        <button className="primary" disabled={!valid} onClick={save}>
          Save
        </button>
      </div>

      {goal && (
        <>
          <button
            className="secondary"
            onClick={() => {
              actions.saveGoal({ ...goal, done: !goal.done })
              showToast(goal.done ? 'Goal reopened' : `"${goal.name}" marked as done; its money is free to spend again`)
              onDone()
            }}
          >
            {goal.done ? 'Reopen goal' : 'Mark as done (money spent or no longer needed)'}
          </button>
          <ConfirmButton
            className="danger"
            confirmLabel="Tap again to delete this goal"
            onConfirm={() => {
              actions.deleteGoal(goal.id)
              showToast(`Goal "${goal.name}" deleted`, { label: 'Undo', run: () => actions.saveGoal(goal) })
              onDone()
            }}
          >
            Delete goal
          </ConfirmButton>
        </>
      )}
    </div>
  )
}
