import { describe, expect, it } from 'vitest'
import type { BudgetLineLike } from '../app/utils/budget-math'
import {
  categoryBreakdown,
  estimateByRoom,
  projectBudget,
  roomBudget,
  typicalRange,
} from '../app/utils/budget-math'
import { csvField, toCsv } from '../app/utils/csv'

const line = (over: Partial<BudgetLineLike>): BudgetLineLike => ({
  roomId: 'room-1',
  category: 'materials',
  estimateCents: 100_000,
  ...over,
})

describe('roomBudget', () => {
  it('sums estimate, actual, variance and flags over-budget', () => {
    const r = roomBudget([
      line({ estimateCents: 100_000, actualCents: 120_000 }),
      line({ estimateCents: 50_000, actualCents: 40_000, category: 'labor' }),
    ])
    expect(r.estimateCents).toBe(150_000)
    expect(r.actualCents).toBe(160_000)
    expect(r.varianceCents).toBe(10_000) // (120k-100k) + (40k-50k) = +10k
    expect(r.remainingCents).toBe(-10_000)
    expect(r.overBudget).toBe(true)
    expect(r.lineCount).toBe(2)
  })

  it('ignores actual when absent (estimate-only line)', () => {
    const r = roomBudget([line({ estimateCents: 80_000 })])
    expect(r.actualCents).toBe(0)
    expect(r.varianceCents).toBe(0)
    expect(r.remainingCents).toBe(80_000)
    expect(r.overBudget).toBe(false)
  })

  it('is empty-safe', () => {
    expect(roomBudget([])).toEqual({
      estimateCents: 0,
      actualCents: 0,
      varianceCents: 0,
      remainingCents: 0,
      overBudget: false,
      lineCount: 0,
    })
  })
})

describe('projectBudget', () => {
  it('computes committed, contingency, remaining', () => {
    const p = projectBudget(
      [line({ estimateCents: 200_000 }), line({ estimateCents: 100_000, category: 'labor' })],
      500_000,
      15,
    )
    expect(p.committedCents).toBe(300_000)
    expect(p.contingencyCents).toBe(45_000) // 15% of 300k
    expect(p.committedWithContingencyCents).toBe(345_000)
    expect(p.remainingCents).toBe(200_000) // 500k budget − 300k committed
    expect(p.overBudget).toBe(false)
  })

  it('rounds contingency to whole cents', () => {
    // 15% of 33_333 = 4999.95 → 5000
    const p = projectBudget([line({ estimateCents: 33_333 })], 100_000, 15)
    expect(p.contingencyCents).toBe(5000)
    expect(Number.isInteger(p.contingencyCents)).toBe(true)
  })

  it('flags over-budget when estimates exceed the total', () => {
    const p = projectBudget([line({ estimateCents: 600_000 })], 500_000, 15)
    expect(p.remainingCents).toBe(-100_000)
    expect(p.overBudget).toBe(true)
  })
})

describe('categoryBreakdown', () => {
  it('totals every category with zeros for unused ones', () => {
    const b = categoryBreakdown([
      line({ category: 'materials', estimateCents: 100_000, actualCents: 90_000 }),
      line({ category: 'materials', estimateCents: 50_000 }),
      line({ category: 'permits', estimateCents: 20_000 }),
    ])
    expect(b.materials).toEqual({ estimateCents: 150_000, actualCents: 90_000 })
    expect(b.permits).toEqual({ estimateCents: 20_000, actualCents: 0 })
    expect(b.labor).toEqual({ estimateCents: 0, actualCents: 0 })
  })
})

describe('estimateByRoom', () => {
  it('buckets estimates per room per category, ignoring unknown rooms', () => {
    const e = estimateByRoom(
      [
        line({ roomId: 'a', category: 'materials', estimateCents: 100_000 }),
        line({ roomId: 'a', category: 'labor', estimateCents: 50_000 }),
        line({ roomId: 'b', category: 'materials', estimateCents: 30_000 }),
        line({ roomId: 'ghost', estimateCents: 999 }),
      ],
      ['a', 'b'],
    )
    expect(e.a!.materials).toBe(100_000)
    expect(e.a!.labor).toBe(50_000)
    expect(e.b!.materials).toBe(30_000)
    expect(e.ghost).toBeUndefined()
  })
})

describe('typicalRange', () => {
  it('returns a room-specific range in cents', () => {
    const r = typicalRange('kitchen', 'materials')
    expect(r).toEqual([800_000, 2_500_000])
  })
  it('falls back to a generic range for an unlisted room/category combo', () => {
    expect(typicalRange('bedroom', 'permits')).not.toBeNull()
  })
  it('returns null for an un-anchored category', () => {
    expect(typicalRange('kitchen', 'other')).toBeNull()
  })
})

describe('csv', () => {
  it('quotes fields with commas, quotes, or newlines and doubles quotes', () => {
    expect(csvField('plain')).toBe('plain')
    expect(csvField('a,b')).toBe('"a,b"')
    expect(csvField('say "hi"')).toBe('"say ""hi"""')
    expect(csvField('line\nbreak')).toBe('"line\nbreak"')
    expect(csvField(null)).toBe('')
    expect(csvField(1255)).toBe('1255')
  })

  it('builds CRLF rows with a header line', () => {
    const csv = toCsv(['Room', 'Item', 'Estimate'], [['Kitchen', 'Cabinets, oak', '1255.00']])
    expect(csv).toBe('Room,Item,Estimate\r\nKitchen,"Cabinets, oak",1255.00')
  })
})
