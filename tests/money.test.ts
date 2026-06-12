import { describe, expect, it } from 'vitest'
import { formatMoney, parseMoney } from '../app/utils/money'

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

describe('parseMoney', () => {
  it('parses dollar inputs to integer cents via string math', () => {
    expect(parseMoney('25000')).toBe(2_500_000)
    expect(parseMoney('$1,234.56')).toBe(123_456)
    expect(parseMoney('1234.5')).toBe(123_450)
    expect(parseMoney('0.07')).toBe(7) // the classic float trap: 0.07*100 !== 7
    expect(parseMoney(' $ 99 ')).toBe(9_900)
    expect(parseMoney('0')).toBe(0)
  })

  it('rejects malformed input', () => {
    expect(parseMoney('')).toBeNull()
    expect(parseMoney('abc')).toBeNull()
    expect(parseMoney('12.345')).toBeNull()
    expect(parseMoney('-5')).toBeNull()
    expect(parseMoney('1,23.45')).toBeNull()
  })
})
