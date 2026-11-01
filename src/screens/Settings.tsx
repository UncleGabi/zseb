import { useRef, useState } from 'react'
import { BUCKETS, SPEND_BUCKETS, configFor, daysBetween, todayISO, type BucketId, type Category, type SpendBucketId } from '../domain'
import { parseAmount } from '../format'
import { actions, useStore } from '../store'
import { MonthSwitcher } from '../components/MonthSwitcher'
import { ConfirmButton } from '../components/ConfirmButton'
import { showToast } from '../toast'
import { exportBackup } from '../backup'

const bucketName = (b: BucketId) => BUCKETS.find((x) => x.id === b)!.name

export function Settings() {
  return (
    <>
      <MonthSwitcher />
      <MonthSetup />
      <Opening />
      <Categories />
      <Backup />
    </>
  )
}

function MonthSetup() {
  const { state, selectedMonth } = useStore()
  const cfg = configFor(state, selectedMonth)
  // Remount the form when the month or its stored values change, so the inputs reset cleanly.
  const key = `${selectedMonth}:${cfg.salary}:${cfg.shares.fixed}:${cfg.shares.wellbeing}:${cfg.shares.investment}`
  return <MonthForm key={key} />
}

function MonthForm() {
  const { state, selectedMonth } = useStore()
  const cfg = configFor(state, selectedMonth)
  const [salary, setSalary] = useState(cfg.salary ? String(cfg.salary) : '')
  const [shares, setShares] = useState<Record<BucketId, string>>({
    fixed: String(cfg.shares.fixed),
    wellbeing: String(cfg.shares.wellbeing),
    investment: String(cfg.shares.investment),
  })

  const salaryNum = parseAmount(salary)
  const sharesNum = {
    fixed: Number(shares.fixed),
    wellbeing: Number(shares.wellbeing),
    investment: Number(shares.investment),
  }
  const sum = sharesNum.fixed + sharesNum.wellbeing + sharesNum.investment
  const valid = salaryNum >= 0 && Object.values(sharesNum).every((n) => n >= 0 && Number.isFinite(n)) && sum === 100

  const save = () => {
    actions.saveMonth(selectedMonth, { salary: salaryNum, shares: sharesNum })
    showToast('Month saved')
  }

  return (
    <section className="card form">
      <h2>Month setup</h2>
      <p className="hint">Later months without their own setup copy this one.</p>
      <label>
        Net salary (Ft)
        <input
          inputMode="numeric"
          placeholder="0"
          value={salary}
          onChange={(e) => setSalary(e.target.value)}
        />
      </label>
      <div className="field-row three">
        {BUCKETS.map((b) => (
          <label key={b.id}>
            {b.name} %
            <input
              inputMode="numeric"
              value={shares[b.id]}
              onChange={(e) => setShares({ ...shares, [b.id]: e.target.value })}
            />
          </label>
        ))}
      </div>
      {sum !== 100 && <p className="error">Shares add up to {sum}%, they must add up to 100%.</p>}
      <button className="primary" disabled={!valid || Number.isNaN(salaryNum)} onClick={save}>
        Save month
      </button>
    </section>
  )
}

function Opening() {
  const { state } = useStore()
  return (
    <section className="card form">
      <h2>Opening balances</h2>
      <p className="hint">Money already saved in a bucket when you start tracking. Added to the first month you set up.</p>
      {SPEND_BUCKETS.map((b) => (
        <OpeningField key={b} bucket={b} value={state.opening[b]} />
      ))}
    </section>
  )
}

function OpeningField({ bucket, value }: { bucket: SpendBucketId; value: number }) {
  const [text, setText] = useState(value ? String(value) : '')
  return (
    <label>
      {BUCKETS.find((b) => b.id === bucket)!.name} (Ft)
      <input
        inputMode="numeric"
        placeholder="0"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const n = text.trim() === '' ? 0 : parseAmount(text)
          if (Number.isNaN(n)) setText(value ? String(value) : '')
          else actions.setOpening(bucket, n)
        }}
      />
    </label>
  )
}

