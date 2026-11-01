import { Fragment, useEffect, useId, useMemo, useRef, useState } from 'react'

export interface ComboOption {
  value: string
  label: string
  /** Options sharing a group are listed under one heading; keep them adjacent. */
  group?: string
  /** Extra class for a coloured dot in front of the label (e.g. the bucket id). */
  dot?: string
}

import { foldText as fold } from '../format'

/**
 * A select box you can type into: focusing it lists every option, typing filters them
 * (by label or group name), arrow keys + Enter pick one, Escape cancels.
 */
export function Combobox({
  value,
  options,
  onChange,
  ariaLabel,
  placeholder = 'Type to search',
}: {
  value: string
  options: ComboOption[]
  onChange: (value: string) => void
  ariaLabel: string
  placeholder?: string
}) {
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const selected = options.find((o) => o.value === value)
  const q = fold(query.trim())
  const matches = useMemo(
    () => (q ? options.filter((o) => fold(o.label).includes(q) || (o.group && fold(o.group).includes(q))) : options),
    [options, q],
  )

  useEffect(() => {
    if (open) listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  const show = () => {
    if (open) return
    setQuery('')
    setActive(Math.max(0, options.findIndex((o) => o.value === value)))
    setOpen(true)
  }
  const close = () => {
    setOpen(false)
    setQuery('')
  }
  const choose = (o: ComboOption) => {
    onChange(o.value)
    close()
    inputRef.current?.blur()
  }

  return (
    <div className="combo">
      <input
        ref={inputRef}
        className="combo-input"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={open && matches[active] ? `${id}-${active}` : undefined}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        value={open ? query : (selected?.label ?? '')}
        placeholder={selected?.label ?? placeholder}
        onFocus={show}
        onClick={show}
        onBlur={close}
        onChange={(e) => {
          setQuery(e.target.value)
          setActive(0)
          setOpen(true)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            if (!open) show()
            else setActive((a) => Math.min(a + 1, matches.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((a) => Math.max(a - 1, 0))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            if (open && matches[active]) choose(matches[active])
          } else if (e.key === 'Escape') {
            close()
            inputRef.current?.blur()
          }
        }}
      />
      {open && (
        <ul ref={listRef} id={`${id}-list`} role="listbox" aria-label={ariaLabel} className="combo-list">
          {matches.length === 0 && <li className="combo-empty">No match for "{query.trim()}"</li>}
          {matches.map((o, i) => (
            <Fragment key={o.value}>
              {o.group && o.group !== matches[i - 1]?.group && (
                <li role="presentation" className="combo-group">
                  {o.group}
                </li>
              )}
              <li
                id={`${id}-${i}`}
                data-index={i}
                role="option"
                aria-selected={o.value === value}
                className={`combo-option ${i === active ? 'active' : ''}`}
                // Keep focus in the input so the click below still lands before the list closes.
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(o)}
              >
                {o.dot && <span className={`dot ${o.dot}`} />}
                <Highlight text={o.label} q={q} />
              </li>
            </Fragment>
          ))}
        </ul>
      )}
    </div>
  )
}

function Highlight({ text, q }: { text: string; q: string }) {
  const i = q ? fold(text).indexOf(q) : -1
  if (i < 0) return <span>{text}</span>
  return (
    <span>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </span>
  )
}
