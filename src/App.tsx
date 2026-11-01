import { Fragment, useRef, useState } from 'react'
import type { Expense } from './domain'
import { Home } from './screens/Home'
import { Expenses } from './screens/Expenses'
import { Insights } from './screens/Insights'
import { Settings } from './screens/Settings'
import { ExpenseSheet } from './components/ExpenseSheet'
import { Snackbar } from './components/Snackbar'
import { addMonths } from './domain'
import { actions, useStore } from './store'
import { useUpdateReady } from './update'

type Tab = 'home' | 'expenses' | 'insights' | 'settings'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: 'Home', icon: '◐' },
  { id: 'expenses', label: 'Expenses', icon: '☰' },
  { id: 'insights', label: 'Insights', icon: '▤' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
]

export interface SheetState {
  open: boolean
  expense?: Expense
  /** The month the expense was opened from; tells which renewal year of an annual cost is being edited. */
  month?: string
}

export function App() {
  const [tab, setTab] = useState<Tab>('home')
  const [sheet, setSheet] = useState<SheetState>({ open: false })
  const edit = (expense?: Expense, month?: string) => setSheet({ open: true, expense, month })
  const { selectedMonth } = useStore()
  const applyUpdate = useUpdateReady()

  // Horizontal swipe changes the month on the screens that show one.
  const touch = useRef<{ x: number; y: number } | null>(null)
  const swipeable = tab !== 'insights' && !sheet.open
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    touch.current = swipeable && e.touches.length === 1 && !(e.target as HTMLElement).closest('input, select, .combo-list') ? { x: t.clientX, y: t.clientY } : null
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touch.current
    touch.current = null
    if (!start) return
    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 2) actions.selectMonth(addMonths(selectedMonth, dx < 0 ? 1 : -1))
  }

  return (
    <div className="app">
      {applyUpdate && (
        <div className="update-bar" role="status">
          <span>A new version of the app is ready.</span>
          <button onClick={applyUpdate}>Update</button>
        </div>
      )}
      <main className="screen" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {tab === 'home' && <Home onEdit={edit} onSeeAll={() => setTab('expenses')} />}
        {tab === 'expenses' && <Expenses onEdit={edit} />}
        {tab === 'insights' && <Insights />}
        {tab === 'settings' && <Settings />}
      </main>

      <nav className="tabbar">
        {TABS.map((t, i) => (
          <Fragment key={t.id}>
            {i === 2 && (
              <button className="add-tab" aria-label="Add expense" onClick={() => edit()}>
                {/* Drawn rather than a "+" character: glyphs sit off-centre differently in every font. */}
                <span>
                  <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
                    <path d="M11 3v16M3 11h16" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
                  </svg>
                </span>
              </button>
            )}
            <button className={t.id === tab ? 'active' : ''} onClick={() => setTab(t.id)}>
              <span className="tab-icon">{t.icon}</span>
              {t.label}
            </button>
          </Fragment>
        ))}
      </nav>

      <Snackbar />

      {sheet.open && <ExpenseSheet expense={sheet.expense} month={sheet.month} onClose={() => setSheet({ open: false })} />}
    </div>
  )
}
