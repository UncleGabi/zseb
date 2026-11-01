import { addMonths, monthOf, todayISO } from '../domain'
import { monthLabel } from '../format'
import { actions, useStore } from '../store'

export function MonthSwitcher() {
  const { selectedMonth } = useStore()
  const current = monthOf(todayISO())
  return (
    <div className="month-nav">
      <div className="month-switcher">
        <button aria-label="Previous month" onClick={() => actions.selectMonth(addMonths(selectedMonth, -1))}>
          ‹
        </button>
        <h1>{monthLabel(selectedMonth)}</h1>
        <button aria-label="Next month" onClick={() => actions.selectMonth(addMonths(selectedMonth, 1))}>
          ›
        </button>
      </div>
      {selectedMonth !== current && (
        <button className="today-pill" onClick={() => actions.selectMonth(current)}>
          {selectedMonth < current ? 'Back to this month ›' : '‹ Back to this month'}
        </button>
      )}
    </div>
  )
}