function Categories() {
  const { state } = useStore()
  const [name, setName] = useState('')
  const [bucket, setBucket] = useState<SpendBucketId>('fixed')

  const add = () => {
    if (!name.trim()) return
    actions.addCategory(name.trim(), bucket)
    showToast(`Category "${name.trim()}" added`)
    setName('')
  }
  const remove = (id: string, label: string) => {
    if (actions.deleteCategory(id)) showToast(`Category "${label}" deleted`)
    else showToast(`"${label}" still has expenses. Delete or move them first.`)
  }
  // Only two spend buckets, so "move" means switching to the other one.
  const move = (c: Category) => {
    const to: SpendBucketId = c.bucket === 'fixed' ? 'wellbeing' : 'fixed'
    actions.updateCategory(c.id, { bucket: to })
    showToast(`"${c.name}" moved to ${bucketName(to)}`, {
      label: 'Undo',
      run: () => actions.updateCategory(c.id, { bucket: c.bucket }),
    })
  }

  return (
    <section className="card form">
      <h2>Categories</h2>
      {SPEND_BUCKETS.map((b) => (
        <div key={b}>
          <div className="chip-title">{BUCKETS.find((x) => x.id === b)!.name}</div>
          {state.categories
            .filter((c) => c.bucket === b)
            .map((c) => (
              <div className="cat-row" key={c.id}>
                <CategoryName id={c.id} name={c.name} />
                <button
                  className="icon-btn"
                  aria-label={`Move ${c.name} to ${bucketName(c.bucket === 'fixed' ? 'wellbeing' : 'fixed')}`}
                  title={`Move to ${bucketName(c.bucket === 'fixed' ? 'wellbeing' : 'fixed')}`}
                  onClick={() => move(c)}
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                    <path
                      d="M3 6h11m-3-3 3 3-3 3M15 12H4m3-3-3 3 3 3"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <ConfirmButton
                  className="link danger-text"
                  ariaLabel={`Delete ${c.name}`}
                  confirmLabel="Delete?"
                  onConfirm={() => remove(c.id, c.name)}
                >
                  ✕
                </ConfirmButton>
              </div>
            ))}
        </div>
      ))}
      <div className="chip-title">New category</div>
      <div className="cat-new">
        <input placeholder="Name" aria-label="New category name" value={name} onChange={(e) => setName(e.target.value)} />
        <select value={bucket} onChange={(e) => setBucket(e.target.value as SpendBucketId)} aria-label="Bucket">
          {SPEND_BUCKETS.map((x) => (
            <option key={x} value={x}>
              {BUCKETS.find((y) => y.id === x)!.name}
            </option>
          ))}
        </select>
        <button className="primary small" disabled={!name.trim()} onClick={add}>
          Add
        </button>
      </div>
    </section>
  )
}

/** Edits locally and saves on blur, so a category can never be left with an empty name. */
function CategoryName({ id, name }: { id: string; name: string }) {
  const [text, setText] = useState(name)
  return (
    <input
      value={text}
      aria-label="Category name"
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const trimmed = text.trim()
        if (trimmed) actions.updateCategory(id, { name: trimmed })
        else setText(name)
      }}
    />
  )
}

function Backup() {
  const { state } = useStore()
  const fileRef = useRef<HTMLInputElement>(null)
  // A chosen backup file waits here until the user confirms replacing the current data.
  const [pending, setPending] = useState<{ name: string; text: string } | null>(null)

  const since = state.lastBackupAt ? daysBetween(state.lastBackupAt, todayISO()) : null

  const restore = () => {
    if (!pending) return
    try {
      actions.importJSON(pending.text)
      showToast('Backup restored')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not read the file')
    }
    setPending(null)
  }

  return (
    <section className="card form">
      <h2>Backup</h2>
      <p className="hint">
        Data lives only on this device ({state.expenses.length} expenses). On iPhone, Export opens the share sheet: choose
        “Save to Files” and keep it in iCloud Drive.
      </p>
      <p className={`backup-status ${since === null || since > 30 ? 'stale' : ''}`}>
        Last backup:{' '}
        <strong>{since === null ? 'never' : since === 0 ? 'today' : `${since} ${since === 1 ? 'day' : 'days'} ago`}</strong>
      </p>
      <div className="field-row">
        <button className="primary" onClick={exportBackup}>
          Export backup
        </button>
        <button className="secondary" onClick={() => fileRef.current?.click()}>
          Import backup
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) f.text().then((text) => setPending({ name: f.name, text }))
          e.target.value = ''
        }}
      />
      {pending && (
        <div className="confirm-box">
          <p>
            Replace all current data with <strong>{pending.name}</strong>? This cannot be undone.
          </p>
          <div className="field-row">
            <button className="secondary" onClick={() => setPending(null)}>
              Cancel
            </button>
            <button className="primary danger-bg" onClick={restore}>
              Replace data
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
