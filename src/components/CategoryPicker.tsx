import { useMemo } from 'react'
import { BUCKETS, SPEND_BUCKETS } from '../domain'
import { useStore } from '../store'
import { Combobox, type ComboOption } from './Combobox'

/**
 * Searchable picker over buckets and categories. Values: 'all' (when includeAll),
 * 'bucket:<bucket id>' or 'cat:<category id>'.
 */
export function CategoryPicker({
  value,
  onChange,
  includeAll = false,
  ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  includeAll?: boolean
  ariaLabel: string
}) {
  const { state } = useStore()
  const options = useMemo<ComboOption[]>(() => {
    const out: ComboOption[] = includeAll ? [{ value: 'all', label: 'All categories' }] : []
    for (const b of SPEND_BUCKETS) {
      const group = BUCKETS.find((x) => x.id === b)!.name
      out.push({ value: `bucket:${b}`, label: `All ${group.toLowerCase()}`, group, dot: b })
      for (const c of state.categories.filter((c) => c.bucket === b)) {
        out.push({ value: `cat:${c.id}`, label: c.name, group, dot: b })
      }
    }
    return out
  }, [state.categories, includeAll])

  return <Combobox value={value} options={options} onChange={onChange} ariaLabel={ariaLabel} />
}
