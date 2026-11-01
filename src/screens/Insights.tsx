import { useState } from 'react'
import { addMonths, categoryTotals, monthOf, monthsBetween, periodStats, projectMonth, todayISO } from '../domain'
import { formatHuf, monthLabelShort } from '../format'
import { useStore } from '../store'
import { CategoryPicker } from '../components/CategoryPicker'

type Preset = 'this' | '3' | '6' | '12' | 'custom'

export function Insights() {
  const { state } = useStore()
  const thisMonth = monthOf(todayISO())
  const [target, setTarget] = useState('bucket:fixed') // 'bucket:<id>' | 'cat:<id>'
  const [preset, setPreset] = useState<Preset>('3')
  const [customFrom, setCustomFrom] = useState(addMonths(thisMonth, -2))
  const [customTo, setCustomTo] = useState(thisMonth)

  // "Last N" means the N complete months before the current one.
  let from = thisMonth
  let to = thisMonth
  if (preset === 'custom') {
    from = customFrom
    to = customTo
  } else if (preset !== 'this') {
    from = addMonths(thisMonth, -Number(preset))
    to = addMonths(thisMonth, -1)
  }
  const rangeValid = from <= to

  const ids = new Set(
    target.startsWith('bucket:')
      ? state.categories.filter((c) => c.bucket === target.slice(7)).map((c) => c.id)
      : [target.slice(4)],
  )
  const stats = rangeValid ? periodStats(state.expenses, ids, from, to) : null
  const peak = stats ? Math.max(1, ...stats.perMonth.map((m) => m.total)) : 1

  // Same-length period right before, for "vs previous" (only meaningful for complete months).
  const len = rangeValid ? monthsBetween(from, to) + 1 : 0
  const previous = rangeValid && preset !== 'this' ? periodStats(state.expenses, ids, addMonths(from, -len), addMonths(from, -1)) : null
  const change = stats && previous && previous.avgPerMonth > 0 ? (stats.avgPerMonth - previous.avgPerMonth) / previous.avgPerMonth : null

  const projection = preset === 'this' ? projectMonth(state.expenses, ids, todayISO()) : null
  const top = rangeValid && target.startsWith('bucket:') ? categoryTotals(state.expenses, ids, from, to).slice(0, 5) : []
  const topPeak = Math.max(1, ...top.map((r) => r.total))

  return (
    <>
      <div className="month-switcher">
        <h1>Insights</h1>
      </div>

      <div className="card form">
        <div className="field-label">Category</div>
        <CategoryPicker value={target} onChange={setTarget} ariaLabel="Category" />

        <div className="segmented" role="tablist">
          {(
            [
              ['this', 'Current'],
              ['3', 'Last 3'],
              ['6', 'Last 6'],
              ['12', 'Last 12'],
              ['custom', 'Custom'],
            ] as [Preset, string][]
          ).map(([id, label]) => (
            <button key={id} className={preset === id ? 'on' : ''} onClick={() => setPreset(id)}>
              {label}
            </button>
          ))}
        </div>

        {preset === 'custom' && (
          <div className="field-row">
            <label>
              From
              <input type="month" value={customFrom} onChange={(e) => e.target.value && setCustomFrom(e.target.value)} />
            </label>
            <label>
              To
              <input type="month" value={customTo} onChange={(e) => e.target.value && setCustomTo(e.target.value)} />
            </label>
          </div>
        )}
        <p className="hint">
          {rangeValid
            ? `${monthLabelShort(from)} – ${monthLabelShort(to)}${preset !== 'this' && preset !== 'custom' ? ' (full months, current month excluded)' : ''}`
            : 'The start month must not be after the end month.'}
        </p>
      </div>

      {stats && (
        <>
          <div className="stat-grid">
            <div className="card stat">
              <div className="card-sub">Average per month</div>
              <div className="big">{formatHuf(stats.avgPerMonth)}</div>
              {change !== null && (
                <div className={`delta ${change > 0 ? 'up' : 'down'}`}>
                  {change > 0 ? '▲' : '▼'} {Math.abs(Math.round(change * 100))}% vs previous {len} {len === 1 ? 'month' : 'months'}
                </div>
              )}
            </div>
            <div className="card stat">
              <div className="card-sub">Average per purchase</div>
              <div className="big">{formatHuf(stats.avgPerTransaction)}</div>
            </div>
            <div className="card stat">
              <div className="card-sub">Total</div>
              <div className="mid">{formatHuf(stats.total)}</div>
            </div>
            <div className="card stat">
              <div className="card-sub">Purchases · months</div>
              <div className="mid">
                {stats.count} · {stats.months}
              </div>
            </div>
          </div>

          {projection && (
            <div className="card projection">
              <div className="card-sub">Projected for {monthLabelShort(thisMonth)}</div>
              <div className="mid">{formatHuf(projection.projected)}</div>
              <div className="card-sub">
                {formatHuf(projection.soFar)} so far; recurring costs counted in full, day-to-day spending extrapolated to month end
              </div>
            </div>
          )}

          {top.length > 0 && (
            <>
              <div className="section-head">
                <h2>Where the money went</h2>
              </div>
              <div className="list bars">
                {top.map((r) => (
                  <div className="bar-row wide" key={r.categoryId}>
                    <span className="bar-label">{state.categories.find((c) => c.id === r.categoryId)?.name}</span>
                    <span className="bar-track">
                      <span className="bar-fill-h" style={{ width: `${(r.total / topPeak) * 100}%` }} />
                    </span>
                    <span className="bar-value">{formatHuf(r.total)}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="section-head">
            <h2>By month</h2>
          </div>
          <div className="list bars">
            {[...stats.perMonth].reverse().map((m) => (
              <div className="bar-row" key={m.ym}>
                <span className="bar-label">{monthLabelShort(m.ym)}</span>
                <span className="bar-track">
                  <span className="bar-fill-h" style={{ width: `${(m.total / peak) * 100}%` }} />
                </span>
                <span className="bar-value">{formatHuf(m.total)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  )
}
