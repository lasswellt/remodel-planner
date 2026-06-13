import { describe, expect, it } from 'vitest'
import { Timestamp } from 'firebase/firestore'
import {
  computeExpectedAt,
  hasArrived,
  isOverdue,
  LONG_LEAD_SUGGESTIONS,
  todayDateOnly,
} from '../app/utils/selection-math'
import { RoomType } from '../app/models'

describe('computeExpectedAt', () => {
  const orderedAt = Timestamp.fromMillis(Date.UTC(2026, 5, 1, 12, 0, 0)) // 2026-06-01T12:00Z

  it('adds the lead time as calendar days (UTC, timezone-free)', () => {
    expect(computeExpectedAt(orderedAt, 30)).toBe('2026-07-01')
    expect(computeExpectedAt(orderedAt, 45)).toBe('2026-07-16')
    expect(computeExpectedAt(orderedAt, 0)).toBe('2026-06-01')
  })

  it('crosses month and year boundaries correctly', () => {
    const dec = Timestamp.fromMillis(Date.UTC(2026, 11, 20, 0, 0, 0)) // 2026-12-20
    expect(computeExpectedAt(dec, 30)).toBe('2027-01-19')
  })
})

describe('isOverdue', () => {
  it('is overdue when expected in the past and not arrived', () => {
    expect(isOverdue('2026-06-01', 'ordered', '2026-06-12')).toBe(true)
  })
  it('is not overdue when expected in the future', () => {
    expect(isOverdue('2026-06-20', 'ordered', '2026-06-12')).toBe(false)
  })
  it('is never overdue once delivered or installed', () => {
    expect(isOverdue('2026-06-01', 'delivered', '2026-06-12')).toBe(false)
    expect(isOverdue('2026-06-01', 'installed', '2026-06-12')).toBe(false)
  })
  it('is not overdue without an expected date', () => {
    expect(isOverdue(undefined, 'ordered', '2026-06-12')).toBe(false)
  })
  it('is not overdue exactly on the expected day', () => {
    expect(isOverdue('2026-06-12', 'ordered', '2026-06-12')).toBe(false)
  })
})

describe('hasArrived', () => {
  it('is true for delivered/installed only', () => {
    expect(hasArrived('delivered')).toBe(true)
    expect(hasArrived('installed')).toBe(true)
    expect(hasArrived('ordered')).toBe(false)
    expect(hasArrived('considering')).toBe(false)
  })
})

describe('todayDateOnly', () => {
  it('formats local Y-M-D zero-padded', () => {
    expect(todayDateOnly(new Date(2026, 5, 12))).toBe('2026-06-12')
    expect(todayDateOnly(new Date(2026, 0, 3))).toBe('2026-01-03')
  })
})

describe('LONG_LEAD_SUGGESTIONS', () => {
  it('covers every room type with at least 3 items', () => {
    for (const type of RoomType.options) {
      expect(LONG_LEAD_SUGGESTIONS[type].length).toBeGreaterThanOrEqual(3)
    }
  })
  it('seeds kitchens with cabinets + appliances', () => {
    expect(LONG_LEAD_SUGGESTIONS.kitchen).toContain('Cabinets')
    expect(LONG_LEAD_SUGGESTIONS.kitchen).toContain('Appliances')
  })
})
