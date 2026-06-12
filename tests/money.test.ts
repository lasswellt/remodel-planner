import { describe, expect, it } from 'vitest'
import { formatMoney } from '../app/utils/money'

describe('formatMoney', () => {
  it('formats integer cents as USD', () => {
    expect(formatMoney(0)).toBe('$0.00')
    expect(formatMoney(1)).toBe('$0.01')
    expect(formatMoney(12345)).toBe('$123.45')
    expect(formatMoney(100000)).toBe('$1,000.00')
  })

  it('rejects non-integer cents (no float currency math)', () => {
    expect(() => formatMoney(12.5)).toThrow()
  })
})
