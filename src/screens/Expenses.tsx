import { useState } from 'react'
import { occurrencesIn, type Expense, type Occurrence } from '../domain'
import { dayLabel, formatHuf } from '../format'
import { useStore } from '../store'
import { MonthSwitcher } from '../components/MonthSwitcher'
import { ExpenseRow } from '../components/ExpenseRow'
import { CategoryPicker } from '../components/CategoryPicker'

export function Expenses({ onEdit }: { onEdit: (e?: Expense, month?: string) => void }) {
  const { state, selectedMonth } = useStore()
  const [filter, setFilter] = useState('all') // 'all' | 'bucket:<id>' | 'cat:<id>'

  const inFilter = ({ expense }: Occurrence) => {
    if (filter === 'all') return true
    const cat = state.categories.find((c) => c.id === expense.categoryId)
    if (filter.startsWith('bucket:')) return cat?.bucket === filter.slice(7)
    return expense.categoryId === filter.slice(4)
  }

  const items = occurrencesIn(state.expenses, selectedMonth)
    .filter(inFilter)
    .sort((a, b) => b.date.localeCompare(a.date))
  const total = items.reduce((sum, o) => sum + o.amount, 0)

  const days: { date: string; items: Occurrence[] }[] = []
  for (const o of items) {
    const last = days[days.length - 1]
    if (last && last.date === o.date) last.items.push(o)
    else days.push({ date: o.date, items: [o] })
  }

  return (
    <>
      <MonthSwitcher />
      <div className="toolbar">
        <CategoryPicker value={filter} onChange={setFilter} includeAll ariaLabel="Filter by category" />
        <strong>{formatHuf(total)}</strong>
      </div>

      {days.length === 0 && <p className="empty">Nothing here. Tap + to add an expense.</p>}
      {days.map((d) => (
        <div key={d.date}>
          <div className="day-head">{dayLabel(d.date)}</div>
          <div className="list">
            {d.items.map((o) => (
              <ExpenseRow key={o.expense.id} occ={o} state={state} onClick={() => onEdit(o.expense, selectedMonth)} />
            ))}
          </div>
        </div>
      ))}
    </>
  )
}
