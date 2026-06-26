import { describe, expect, it } from 'vitest'
import type { ExpenseLike } from '../app/utils/ledger-math'
import { ledgerSummary, spentByRoom } from '../app/utils/ledger-math'
import { formatDateOnly } from '../app/utils/date'

const exp = (over: Partial<ExpenseLike>): ExpenseLike => ({
  roomId: 'room-1',
  category: 'materials',
  amountCents: 100_000,
  ...over,
})

describe('ledgerSummary', () => {
  it('sums total, counts entries, and buckets by category', () => {
    const s = ledgerSummary([
      exp({ amountCents: 45_210 }),
      exp({ amountCents: 28_900, category: 'fixtures' }),
      exp({ amountCents: 80_000, category: 'labor' }),
    ])
    expect(s.totalCents).toBe(154_110)
    expect(s.count).toBe(3)
    expect(s.byCategory.materials).toBe(45_210)
    expect(s.byCategory.fixtures).toBe(28_900)
    expect(s.byCategory.labor).toBe(80_000)
    // Unused categories are present as zero (stable legend).
    expect(s.byCategory.permits).toBe(0)
    expect(s.byCategory.other).toBe(0)
  })

  it('is empty-safe with every category zeroed', () => {
    const s = ledgerSummary([])
    expect(s.totalCents).toBe(0)
    expect(s.count).toBe(0)
    expect(s.byCategory).toEqual({
      materials: 0,
      labor: 0,
      permits: 0,
      fixtures: 0,
      other: 0,
    })
  })
})

describe('spentByRoom', () => {
  it('buckets spend per room, ignoring expenses on unknown rooms', () => {
    const out = spentByRoom(
      [
        exp({ roomId: 'a', amountCents: 100_000 }),
        exp({ roomId: 'a', amountCents: 50_000 }),
        exp({ roomId: 'b', amountCents: 30_000 }),
        exp({ roomId: 'ghost', amountCents: 999 }),
      ],
      ['a', 'b'],
    )
    expect(out.a).toBe(150_000)
    expect(out.b).toBe(30_000)
    expect(out.ghost).toBeUndefined()
  })

  it('returns zero for rooms with no expenses', () => {
    expect(spentByRoom([], ['a', 'b'])).toEqual({ a: 0, b: 0 })
  })
})

describe('formatDateOnly', () => {
  it('formats a YYYY-MM-DD string without timezone math', () => {
    expect(formatDateOnly('2026-06-20')).toBe('Jun 20, 2026')
    expect(formatDateOnly('2026-01-05')).toBe('Jan 5, 2026')
    expect(formatDateOnly('2026-12-31')).toBe('Dec 31, 2026')
  })

  it('returns the raw input for a malformed date', () => {
    expect(formatDateOnly('not-a-date')).toBe('not-a-date')
    expect(formatDateOnly('2026-13-01')).toBe('2026-13-01') // month 13 → no label
  })
})
