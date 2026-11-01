import { describe, expect, it } from 'vitest'
import { formatAmountInput, parseAmount } from './format'

describe('amount input', () => {
  it('parses plain and grouped amounts', () => {
    expect(parseAmount('12500')).toBe(12_500)
    expect(parseAmount('1 250 000')).toBe(1_250_000)
    expect(parseAmount('1\u00a0250')).toBe(1_250)
  })

  it('adds up sums for split receipts', () => {
    expect(parseAmount('12 500 + 3 400')).toBe(15_900)
    expect(parseAmount('100+200+300')).toBe(600)
  })

  it('rejects empty or broken input', () => {
    expect(parseAmount('')).toBeNaN()
    expect(parseAmount('12 +')).toBeNaN()
    expect(parseAmount('abc')).toBeNaN()
  })

  it('groups digits while typing', () => {
    expect(formatAmountInput('1250000')).toBe('1 250 000')
    expect(formatAmountInput('12500+3400')).toBe('12 500 + 3 400')
    expect(formatAmountInput('12500 +')).toBe('12 500 + ')
    expect(formatAmountInput('007')).toBe('7')
    expect(formatAmountInput('12a3')).toBe('123')
  })
})
