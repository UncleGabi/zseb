const huf = new Intl.NumberFormat('hu-HU', { style: 'currency', currency: 'HUF', maximumFractionDigits: 0 })
const monthName = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' })
const monthShort = new Intl.DateTimeFormat('en-GB', { month: 'short', year: '2-digit' })
const dayName = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

const asDate = (ym: string) => new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, 1)

export const formatHuf = (n: number): string => huf.format(n)
export const monthLabel = (ym: string): string => monthName.format(asDate(ym))
export const monthLabelShort = (ym: string): string => monthShort.format(asDate(ym))
export const dayLabel = (date: string): string =>
  dayName.format(new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))))

/** Lower-case and strip accents, so "egeszseg" finds "Egészség". Keeps the length of precomposed text. */
export const foldText = (s: string): string => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

const compact = new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 })
/** Short form for tight tables: 450K, 1.2M. */
export const formatCompact = (n: number): string => compact.format(n)

/**
 * Parses an amount as typed: "12 500", "12500" or a sum like "12 500 + 3 400" (for split receipts).
 * Returns whole forints, or NaN when empty or invalid.
 */
export function parseAmount(text: string): number {
  const cleaned = text.replace(/[\s\u00a0]/g, '').replace(/,/g, '.')
  if (!/^\d+(\.\d+)?(\+\d+(\.\d+)?)*$/.test(cleaned)) return NaN
  return Math.round(cleaned.split('+').reduce((sum, part) => sum + Number(part), 0))
}

/** Re-formats amount input while typing: digit groups of three ("1 250 000"), sums kept as "a + b". */
export function formatAmountInput(text: string): string {
  const parts = text.replace(/[^\d+]/g, '').split('+')
  const grouped = parts.map((p) => p.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ' '))
  return grouped.join(' + ')
}
