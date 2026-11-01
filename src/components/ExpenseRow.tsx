import type { AppState, Occurrence } from '../domain'
import { dayLabel, formatHuf } from '../format'

export function ExpenseRow({ occ, state, onClick }: { occ: Occurrence; state: AppState; onClick: () => void }) {
  const { expense, part } = occ
  const category = state.categories.find((c) => c.id === expense.categoryId)
  const details = [
    dayLabel(occ.date),
    occ.recurring ? 'monthly' : '',
    part ? `annual${part.year > 0 ? ` · year ${part.year + 1}` : ''} · ${part.index}/${part.of}` : '',
    expense.note,
  ].filter(Boolean)
  return (
    <button className="row" onClick={onClick}>
      <span className={`dot ${category?.bucket ?? ''}`} />
      <span className="row-main">
        <span className="row-title">{category?.name || 'Unnamed category'}</span>
        <span className="row-sub">{details.join(' · ')}</span>
      </span>
      <span className="row-amount">{formatHuf(occ.amount)}</span>
    </button>
  )
}
